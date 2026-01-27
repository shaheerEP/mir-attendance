#include "Arduino.h"
#include "esp_camera.h"
#include "esp_http_server.h"
#include "esp_timer.h"
#include "fb_gfx.h"
#include "img_converters.h"
#include "soc/rtc_cntl_reg.h" //disable brownout problems
#include "soc/soc.h"          //disable brownout problems
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <vector>


// Internal Flash Storage
#include "FS.h"
#include <LittleFS.h>

// ===================
// Select Camera Model
// ===================
#define CAMERA_MODEL_AI_THINKER // Has PSRAM
#include "camera_pins.h"

// ===========================
// CONFIGURATION
// ===========================
const char *ssid = "IRIS_FOUNDATION_JIO";
const char *password = "iris916313";
const char *serverUrl = "https://mir-attendance.vercel.app/api/attendance";

// Offline Config
#define OFFLINE_FILE "/offline_logs.csv"
bool offlineStorageEnabled = false;

#define PART_BOUNDARY "123456789000000000000987654321"
static const char *_STREAM_CONTENT_TYPE =
    "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char *_STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char *_STREAM_PART =
    "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

httpd_handle_t stream_httpd = NULL;
httpd_handle_t camera_httpd = NULL;

void startCameraServer();
void syncOfflineLogs();

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // disable brownout detector

  Serial.begin(115200);
  Serial.setDebugOutput(false);

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

  if (psramFound()) {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // Camera Init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  // Internal Storage Init (LittleFS)
  // Format if failed to mount
  if (LittleFS.begin(true)) {
    Serial.println("LittleFS mounted successfully");
    offlineStorageEnabled = true;
  } else {
    Serial.println("LittleFS Mount Failed");
    offlineStorageEnabled = false;
  }

  // WiFi Connection
  WiFi.begin(ssid, password);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    syncOfflineLogs();
  } else {
    Serial.println("\nWiFi Connection Failed - Started in Offline Mode");
  }

  Serial.print("Camera Ready! Use 'http://");
  Serial.print(WiFi.localIP());
  Serial.println("' to connect");

  startCameraServer();
}

// ----------------------------------------------------------------
// OFFLINE LOGGING SYSTEM (Internal Flash)
// ----------------------------------------------------------------

void saveAttendanceOffline(String name) {
  if (!offlineStorageEnabled) {
    Serial.println("Storage not available to save offline log.");
    return;
  }

  File file = LittleFS.open(OFFLINE_FILE, FILE_APPEND);
  if (!file) {
    Serial.println("Failed to open file for appending");
    return;
  }

  file.println(name);
  file.close();
  Serial.println("Saved to Internal Flash: " + name);
}

void sendAttendance(String name); // Forward declaration

void syncOfflineLogs() {
  if (!offlineStorageEnabled || WiFi.status() != WL_CONNECTED)
    return;

  if (!LittleFS.exists(OFFLINE_FILE)) {
    Serial.println("No offline logs to sync.");
    return;
  }

  File file = LittleFS.open(OFFLINE_FILE, "r");
  if (!file)
    return;

  Serial.println("Syncing offline logs...");

  while (file.available()) {
    String name = file.readStringUntil('\n');
    name.trim();
    if (name.length() > 0) {
      sendAttendance(name);
      delay(200);
    }
  }
  file.close();

  // Clear the file
  LittleFS.format(); // formatting is cleanest way to clear efficiently or just:
  // LittleFS.remove(OFFLINE_FILE);
  // Re-mount checks? Safe to just remove.
  LittleFS.remove(OFFLINE_FILE);
  Serial.println("Sync Complete. Offline file cleared.");
}

// ----------------------------------------------------------------
// ATTENDANCE SENDER
// ----------------------------------------------------------------
void sendAttendance(String name) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi Down. Saving offline.");
    saveAttendanceOffline(name);
    return;
  }

  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;

    Serial.println("Sending attendance for: " + name);

    http.begin(client, serverUrl);
    http.addHeader("Content-Type", "application/json");

    String payload = "{\"name\":\"" + name + "\", \"deviceId\":\"ESP32_Pro\"}";

    int httpCode = http.POST(payload);

    if (httpCode > 0) {
      String response = http.getString();
      Serial.println(httpCode);
      Serial.println(response);
    } else {
      Serial.print("Error on sending POST: ");
      Serial.println(httpCode);
      saveAttendanceOffline(name);
    }

    http.end();
  }
}

// ----------------------------------------------------------------
// WEB SERVER HANDLERS
// ----------------------------------------------------------------

static esp_err_t index_handler(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/html");
  String html = "<html><body><h1>ESP32 Face Recognition</h1>"
                "<p>System is running. INTERNAL STORAGE MODE.</p>"
                "<form action='/simulate' method='get'>"
                "Enter Name to Simulate Detection: <input type='text' "
                "name='name'><input type='submit' value='Simulate'>"
                "</form></body></html>";
  return httpd_resp_send(req, html.c_str(), html.length());
}

static esp_err_t simulate_handler(httpd_req_t *req) {
  char buf[100];
  char nameBuf[50] = "";
  if (httpd_req_get_url_query_str(req, buf, sizeof(buf)) == ESP_OK) {
    if (httpd_query_key_value(buf, "name", nameBuf, sizeof(nameBuf)) ==
        ESP_OK) {
      Serial.println("Simulating detection for: " + String(nameBuf));
      sendAttendance(String(nameBuf));
    }
  }
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, "Simulated. Check server logs.", 27);
}

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  httpd_uri_t index_uri = {.uri = "/",
                           .method = HTTP_GET,
                           .handler = index_handler,
                           .user_ctx = NULL};

  httpd_uri_t simulate_uri = {.uri = "/simulate",
                              .method = HTTP_GET,
                              .handler = simulate_handler,
                              .user_ctx = NULL};

  if (httpd_start(&camera_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(camera_httpd, &index_uri);
    httpd_register_uri_handler(camera_httpd, &simulate_uri);
  }
}

void loop() { delay(10000); }
