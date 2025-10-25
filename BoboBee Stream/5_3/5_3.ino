#include "esp_camera.h"
#include <WiFi.h>
#include <Preferences.h>

// ====== Video (tetap pakai addon kamu)
#include "cam_stream_addon.h"

// ====== Audio (PDM -> WebSocket BIN PCM16)
#include <WebSocketsServer.h>
#include "ESP_I2S.h"

// -------------------------------
// PIN KAMERA (DFRobot ESP32-S3 AI Camera)
// (sudah sesuai di cam_stream_addon.h, cukup ulang untuk kejelasan)
#define PWDN_GPIO_NUM   -1
#define RESET_GPIO_NUM  -1
#define XCLK_GPIO_NUM   5
#define SIOD_GPIO_NUM   8
#define SIOC_GPIO_NUM   9
#define Y9_GPIO_NUM     4
#define Y8_GPIO_NUM     6
#define Y7_GPIO_NUM     7
#define Y6_GPIO_NUM     14
#define Y5_GPIO_NUM     17
#define Y4_GPIO_NUM     21
#define Y3_GPIO_NUM     18
#define Y2_GPIO_NUM     16
#define VSYNC_GPIO_NUM  1
#define HREF_GPIO_NUM   2
#define PCLK_GPIO_NUM   15

#define LED_GPIO_NUM    47

// -------------------------------
// I2S PDM MIC (DFRobot S3 AI Cam)
#define I2S_SAMPLE_RATE     (16000)    // 16 kHz
#define I2S_DATA_BIT        I2S_DATA_BIT_WIDTH_32BIT
#define I2S_CHANNEL_FORMAT  I2S_SLOT_MODE_MONO
#define I2S_SCK_IO          GPIO_NUM_38          // PDM CLK
#define I2S_SD_IO_DEFAULT   GPIO_NUM_39          // PDM DATA default
#define ALT_SD_PIN          GPIO_NUM_40          // fallback DATA

// Gain software (boleh diubah)
#define SOFTWARE_GAIN       (3.0f)     // 6..12 umumnya pas (mulai konservatif 3)

// Buffer input 32-bit dari I2S
#define AUDIO_BUF_32_COUNT  (1024)
static int32_t buffer_in_32[AUDIO_BUF_32_COUNT * 2];  // safety

// -------------------------------
// GLOBALS
Preferences preferences;
WebSocketsServer g_ws(81);     // audio WS di :81
static I2SClass g_i2s_mic;

static volatile int  g_dynamic_shift = 8;  // auto shift 32->16
static gpio_num_t    g_sd_pin        = I2S_SD_IO_DEFAULT;
static bool          g_triedAltPin   = false;
static uint32_t      g_zeroRun       = 0;
static const uint32_t ZERO_RUN_TRY   = 50;

// -------------------------------
// PROTO
static void setupLedFlash(int pin);
static bool connectToWiFi(const char* ssid, const char* pass);
static void initWiFi();
static bool initI2S(gpio_num_t sd_pin);
static void startAudioWebSocket();
static void audioTask(void *pv);

// -------------------------------
// LED
static void setupLedFlash(int pin) {
  if (pin >= 0) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }
}

// -------------------------------
// WiFi helper: returns true if connected
static bool connectToWiFi(const char* ssid, const char* pass) {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(ssid, pass);

  Serial.printf("Connecting to WiFi: %s\n", ssid);
  for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    return true;
  } else {
    Serial.println("WiFi connect FAILED.");
    return false;
  }
}

// Meminta / menggunakan kredensial, simpan di NVS
static void initWiFi() {
  preferences.begin("wifi", false);
  String savedSSID = preferences.getString("ssid", "");
  String savedPASS = preferences.getString("password", "");

  if (savedSSID.length() > 0 && savedPASS.length() > 0) {
    Serial.println("Found saved WiFi credentials.");
    if (connectToWiFi(savedSSID.c_str(), savedPASS.c_str())) {
      preferences.end();
      return;
    } else {
      Serial.println("Stored credentials failed. Please enter new credentials.");
    }
  } else {
    Serial.println("No WiFi credentials found. Please enter:");
  }

  while (Serial.available()) Serial.read();

  Serial.print("Enter SSID: ");
  while (Serial.available() == 0) delay(10);
  String inputSSID = Serial.readStringUntil('\n'); inputSSID.trim();

  Serial.print("Enter Password: ");
  while (Serial.available() == 0) delay(10);
  String inputPASS = Serial.readStringUntil('\n'); inputPASS.trim();

  if (connectToWiFi(inputSSID.c_str(), inputPASS.c_str())) {
    preferences.putString("ssid", inputSSID);
    preferences.putString("password", inputPASS);
    Serial.println("WiFi credentials saved.");
  } else {
    Serial.println("Failed to connect. Credentials not saved.");
  }
  preferences.end();
}

// -------------------------------
// I2S init
static bool initI2S(gpio_num_t sd_pin) {
  Serial.printf("Init I2S PDM RX (CLK=%d, DATA=%d)...",
                (int)I2S_SCK_IO, (int)sd_pin);

  g_i2s_mic.end(); // bersihkan instance jika sebelumnya aktif
  g_i2s_mic.setPinsPdmRx(I2S_SCK_IO, sd_pin);

  if (!g_i2s_mic.begin(I2S_MODE_PDM_RX, I2S_SAMPLE_RATE, I2S_DATA_BIT, I2S_CHANNEL_FORMAT)) {
    Serial.println(" GAGAL!");
    return false;
  }
  Serial.println(" OK");
  g_sd_pin = sd_pin;
  return true;
}

