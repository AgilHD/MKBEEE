#include <WiFi.h>
#include <esp_now.h>
#include <esp_mac.h>     // 🔥 ganti esp_wifi.h, diperlukan untuk esp_read_mac()
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// --- Konfigurasi LCD ---
#define SDA_PIN 21
#define SCL_PIN 17
LiquidCrystal_I2C lcd(0x27, 16, 2); // alamat umum 0x27

// --- Struktur data ---
typedef struct __attribute__((packed)) {
  uint32_t counter;
  float suhu;
  float kelembaban;
} Payload;

Payload incomingData;

// --- Callback baru untuk ESP-NOW (sesuai IDF v5) ---
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  char macStr[18];
  snprintf(macStr, sizeof(macStr),
           "%02X:%02X:%02X:%02X:%02X:%02X",
           info->src_addr[0], info->src_addr[1], info->src_addr[2],
           info->src_addr[3], info->src_addr[4], info->src_addr[5]);

  Serial.printf("\n📩 Data dari %s | %d bytes\n", macStr, len);

  if (len == sizeof(Payload)) {
    memcpy(&incomingData, data, sizeof(incomingData));
    Serial.printf("➡ Counter: %lu | 🌡 %.2f °C | 💧 %.2f %%\n",
                  incomingData.counter,
                  incomingData.suhu,
                  incomingData.kelembaban);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Temp: ");
    lcd.print(incomingData.suhu, 1);
    lcd.print(" C");

    lcd.setCursor(0, 1);
    lcd.print("Hum: ");
    lcd.print(incomingData.kelembaban, 1);
    lcd.print(" %");
  } else {
    Serial.println("⚠ Ukuran data tidak cocok!");
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n📡 ESP32-D Receiver + LCD I2C");

  // --- Inisialisasi LCD ---
  Wire.begin(SDA_PIN, SCL_PIN);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Receiver Ready");

  // --- Mode WiFi STA ---
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  WiFi.persistent(false);
  WiFi.setSleep(false);

  // --- Ambil MAC Address valid ---
  uint8_t macAddr[6];
  esp_read_mac(macAddr, ESP_MAC_WIFI_STA); // ✅ benar untuk IDF v5
  Serial.printf("ESP32 MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
                macAddr[0], macAddr[1], macAddr[2],
                macAddr[3], macAddr[4], macAddr[5]);

  // --- Inisialisasi ESP-NOW ---
  if (esp_now_init() != ESP_OK) {
    Serial.println("❌ ESP-NOW init gagal!");
    lcd.setCursor(0, 1);
    lcd.print("ESPNOW FAIL");
    while (true) delay(1000);
  }

  esp_now_register_recv_cb(onDataRecv);
  Serial.println("✅ Receiver siap menerima data DHT22!");
}

void loop() {
  static unsigned long t = 0;
  if (millis() - t >= 2000) {
    Serial.println("(listening...)");
    t = millis();
  }
}
