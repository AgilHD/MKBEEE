#include "esp_camera.h"
#include <WiFi.h>
#include <Preferences.h>
#include "esp_http_server.h"
#include "esp_timer.h"
#include "fb_gfx.h"
#include <string.h>

// Library untuk SD Card
#include <FS.h>
#include <SD_MMC.h>

// Library yang sudah teruji untuk I2S PDM
#include "ESP_I2S.h" 

// =======================
// === Konfigurasi Pin Kamera (DFRobot ESP32-S3 AI Camera) ===
// =======================
#define PWDN_GPIO_NUM -1
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 5
#define Y9_GPIO_NUM 4
#define Y8_GPIO_NUM 6
#define Y7_GPIO_NUM 7
#define Y6_GPIO_NUM 14
#define Y5_GPIO_NUM 17
#define Y4_GPIO_NUM 21
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 16
#define VSYNC_GPIO_NUM 1
#define HREF_GPIO_NUM 2
#define PCLK_GPIO_NUM 15
#define SIOD_GPIO_NUM 8 
#define SIOC_GPIO_NUM 9 
#define LED_GPIO_NUM 47 

// =======================
// === Konfigurasi I2S Mikrofon (ESP_I2S.h) ===
// =======================
#define AUDIO_SAMPLE_RATE     (16000) 
#define AUDIO_DATA_BIT        I2S_DATA_BIT_WIDTH_16BIT 
#define CLOCK_PIN             (GPIO_NUM_38)
#define DATA_PIN              (GPIO_NUM_39)

// ===========================
// === KREDENSIAL WIFI DEFAULT ===
// ===========================
const char* DEFAULT_SSID = "Agil";
const char* DEFAULT_PASS = "agil1234";

// ===========================
// === Deklarasi Variabel & Prototipe ===
// ===========================
Preferences preferences;
bool led_status = false;
httpd_handle_t stream_httpd = NULL;
I2SClass i2s_mic; // Inisialisasi I2SClass global

// Prototipe Fungsi HTTP Handler (Wajib extern "C" untuk Linker)
extern "C" {
    esp_err_t stream_handler(httpd_req_t *req);
    esp_err_t index_handler(httpd_req_t *req);
    esp_err_t led_handler(httpd_req_t *req);
    esp_err_t capture_handler(httpd_req_t *req); 
    esp_err_t audio_handler(httpd_req_t *req); 
}

// Prototipe Fungsi Utilitas
void startCameraServer();
void setupLedFlash(int pin);
void connectToWiFi(const char* ssid, const char* password);
void initWiFi();
void initCamera();
bool initI2S(); 
bool initSD();   
void recordStill(const char *filename); 
void recordAudio(const char *filename, int duration_sec); 


// ======================================
// === FUNGSI INIT HARDWARE (SD & I2S BARU) ===
// ======================================

bool initSD() {
    Serial.print("Inisialisasi SD Card...");
    if(!SD_MMC.begin()){
        Serial.println("Gagal! SD Card Mount Failed!");
        return false;
    }
    Serial.printf("Berhasil. Ukuran: %lluMB\n", SD_MMC.cardSize() / (1024 * 1024));
    return true;
}

bool initI2S() {
    Serial.print("Inisialisasi I2S Mikrofon...");
    
    // Set pin PDM Rx
    i2s_mic.setPinsPdmRx(CLOCK_PIN, DATA_PIN);

    // Mulai I2S PDM
    if (!i2s_mic.begin(I2S_MODE_PDM_RX, AUDIO_SAMPLE_RATE, AUDIO_DATA_BIT, I2S_SLOT_MODE_MONO)) {
        Serial.println("Gagal menginisialisasi I2S PDM RX!");
        return false;
    }
    
    Serial.println("Berhasil.");
    return true;
}

// ======================================
// === FUNGSI REKAM GAMBAR & SUARA BARU ===
// ======================================

void recordStill(const char *filename) {
    if (!SD_MMC.cardSize()) {
        Serial.println("SD Card tidak terdeteksi, Gagal merekam gambar.");
        return;
    }
    // ... (Logika capture photo tetap sama) ...
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("Camera capture failed!");
        return;
    }

    File file = SD_MMC.open(filename, FILE_WRITE);
    if (!file) {
        Serial.printf("Gagal membuka file: %s\n", filename);
    } else {
        file.write(fb->buf, fb->len);
        file.close();
        Serial.printf("Capture saved: %s, Size: %u bytes\n", filename, fb->len);
    }

    esp_camera_fb_return(fb);
}


