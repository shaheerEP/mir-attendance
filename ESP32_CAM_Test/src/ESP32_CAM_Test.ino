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
#define CAMERA_MODEL_AI_THINKER // Has PSRAM
#include "camera_pins.h"

// ===========================
// Enter your WiFi Credentials
// ===========================
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const char* ssid = "IRIS_FOUNDATION_JIO";
const char* password = "iris916313";

// OLED Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C
#define OLED_SDA 14
#define OLED_SCL 15

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Global control flags
volatile bool isCapturing = false;

void startCameraServer();

// HTML for the Main Page
static const char PROLOGUE[] = 
  "<!DOCTYPE html><html><head>"
  "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
  "<title>ESP32-CAM Stream</title>"
  "<style>"
  "body { font-family: sans-serif; text-align: center; margin: 0; padding: 0; background-color: #333; color: white; }"
  "h1 { margin: 10px; }"
  "img { width: 100%; max-width: 800px; height: auto; }" 
  ".container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }"
  "button { padding: 15px 40px; font-size: 18px; margin: 10px; cursor: pointer; background-color: #28a745; color: white; border: none; border-radius: 5px; }"
  "button:hover { background-color: #218838; }"
  "button:disabled { background-color: #555; cursor: not-allowed; }"
  "#captured { margin-top: 20px; border: 2px solid #fff; display: none; }"
  "</style>"
  "<script>"
  "console.log('Script loaded');"
  "function capturePhoto() {"
  "  console.log('Capture clicked');"
  "  var btn = document.getElementById('btn-capture');"
  "  var img = document.getElementById('captured');"
  "  var stream = document.getElementById('stream');"
  "  "
  "  if(!btn || !img || !stream) { console.error('Elements not found'); return; }"
  "  "
  "  btn.disabled = true;"
  "  btn.innerText = 'Capturing...';"
  "  "
  "  // STOP STREAM to free up server"
  "  var streamSrc = stream.src;"
  "  stream.src = '';"
  "  console.log('Stream stopped');"
  "  "
  "  setTimeout(function() {"
  "    var timestamp = new Date().getTime();"
  "    var url = '/capture?t=' + timestamp;"
  "    "
  "    var tempImg = new Image();"
  "    tempImg.onload = function() {"
  "      img.src = url;"
  "      img.style.display = 'block';"
  "      btn.disabled = false;"
  "      btn.innerText = 'Take High-Res Photo';"
  "      // Restore stream"
  "      stream.src = streamSrc;"
  "      console.log('Stream restored');"
  "    };"
  "    tempImg.onerror = function() {"
  "      alert('Capture failed. Please try again.');"
  "      btn.disabled = false;"
  "      btn.innerText = 'Take High-Res Photo';"
  "      stream.src = streamSrc;"
  "    };"
  "    tempImg.src = url;"
  "  }, 500);"
  "}"
  "window.capturePhoto = capturePhoto;"
  "</script>"
  "</head><body>"
  "<div class=\"container\">"
  "<h1>ESP32-CAM Stream</h1>"
  "<img src=\"/stream\" id=\"stream\">"
  "<br>"
  "<button id=\"btn-capture\" onclick=\"capturePhoto()\">Take High-Res Photo</button>"
  "<h3>Captured Image:</h3>"
  "<img id=\"captured\" src=\"\">"
  "</div>"
  "</body></html>";

  static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=frame";
  static const char _STREAM_BOUNDARY[] = "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";
  static const char _STREAM_PART[] = "\r\n--frame\r\n";
  static const size_t _STREAM_PART_LEN = sizeof(_STREAM_PART) - 1;

void updateOLED(String msg, String type) {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.println("IRIS ATTENDANCE");
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
  
  display.setCursor(0, 20);
  if (type == "success") {
    display.setTextSize(2);
    display.println("WELCOME!");
    display.setTextSize(1);
    display.println(msg);
  } else if (type == "error") {
    display.setTextSize(1);
    display.println("ALERT:");
    display.setTextSize(2);
    display.println(msg);
  } else {
    display.setTextSize(2);
    display.println(msg);
  }
  
  display.display();
}

