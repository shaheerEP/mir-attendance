#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <SPI.h>
#include <MFRC522.h>

// -------------------------------------------------------------
// CONFIGURATION
// -------------------------------------------------------------
const char* ssid = "MIR. 4G";
const char* password = "mirpunjab"; // <--- CHANGE THIS to the password for MIR. 4G

// -------------------------------------------------------------
// SELECT YOUR ENVIRONMENT
// -------------------------------------------------------------

// OPTION 1: Local Development (Use your computer's IP)
// const char* serverUrl = "http://192.168.1.8:3000/api/attendance";

// OPTION 2: Vercel Production (Use your website URL)
// REPLACE "https://your-project.vercel.app" with your actual Vercel link
const char* serverUrl = "https://your-project.vercel.app/api/attendance";

// RFID Pins (D1/D2 default for generic NodeMCU/Wemos)
#define SS_PIN  D8  // GPIO15
#define RST_PIN D3  // GPIO0

// -------------------------------------------------------------

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  SPI.begin();
  mfrc522.PCD_Init();

  WiFi.begin(ssid, password);
  Serial.println("");
  
  // Wait for connection
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("Connected to ID: ");
  Serial.println(ssid);
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.println("Ready to scan RFID...");
}

void loop() {
  // Look for new cards
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  // Select one of the cards
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // Create UID String
  String content = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    content.concat(String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : ""));
    content.concat(String(mfrc522.uid.uidByte[i], HEX));
  }
  content.toUpperCase();
  Serial.print("UID Scanned: ");
  Serial.println(content);

  // Send to Server
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client;
    HTTPClient http;

    Serial.print("[HTTP] begin...\n");
    if (http.begin(client, serverUrl)) {  // HTTP

      http.addHeader("Content-Type", "application/json");
      
      // JSON Payload
      String payload = "{\"uid\":\"" + content + "\"}";
      
      Serial.print("[HTTP] POST...\n");
      // start connection and send HTTP header
      int httpCode = http.POST(payload);

      // httpCode will be negative on error
      if (httpCode > 0) {
        // HTTP header has been send and Server response header has been handled
        Serial.printf("[HTTP] POST... code: %d\n", httpCode);

        // file found at server
        if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
          String payload = http.getString();
          Serial.println(payload);
        }
      } else {
        Serial.printf("[HTTP] POST... failed, error: %s\n", http.errorToString(httpCode).c_str());
      }
      http.end();
    } else {
      Serial.printf("[HTTP] Unable to connect\n");
    }
  }

  // Halt PICC
  mfrc522.PICC_HaltA();
  // Stop encryption on PCD
  mfrc522.PCD_StopCrypto1();
  
  // Delay to prevent double reading
  delay(1000);
}
