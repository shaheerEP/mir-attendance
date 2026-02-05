#include "Arduino.h"
#include "esp_camera.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

// FACE DETECTION HEADER
#include "fd_forward.h"

// ===========================
// CONFIGURATION
// ===========================
const char *ssid = "IRIS_FOUNDATION_JIO";
const char *password = "iris916313";
const char *serverUrl = "mir-attendance.vercel.app";
const char *serverPath = "/api/recognize";
const int serverPort = 443;

// OLED CONFIG
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// CAMERA PINS
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

static mtmn_config_t mtmn_config = {0};

void showStatus(String title, String msg) {
  // Serial Log (Since OLED might be missing)
  Serial.println("--- STATUS ---");
  Serial.println("Title: " + title);
  Serial.println("Msg:   " + msg);
  Serial.println("--------------");

  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.println(title);
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
  display.setCursor(0, 20);
  display.setTextSize(2); // Large text
  display.println(msg);
  display.display();
}

void initCamera() {
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

  // Use QVGA for Detection Speed ?? No, we need quality for server.
  // Tradeoff: Recognition needs Quality. Detection needs Speed.
  // We will capture HIGH QUALITY, but downscale for detection if needed?
  // Actually, ESP32 Camera driver supports changing resolution on the fly but
  // it can be buggy. Let's stick to VGA (640x480). It's slow for detection
  // (~800ms) but works.

  if (psramFound()) {
    config.frame_size = FRAMESIZE_CIF; // Reduced from VGA to save RAM for SSL
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_QVGA; // Fallback for no PSRAM
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  if (esp_camera_init(&config) != ESP_OK) {
    showStatus("Error", "Cam Failed");
    delay(3000);
    ESP.restart();
  }
}

// Include HTTPClient
#include <HTTPClient.h>

String sendPhoto(camera_fb_t *fb) {
  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure();     // Skip cert check
  client.setTimeout(20000); // 20s timeout for TCP connect

  Serial.println("Connecting to " + String(serverUrl));

  // Construct URL with https protocol
  String fullUrl = "https://" + String(serverUrl) + String(serverPath);

  // We use WiFiClientSecure with HTTPClient to manage the connection
  if (!http.begin(client, fullUrl)) {
    return "Connect Fail";
  }

  showStatus("Processing", "Uploading...");

  String boundary = "esp32-boundary";
  String contentType = "multipart/form-data; boundary=" + boundary;

  // Start POST
  http.addHeader("Content-Type", contentType);

  String head = "--" + boundary +
                "\r\nContent-Disposition: form-data; name=\"image\"; "
                "filename=\"capture.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";

  uint32_t imageLen = fb->len;
  uint32_t extraLen = head.length() + tail.length();
  uint32_t totalLen = imageLen + extraLen;

  // Custom logic to stream data because HTTPClient.POST(String) loads
  // everything to RAM which crashes ESP32 We have to use the low-level stream
  // or fallback to existing method if HTTPClient is too heavy. Actually,
  // standard HTTPClient library doesn't support streaming POST body easily
  // without hacking. Given the fragility, let's use the Raw Client but with
  // improved settings (Keep-Alive, Retry)

  http.end(); // Clean up if we aren't using it

  // --- RAW CLIENT RETRY LOGIC ---
  int retries = 3;
  while (retries > 0) {
    if (client.connect(serverUrl, 443)) {
      break;
    }
    Serial.println("Connect failed... retrying");
    retries--;
    delay(1000);
  }

  if (!client.connected()) {
    return "Conn. Fail";
  }

  client.println("POST " + String(serverPath) + " HTTP/1.1");
  client.println("Host: " + String(serverUrl));
  client.println("Content-Length: " + String(totalLen));
  client.println("Content-Type: multipart/form-data; boundary=" + boundary);
  client.println("Connection: close");
  client.println();
  client.print(head);

  uint8_t *fbBuf = fb->buf;
  size_t fbLen = fb->len;
  size_t bufferSize = 1024;
  for (size_t i = 0; i < fbLen; i += bufferSize) {
    size_t remaining = fbLen - i;
    if (remaining < bufferSize)
      bufferSize = remaining;
    client.write(fbBuf + i, bufferSize);
  }

  client.print(tail);

  // Read Response
  showStatus("Processing", "Analyzing...");
  unsigned long start = millis();
  while (client.connected() && millis() - start < 20000) {
    if (client.available()) {
      String response = client.readString();
      Serial.println("Server Params: " +
                     response.substring(0, 300)); // Debug header

      int jsonStart = response.indexOf("{");
      if (jsonStart != -1) {
        String jsonStr = response.substring(jsonStart);
        int jsonEnd = jsonStr.lastIndexOf("}");
        if (jsonEnd != -1)
          jsonStr = jsonStr.substring(0, jsonEnd + 1);

        DynamicJsonDocument doc(1024);
        deserializeJson(doc, jsonStr);
        String msg = doc["message"].as<String>();
        client.stop();
        return msg;
      }
    }
  }
  client.stop();
  return "Timeout";
}

void setup() {
  Serial.begin(115200);

  // OLED
  Wire.begin(14, 15);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.display();

  showStatus("Booting", "Init...");

  // Camera
  initCamera();

  // Init Face Detection Config
  mtmn_config = mtmn_init_config();

  // WiFi
  WiFi.setSleep(false); // Disable sleep for better connection
  WiFi.config(INADDR_NONE, INADDR_NONE, INADDR_NONE, IPAddress(8, 8, 8, 8),
              IPAddress(8, 8, 4, 4));
  WiFi.setHostname("ESP32-Attendance");

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    showStatus("Connecting", "WiFi...");
  }

  Serial.print("WiFi Connected. IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("DNS: ");
  Serial.println(WiFi.dnsIP());

  showStatus("Ready", "Look at Cam");
}

void loop() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    delay(100);
    return;
  }

  // WE NEED RGB888 FOR DETECTION
  // Detection on VGA JPEG is slow because we have to decode it.
  // 1. Allocate RAM for RGB
  dl_matrix3du_t *image_matrix =
      dl_matrix3du_alloc(1, fb->width, fb->height, 3);

  bool faceFound = false;

  if (image_matrix) {
    // 2. Convert JPEG to RGB
    if (fmt2rgb888(fb->buf, fb->len, fb->format, image_matrix->item)) {
      // 3. Detect
      box_array_t *boxes = face_detect(image_matrix, &mtmn_config);

      if (boxes) {
        faceFound = true;
        Serial.println("Face Detected!");

        // Cleanup boxes
        if (boxes->score)
          dl_lib_free(boxes->score);
        if (boxes->box)
          dl_lib_free(boxes->box);
        if (boxes->landmark)
          dl_lib_free(boxes->landmark);
        dl_lib_free(boxes);
      }
    }
    dl_matrix3du_free(image_matrix);
  }

  if (faceFound) {
    // UPLOAD THE SAME FB (It's already JPEG)
    String result = sendPhoto(fb);
    showStatus("Result", result);

    esp_camera_fb_return(fb);

    // COOLDOWN to prevent spamming
    delay(5000);
    showStatus("Ready", "Look at Cam");
  } else {
    esp_camera_fb_return(fb);
    // detection loop speed
    // display dot to show life?
    // display.drawPixel(0,0, SSD1306_WHITE); display.display();
  }
}
