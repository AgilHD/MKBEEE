#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_err.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>
#include <DHT_U.h>
#include <WebServer.h>  // Web API
#include <HTTPClient.h> // optional

// =======================
// --- Konfigurasi WiFi ---
// =======================
const char* ssid     = "seipa";
const char* password = "00000001";

WebServer server(80);
String statusCry = "TidakMenangis";   // konsisten: tanpa spasi

// =======================
// --- Konfigurasi TFT ---
// =======================
#define TFT_CS   5
#define TFT_DC   2
#define TFT_RST  14
#define TFT_SCLK 12
#define TFT_MOSI 13

SPIClass spiTFT = SPIClass(HSPI);
Adafruit_ST7735 tft = Adafruit_ST7735(&spiTFT, TFT_CS, TFT_DC, TFT_RST);

// =======================
// --- Konfigurasi DHT ---
// =======================
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// =======================
// --- MAC Receiver (ESP Parent) ---
// =======================
// GANTI SESUAI MAC RECEIVER PARENT
uint8_t TARGET_8266_MAC[6] = {0x38, 0x18, 0x2B, 0x80, 0x59, 0x68};
uint8_t BCAST[6]           = {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF};

// Kalau mau aman, untuk peer.channel bisa pakai 0 (ikut channel WiFi aktif)
const uint8_t ESPNOW_CH = 0;

// =======================
// --- Struktur Data ---
// =======================

// Payload DHT – 12 byte
typedef struct __attribute__((packed)) {
  uint32_t counter;
  float suhu;
  float kelembaban;
} PayloadDHT;

// Payload Cry – harus sama dengan yang di receiver
typedef struct __attribute__((packed)) {
  uint8_t type;           // 0 = suhu/kelembapan | 1 = cry detect
  uint32_t counter;
  float suhu;
  float kelembaban;
  bool cry_detected;
} PayloadCry;

// =======================
// --- Variabel Global ---
// =======================
uint32_t counter = 0;
uint32_t lastChange = 0;
uint32_t expressionInterval = 500; // 0.5 detik
int currentExpression = 0;
uint32_t lastSend = 0;

// =======================
// --- Callback Send ---
// =======================
void onSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  const char *stat = (status == ESP_NOW_SEND_SUCCESS) ? "OK" : "FAIL";
  Serial.printf("[CB] Send %s\n", stat);

  if (info != nullptr) {
    char macStr[18];
    snprintf(macStr, sizeof(macStr),
             "%02X:%02X:%02X:%02X:%02X:%02X",
             info->des_addr[0], info->des_addr[1], info->des_addr[2],
             info->des_addr[3], info->des_addr[4], info->des_addr[5]);
    Serial.print("  -> Dest MAC: "); Serial.println(macStr);
  }
}

// =======================
// --- Tambah Peer ---
// =======================
void addPeer(const uint8_t mac[6]) {
  esp_now_peer_info_t p;
  memset(&p, 0, sizeof(p));
  memcpy(p.peer_addr, mac, 6);
  p.channel = ESPNOW_CH;        // 0 = ikut channel WiFi aktif
  p.ifidx   = WIFI_IF_STA;
  p.encrypt = false;

  if (esp_now_is_peer_exist(mac)) esp_now_del_peer(mac);

  esp_err_t res = esp_now_add_peer(&p);
  if (res == ESP_OK) Serial.println("Peer ditambahkan.");
  else Serial.printf("esp_now_add_peer gagal: %d\n", res);
}

