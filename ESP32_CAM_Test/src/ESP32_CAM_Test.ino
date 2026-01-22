#include "esp_camera.h"
#include <WiFi.h>
#include "esp_timer.h"
#include "img_converters.h"
#include "Arduino.h"
#include "fb_gfx.h"
#include "soc/soc.h" //disable brownout problems
#include "soc/rtc_cntl_reg.h"  //disable brownout problems
#include "esp_http_server.h"

// ===================
// Select Camera Model
// ===================
// The AI Thinker model supports both OV2640 and OV3660 sensors.
// They share the same pinout on this board.
#define CAMERA_MODEL_AI_THINKER // Has PSRAM
#include "camera_pins.h"

// ===========================
// Enter your WiFi Credentials
// ===========================
const char* ssid = "IRIS_FOUNDATION_JIO";
const char* password = "iris916313";

bool ledOn = false;

void startCameraServer();

// HTML for the Main Page
static const char PROLOGUE[] PROGMEM = 
  "<!DOCTYPE html><html><head>"
  "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
  "<title>ESP32-CAM Stream</title>"
  "<style>"
  "body { font-family: sans-serif; text-align: center; margin: 0; padding: 0; background-color: #333; color: white; }"
  "h1 { margin: 10px; }"
  ".container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }"
  "button { padding: 15px 40px; font-size: 18px; cursor: pointer; background-color: #4CAF50; color: white; border: none; border-radius: 5px; }"
  "button:hover { background-color: #45a049; }"
  "button:active { background-color: #3d8b40; }"
  "</style>"
  "</head><body>"
  "<div class=\"container\">"
  "<h1>Capture Photo</h1>"
  "<button onclick=\"captureWithFlash()\">Take Photo</button>"
  "</div>"
  "<script>"
  "async function captureWithFlash() {"
  "  try {"
  "    console.log('Turning on flash...');"
  "    await fetch('/light?toggle=1');"
  "    await new Promise(resolve => setTimeout(resolve, 300));"
  "    console.log('Opening capture window...');"
  "    window.open('/capture', '_blank');"
  "    setTimeout(() => {"
  "      console.log('Turning off flash...');"
  "      fetch('/light?toggle=1');"
  "    }, 500);"
  "  } catch(err) {"
  "    console.error('Error:', err);"
  "    alert('Failed to capture photo: ' + err.message);"
  "  }"
  "}"
  "</script>"
  "</body></html>";

  // Stream response definitions
  static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=frame";
  static const char _STREAM_BOUNDARY[] = "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";
  static const char _STREAM_PART[] = "\r\n--frame\r\n";
  static const size_t _STREAM_PART_LEN = sizeof(_STREAM_PART) - 1;

static esp_err_t index_handler(httpd_req_t *req){
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, (const char *)PROLOGUE, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t stream_handler(httpd_req_t *req){
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char part_buf[64];

  Serial.println("Stream handler called");
  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if(res != ESP_OK){
    Serial.println("Failed to set content type");
    return res;
  }

  while(true){
    int retry_count = 0;
    fb = NULL;
    
    // Retry frame capture up to 3 times if it fails (handles I2C glitches)
    while(!fb && retry_count < 3) {
      fb = esp_camera_fb_get();
      if (!fb) {
        retry_count++;
        delayMicroseconds(100);  // Small delay to let I2C settle
      }
    }
    
    if (!fb) {
      Serial.println("Camera capture failed after 3 retries");
      res = ESP_FAIL;
    } else {
      if(fb->format != PIXFORMAT_JPEG){
        bool jpeg_converted = frame2jpg(fb, 80, &_jpg_buf, &_jpg_buf_len);
        esp_camera_fb_return(fb);
        fb = NULL;
        if(!jpeg_converted){
          Serial.println("JPEG compression failed");
          res = ESP_FAIL;
        }
      } else {
        _jpg_buf_len = fb->len;
        _jpg_buf = fb->buf;
      }
    }
    if(res == ESP_OK){
      size_t hlen = snprintf((char *)part_buf, 64, _STREAM_BOUNDARY, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, (const char *)part_buf, hlen);
    }
    if(res == ESP_OK){
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }
    if(res == ESP_OK){
      res = httpd_resp_send_chunk(req, _STREAM_PART, _STREAM_PART_LEN);
    }
    if(fb){
      esp_camera_fb_return(fb);
      fb = NULL;
      _jpg_buf = NULL;
    } else if(_jpg_buf){
      free(_jpg_buf);
      _jpg_buf = NULL;
    }
    if(res != ESP_OK){
      break;
    }
    //Serial.printf("MJPG: %uB\n",(uint32_t)(_jpg_buf_len));
  }
  return res;
}

static esp_err_t capture_handler(httpd_req_t *req){
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    return httpd_resp_send_500(req);
  }

  if(fb->format != PIXFORMAT_JPEG){
    uint8_t * jpg_buf = NULL;
    size_t jpg_len = 0;
    if(!frame2jpg(fb, 30, &jpg_buf, &jpg_len)){  // Quality 30 = high clarity
      esp_camera_fb_return(fb);
      Serial.println("JPEG compression failed");
      return httpd_resp_send_500(req);
    }
    httpd_resp_set_type(req, "image/jpeg");
    httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
    res = httpd_resp_send(req, (const char *)jpg_buf, jpg_len);
    free(jpg_buf);
    esp_camera_fb_return(fb);
    return res;
  } else {
    httpd_resp_set_type(req, "image/jpeg");
    httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
    res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
    esp_camera_fb_return(fb);
    return res;
  }
}

static esp_err_t light_handler(httpd_req_t *req){
  ledOn = !ledOn;
  digitalWrite(FLASH_GPIO_NUM, ledOn ? HIGH : LOW);
  
  const char* response = ledOn ? "{\"status\":\"on\"}" : "{\"status\":\"off\"}";
  httpd_resp_set_type(req, "application/json");
  return httpd_resp_send(req, response, HTTPD_RESP_USE_STRLEN);
}

void startCameraServer(){
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  httpd_uri_t index_uri = {
    .uri       = "/",
    .method    = HTTP_GET,
    .handler   = index_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t capture_uri = {
    .uri       = "/capture",
    .method    = HTTP_GET,
    .handler   = capture_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t light_uri = {
    .uri       = "/light",
    .method    = HTTP_GET,
    .handler   = light_handler,
    .user_ctx  = NULL
  };

  httpd_handle_t stream_httpd = NULL;
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &index_uri);
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    httpd_register_uri_handler(stream_httpd, &capture_uri);
    httpd_register_uri_handler(stream_httpd, &light_uri);
  }
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); //disable brownout detector

  Serial.begin(115200);
  Serial.setDebugOutput(false);
  
  // Initialize flash LED pin
  pinMode(FLASH_GPIO_NUM, OUTPUT);
  digitalWrite(FLASH_GPIO_NUM, LOW);
  
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG; 
  
  if(psramFound()){
    config.frame_size = FRAMESIZE_VGA;   // 640x480 - maximum clarity resolution
    config.jpeg_quality = 25;             // High quality = best clarity (1-100)
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 20;             // No PSRAM: use lower res
    config.fb_count = 1;
  }
  
  // Camera init
  Serial.println("Initializing camera...");
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
    return;
  }
  Serial.println("Camera initialized successfully");
  
  // Wi-Fi connection
  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");
  
  Serial.print("Camera Stream Ready! Go to: http://");
  Serial.println(WiFi.localIP());
  
  // Start streaming web server
  Serial.println("Starting camera server...");
  startCameraServer();
  Serial.println("Camera server started");
}

void loop() {
  delay(10000);
}