static esp_err_t feedback_handler(httpd_req_t *req){
    char buf[100];
    char msg[50] = "Ready";
    char type[20] = "info";
    
    if (httpd_req_get_url_query_str(req, buf, sizeof(buf)) == ESP_OK) {
        if (httpd_query_key_value(buf, "msg", msg, sizeof(msg)) == ESP_OK) {
            // URL decode would be better but let's assume raw text or simple spaces
            for(int i=0; msg[i]; i++) if(msg[i] == '+') msg[i] = ' ';
        }
        httpd_query_key_value(buf, "type", type, sizeof(type));
    }
    
    updateOLED(String(msg), String(type));
    
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    return httpd_resp_send(req, "OK", 2);
}

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

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET");

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if(res != ESP_OK){
    return res;
  }

  while(true){
    // PAUSE CHECK: If capturing, yield and continue
    if (isCapturing) {
      delay(50);
      continue;
    }

    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
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
  }
  return res;
}

static esp_err_t capture_handler(httpd_req_t *req){
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  
  Serial.println("capture_handler started");

  // 1. Pause the stream
  isCapturing = true;
  delay(500); // Increased wait time to ensure stream handler releases resources
  Serial.println("Stream paused");

  sensor_t * s = esp_camera_sensor_get();
  framesize_t old_size = s->status.framesize;

  // 2. Switch to UXGA (1600x1200) for High Res
  s->set_framesize(s, FRAMESIZE_UXGA);
  Serial.println("Resolution switched to UXGA");
  
  // 3. Turn on Flash (Pin 4)
  #ifdef FLASH_GPIO_NUM
  digitalWrite(FLASH_GPIO_NUM, HIGH);
  Serial.println("Flash ON");
  #endif
  
  // 4. Warmup loop (discard bad auto-exposure frames after res change)
  Serial.println("Starting warmup...");
  for(int i=0; i<3; i++){
    fb = esp_camera_fb_get();
    if(fb) {
      esp_camera_fb_return(fb);
      fb = NULL;
    }
    delay(50);
  }
  Serial.println("Warmup done");

  // 5. Capture the good frame
  fb = esp_camera_fb_get();
  
  // 6. Turn off Flash
  #ifdef FLASH_GPIO_NUM
  digitalWrite(FLASH_GPIO_NUM, LOW);
  Serial.println("Flash OFF");
  #endif

  if (!fb) {
    Serial.println("Capture failed: No Frame Buffer");
    httpd_resp_send_500(req);
    // Restore and resume
    s->set_framesize(s, old_size);
    isCapturing = false;
    return ESP_FAIL;
  }
  Serial.printf("Capture successful. Size: %u bytes\n", fb->len);

  // 7. Send the image
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  if(fb->format == PIXFORMAT_JPEG){
    res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  } else {
    // Should not happen with current config, but fallback
    uint8_t * jpg_buf = NULL;
    size_t jpg_len = 0;
    frame2jpg(fb, 90, &jpg_buf, &jpg_len);
    res = httpd_resp_send(req, (const char *)jpg_buf, jpg_len);
    free(jpg_buf);
  }
  
  esp_camera_fb_return(fb);
  
  // 8. Restore resolution and resume stream
  s->set_framesize(s, old_size);
  isCapturing = false;
  Serial.println("Resolution restored, stream resuming");
  
  return res;
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

  httpd_uri_t feedback_uri = {
    .uri       = "/feedback",
    .method    = HTTP_GET,
    .handler   = feedback_handler,
    .user_ctx  = NULL
  };

  httpd_handle_t stream_httpd = NULL;
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &index_uri);
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    httpd_register_uri_handler(stream_httpd, &capture_uri);
    httpd_register_uri_handler(stream_httpd, &feedback_uri);
  }
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); //disable brownout detector

  Serial.begin(115200);
  Serial.setDebugOutput(false);

  // Initialize I2C and OLED
  Wire.begin(OLED_SDA, OLED_SCL);
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("SSD1306 allocation failed"));
  } else {
    display.clearDisplay();
    display.setRotation(0);
    updateOLED("SYSTEM START", "info");
    Serial.println("OLED initialized");
  }
  
  // Initialize flash LED pin
  #ifdef FLASH_GPIO_NUM
  pinMode(FLASH_GPIO_NUM, OUTPUT);
  digitalWrite(FLASH_GPIO_NUM, LOW);
  #endif
  
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
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG; 
  
  if(psramFound()){
    config.frame_size = FRAMESIZE_UXGA; // Init with high res to allocate large buffer
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }
  
  // Camera init
  Serial.println("Initializing camera...");
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
    return;
  }

  // Drop down to VGA for smooth streaming
  sensor_t * s = esp_camera_sensor_get();
  if (psramFound()) {
    s->set_framesize(s, FRAMESIZE_VGA);
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