// =======================
// --- Gambar Ekspresi ---
// =======================
void drawFace(int mode) {
  uint16_t bg = tft.color565(20, 25, 35);
  uint16_t eyeColor = tft.color565(0, 255, 255);
  uint16_t mouthColor = tft.color565(0, 255, 180);
  tft.fillScreen(bg);

  int eyeSize = 45;
  int eyeY = 40;
  int leftX = 35;
  int rightX = 35 + eyeSize + 15;
  int radius = 10;

  if (mode == 0) {
    // 😀 Senyum
    tft.fillRoundRect(leftX, eyeY, eyeSize, eyeSize, radius, eyeColor);
    tft.fillRoundRect(rightX, eyeY, eyeSize, eyeSize, radius, eyeColor);
    tft.drawLine(65, 115, 105, 115, mouthColor);
  } else if (mode == 1) {
    // 😲 Terkejut (dipakai untuk Menangis)
    tft.fillRoundRect(leftX, eyeY, eyeSize, eyeSize, radius, eyeColor);
    tft.fillRoundRect(rightX, eyeY, eyeSize, eyeSize, radius, eyeColor);
    tft.drawCircle(85, 115, 8, mouthColor);
  } else if (mode == 2) {
    // 😬 Gemas (>_<)
    tft.drawLine(leftX, eyeY + 10, leftX + 20, eyeY + 22, eyeColor);
    tft.drawLine(leftX, eyeY + 22, leftX + 20, eyeY + 34, eyeColor);
    tft.drawLine(rightX + 20, eyeY + 10, rightX, eyeY + 22, eyeColor);
    tft.drawLine(rightX + 20, eyeY + 34, rightX, eyeY + 22, eyeColor);
    tft.drawLine(75, 115, 95, 115, mouthColor);
  } else if (mode == 3) {
    // 😑 Kedip
    tft.fillRect(leftX, eyeY + eyeSize/2, eyeSize, 4, eyeColor);
    tft.fillRect(rightX, eyeY + eyeSize/2, eyeSize, 4, eyeColor);
    tft.drawLine(70, 115, 100, 115, mouthColor);
  }
}

// =======================
// --- WebServer Handlers ---
// =======================

// Kirim paket cry ke parent
void sendCryToParent(bool isCrying) {
  PayloadCry cry{};
  cry.type         = 1;         // 1 = cry detect
  cry.counter      = counter++;
  cry.suhu         = -1.0f;     // bisa diabaikan di receiver
  cry.kelembaban   = -1.0f;
  cry.cry_detected = isCrying;

  esp_err_t r1 = esp_now_send(TARGET_8266_MAC, (uint8_t*)&cry, sizeof(cry));
  esp_err_t r2 = esp_now_send(BCAST,          (uint8_t*)&cry, sizeof(cry));

  Serial.printf("[ESP-NOW] Cry packet sent (cry=%d) res=(%d,%d)\n",
                isCrying ? 1 : 0, r1, r2);
}

// /cry: validasi status, update TFT, kirim alert saat "Menangis", dan tahan 15 detik
void handleCryStatus() {
  if (server.hasArg("status")) {
    String newStatus = server.arg("status");

    if (newStatus == "Menangis" || newStatus == "TidakMenangis") {
      statusCry = newStatus;
      Serial.println("[HTTP] Status tangisan diterima: " + statusCry);

      if (statusCry == "Menangis") {
        Serial.println("[LOG] Menerima status 'Menangis' dari web. Menampilkan ekspresi & kirim ke parent.");
        drawFace(1); // 😲 Terkejut sebagai ekspresi menangis
        Serial.println("[ESP-LCD] Menampilkan ekspresi: Menangis");

        // Kirim info cry ke ESP parent
        sendCryToParent(true);

        // Kirim respon dulu agar client tidak nunggu lama
        server.send(200, "text/plain", "OK: Menangis");

        // Tahan 15 detik agar tampilan 'Menangis' terlihat dulu sebelum update baru
        Serial.println("[DELAY] Menahan update 15 detik...");
        delay(15000);
        return; // selesai handler
      } else {
        Serial.println("[LOG] Menerima status 'TidakMenangis' dari web. Reset ekspresi & kirim ke parent.");
        drawFace(0); // 😀 Senyum
        Serial.println("[ESP-LCD] Menampilkan ekspresi: TidakMenangis");

        // Kirim info ke parent bahwa sudah tidak menangis
        sendCryToParent(false);

        server.send(200, "text/plain", "OK: TidakMenangis");
        return;
      }
    } else {
      Serial.println("[HTTP] Status tidak valid: " + newStatus);
      server.send(400, "text/plain", "Status harus 'Menangis' atau 'TidakMenangis'");
      return;
    }
  }
  // Jika tidak ada argumen, balas status terakhir
  server.send(200, "text/plain", "OK: " + statusCry);
}

