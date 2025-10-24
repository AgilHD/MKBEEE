#include "esp_camera.h"
#include <WiFi.h>
#include <Preferences.h>
#include "esp_http_server.h"
#include "esp_timer.h"
#include "fb_gfx.h"
#include <string.h>

// Library untuk WEBSOCKETS
#include <WebSocketsServer.h> 
// Library untuk Audio yang BERHASIL (ESP_I2S.h)
#include "ESP_I2S.h" 

// =======================
// === Konfigurasi Pin Kamera (DFRobot ESP32-S3 AI Camera) ===
// =======================
#define PWDN_GPIO_NUM       -1
#define RESET_GPIO_NUM      -1
#define XCLK_GPIO_NUM       5
#define Y9_GPIO_NUM         4
#define Y8_GPIO_NUM         6
#define Y7_GPIO_NUM         7
#define Y6_GPIO_NUM         14
#define Y5_GPIO_NUM         17
#define Y4_GPIO_NUM         21
#define Y3_GPIO_NUM         18
#define Y2_GPIO_NUM         16
#define VSYNC_GPIO_NUM      1
#define HREF_GPIO_NUM       2
#define PCLK_GPIO_NUM       15
#define SIOD_GPIO_NUM       8 
#define SIOC_GPIO_NUM       9 
#define LED_GPIO_NUM        47 // Pin LED Flash/Torch

// =======================
// === Konfigurasi I2S Mikrofon (Audio Stream) ===
// =======================
#define I2S_SAMPLE_RATE     (16000) 

// KUNCI STABILITAS: Menggunakan 32-bit untuk inisialisasi I2S (untuk stabilitas PDM frame)
#define I2S_DATA_BIT        I2S_DATA_BIT_WIDTH_32BIT 

#define I2S_CHANNEL_FORMAT  I2S_SLOT_MODE_MONO // Menggunakan SLOTS MONO untuk ESP_I2S

#define I2S_SCK_IO          GPIO_NUM_38 // PDM Clock
#define I2S_SD_IO           GPIO_NUM_39 // PDM Data In (DIN)

// Ukuran buffer I2S yang akan dibaca dalam handler
const int AUDIO_BUFFER_SIZE_16BIT = 1024; 
I2SClass i2s_mic; // Class I2S global

// Instansi WebSocket Server
WebSocketsServer webSocket = WebSocketsServer(81); // WebSocket akan berjalan di port 81


// ===========================
// === KREDENSIAL WIFI DEFAULT ===
// ===========================
const char* DEFAULT_SSID = "seipa"; 
const char* DEFAULT_PASS = "00000001"; 

// ===========================
// === Deklarasi Variabel & Prototipe ===
// ===========================
Preferences preferences;
httpd_handle_t stream_httpd = NULL;

// Prototipe Fungsi HTTP Handler (Wajib extern "C" untuk Linker)
extern "C" {
    esp_err_t stream_handler(httpd_req_t *req);
    esp_err_t audio_stream_handler(httpd_req_t *req); 
    esp_err_t index_handler(httpd_req_t *req);
}

// Prototipe Fungsi Utilitas
void startCameraServer();
void setupLedFlash(int pin);
void connectToWiFi(const char* ssid, const char* password);
void initWiFi();
void initCamera();
bool initI2S(); 
void audioSampleAndSendTask(void *pvParameters); // Task baru untuk audio


// ======================================
// === FUNGSI INIT HARDWARE ===
// ======================================

bool initI2S() {
    Serial.print("Inisialisasi I2S Mikrofon...");
    
    // 1. Set Pin PDM Rx
    i2s_mic.setPinsPdmRx(I2S_SCK_IO, I2S_SD_IO);
    
    // 2. Inisialisasi PDM Receiver menggunakan mode yang terbukti berhasil
    if (!i2s_mic.begin(I2S_MODE_PDM_RX, I2S_SAMPLE_RATE, I2S_DATA_BIT, I2S_CHANNEL_FORMAT)) {
        Serial.println("GAGAL: Menginisialisasi I2S PDM RX.");
        return false;
    }

    Serial.println("Berhasil.");
    return true;
}

// ======================================
// === TASK AUDIO WEBSOCKET (NEW) ===
// ======================================

