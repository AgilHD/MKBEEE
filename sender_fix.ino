#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_err.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>

// ---- Konfigurasi DHT22 ----
#define DHTPIN 4        // sesuaikan dengan pin GPIO yang dipakai
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// MAC ESP8266 (receiver) punyamu
uint8_t TARGET_8266_MAC[6] = { 0x84, 0x0D, 0x8E, 0xB8, 0x37, 0x16 };

// (opsional) broadcast peer untuk diagnosa
uint8_t BCAST[6] = {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF};
const uint8_t ESPNOW_CH = 1;

// Payload: counter + suhu + kelembaban
typedef struct __attribute__((packed)) {
  uint32_t counter;
  float suhu;
  float kelembaban;
} Payload;

// Callback jika data terkirim (ESP-IDF v5.x style untuk ESP32-S3)
void onSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  Serial.print("[CB] Packet sent -> ");
  if (info) {
    const uint8_t *mac = info->des_addr; // <-- gunakan des_addr
    for (int i = 0; i < 6; i++) {
      if (i) Serial.print(":");
      Serial.printf("%02X", mac[i]);
    }
  } else {
    Serial.print("NULL_ADDR");
  }
  Serial.printf(" | Status: %s\n", status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAIL");
}

void addPeer(const uint8_t mac[6], uint8_t ch) {
  if (esp_now_is_peer_exist(mac)) esp_now_del_peer(mac);
  esp_now_peer_info_t p{};
  memcpy(p.peer_addr, mac, 6);
  p.channel = ch;
  p.encrypt = false;
  esp_err_t e = esp_now_add_peer(&p);
  Serial.printf("add_peer %02X:%02X:%02X:%02X:%02X:%02X ch=%u -> %s (%d)\n",
                mac[0],mac[1],mac[2],mac[3],mac[4],mac[5], ch, esp_err_to_name(e), e);
}

void setup() {
  Serial.begin(115200);
  delay(100);

  // Inisialisasi DHT22
  dht.begin();

  // 1) Start Wi-Fi STA benar-benar ON
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);
  esp_wifi_start();
  esp_wifi_set_ps(WIFI_PS_NONE);

  // 2) Kunci channel (HARUS sama dengan receiver)
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(ESPNOW_CH, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  // 3) Init ESPNOW + callback
  esp_err_t e = esp_now_init();
  Serial.printf("esp_now_init -> %s (%d)\n", esp_err_to_name(e), e);
  if (e != ESP_OK) while(true){}
  // daftar callback (pakai signature wifi_tx_info_t)
  esp_now_register_send_cb(onSent);

  // 4) Tambah peer unicast + broadcast (diagnosa)
  addPeer(TARGET_8266_MAC, ESPNOW_CH);
  addPeer(BCAST, ESPNOW_CH);

  Serial.println("Sender ready (ESP32 + DHT22).");
}

void loop() {
  static uint32_t counter = 0;

  // --- Baca sensor DHT22 ---
  float suhu = dht.readTemperature();     // Celcius
  float hum  = dht.readHumidity();

  // Jika gagal baca sensor
  if (isnan(suhu) || isnan(hum)) {
    Serial.println("Gagal baca DHT22!");
    delay(2000);
    return;
  }

  // Siapkan payload
  Payload p{ counter++, suhu, hum };

  // Kirim unicast ke ESP8266
  esp_err_t rc1 = esp_now_send(TARGET_8266_MAC, (uint8_t*)&p, sizeof(p));
  Serial.printf("[TX] unicast -> %s (%d) ctr=%lu | suhu=%.2f | hum=%.2f\n",
                esp_err_to_name(rc1), rc1, p.counter, p.suhu, p.kelembaban);

  // Kirim broadcast (opsional, untuk diagnosa)
  esp_err_t rc2 = esp_now_send(BCAST, (uint8_t*)&p, sizeof(p));
  Serial.printf("[TX] broadcast -> %s (%d)\n", esp_err_to_name(rc2), rc2);

  delay(2000); // baca DHT tiap 2 detik
}