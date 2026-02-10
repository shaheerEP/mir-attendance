#include "Arduino.h"
#include "esp_camera.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

// ===========================
// CONFIGURATION
// ===========================
const char *ssid = "IRIS_FOUNDATION_JIO";
const char *password = "iris916313";
const char *serverUrl = "mir-attendance.vercel.app";
const char *serverPath = "/api/recognize";
const char *statusPath =
    "https://mir-attendance.vercel.app/api/status"; // Full URL for HTTPClient
const int serverPort = 443;                         // HTTPS Port

// STATE MACHINE
enum AppState { STATE_IDLE, STATE_CAPTURING, STATE_SHOWING_RESULT };
AppState currentState = STATE_IDLE;

// STATUS GLOBALS
String currentPeriod = "---";
int presentCount = 0;
int totalCount = 0;

// GPIO PINS
#define BUTTON_PIN 12 // Button to GND
#define FLASH_PIN 4   // On-board Flash LED

// OLED CONFIG
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
// OLED Pins: SDA=14, SCL=15 (Default for some ESP32-CAM shields)
// If your shield uses different pins, change Wire.begin() in setup()
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// CAMERA PINS (Ai-Thinker Model)
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

// GLOBALS
bool isCapturing = false;
unsigned long lastButtonPress = 0;
const unsigned long DEBOUNCE_DELAY =
    1000; // 1 second debounce to prevent double snaps

void showStatus(String title, String msg) {
  display.clearDisplay();

  // HEADER BAR
  display.fillRect(0, 0, 128, 14, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK, SSD1306_WHITE); // Inverted text
  display.setTextSize(1);
  display.setCursor(2, 3);
  display.print(currentPeriod);

  String countStr = String(presentCount) + "/" + String(totalCount);
  int16_t x1, y1;
  uint16_t w, h;
  display.getTextBounds(countStr, 0, 0, &x1, &y1, &w, &h);
  display.setCursor(128 - w - 2, 3);
  display.print(countStr);

  // MAIN CONTENT
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 20);

  // Dynamic Text Size based on length
  if (msg.length() > 10) {
    display.setTextSize(1);
  } else {
    display.setTextSize(2);
  }

  if (title.length() > 0) {
    display.println(title);
    display.println(""); // Spacer
  }
  display.println(msg);

  display.display();
  Serial.println("[OLED] " + title + ": " + msg);
}

void fetchStatus() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(statusPath);
    int httpCode = http.GET();

    if (httpCode > 0) {
      String payload = http.getString();
      Serial.println("[Status] " + payload);

      DynamicJsonDocument doc(512);
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        currentPeriod = doc["period"].as<String>();
        presentCount = doc["present"];
        totalCount = doc["total"];
      } else {
        Serial.println(F("[Status] JSON Error"));
      }
    } else {
      Serial.println(F("[Status] HTTP Error"));
    }
    http.end();
  }
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

  // Optimized for Speed & Multi-Face
  // VGA (640x480) is enough for face detection and much faster to upload than
  // SVGA/XGA.
  if (psramFound()) {
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12; // 10-12 is good balance (lower is better quality)
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  if (esp_camera_init(&config) != ESP_OK) {
    showStatus("Error", "Cam Init Fail");
    delay(3000);
    ESP.restart();
  }
}

// Function to control Flash LED
void setFlash(bool on) {
  // GPIO 4 (Flash) is active HIGH usually
  digitalWrite(FLASH_PIN, on ? HIGH : LOW);
}

