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
// --- MAC Receiver ---
// =======================
uint8_t TARGET_8266_MAC[6] = {0x38, 0x18, 0x2B, 0x80, 0x59, 0x68};
uint8_t BCAST[6]           = {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF};
const uint8_t ESPNOW_CH = 1;

// =======================
// --- Struktur Data ---
// =======================
typedef struct __attribute__((packed)) {
  uint32_t counter;
  float suhu;
  float kelembaban;
} Payload;

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
  Serial.printf("[CB] Send %s\n", status == ESP_NOW_SEND_SUCCESS ? "OK" : "FAIL");
}

// =======================
// --- Tambah Peer ---
// =======================
void addPeer(const uint8_t mac[6], uint8_t ch) {
  if (esp_now_is_peer_exist(mac)) esp_now_del_peer(mac);
  esp_now_peer_info_t p{};
  memcpy(p.peer_addr, mac, 6);
  p.channel = ch;
  p.encrypt = false;
  esp_now_add_peer(&p);
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
    tft.drawLine(65, 116, 105, 116, mouthColor);
  } 
  else if (mode == 1) {
    // 😲 Terkejut
    tft.fillRoundRect(leftX, eyeY, eyeSize, eyeSize, radius, eyeColor);
    tft.fillRoundRect(rightX, eyeY, eyeSize, eyeSize, radius, eyeColor);
    tft.drawCircle(85, 115, 8, mouthColor);
  } 
  else if (mode == 2) {
    // 😬 Gemas (>_<)
    // Mata kiri: ">" (dua garis miring ke dalam)
    tft.drawLine(leftX, eyeY + 10, leftX + 20, eyeY + 22, eyeColor);  // garis bawah
    tft.drawLine(leftX, eyeY + 22, leftX + 20, eyeY + 34, eyeColor);  // garis atas

    // Mata kanan: "<" (dua garis miring ke dalam)
    tft.drawLine(rightX + 20, eyeY + 10, rightX, eyeY + 22, eyeColor);
    tft.drawLine(rightX + 20, eyeY + 34, rightX, eyeY + 22, eyeColor);

    // Mulut: garis pendek horizontal
    tft.drawLine(75, 115, 95, 115, mouthColor);
  } 
  else if (mode == 3) {
    // 😑 Kedip
    tft.fillRect(leftX, eyeY + eyeSize/2, eyeSize, 4, eyeColor);
    tft.fillRect(rightX, eyeY + eyeSize/2, eyeSize, 4, eyeColor);
    tft.drawLine(70, 115, 100, 115, mouthColor);
  }
}


// =======================
// --- Setup ---
// =======================
void setup() {
  Serial.begin(115200);
  dht.begin();

  spiTFT.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  tft.initR(INITR_BLACKTAB);
  tft.setRotation(1);
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(10, 30);
  tft.println("ESP32-S3 Face Sender");
  delay(1000);

  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);
  esp_wifi_start();
  esp_wifi_set_ps(WIFI_PS_NONE);
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(ESPNOW_CH, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);
  esp_now_init();
  esp_now_register_send_cb(onSent);
  addPeer(TARGET_8266_MAC, ESPNOW_CH);
  addPeer(BCAST, ESPNOW_CH);

  drawFace(0);
}

// =======================
// --- Loop ---
// =======================
void loop() {
  uint32_t now = millis();

  if (now - lastChange > expressionInterval) {
    lastChange = now;
    if (currentExpression == 3) currentExpression = 0;
    else if (random(0, 10) < 2) currentExpression = random(1, 3);
    else if (random(0, 10) < 3) currentExpression = 3;
    else currentExpression = 0;
    drawFace(currentExpression);
  }

  if (now - lastSend > 2000) {
    lastSend = now;
    float suhu = dht.readTemperature();
    float hum = dht.readHumidity();
    if (!isnan(suhu) && !isnan(hum)) {
      Payload p{ counter++, suhu, hum };
      esp_now_send(TARGET_8266_MAC, (uint8_t*)&p, sizeof(p));
      esp_now_send(BCAST, (uint8_t*)&p, sizeof(p));
      Serial.printf("[TX] #%lu Suhu=%.2fC | Hum=%.2f%%\n", p.counter, suhu, hum);
    }
  }
}
