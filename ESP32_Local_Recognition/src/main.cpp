#include "Arduino.h"
#include "esp_camera.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <HTTPUpdate.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

// ===========================
// CONFIGURATION
// ===========================
const char *default_ssid = "IRIS_FOUNDATION_JIO";
const char *default_password = "iris916313";
const char *serverUrl = "mir-attendance.vercel.app";
// const char *serverUrl = "192.168.31.3"; // Local Computer IP
const char *serverPath = "/api/recognize";
const char *settingsPath = "/api/settings";
const int serverPort = 443; // HTTPS Port

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
String currentPeriod = "Free";   // Default before fetch
String attendanceCounts = "-/-"; // Default before fetch

void showStatus(String title, String msg) {
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
  Serial.println("[OLED] " + title + ": " + msg);
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

  DynamicJsonDocument doc(2048);
  DeserializationError error = deserializeJson(doc, body);

  if (!error) {
    // 1. Check WiFi Update
    if (doc.containsKey("wifi")) {
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
    if (doc.containsKey("firmware")) {
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

    // 3. Check Status (Period + Counts)
    if (doc.containsKey("status")) {
      currentPeriod = doc["status"]["period"].as<String>();
      attendanceCounts = doc["status"]["counts"].as<String>();
      Serial.println("Status Updated: " + currentPeriod + " " +
                     attendanceCounts);
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
          DynamicJsonDocument doc(1024);
          deserializeJson(doc, jsonStr);
          return doc["message"].as<String>();
        }
      }
    }
    delay(10);
  }
  return "Timeout";
}

void setup() {
  Serial.begin(115200);

  // Init Preferences
  preferences.begin("attendance", false);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(FLASH_PIN, OUTPUT);
  setFlash(false);

  Wire.begin(14, 15);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 failed"));
    for (;;)
      ;
  }
  display.clearDisplay();
  display.display();

  showStatus("Booting...", "Ver: " + currentVersion);
  delay(1000);

  initCamera();

  // Load WiFi Credentials
  String ssid = preferences.getString("ssid", default_ssid);
  String password = preferences.getString("password", default_password);

  Serial.println("Connecting to: " + ssid);
  WiFi.begin(ssid.c_str(), password.c_str());

  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    showStatus("Connecting...", String(retry));
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    showStatus("Ready", "Checking...");

    // Check for updates on boot (fetches status too)
    checkSettingsUpdates();

    // Show the fetched status
    showStatus(currentPeriod, attendanceCounts);

  } else {
    showStatus("WiFi Error", "Using Defaults");
    // Try Default if stored failed?
    if (ssid != default_ssid) {
      WiFi.begin(default_ssid, default_password);
      // ... retry logic
    }
  }
}

void loop() {
  if (digitalRead(BUTTON_PIN) == LOW) {
    if (millis() - lastButtonPress > DEBOUNCE_DELAY) {
      lastButtonPress = millis();
      isCapturing = true;
    }
  }

  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'c' || c == 'C')
      isCapturing = true;
  }

  if (isCapturing) {
    setFlash(true);
    delay(150);
    camera_fb_t *fb = esp_camera_fb_get();
    setFlash(false);

    if (!fb) {
      showStatus("Error", "Capture Fail");
      delay(2000); // Small delay to read error
    } else {
      String result = uploadPhoto(fb);
      // Show Result matches
      showStatus("Result", result);
      esp_camera_fb_return(fb);

      // HOLD LOGIC: Wait for button press to dismiss/next
      // User request: "The presented names... want to stay... until press the
      // button" "when it will click... show message to press button to next
      // capture"

      // Wait while button is NOT pressed (HIGH because INPUT_PULLUP)
      while (digitalRead(BUTTON_PIN) == HIGH) {
        delay(50); // prevent watchdog trigger, small poll
      }

      // Button is now PRESSED (LOW)
      // Display prompt for next capture
      showStatus(currentPeriod, attendanceCounts);

      // Debounce release
      delay(200);
      while (digitalRead(BUTTON_PIN) == LOW) {
        delay(50);
      }
    }

    // showStatus("Ready", "Btn/Serial"); // Old logic
    isCapturing = false;

    // Also check for updates after a capture?
    checkSettingsUpdates();

    // Update display in case stats changed
    showStatus(currentPeriod, attendanceCounts);
  }
}
