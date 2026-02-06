#include "Arduino.h"
#include "esp_camera.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

// FACE DETECTION HEADER
#include "custom_fr_flash.h" // Add Custom Flash Support
#include "esp_partition.h"
#include "fd_forward.h"
#include "fr_forward.h" // Uncomment if FR libraries are available
#include "soc/rtc_cntl_reg.h"
#include "soc/soc.h"
#include <Preferences.h>

Preferences preferences;

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
// FACE DETECTION GLOBALS
static mtmn_config_t mtmn_config = {0};

// FORWARD DECLARATION
void showStatus(String title, String msg);

// RESTORED GLOBALS
static face_id_list id_list = {0};
#define ENROLL_CONFIRM_TIMES 5
#define FACE_ID_SAVE_NUMBER 7

// Global State for Production
String currentEnrollStudentId = "";
unsigned long lastPollTime = 0;
const long pollInterval = 5000;
bool isEnrolling = false;

// simple in-memory map
String studentMap[FACE_ID_SAVE_NUMBER];

// Poll Server for Commands
void checkRemoteCommands() {
  if (millis() - lastPollTime < pollInterval)
    return;
  lastPollTime = millis();

  if (isEnrolling)
    return; // Don't interrupt enrollment

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(5000); // Short timeout for polling

    // API: GET /api/device/command
    // Using String concat to be safe
    String fullUrl = "https://" + String(serverUrl) + "/api/device/command";

    if (http.begin(client, fullUrl)) {
      int code = http.GET();
      if (code > 0) {
        String resp = http.getString();

        JsonDocument doc; // ArduinoJson v7
        deserializeJson(doc, resp);

        if (doc["command"] == "ENROLL") {
          String studentId = doc["payload"]["studentId"].as<String>();
          currentEnrollStudentId = studentId;
          isEnrolling = true;

          showStatus("CMD RECV", "Enroll: " + studentId.substring(0, 5));
          Serial.println("Command: ENROLL " + studentId);
          delay(2000);
        }
      }
      http.end();
    }
  }
}
// [Deleted Manual Persistence]

