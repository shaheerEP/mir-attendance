#include "Arduino.h"
#include "esp_camera.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>  // ABSOLUTELY REQUIRED for httpUpdate
#include <Preferences.h> // ABSOLUTELY REQUIRED for Preferences
#include <WiFi.h>
#include <WiFiClientSecure.h>

// ===========================
// CONFIGURATION
// ===========================
const char *default_ssid = "IRIS_FOUNDATION_JIO";
const char *default_password = "iris916313";
const char *serverUrl = "mir-attendance.vercel.app";
const char *serverPath = "/api/recognize";
const char *statusPath =
    "https://mir-attendance.vercel.app/api/status"; // Full URL for HTTPClient
const char *settingsPath = "/api/settings"; // Endpoint for checking updates
const int serverPort = 443;                 // HTTPS Port

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
const unsigned long DEBOUNCE_DELAY = 1000;
Preferences preferences;
String currentVersion = "1.0.0"; // FIRMWARE VERSION

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
    WiFiClientSecure client;
    client.setInsecure(); // Required for HTTPS without cert

    HTTPClient http;
    http.begin(client, statusPath);
    http.setFollowRedirects(
        HTTPC_FORCE_FOLLOW_REDIRECTS); // Handle 307 Redirects

    int httpCode = http.GET();

    if (httpCode > 0) {
      String payload = http.getString();
      Serial.println("[Status] " + payload);

      // ARDUINOJSON v7 specific: Use JsonDocument instead of
      // DynamicJsonDocument
      JsonDocument doc;
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        if (doc["period"].is<String>())
          currentPeriod = doc["period"].as<String>();
        if (doc["present"].is<int>())
          presentCount = doc["present"];
        if (doc["total"].is<int>())
          totalCount = doc["total"];
      } else {
        Serial.println(F("[Status] JSON Error"));
      }
    } else {
      Serial.printf("[Status] HTTP Error: %s\n",
                    http.errorToString(httpCode).c_str());
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

  if (psramFound()) {
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
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

void setFlash(bool on) { digitalWrite(FLASH_PIN, on ? HIGH : LOW); }

// Check for Settings Updates (WiFi & Firmware)
void checkSettingsUpdates() {
  if (WiFi.status() != WL_CONNECTED)
    return;

  Serial.println("Checking for updates...");
  WiFiClientSecure client;
  client.setInsecure();

  if (!client.connect(serverUrl, serverPort)) {
    Serial.println("Connection failed");
    return;
  }

  client.println("GET " + String(settingsPath) + " HTTP/1.1");
  client.println("Host: " + String(serverUrl));
  client.println("Connection: close");
  client.println();

  // Read response
  String body = "";
  bool bodyStarted = false;
  unsigned long timeout = millis();
  while (client.connected() && millis() - timeout < 10000) {
    String line = client.readStringUntil('\n');
    if (line == "\r") {
      bodyStarted = true;
    } else if (bodyStarted) {
      body += line;
    }
  }

  // ARDUINOJSON v7
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, body);

  if (!error) {
    // 1. Check WiFi Update
    if (doc["wifi"].is<JsonObject>()) {
      String newSSID = doc["wifi"]["ssid"].as<String>();
      String newPass = doc["wifi"]["password"].as<String>();

      String currentSSID = preferences.getString("ssid", default_ssid);
      String currentPass = preferences.getString("password", default_password);

      if (newSSID != "" && (newSSID != currentSSID || newPass != currentPass)) {
        Serial.println("New WiFi Credentials found. Saving...");
        preferences.putString("ssid", newSSID);
        preferences.putString("password", newPass);
        showStatus("Config", "WiFi Updated");
        delay(2000);
        // Optionally restart or reconnect?
        // ESP.restart(); // Let's not restart immediately, maybe next boot
      }
    }

    // 2. Check Firmware Update
    if (doc["firmware"].is<JsonObject>()) {
      String newVersion = doc["firmware"]["version"].as<String>();
      String firmwareUrl = doc["firmware"]["url"].as<String>();

      if (newVersion != currentVersion && firmwareUrl != "") {
        Serial.println("New Firmware found: " + newVersion);
        showStatus("Update", "New Firmware");
        delay(2000);

        // Perform OTA Update
        // The URL in DB might be relative path e.g. /firmware/abc.bin
        // We need full URL
        String fullUrl = "https://" + String(serverUrl) + firmwareUrl;

        // Note: WiFiClientSecure is needed for HTTPS OTA
        t_httpUpdate_return ret = httpUpdate.update(client, fullUrl);

        switch (ret) {
        case HTTP_UPDATE_FAILED:
          Serial.printf("HTTP_UPDATE_FAILED Error (%d): %s\n",
                        httpUpdate.getLastError(),
                        httpUpdate.getLastErrorString().c_str());
          showStatus("Error", "Update Fail");
          break;
        case HTTP_UPDATE_NO_UPDATES:
          Serial.println("HTTP_UPDATE_NO_UPDATES");
          break;
        case HTTP_UPDATE_OK:
          Serial.println("HTTP_UPDATE_OK");
          break;
        }
      }
    }
  }
}

String uploadPhoto(camera_fb_t *fb) {
  WiFiClientSecure client;
  client.setInsecure();

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

  client.println("POST " + String(serverPath) + " HTTP/1.1");
  client.println("Host: " + String(serverUrl));
  client.println("Content-Length: " + String(totalLen));
  client.println("Content-Type: multipart/form-data; boundary=" + boundary);
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

  // Read response...
  // (Simplified for brevity, reusing previous logic logic)
  unsigned long timeout = millis();
  while (client.connected() && millis() - timeout < 60000) {
    if (client.available()) {
      String response = client.readString();
      int jsonStart = response.indexOf("{");
      if (jsonStart != -1) {
        String jsonStr = response.substring(jsonStart);
        int jsonEnd = jsonStr.lastIndexOf("}");
        if (jsonEnd != -1) {
          jsonStr = jsonStr.substring(0, jsonEnd + 1);

          // ARDUINOJSON v7
          JsonDocument doc;
          DeserializationError error = deserializeJson(doc, jsonStr);

          if (!error) {
            String msg = doc["message"].as<String>();

            // Update Globals if present
            if (doc["period"].is<String>())
              currentPeriod = doc["period"].as<String>();
            if (doc["present"].is<int>())
              presentCount = doc["present"];
            if (doc["total"].is<int>())
              totalCount = doc["total"];

            return msg; // Should be "Welcome Shaheer" or error msg
          } else {
            return "Json Error";
          }
        }
      }
      delay(10);
    }
  }
  return "Timeout";
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n--- ESP32 Online Snapshot Firmware ---");

  // INIT PREFERENCES
  preferences.begin("cam-app", false); // Namespace "cam-app"

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
  String ssid = preferences.getString("ssid", default_ssid);
  String password = preferences.getString("password", default_password);

  WiFi.begin(ssid.c_str(), password.c_str());
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    showStatus("", "WiFi " + String(retry));
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    fetchStatus();          // Get initial status
    checkSettingsUpdates(); // Check for firmware/wifi updates

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

  case STATE_CAPTURING: {
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
      String result = uploadPhoto(fb);
      esp_camera_fb_return(fb);

      // 5. Show Result
      showStatus("Result", result);

      // 6. Wait for user to dismiss
      currentState = STATE_SHOWING_RESULT;
    }
    break;
  }

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
