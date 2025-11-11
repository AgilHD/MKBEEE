#include <WiFi.h>
#include <esp_now.h>
#include <esp_mac.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <driver/i2s.h>
#include <math.h>

// ==========================
// Konfigurasi LCD & Audio
// ==========================
#define SDA_PIN 21
#define SCL_PIN 17
LiquidCrystal_I2C lcd(0x27, 16, 2);

#define I2S_BCLK 26
#define I2S_LRC  25
#define I2S_DOUT 22

// ==========================
// Struktur Data
// ==========================
typedef struct _attribute_((packed)) {
  uint8_t type;           // 0 = suhu/kelembapan | 1 = cry detect
  uint32_t counter;
  float suhu;
  float kelembaban;
  bool cry_detected;
} Payload;

Payload incomingData;

// ==========================
// Variabel global status
// ==========================
bool alarmTriggered = false;
float lastTemperature = 0;
bool cryDetected = false;

// ==========================
// Audio setup
// ==========================
void setupI2S() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = 16000,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_I2S,
    .intr_alloc_flags = 0,
    .dma_buf_count = 8,
    .dma_buf_len = 128,
    .use_apll = false
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_BCLK,
    .ws_io_num = I2S_LRC,
    .data_out_num = I2S_DOUT,
    .data_in_num = I2S_PIN_NO_CHANGE
  };

  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);
  i2s_start(I2S_NUM_0);
  i2s_zero_dma_buffer(I2S_NUM_0);
}

void playTone(float freq, int dur_ms, float volume = 0.4f) {
  const int sample_rate = 16000;
  const float amplitude = 32767.0f * volume;
  int total_samples = (sample_rate * dur_ms) / 1000;

  for (int i = 0; i < total_samples; i++) {
    float sample = sin(2.0f * PI * freq * i / sample_rate);
    int16_t s = (int16_t)(sample * amplitude);
    size_t written;
    i2s_write(I2S_NUM_0, &s, sizeof(s), &written, portMAX_DELAY);
  }
}

void playAlarm() {
  unsigned long startTime = millis();
  while (millis() - startTime < 5000) {
    playTone(880, 200, 0.5);
    delay(50);
    playTone(660, 200, 0.5);
    delay(50);
  }
  i2s_zero_dma_buffer(I2S_NUM_0);
}

// ==========================
// Fungsi trigger alarm
// ==========================
void checkAndTriggerAlarm() {
  bool tempHigh = (lastTemperature > 31.0);
  bool trigger = tempHigh || cryDetected;

  if (trigger && !alarmTriggered) {
    alarmTriggered = true;
    Serial.println("🚨 ALARM TRIGGERED!");
    lcd.clear();
    lcd.setCursor(0, 0);
    if (tempHigh && cryDetected)
      lcd.print("🔥 HOT & CRYING!");
    else if (tempHigh)
      lcd.print("Hot > 31 C");
    else if (cryDetected)
      lcd.print("👶 BABY CRY!");
    playAlarm();
  } 
  else if (!trigger && alarmTriggered) {
    alarmTriggered = false;
    Serial.println("✅ Alarm reset");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Normal Condition");
  }
}

// ==========================
// Tambah Peer jika baru
// ==========================
void addPeerIfNew(const uint8_t *mac) {
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, mac, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;

  if (!esp_now_is_peer_exist(mac)) {
    if (esp_now_add_peer(&peerInfo) == ESP_OK) {
      Serial.printf("🟢 Peer baru: %02X:%02X:%02X:%02X:%02X:%02X\n",
                    mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    }
  }
}

// ==========================
// Callback ESP-NOW
// ==========================
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  char macStr[18];
  snprintf(macStr, sizeof(macStr),
           "%02X:%02X:%02X:%02X:%02X:%02X",
           info->src_addr[0], info->src_addr[1], info->src_addr[2],
           info->src_addr[3], info->src_addr[4], info->src_addr[5]);

  Serial.printf("\n📩 Data dari %s | %d bytes\n", macStr, len);
  addPeerIfNew(info->src_addr);

  if (len == 12) {
    // --- Data dari sender DHT22 ---
    memcpy(&incomingData.counter, data, 4);
    memcpy(&incomingData.suhu, data + 4, 4);
    memcpy(&incomingData.kelembaban, data + 8, 4);
    incomingData.type = 0;
    incomingData.cry_detected = false;

    lastTemperature = incomingData.suhu;

    Serial.printf("🌡 Temp: %.2f°C | 💧 Hum: %.2f%%\n",
                  incomingData.suhu, incomingData.kelembaban);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Temp: ");
    lcd.print(incomingData.suhu, 1);
    lcd.print(" C");
    lcd.setCursor(0, 1);
    lcd.print("Hum: ");
    lcd.print(incomingData.kelembaban, 1);
    lcd.print(" %");
  }

  else if (len == sizeof(Payload)) {
    // --- Data dari sender Cry Detection ---
    memcpy(&incomingData, data, sizeof(incomingData));

    cryDetected = incomingData.cry_detected;
    Serial.printf("👶 Cry Detected: %s\n", cryDetected ? "TRUE" : "FALSE");

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(cryDetected ? "👶 Baby Crying!" : "No Cry Detected");
  }

  else {
    Serial.printf("⚠ Ukuran data tidak dikenal: %d bytes\n", len);
  }

  // Cek apakah alarm perlu dinyalakan
  checkAndTriggerAlarm();
}

// ==========================
// Setup
// ==========================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n📡 Receiver 2 ESP (DHT22 + Cry)");

  Wire.begin(SDA_PIN, SCL_PIN);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Receiver Ready");

  setupI2S();

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  WiFi.persistent(false);
  WiFi.setSleep(false);

  uint8_t macAddr[6];
  esp_read_mac(macAddr, ESP_MAC_WIFI_STA);
  Serial.printf("Receiver MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
                macAddr[0], macAddr[1], macAddr[2],
                macAddr[3], macAddr[4], macAddr[5]);

  if (esp_now_init() != ESP_OK) {
    Serial.println("❌ ESP-NOW init gagal!");
    lcd.setCursor(0, 1);
    lcd.print("ESPNOW FAIL");
    while (true) delay(1000);
  }

  esp_now_register_recv_cb(onDataRecv);
  Serial.println("✅ Receiver siap menerima dari 2 ESP!");
}

// ==========================
// Loop
// ==========================
void loop() {
  static unsigned long t = 0;
  if (millis() - t >= 3000) {
    Serial.println("(listening...)");
    t = millis();
  }
}