void recordAudio(const char *filename, int duration_sec) {
    if (!SD_MMC.cardSize()) {
        Serial.println("SD Card tidak terdeteksi, Gagal merekam audio.");
        return;
    }

    Serial.printf("Mulai rekam audio selama %d detik ke %s (WAV)... \n", duration_sec, filename);
    
    // Gunakan fungsi recordWAV dari ESP_I2S.h yang terbukti berhasil
    uint8_t *wav_buffer;
    size_t wav_size;
    
    // CATATAN: recordWAV menyimpan ke RAM/PSRAM. Pastikan ada memori yang cukup!
    wav_buffer = i2s_mic.recordWAV(duration_sec, &wav_size);
    
    if (wav_buffer != NULL && wav_size > 44) { // WAV size minimal 44 bytes (header)
        File file = SD_MMC.open(filename, FILE_WRITE);
        if (!file) {
            Serial.printf("Gagal membuka file %s untuk rekaman audio.\n", filename);
        } else {
            file.write((uint8_t*)wav_buffer, wav_size);
            file.close();
            Serial.printf("Rekaman WAV selesai. Total %u bytes ditulis.\n", wav_size);
        }
        // Bebaskan memori yang dialokasikan oleh recordWAV()
        free(wav_buffer);
    } else {
        Serial.println("Gagal merekam audio atau buffer kosong!");
    }
}


// ========================
// === FUNGSI DASAR & WIFI ===
// ========================

void setupLedFlash(int pin) { 
    if (pin > 0) {
        pinMode(pin, OUTPUT);
        digitalWrite(pin, LOW);
    }
}
void connectToWiFi(const char* ssid, const char* password) { 
    WiFi.begin(ssid, password);
    Serial.printf("Connecting to WiFi: %s\n", ssid);
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 20) {
        delay(500);
        Serial.print(".");
        retries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nFailed to connect to WiFi.");
    }
}

void initWiFi() {
    Serial.println("Attempting to connect using default credentials...");
    connectToWiFi(DEFAULT_SSID, DEFAULT_PASS);

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Failed to connect with default credentials. Please check your WiFi settings.");
    }
}


void initCamera(){
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
    config.frame_size = FRAMESIZE_VGA; 
    config.pixel_format = PIXFORMAT_JPEG; 
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.jpeg_quality = 12;
    config.fb_count = 1;

    if (psramFound()) {
        config.jpeg_quality = 10;
        config.fb_count = 2;
        config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
        config.frame_size = FRAMESIZE_SVGA;
        config.fb_location = CAMERA_FB_IN_DRAM;
    }

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("Camera init failed with error 0x%x\n", err);
        return;
    }

    sensor_t *s = esp_camera_sensor_get();
    if (s->id.PID == OV3660_PID) {
        s->set_vflip(s, 1); 
        s->set_brightness(s, 1);
        s->set_saturation(s, -2);
    }

    if (config.pixel_format == PIXFORMAT_JPEG) {
        s->set_framesize(s, FRAMESIZE_QVGA); 
    }
}


