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
const char* serverUrl = "https://mir-attendance.vercel.app/api/attendance";

// RFID Pins (D1/D2 default for generic NodeMCU/Wemos)
#define SS_PIN  D8  // GPIO15
#define RST_PIN D3  // GPIO0

// LED Pins
#define LED_GREEN D1 // GPIO5
#define LED_RED   D2 // GPIO4
#define LED_YELLOW D4 // GPIO2

// -------------------------------------------------------------

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  SPI.begin();
  mfrc522.PCD_Init();

  // Setup LEDs
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_YELLOW, LOW);

  // Test Blink on Startup
  digitalWrite(LED_GREEN, HIGH); delay(200); digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, HIGH); delay(200); digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, HIGH); delay(200); digitalWrite(LED_RED, LOW);

  WiFi.begin(ssid, password);
  Serial.println("");
  
  // Wait for connection
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_RED, HIGH); // Blink Red while connecting
    delay(250);
    digitalWrite(LED_RED, LOW);
    delay(250);
    Serial.print(".");
  }
  
  // Connected Signal (Green Blink x 3)
  for(int i=0; i<3; i++) {
    digitalWrite(LED_GREEN, HIGH); delay(100);
    digitalWrite(LED_GREEN, LOW); delay(100);
  }

  Serial.println("");
  Serial.print("Connected to ID: ");
  Serial.println(ssid);
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.println("Ready to scan RFID...");
}

void loop() {
  // 1. Continuous Network Check (Priority)
  // If WiFi is lost, blink Red and retry next loop.
  // This ensures "Out of Range" indication works even without a card.
  if (WiFi.status() != WL_CONNECTED) {
      digitalWrite(LED_RED, HIGH); delay(250);
      digitalWrite(LED_RED, LOW); delay(250);
      return; 
  }

  // 2. Look for new cards
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  // 3. Select one of the cards
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // 4. Create UID String
  String content = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    content.concat(String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : ""));
    content.concat(String(mfrc522.uid.uidByte[i], HEX));
  }
  content.toUpperCase();
  Serial.print("UID Scanned: ");
  Serial.println(content);

  // 5. Send to Server (We are connected)
  WiFiClientSecure client;
  client.setInsecure(); // Disable SSL certificate verification
  HTTPClient http;

  Serial.print("[HTTP] begin...\n");
  
  if (http.begin(client, serverUrl)) {  
    http.addHeader("Content-Type", "application/json");
    
    // JSON Payload
    String payload = "{\"uid\":\"" + content + "\"}";
    
    Serial.print("[HTTP] POST...\n");
    int httpCode = http.POST(payload);
    
    if (httpCode > 0) {
      Serial.printf("[HTTP] POST... code: %d\n", httpCode);

      // SUCCESS cases (200 OK, 201 Created)
      if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
        String payload = http.getString();
        Serial.println(payload);
        
        // SUCCESS FEEDBACK: Green Light 1.5s
        digitalWrite(LED_GREEN, HIGH);
        delay(1500);
        digitalWrite(LED_GREEN, LOW);
        
      } else if (httpCode == 206) {
           // HALF DAY FEEDBACK: Yellow AND Green Light 1.5s
           String payload = http.getString();
           Serial.println(payload);

           digitalWrite(LED_YELLOW, HIGH);
           digitalWrite(LED_GREEN, HIGH);
           delay(1500);
           digitalWrite(LED_YELLOW, LOW);
           digitalWrite(LED_GREEN, LOW);

      } else {
        // ERROR cases (403, 404, 500, 409 etc)
        Serial.printf("[HTTP] Server Error: %d\n", httpCode);
        
        // ERROR FEEDBACK: Red Light Blink 2 Times
        for(int i=0; i<2; i++) {
           digitalWrite(LED_RED, HIGH);
           delay(500);
           digitalWrite(LED_RED, LOW);
           delay(300);
        }
      }
    } else {
      Serial.printf("[HTTP] POST... failed, error: %s\n", http.errorToString(httpCode).c_str());
      // NETWORK FAIL: Quick Red Blinks
      for(int i=0; i<5; i++) {
          digitalWrite(LED_RED, HIGH); delay(100);
          digitalWrite(LED_RED, LOW); delay(100);
      }
    }
    http.end();
  } else {
    Serial.printf("[HTTP] Unable to connect\n");
    // CONN FAIL: Quick Red Blinks
    for(int i=0; i<5; i++) {
        digitalWrite(LED_RED, HIGH); delay(100);
        digitalWrite(LED_RED, LOW); delay(100);
    }
  }

  // Halt PICC
  mfrc522.PICC_HaltA();
  // Stop encryption on PCD
  mfrc522.PCD_StopCrypto1();
  
  // Delay to prevent double reading
  delay(100);
}
