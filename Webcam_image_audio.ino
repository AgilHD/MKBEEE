#include "esp_camera.h"
#include <WiFi.h>
#include <Preferences.h>
#include "esp_http_server.h"
#include "esp_timer.h"
#include "fb_gfx.h"
#include <string.h>

// Library untuk I2S (Digunakan untuk streaming audio)
#include "driver/i2s.h" 

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
#define I2S_PORT            I2S_NUM_0
#define I2S_SAMPLE_RATE     (16000) 
#define I2S_DATA_BIT        I2S_BITS_PER_SAMPLE_16BIT 
#define I2S_CHANNEL_FORMAT  I2S_CHANNEL_FMT_ONLY_RIGHT 
#define I2S_MODE            (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX) // Mode PDM (tanpa I2S_MODE_PDM)
#define I2S_SCK_IO          GPIO_NUM_38 // PDM Clock
#define I2S_SD_IO           GPIO_NUM_39 // PDM Data In (DIN)
#define AUDIO_BUFFER_SIZE   (2048) // Ukuran buffer untuk setiap blok audio


// ===========================
// === KREDENSIAL WIFI DEFAULT ===
// ===========================
// Kredensial diperbarui sesuai permintaan
const char* DEFAULT_SSID = "ALAYDRUS"; 
const char* DEFAULT_PASS = "87654321"; 

// ===========================
// === Deklarasi Variabel & Prototipe ===
// ===========================
Preferences preferences;
httpd_handle_t stream_httpd = NULL;

// Prototipe Fungsi HTTP Handler (Wajib extern "C" untuk Linker)
extern "C" {
    esp_err_t stream_handler(httpd_req_t *req);
    esp_err_t audio_stream_handler(httpd_req_t *req); // Handler untuk Audio Stream
    esp_err_t index_handler(httpd_req_t *req);
}

// Prototipe Fungsi Utilitas
void startCameraServer();
void setupLedFlash(int pin);
void connectToWiFi(const char* ssid, const char* password);
void initWiFi();
void initCamera();
bool initI2S(); 


// ======================================
// === FUNGSI INIT HARDWARE ===
// ======================================

bool initI2S() {
    Serial.print("Inisialisasi I2S Mikrofon...");
    i2s_config_t i2s_config = {
        .mode = I2S_MODE,
        .sample_rate = I2S_SAMPLE_RATE,
        .bits_per_sample = I2S_DATA_BIT,
        .channel_format = I2S_CHANNEL_FORMAT,
        .communication_format = (i2s_comm_format_t)(I2S_COMM_FORMAT_STAND_I2S | I2S_COMM_FORMAT_I2S_MSB), // Menggunakan I2S MSB
        .intr_alloc_flags = 0,
        .dma_buf_count = 8,
        .dma_buf_len = 256, // DIKURANGI DARI 512 ke 256 untuk stabilitas DMA
        .use_apll = false
    };

    i2s_pin_config_t pin_config = {
        .bck_io_num = I2S_SCK_IO,
        .ws_io_num = I2S_SCK_IO, // WS = CLK untuk PDM
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num = I2S_SD_IO
    };
    
    if (i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL) != ESP_OK) {
        Serial.println("Gagal menginstal driver I2S!");
        return false;
    }
    
    if (i2s_set_pin(I2S_PORT, &pin_config) != ESP_OK) {
        Serial.println("Gagal mengatur pin I2S!");
        return false;
    }
    
    // KUNCI PERBAIKAN: Set clock secara eksplisit setelah pin
    if (i2s_set_clk(I2S_PORT, I2S_SAMPLE_RATE, I2S_DATA_BIT, I2S_CHANNEL_MONO) != ESP_OK) {
        Serial.println("Gagal mengatur clock I2S (set_clk)!");
        return false;
    }

    i2s_zero_dma_buffer(I2S_PORT);
    Serial.println("Berhasil.");
    return true;
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