// -------------------------------
// WS events
static void onWsEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_CONNECTED:
      Serial.printf("WS[%u] connected: %s\n", num, g_ws.remoteIP(num).toString().c_str());
      break;
    case WStype_DISCONNECTED:
      Serial.printf("WS[%u] disconnected.\n", num);
      break;
    default: break;
  }
}

// Start WS + task
static void startAudioWebSocket() {
  g_ws.begin();
  g_ws.onEvent(onWsEvent);
  g_ws.enableHeartbeat(15000, 3000, 2);
  Serial.println("WebSocket audio server started on :81");

  // Jalankan task audio di core 1
  xTaskCreatePinnedToCore(audioTask, "AudioTask", 20000, NULL, 2, NULL, 1);
  Serial.println("Audio task started on Core 1.");
}

// -------------------------------
// TASK: baca I2S 32-bit -> PCM16 + gain -> broadcast BIN via WS
static void audioTask(void *pv) {
  if (!initI2S(g_sd_pin)) {
    Serial.println("AudioTask: initI2S FAILED");
    vTaskDelete(NULL);
    return;
  }

  size_t bytes_read = 0;
  uint32_t lastBeat = 0;
  uint32_t tlog = 0;

  for (;;) {
    uint32_t now_ms = millis();

    // heartbeat 1s
    if (now_ms - lastBeat > 1000) {
      g_ws.broadcastTXT("beat");
      lastBeat = now_ms;
    }

    if (g_ws.connectedClients() == 0) {
      vTaskDelay(50 / portTICK_PERIOD_MS);
      continue;
    }

    // Baca I2S (32-bit)
    bytes_read = g_i2s_mic.readBytes((char*)buffer_in_32, sizeof(buffer_in_32));
    if (bytes_read == 0) {
      vTaskDelay(5 / portTICK_PERIOD_MS);
      continue;
    }

    // Cari amplitudo 32-bit mentah (untuk auto-shift & failover)
    int32_t maxAbs32 = 0;
    size_t n32 = bytes_read / sizeof(int32_t);
    for (size_t i = 0; i < n32; i++) {
      int32_t v = buffer_in_32[i];
      int32_t a = v >= 0 ? v : -v;
      if (a > maxAbs32) maxAbs32 = a;
    }

    // Auto-shift dinamis agar tidak clipping / terlalu kecil
    if (maxAbs32 > 0) {
      int msb = 31 - __builtin_clz((uint32_t)maxAbs32); // bit tertinggi
      int desired = 13;                                 // target ~2^13
      int new_shift = msb - desired;
      if (new_shift < 0) new_shift = 0;
      if (new_shift > 20) new_shift = 20;
      g_dynamic_shift = new_shift;
      g_zeroRun = 0; // reset nol beruntun saat ada sinyal
    } else {
      g_zeroRun++;
    }

    // Log tiap 0.5s
    if (millis() - tlog > 500) {
      Serial.printf("I2S bytes=%u maxAbs32=%ld SHIFT=%d (DATA=%d)\n",
                    (unsigned)bytes_read, (long)maxAbs32, g_dynamic_shift, (int)g_sd_pin);
      tlog = millis();
    }

    // Failover pin DATA (39 -> 40) kalau input "flat zero"
    if (maxAbs32 == 0 && !g_triedAltPin && g_zeroRun >= ZERO_RUN_TRY) {
      Serial.println("PDM DATA terlihat 0 beruntun — mencoba ALT pin (GPIO40)...");
      if (initI2S(ALT_SD_PIN)) {
        g_triedAltPin = true;
        g_zeroRun = 0;
      } else {
        Serial.println("Gagal init ALT. Kembali ke pin awal.");
        initI2S(I2S_SD_IO_DEFAULT);
        g_triedAltPin = true;
        g_zeroRun = 0;
      }
    }

    // Konversi 32->16 + software gain
    static int16_t out16[AUDIO_BUF_32_COUNT * 2];
    for (size_t i = 0; i < n32; i++) {
      int16_t s = (int16_t)(buffer_in_32[i] >> g_dynamic_shift);
      int32_t g = (int32_t)((float)s * SOFTWARE_GAIN);
      if (g > 32767) g = 32767;
      if (g < -32768) g = -32768;
      out16[i] = (int16_t)g;
    }

    // Kirim biner PCM16 ke semua klien
    g_ws.broadcastBIN((uint8_t*)out16, n32 * sizeof(int16_t));
    taskYIELD();
  }
}

// -------------------------------
// SETUP
void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  delay(300);
  Serial.println("\n--- ESP32-S3 BoBoBee: Video + Audio WS ---");

  setupLedFlash(LED_GPIO_NUM);

  // Wi-Fi
  initWiFi();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, halt features.");
    return;
  }

  // Video via addon (port 80)
  if (CAM_initCamera()) {
    if (CAM_startOwnServer(80)) {
      Serial.printf("[CAM] own HTTP server on :80, endpoints: /tm, /stream\n");
      Serial.printf("[CAM] Stream URL: http://%s/stream\n",
                    WiFi.localIP().toString().c_str());
    } else {
      Serial.println("[CAM] start httpd failed");
    }
  } else {
    Serial.println("[CAM] init failed");
  }

  // Audio via WebSocket (port 81)
  startAudioWebSocket();

  Serial.printf("[AUDIO] WS URL: ws://%s:81\n",
                WiFi.localIP().toString().c_str());
}

// -------------------------------
// LOOP
void loop() {
  // WS handling harus dipanggil rutin
  g_ws.loop();
  delay(1);
}