// =============================
// === HTML DASHBOARD ===
// =============================
const char* html_dashboard = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <title>ESP32-CAM Dashboard</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; background-color: #f0f0f0; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .stream-container { margin: 20px 0; border: 2px solid #ccc; border-radius: 8px; overflow: hidden; }
        .stream-container img { width: 100%; height: auto; display: block; }
        .controls { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 15px; }
        .control-button { padding: 12px 25px; font-size: 16px; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s, transform 0.1s; }
        .control-button:active { transform: scale(0.98); }
        #toggleLedBtn { background-color: #007BFF; color: white; }
        #captureBtn { background-color: #ffc107; color: #333; }
        #recordBtn { background-color: #dc3545; color: white; }
        #toggleLedBtn.on { background-color: #28a745; }
        #toggleLedBtn.off { background-color: #dc3545; }
        .status-info { margin-top: 20px; color: #555; }
        #message { margin-top: 10px; font-weight: bold; color: #007BFF; }
    </style>
</head>
<body>
    <div class="container">
        <h1>ESP32-CAM Dashboard</h1>
        <div class="stream-container">
            <img src="/stream" alt="Camera Stream" id="camera-stream"> 
        </div>
        <div class="controls">
            <button id="toggleLedBtn" class="control-button off" onclick="toggleLed()">LED Flash ON/OFF</button>
            <button id="captureBtn" class="control-button" onclick="captureStill()">Rekam Gambar</button>
            <button id="recordBtn" class="control-button" onclick="recordAudio()">Rekam Suara (5 Detik)</button>
        </div>
        <div id="message"></div>
        <div class="status-info">
            <p><strong>IP Address:</strong> <span id="ip-address">Loading...</span></p>
        </div>
    </div>
    
    <script>
        window.onload = function() {
            document.getElementById('ip-address').innerText = window.location.hostname;
        };

        async function fetchAction(endpoint, successMsg) {
            const msgEl = document.getElementById('message');
            msgEl.innerText = 'Memproses...';
            try {
                const response = await fetch(endpoint);
                const text = await response.text();
                msgEl.innerText = text || successMsg;
            } catch (error) {
                msgEl.innerText = 'Error: Gagal terhubung ke ESP32.';
                console.error("Error:", error);
            }
        }

        function toggleLed() {
            const btn = document.getElementById('toggleLedBtn');
            const currentState = btn.classList.contains('on');
            const newState = !currentState;
            const action = newState ? 'on' : 'off';
            
            fetchAction(`/led?state=${action}`, `LED ${action.toUpperCase()}`);
            btn.classList.toggle('on', newState);
            btn.classList.toggle('off', !newState);
        }

        function captureStill() {
            fetchAction('/capture', 'Gambar berhasil direkam!');
        }

        function recordAudio() {
            // Memberi tahu pengguna bahwa rekaman butuh waktu 5 detik
            document.getElementById('message').innerText = 'Merekam audio 5 detik... JANGAN tutup browser!';
            fetchAction('/record?duration=5', 'Suara berhasil direkam (5 detik)!');
        }
    </script>
</body>
</html>
)rawliteral";


// =============================
// === Handlers Web Server (TIDAK ADA STATIC) ===
// =============================

#define PART_BOUNDARY "123456789000000000000987654321"
const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

esp_err_t stream_handler(httpd_req_t *req){
    camera_fb_t * fb = NULL;
    esp_err_t res = ESP_OK;
    size_t _jpg_buf_len = 0;
    uint8_t * _jpg_buf = NULL;
    char * part_buf[64];

    res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
    if(res != ESP_OK){ return res; }

    while(true){
        fb = esp_camera_fb_get();
        if (!fb) {
            Serial.println("Camera capture failed");
            res = ESP_FAIL;
        } else {
            if(fb->format != PIXFORMAT_JPEG){
                bool jpeg_converted = frame2jpg(fb, 80, &_jpg_buf, &_jpg_buf_len);
                esp_camera_fb_return(fb);
                fb = NULL;
                if(!jpeg_converted){ res = ESP_FAIL; }
            } else {
                _jpg_buf_len = fb->len;
                _jpg_buf = fb->buf;
            }
        }

        if(res == ESP_OK){ res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY)); }
        if(res == ESP_OK){ 
            size_t hlen = snprintf((char *)part_buf, 64, _STREAM_PART, _jpg_buf_len);
            res = httpd_resp_send_chunk(req, (const char *)part_buf, hlen);
        }
        if(res == ESP_OK){ res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len); }
        
        if(fb){
            esp_camera_fb_return(fb);
            fb = NULL;
        } else if(_jpg_buf) {
            if(fb == NULL) free(_jpg_buf); 
            _jpg_buf = NULL;
        }
        
        if(res != ESP_OK){ break; }
    }
    return res;
}

esp_err_t led_handler(httpd_req_t *req){
    char* buf;
    size_t buf_len;
    char state_param[8];

    buf_len = httpd_req_get_url_query_len(req) + 1;
    if (buf_len > 1) {
        buf = (char*)malloc(buf_len);
        if (httpd_req_get_url_query_str(req, buf, buf_len) == ESP_OK) {
            if (httpd_query_key_value(buf, "state", state_param, sizeof(state_param)) == ESP_OK) {
                if (strcmp(state_param, "on") == 0) {
                    digitalWrite(LED_GPIO_NUM, HIGH);
                    led_status = true;
                    Serial.println("LED ON");
                } else if (strcmp(state_param, "off") == 0) {
                    digitalWrite(LED_GPIO_NUM, LOW);
                    led_status = false;
                    Serial.println("LED OFF");
                }
            }
        }
        free(buf);
    }
    httpd_resp_send_chunk(req, NULL, 0); 
    return ESP_OK;
}