// Handler untuk Audio Stream (RAW PCM)
esp_err_t audio_stream_handler(httpd_req_t *req) {
    // Ukuran buffer I2S (4 bytes per sampel, 1024 sampel = 4096 bytes)
    const int buffer_size_32bit = 1024; 
    // Menggunakan buffer dinamis agar tidak membebani stack
    int32_t *buffer_in = (int32_t *)malloc(buffer_size_32bit * sizeof(int32_t)); 
    if (!buffer_in) {
        // Gagal alokasi, tutup koneksi dengan status error
        httpd_resp_send_500(req);
        return ESP_FAIL;
    }

    size_t bytes_read;
    
    // Header HTTP untuk audio stream RAW PCM
    httpd_resp_set_type(req, "application/octet-stream");
    httpd_resp_set_hdr(req, "Connection", "keep-alive");
    
    // Loop streaming audio
    while (true) {
        // Baca I2S dengan timeout singkat 100ms
        esp_err_t i2s_err = i2s_read(I2S_PORT, (void *)buffer_in, buffer_size_32bit * sizeof(int32_t), &bytes_read, 100 / portTICK_PERIOD_MS);
        
        if (i2s_err == ESP_OK) { // Hanya proses jika I2S read berhasil
            
            // HANYA KIRIM CHUNK JIKA ADA DATA YANG DIBACA
            if (bytes_read > 0) { 
                size_t num_samples = bytes_read / sizeof(int32_t);
                
                // Konversi 32-bit mentah menjadi 16-bit sampel PCM (untuk streaming)
                int16_t buffer_out[num_samples]; // Alokasi stack kecil
                for (size_t i = 0; i < num_samples; i++) {
                    // Ambil 16 bit atas
                    buffer_out[i] = (int16_t)(buffer_in[i] >> 16); 
                }
                
                // Kirim chunk audio (16-bit * jumlah sampel)
                if (httpd_resp_send_chunk(req, (const char *)buffer_out, num_samples * sizeof(int16_t)) != ESP_OK) {
                    break; // Tutup koneksi jika pengiriman chunk gagal
                }
                
                // Tambahkan delay kecil untuk memungkinkan task lain berjalan
                vTaskDelay(pdMS_TO_TICKS(1)); 
            }
        } else if (i2s_err != ESP_ERR_TIMEOUT) {
            // Jika ada error I2S serius (selain timeout), log dan keluar
            // Serial.printf("I2S read error: 0x%x\n", i2s_err); // Debugging I2S
            break; 
        } else {
            // Jika hanya timeout (tidak ada data), biarkan loop berlanjut
            vTaskDelay(pdMS_TO_TICKS(1)); 
        }
    }

    // Bebaskan memori buffer dinamis
    free(buffer_in);
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
// === FUNGSI START SERVER ===
// ======================================
void startCameraServer(){
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.max_uri_handlers = 3; // Video, Audio, Index

    Serial.printf("Starting web server on port: '%d'\n", config.server_port);
    if (httpd_start(&stream_httpd, &config) == ESP_OK) {
        // 1. Video Stream (MJPEG)
        httpd_uri_t stream_uri = { .uri = "/stream", .method = HTTP_GET, .handler = stream_handler, .user_ctx = NULL };
        httpd_register_uri_handler(stream_httpd, &stream_uri);
        
        // 2. Audio Stream (RAW PCM 16-bit 16kHz)
        httpd_uri_t audio_uri = { .uri = "/audiostream", .method = HTTP_GET, .handler = audio_stream_handler, .user_ctx = NULL };
        httpd_register_uri_handler(stream_httpd, &audio_uri);
        
        // 3. Index/Root
        httpd_uri_t index_uri = { .uri = "/", .method = HTTP_GET, .handler = index_handler, .user_ctx = NULL };
        httpd_register_uri_handler(stream_httpd, &index_uri);
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
    Serial.println("--- ESP32 Startup ---");
    
    // 1. Inisialisasi Hardware
    initCamera();
    setupLedFlash(LED_GPIO_NUM);
    
    // 2. Koneksi Jaringan
    initWiFi();
    
    // 3. Inisialisasi Audio I2S (Dilakukan setelah WiFi agar tidak mengganggu)
    if(WiFi.status() == WL_CONNECTED) {
        initI2S(); 
    }
    
    // 4. Mulai Web Server
    if (WiFi.status() == WL_CONNECTED) {
        startCameraServer();
    } else {
        Serial.println("Web server will not start due to WiFi connection failure.");
    }
}

void loop() {
    delay(10000); // Semua pekerjaan dilakukan di Web Server tasks
}