// =======================
// --- Setup ---
// =======================
void setup() {
  Serial.begin(115200);
  delay(100);

  dht.begin();

  // TFT init
  spiTFT.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  tft.initR(INITR_BLACKTAB);     // ganti GREENTAB/REDTAB jika layar blank
  tft.setRotation(1);
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(10, 30);
  tft.println("ESP32-S3 Face Sender");
  delay(1000);

  // WiFi untuk webserver
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Menghubungkan WiFi");
  unsigned long startWiFi = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - startWiFi > 30000) {
      Serial.println("\nGagal konek WiFi dalam 30 detik. Melanjutkan tanpa WiFi.");
      break;
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Tersambung. IP: " + WiFi.localIP().toString());
    Serial.printf("Channel WiFi: %d\n", WiFi.channel());

    // Pasang handlers
    server.on("/cry", handleCryStatus);

    server.on("/sensors", HTTP_GET, []() {
      float suhu = dht.readTemperature();
      float kelembaban = dht.readHumidity();

      if (!isnan(suhu) && !isnan(kelembaban)) {
        String json = "{";
        json += "\"tempC\":" + String(suhu, 2) + ",";
        json += "\"rh\":" + String(kelembaban, 2) + ",";
        json += "\"timestamp\":" + String(millis());
        json += "}";
        server.send(200, "application/json", json);
        Serial.println("[HTTP] Sensor data sent: " + json);
      } else {
        server.send(500, "application/json", "{\"error\":\"Failed to read sensor\"}");
        Serial.println("[HTTP] Failed to read sensor data");
      }
    });

    server.begin();
  } else {
    Serial.println("WiFi tidak tersambung - Web API tidak aktif.");
  }

  // ESP-NOW init
  esp_err_t initRes = esp_now_init();
  if (initRes != ESP_OK) {
    Serial.printf("ESP-NOW init gagal: %d\n", initRes);
  } else {
    esp_now_register_send_cb(onSent);
    addPeer(TARGET_8266_MAC);
    addPeer(BCAST);
  }

  drawFace(0);
}

// =======================
// --- Loop ---
// =======================
void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    server.handleClient();
  }

  uint32_t now = millis();

  // Animasi idle tiap 0.5 detik
  if (now - lastChange > expressionInterval) {
    lastChange = now;
    if (currentExpression == 3) currentExpression = 0;
    else if (random(0, 10) < 2) currentExpression = random(1, 3);
    else if (random(0, 10) < 3) currentExpression = 3;
    else currentExpression = 0;
    drawFace(currentExpression);
  }

  // Telemetri DHT tiap 2 detik via ESP-NOW (12 byte – cocok len==12 di receiver)
  if (now - lastSend > 2000) {
    lastSend = now;
    float suhu = dht.readTemperature();
    float hum  = dht.readHumidity();

    if (!isnan(suhu) && !isnan(hum)) {
      PayloadDHT p{ counter++, suhu, hum };
      esp_err_t res1 = esp_now_send(TARGET_8266_MAC, (uint8_t*)&p, sizeof(p));
      esp_err_t res2 = esp_now_send(BCAST,          (uint8_t*)&p, sizeof(p));
      Serial.printf("[TX] #%lu Suhu=%.2fC | Hum=%.2f%% (res %d, %d)\n",
                    p.counter, suhu, hum, res1, res2);
    } else {
      Serial.println("[TX] Gagal baca DHT (NaN)");
    }
  }

  delay(10); // stabilitas loop
}