String uploadPhoto(camera_fb_t *fb) {
  WiFiClientSecure client; // HTTPS
  client.setInsecure();    // Skip certificate validation

  showStatus("Uploading...", "Please Wait");

  if (!client.connect(serverUrl, serverPort)) {
    return "Conn. Error";
  }

  String boundary = "------------------------esp32cam";
  String head = "--" + boundary +
                "\r\nContent-Disposition: form-data; name=\"image\"; "
                "filename=\"capture.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";

  uint32_t totalLen = fb->len + head.length() + tail.length();

  // 1. Send Headers
  client.println("POST " + String(serverPath) + " HTTP/1.1");
  client.println("Host: " + String(serverUrl));
  client.println("Content-Length: " + String(totalLen));
  client.println("Content-Type: multipart/form-data; boundary=" + boundary);
  client.println();
  client.print(head);

  // 2. Send Image Data in Chunks
  uint8_t *fbBuf = fb->buf;
  size_t fbLen = fb->len;
  size_t bufferSize = 1024;
  for (size_t i = 0; i < fbLen; i += bufferSize) {
    size_t remaining = fbLen - i;
    if (remaining < bufferSize)
      bufferSize = remaining;
    client.write(fbBuf + i, bufferSize);
    // Optional: toggle LED or progress bar?
  }

  // 3. Send Tail
  client.print(tail);

  // 4. Read Response
  showStatus("Processing...", "Analyzing");

  unsigned long timeout = millis();
  while (client.connected() && millis() - timeout < 60000) {
    if (client.available()) {
      String response = client.readString();
      Serial.println("[Response] " + response); // Debug full response
      // Simple JSON parsing
      int jsonStart = response.indexOf("{");
      if (jsonStart != -1) {
        String jsonStr = response.substring(jsonStart);
        int jsonEnd = jsonStr.lastIndexOf("}");
        if (jsonEnd != -1) {
          jsonStr = jsonStr.substring(0, jsonEnd + 1);

          DynamicJsonDocument doc(1024);
          DeserializationError error = deserializeJson(doc, jsonStr);

          if (!error) {
            String msg = doc["message"].as<String>();

            // Update Globals if present
            if (doc.containsKey("period"))
              currentPeriod = doc["period"].as<String>();
            if (doc.containsKey("present"))
              presentCount = doc["present"];
            if (doc.containsKey("total"))
              totalCount = doc["total"];

            return msg; // Should be "Welcome Shaheer" or error msg
          } else {
            return "Json Error";
          }
        }
      }
      delay(10);
    }
    return "Timeout";
  }

  void setup() {
    Serial.begin(115200);
    Serial.println("\n\n--- ESP32 Online Snapshot Firmware ---");

    // 1. Init Button
    pinMode(BUTTON_PIN, INPUT_PULLUP);

    // 2. Init Flash
    pinMode(FLASH_PIN, OUTPUT);
    setFlash(false);

    // 3. Init OLED
    Wire.begin(14, 15);
    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
      Serial.println(F("SSD1306 allocation failed"));
      for (;;)
        ; // Loop forever
    }
    display.clearDisplay();
    display.display();

    showStatus("Booting...", "Init System");

    // 4. Init Camera
    initCamera();

    // 5. Connect WiFi
    WiFi.begin(ssid, password);
    int retry = 0;
    while (WiFi.status() != WL_CONNECTED && retry < 20) {
      delay(500);
      showStatus("", "WiFi " + String(retry));
      retry++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      fetchStatus(); // Get initial status
      showStatus("Ready", "Press Button");
      currentState = STATE_IDLE;
    } else {
      showStatus("WiFi Error", "Check SSID");
    }
  }

  void loop() {
    // Global Button Handling (Available in all states?)
    // NO, context sensitive.

    bool btnPressed = false;
    if (digitalRead(BUTTON_PIN) == LOW) {
      if (millis() - lastButtonPress > DEBOUNCE_DELAY) {
        lastButtonPress = millis();
        btnPressed = true;
        Serial.println("Button Pressed");
      }
    }

    switch (currentState) {
    case STATE_IDLE:
      // Action: Wait for Button to Capture
      if (btnPressed) {
        currentState = STATE_CAPTURING;
        return; // Next loop iteration handles capture
      }

      // Serial Trigger
      if (Serial.available()) {
        char c = Serial.read();
        if (c == 'c' || c == 'C') {
          currentState = STATE_CAPTURING;
        }
      }
      break;

    case STATE_CAPTURING:
      Serial.println("Starting Capture Sequence...");

      // 1. Turn on Flash
      setFlash(true);
      delay(150);

      // 2. Capture Frame
      camera_fb_t *fb = esp_camera_fb_get();

      // 3. Turn off Flash
      setFlash(false);

      if (!fb) {
        showStatus("Error", "Cam Fail");
        delay(2000);
        showStatus("Ready", "Press Button"); // Go back to ready
        currentState = STATE_IDLE;
      } else {
        Serial.printf("Image Captured. Size: %u bytes\n", fb->len);

        // 4. Upload
        // Note: modify uploadPhoto to NOT call showStatus internally if we want
        // to control it here? Actually uploadPhoto calls
        // showStatus("Uploading..."). That's fine.

        String result = uploadPhoto(fb);
        esp_camera_fb_return(fb);

        // 5. Show Result
        // uploadPhoto returns the message string.
        // And it updates globals (period, counts).

        showStatus("Result", result);

        // 6. Wait for user to dismiss
        currentState = STATE_SHOWING_RESULT;
      }
      break;

    case STATE_SHOWING_RESULT:
      // Action: Wait for Button to Dismiss/Next
      if (btnPressed) {
        // Dismiss result, go back to IDLE
        showStatus("Ready", "Press Button");
        currentState = STATE_IDLE;
      }
      break;
    }
  }
