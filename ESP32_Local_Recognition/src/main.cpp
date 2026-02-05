#include "Arduino.h"
#include "esp_camera.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

// FACE DETECTION HEADER
#include "fd_forward.h"
#include "fr_forward.h" // Uncomment if FR libraries are available

// ===========================
// CONFIGURATION
// ===========================
const char *ssid = "IRIS_FOUNDATION_JIO";
const char *password = "iris916313";
const char *serverUrl = "mir-attendance.vercel.app";
const char *serverPath = "/api/mark-attendance";
const int serverPort = 443;

// OLED CONFIG
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// CAMERA PINS (AI THINKER)
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

#define FLASH_LED_PIN 4

// FACE DETECTION GLOBALS
static mtmn_config_t mtmn_config = {0};

void showStatus(String title, String msg) {
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
  display.setTextSize(2);
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

  if (psramFound()) {
    config.frame_size = FRAMESIZE_CIF; // Resolution for Method
    config.jpeg_quality = 12;
    config.fb_count = 1;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  if (esp_camera_init(&config) != ESP_OK) {
    showStatus("Error", "Cam Failed");
    delay(3000);
    ESP.restart();
  }
}

// Send Student ID to Server
String sendAttendance(String studentId) {
  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(15000);

  String fullUrl = "https://" + String(serverUrl) + String(serverPath);

  if (!http.begin(client, fullUrl)) {
    return "Conn Error";
  }

  http.addHeader("Content-Type", "application/json");
  String payload = "{\"studentId\":\"" + studentId + "\"}";

  showStatus("Syncing", "Wait...");

  int httpCode = http.POST(payload);
  String resultMsg = "Error";

  if (httpCode > 0) {
    String response = http.getString();
    Serial.println("Resp: " + response);

    DynamicJsonDocument doc(1024);
    deserializeJson(doc, response);

    if (doc.containsKey("message")) {
      resultMsg = doc["message"].as<String>();
    } else {
      resultMsg = "Marked!";
    }
  } else {
    resultMsg = "Net Error";
  }

  http.end();
  return resultMsg;
}

void setup() {
  Serial.begin(115200);

  // Flash LED
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  // OLED
  Wire.begin(14, 15);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
  }
  display.clearDisplay();
  display.display();

  showStatus("Booting", "Init AI...");

  initCamera();

  // Init Face Detection
  mtmn_config = mtmn_init_config();

  // WiFi
  WiFi.setSleep(false);
  WiFi.config(INADDR_NONE, INADDR_NONE, INADDR_NONE, IPAddress(8, 8, 8, 8),
              IPAddress(8, 8, 4, 4));
  WiFi.setHostname("ESP32-Attendance");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    showStatus("Connecting", "WiFi...");
  }

  showStatus("Ready", "Look at Cam");
}

void loop() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb)
    return;

  // 1. Convert to RGB for AI (Detection)
  dl_matrix3du_t *image_matrix =
      dl_matrix3du_alloc(1, fb->width, fb->height, 3);

  bool faceFound = false;

  if (image_matrix) {
    if (fmt2rgb888(fb->buf, fb->len, fb->format, image_matrix->item)) {
      // 2. DETECT FACES
      box_array_t *boxes = face_detect(image_matrix, &mtmn_config);

      if (boxes) {
        Serial.println("Face Detected");
        faceFound = true;

        // Cleanup
        dl_lib_free(boxes->score);
        dl_lib_free(boxes->box);
        dl_lib_free(boxes->landmark);
        dl_lib_free(boxes);
      }
    }
    dl_matrix3du_free(image_matrix);
  }

  esp_camera_fb_return(fb);

  if (faceFound) {
    // 3. Simulated Recognition & Action
    // In a real FR system, we would:
    // a. Align Face
    // b. Get Face Embedding
    // c. Compare with Local database

    // For this POC Step 1: Prove Connectivity
    showStatus("Face Found", "Identifying...");

    // Flash Feedback
    digitalWrite(FLASH_LED_PIN, HIGH);
    delay(100);
    digitalWrite(FLASH_LED_PIN, LOW);

    // Call Server with a TEST ID (or the specific user's ID if we recognized
    // them) Replace this with the User's Actual MongoDB ID from the logs to
    // test real attendance!
    String testStudentId = "67a29486c12d4586bc537e28";

    String result = sendAttendance(testStudentId);
    showStatus("Attendance", result);

    // Cooldown
    delay(5000);
    showStatus("Ready", "Look at Cam");
  }
}