void audioSampleAndSendTask(void *pvParameters) {
    if (!initI2S()) {
        Serial.println("Task Audio GAGAL: I2S tidak aktif.");
        vTaskDelete(NULL);
        return;
    }

    // Buffer 32-bit untuk menerima data mentah dari I2S
    int32_t buffer_in[AUDIO_BUFFER_SIZE_16BIT * 2]; 
    size_t bytes_read;
    
    Serial.println("Task Audio: Mulai sampling dan kirim via WebSocket.");

    // Loop sampling
    while (true) {
        // Baca I2S
        // Kita membaca 1024 * 4 bytes = 4096 bytes dari buffer I2S 32-bit
        bytes_read = i2s_mic.readBytes((char *)buffer_in, sizeof(buffer_in)); 
        
        if (bytes_read > 0) {
            
            // Kita mendapatkan data mentah 32-bit. Kita harus mengkonversinya 
            // kembali menjadi 16-bit yang benar untuk dikirim ke PC.
            
            size_t num_samples = bytes_read / sizeof(int32_t);
            int16_t buffer_out[num_samples]; // Buffer 16-bit final (alokasi stack kecil)

            for (size_t i = 0; i < num_samples; i++) {
                // Kalibrasi Bit-Shift (Ambil 16 bit atas dari data 32-bit)
                buffer_out[i] = (int16_t)(buffer_in[i] >> 16); 
            }
            
            // Kirim data 16-bit melalui WebSocket
            webSocket.broadcastBIN((uint8_t*)buffer_out, num_samples * sizeof(int16_t));
        }
        
        // KUNCI STABILITAS: taskYIELD() memberikan kesempatan CPU yang paling cepat ke task lain (Video/WiFi)
        taskYIELD(); 
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
// === Handlers Web Server ===
// =============================

// Handler untuk Video Stream (MJPEG)
esp_err_t stream_handler(httpd_req_t *req){
    camera_fb_t * fb = NULL;
    esp_err_t res = ESP_OK;
    size_t _jpg_buf_len = 0;
    uint8_t * _jpg_buf = NULL;
    char * part_buf[64];

    // Header untuk MJPEG stream
    const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=123456789000000000000987654321";
    const char* _STREAM_BOUNDARY = "\r\n--123456789000000000000987654321\r\n";
    const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

    res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
    if(res != ESP_OK){ return res; }

    while(true){
        fb = esp_camera_fb_get();
        if (!fb) {
            // Serial.println("Camera capture failed"); // Hapus print di loop untuk kecepatan
            res = ESP_FAIL;
        } else {
            // Logika untuk mengirim frame JPEG
            if(fb->format != PIXFORMAT_JPEG){
                // Ini seharusnya tidak terjadi jika initCamera sudah benar
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

// Handler DUMMY (Tidak digunakan lagi, hanya untuk mencegah error)
esp_err_t audio_stream_handler(httpd_req_t *req) {
    const char* dummy_msg = "Audio stream functionality moved to WebSocket Port 81.";
    httpd_resp_send(req, dummy_msg, HTTPD_RESP_USE_STRLEN);
    Serial.println("AUDIO: Handler HTTP dipanggil. Redirect ke WS Port 81."); 
    return ESP_OK;
}


// Handler default (Minimal)
esp_err_t index_handler(httpd_req_t *req){
    const char* html_content = "<html><head><title>ESP32 Stream</title></head><body>Redirecting to /stream...</body></html>";
    httpd_resp_set_type(req, "text/html");
    httpd_resp_set_status(req, "302 Found"); // Redirect ke /stream
    httpd_resp_set_hdr(req, "Location", "/stream");
    httpd_resp_send(req, html_content, HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}


// ======================================
// === WEBSOCKET EVENT HANDLER ===
// ======================================

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_CONNECTED:
            Serial.printf("WS [%u] Klien terhubung dari IP: %s\n", num, webSocket.remoteIP(num).toString().c_str());
            break;
        case WStype_DISCONNECTED:
            Serial.printf("WS [%u] Klien terputus.\n", num);
            break;
        case WStype_TEXT:
            // Hanya untuk debugging
            Serial.printf("WS [%u] Pesan diterima: %s\n", num, payload);
            break;
        case WStype_BIN:
            // Audio stream seharusnya berjalan satu arah dari ESP32 ke PC
            break;
        default:
            break;
    }
}


// ======================================
// === FUNGSI START SERVER ===
// ======================================
void startCameraServer(){
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.max_uri_handlers = 3; // Video, Audio (dummy), Index

    // 1. Mulai HTTP Server (Video)
    Serial.printf("Starting web server (HTTP) on port: '%d'\n", config.server_port);
    if (httpd_start(&stream_httpd, &config) == ESP_OK) {
        // Video Stream
        httpd_uri_t stream_uri = { .uri = "/stream", .method = HTTP_GET, .handler = stream_handler, .user_ctx = NULL };
        httpd_register_uri_handler(stream_httpd, &stream_uri);
        
        // Audio Dummy (Menginformasikan klien ke WS Port 81)
        httpd_uri_t audio_uri = { .uri = "/audiostream", .method = HTTP_GET, .handler = audio_stream_handler, .user_ctx = NULL };
        httpd_register_uri_handler(stream_httpd, &audio_uri);
        
        // Index/Root
        httpd_uri_t index_uri = { .uri = "/", .method = HTTP_GET, .handler = index_handler, .user_ctx = NULL };
        httpd_register_uri_handler(stream_httpd, &index_uri);
    } else {
        Serial.println("Failed to start HTTP server!");
    }
    
    // 2. Mulai WebSocket Server (Audio)
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);
    Serial.println("WebSocket Server (Audio) dimulai di Port 81.");
    
    // 3. Mulai Task Audio Sampling (FreerTOS)
    xTaskCreatePinnedToCore(
        audioSampleAndSendTask,  // Fungsi yang akan dijalankan
        "AudioTask",             // Nama Task
        20000,                   // Ukuran stack (bytes) <-- DIPERBAIKI: 20000 bytes
        NULL,                    // Parameter yang dilewatkan
        2,                       // Prioritas Task (DIPERBAIKI: Prioritas 2 lebih tinggi dari default 1)
        NULL,                    // Task handle
        1                        // Core ID (Pindahkan ke Core 1)
    );
    Serial.println("Task Audio Sampling dimulai di Core 1.");
}

// ========================
// === Fungsi Setup & Loop ===
// ========================
void setup() {
    Serial.begin(115200);
    Serial.setDebugOutput(true);
    delay(1000);
    Serial.println();
    Serial.println("--- ESP32 Startup ---");
    
    // 1. Inisialisasi Hardware
    initCamera();
    setupLedFlash(LED_GPIO_NUM);
    
    // 2. Koneksi Jaringan
    initWiFi();
    
    // 3. Mulai Web Server dan Task Audio
    if (WiFi.status() == WL_CONNECTED) {
        startCameraServer();
        WiFi.setSleep(false); 
    } else {
        Serial.println("Web server will not start due to WiFi connection failure.");
    }
}

void loop() {
    // WebSocket memerlukan penanganan di loop()
    webSocket.loop();
    delay(1); 
}