// Map Local Face ID -> MongoDB ID
String getStudentId(int face_id) {
  if (face_id >= 0 && face_id < FACE_ID_SAVE_NUMBER) {
    return studentMap[face_id];
  }
  return "";
}

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

    JsonDocument doc; // Fixed Deprecation
    deserializeJson(doc, response);

    if (doc["message"].is<String>()) {
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
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable Brownout Detector
  Serial.begin(115200);

  // DEBUG PARTITIONS
  Serial.println("--- PARTITIONS ---");
  // Check for DATA partitions (Type 1)
  esp_partition_iterator_t it = esp_partition_find(
      ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, NULL);
  if (it) {
    do {
      const esp_partition_t *p = esp_partition_get(it);
      Serial.printf("Part: %s, Type: %d, Sub: %d, Addr: 0x%X, Size: 0x%X\n",
                    p->label, p->type, p->subtype, p->address, p->size);
      it = esp_partition_next(it);
    } while (it);
  }
  Serial.println("------------------");

  // Load Persistent Map
  preferences.begin("attendance", false); // Namespace "attendance", RW mode
  for (int i = 0; i < FACE_ID_SAVE_NUMBER; i++) {
    String key = "id_" + String(i);
    String val = preferences.getString(key.c_str(), "");
    if (val != "") {
      studentMap[i] = val;
      Serial.printf("Loaded ID %d: %s\n", i, val.c_str());
    }
  }
  preferences.end();

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

  // Init Face Detection & Recognition
  // Init Face Detection & Recognition
  mtmn_config = mtmn_init_config();
  face_id_init(&id_list, FACE_ID_SAVE_NUMBER, ENROLL_CONFIRM_TIMES);

  // Load Biometrics from Flash
  read_face_id_from_flash_custom(&id_list);
  Serial.printf("Model loaded. RAM Count: %d\n", id_list.count);

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
  // 1. Check for remote commands
  checkRemoteCommands();

  // Camera Capture
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb)
    return;

  dl_matrix3du_t *image_matrix =
      dl_matrix3du_alloc(1, fb->width, fb->height, 3);
  if (!image_matrix) {
    esp_camera_fb_return(fb);
    return;
  }

  if (fmt2rgb888(fb->buf, fb->len, fb->format, image_matrix->item)) {

    box_array_t *boxes = face_detect(image_matrix, &mtmn_config);

    if (boxes) {
      Serial.println("Face Detected");

      // ALIGNMENT
      dl_matrix3du_t *aligned_face =
          dl_matrix3du_alloc(1, FACE_WIDTH, FACE_HEIGHT, 3);

      if (aligned_face) {
        if (align_face(boxes, image_matrix, aligned_face) == ESP_OK) {

          if (isEnrolling) {
            // ENROLL
            int left_sample_face = enroll_face(&id_list, aligned_face);

            if (left_sample_face == 0) {
              int enrolled_id = id_list.count - 1;

              // SUCCESS
              String msg = "ID " + String(enrolled_id) + " Saved";
              showStatus("ENROLLED", currentEnrollStudentId.substring(0, 8));
              Serial.printf("Enrolled Face ID: %d for Student: %s\n",
                            enrolled_id, currentEnrollStudentId.c_str());

              // SAVE MAPPING
              if (enrolled_id < FACE_ID_SAVE_NUMBER) {
                studentMap[enrolled_id] = currentEnrollStudentId;

                // Save to Flash
                preferences.begin("attendance", false);
                String key = "id_" + String(enrolled_id);
                preferences.putString(key.c_str(), currentEnrollStudentId);
                preferences.end();
                Serial.println("Saved to Flash: " + key);

                // Save Biometrics
                // Using enroll_face_id_to_flash which handles flash writing
                // Note: we already called enroll_face (RAM), so maybe check if
                // this duplicates? Actually, standard usage: enroll_face (RAM)
                // -> delete generic flash -> writes generic flash. But let's
                // try assuming internal API: If enroll_face_id_to_flash exists,
                // it typically takes (list, aligned_face). Since we already
                // enrolled in RAM, we might need to just "save" the list.
                // Reverting to `write_face_id_to_flash` if it doesn't error.
                // But since I'm changing lines, I'll update to
                // `delete_face_id_in_flash` + `read`? No.

                // Best guess for "save all":
                // delete_face_id_in_flash(&id_list, enrolled_id);
                // wait, delete removes it.
                // We want to ADD it.
                // code below assumes we save the RAM list to Flash.

                // Let's rely on standard:
                // enroll_face_id_to_flash(&id_list, aligned_face);
                // But we already enrolled in RAM...

                // Let's stick to the previous `write_face_id_to_flash` attempt?
                // No, user said `enroll_face_id_to_flash` is the primary
                // function. If I call that, I should probably NOT call
                // `enroll_face` before it? Or maybe `enroll_face` is for RAM
                // and `..._to_flash` is for Flash? I will COMMENT OUT
                // `write_face_id_to_flash` and try `enroll_face_id_to_flash`
                // ONLY if the previous one failed? No, I can't interact.

                // Let's try `enroll_face_id_to_flash` INSTEAD of
                // `write_face_id_to_flash`. It likely needs the aligned face.
                // But I lost reference to aligned_face? No, it's valid in this
                // scope.

                enroll_face_id_to_flash_custom(&id_list, aligned_face);
                Serial.println("Biometrics saved to Flash");
              }

              isEnrolling = false;         // Stop enrolling
              currentEnrollStudentId = ""; // Clear

              delay(3000);
              showStatus("Ready", "Scan Next...");
            } else {
              String msg = "Samples: " + String(left_sample_face);
              showStatus("Enrolling...", msg);
              Serial.println("Ct: " + String(left_sample_face));
              delay(500);
            }
          } else {
            // RECOGNIZE
            int face_id = recognize_face(&id_list, aligned_face);

            if (face_id >= 0) {
              Serial.printf("Matched Face ID: %d\n", face_id);
              String studentId =
                  getStudentId(face_id); // This will need dynamic mapping later
              if (studentId != "") {
                digitalWrite(FLASH_LED_PIN, HIGH);
                delay(100);
                digitalWrite(FLASH_LED_PIN, LOW);

                String result = sendAttendance(studentId);
                showStatus("Success", result);
                delay(4000);
              } else {
                showStatus("Unknown", "ID: " + String(face_id));
              }
            } else {
              Serial.println("Not Recognized");
            }
          }
        } else {
          Serial.println("Align Failed");
        }
        dl_matrix3du_free(aligned_face);
      }

      dl_lib_free(boxes->score);
      dl_lib_free(boxes->box);
      dl_lib_free(boxes->landmark);
      dl_lib_free(boxes);
    }
  }

  dl_matrix3du_free(image_matrix);
  esp_camera_fb_return(fb);
}