esp_err_t capture_handler(httpd_req_t *req){
    char filename[32];
    snprintf(filename, sizeof(filename), "/img_%lu.jpg", millis());
    
    Serial.printf("Memulai rekam gambar ke %s\n", filename);
    recordStill(filename);
    
    httpd_resp_sendstr_chunk(req, "Gambar berhasil disimpan.");
    httpd_resp_sendstr_chunk(req, NULL);
    return ESP_OK;
}

esp_err_t audio_handler(httpd_req_t *req){
    int duration = 5; 
    
    char* buf;
    size_t buf_len = httpd_req_get_url_query_len(req) + 1;
    if (buf_len > 1) {
        buf = (char*)malloc(buf_len);
        if (httpd_req_get_url_query_str(req, buf, buf_len) == ESP_OK) {
            char duration_param[8];
            if (httpd_query_key_value(buf, "duration", duration_param, sizeof(duration_param)) == ESP_OK) {
                duration = atoi(duration_param);
                if (duration <= 0 || duration > 30) duration = 5; 
            }
        }
        free(buf);
    }
    
    char filename[32];
    // Simpan sebagai WAV karena ESP_I2S.h sudah menyertakan header WAV
    snprintf(filename, sizeof(filename), "/aud_%lu.wav", millis()); 

    httpd_resp_sendstr_chunk(req, "Memulai rekaman audio...");
    
    // Fungsi ini menggunakan ESP_I2S.h
    recordAudio(filename, duration);
    
    httpd_resp_sendstr_chunk(req, "\nRekaman audio selesai dan disimpan.");
    httpd_resp_sendstr_chunk(req, NULL);
    return ESP_OK;
}

esp_err_t index_handler(httpd_req_t *req){
    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, html_dashboard, HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}


// ======================================
// === FUNGSI START SERVER ===
// ======================================
void startCameraServer(){
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.max_uri_handlers = 6; 

    Serial.printf("Starting web server on port: '%d'\n", config.server_port);
    if (httpd_start(&stream_httpd, &config) == ESP_OK) {
        httpd_uri_t stream_uri = { .uri = "/stream", .method = HTTP_GET, .handler = stream_handler, .user_ctx = NULL };
        httpd_uri_t index_uri = { .uri = "/", .method = HTTP_GET, .handler = index_handler, .user_ctx = NULL };
        httpd_uri_t led_uri = { .uri = "/led", .method = HTTP_GET, .handler = led_handler, .user_ctx = NULL };
        httpd_uri_t capture_uri = { .uri = "/capture", .method = HTTP_GET, .handler = capture_handler, .user_ctx = NULL };
        httpd_uri_t audio_uri = { .uri = "/record", .method = HTTP_GET, .handler = audio_handler, .user_ctx = NULL };
        
        httpd_register_uri_handler(stream_httpd, &index_uri);
        httpd_register_uri_handler(stream_httpd, &stream_uri);
        httpd_register_uri_handler(stream_httpd, &led_uri);
        httpd_register_uri_handler(stream_httpd, &capture_uri);
        httpd_register_uri_handler(stream_httpd, &audio_uri);
    } else {
        Serial.println("Failed to start HTTP server!");
    }
}

// ========================
// === Fungsi Setup & Loop ===
// ========================
void setup() {
    Serial.begin(115200);
    Serial.setDebugOutput(true);
    delay(1000);
    Serial.println();

    Serial.println("Starting Setup...");
    
    // 1. Inisialisasi Hardware
    initCamera();
    setupLedFlash(LED_GPIO_NUM);
    initSD();      // Inisialisasi SD Card
    initI2S();     // Menggunakan ESP_I2S.h yang sudah teruji
    
    // 2. Koneksi Jaringan
    initWiFi();
    
    // 3. Mulai Web Server
    if (WiFi.status() == WL_CONNECTED) {
        startCameraServer();
    } else {
        Serial.println("Web server will not start due to WiFi connection failure.");
    }
}

void loop() {
    delay(10000); // Semua pekerjaan dilakukan di Web Server tasks
}
