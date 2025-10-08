#include "esp_camera.h"
#include <WiFi.h>
#include <Preferences.h>
#include "esp_http_server.h"
#include "esp_timer.h"
#include "fb_gfx.h"
#include <string.h>

// =======================
// === Konfigurasi Pin ===
// =======================
// Pinout diasumsikan untuk DFRobot ESP32-S3 AI Camera (atau yang serupa).
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
#define SIOD_GPIO_NUM 8 // I2C SDA (SCCB)
#define SIOC_GPIO_NUM 9 // I2C SCL (SCCB)
#define LED_GPIO_NUM 47 // Pin LED Flash

// ===========================
// === KREDENSIAL WIFI DEFAULT ===
// Kredensial ini akan selalu digunakan!
// ===========================
const char* DEFAULT_SSID = "R";
const char* DEFAULT_PASS = "Rillcuy27";


// ===========================
// === Deklarasi Variabel & Prototipe ===
// ===========================
Preferences preferences;
bool led_status = false;
httpd_handle_t stream_httpd = NULL;

// Prototipe
void startCameraServer();
void setupLedFlash(int pin);
void connectToWiFi(const char* ssid, const char* password);
void initWiFi();
void initCamera();
static esp_err_t stream_handler(httpd_req_t *req);
static esp_err_t index_handler(httpd_req_t *req);
static esp_err_t led_handler(httpd_req_t *req);


// ========================
// === Fungsi-fungsi Dasar ===
// ========================

void setupLedFlash(int pin) {
    if (pin > 0) {
        pinMode(pin, OUTPUT);
        digitalWrite(pin, LOW); // LED mati saat awal
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

// ==============================
// === FUNGSI WIFI DIVERSIFIKASI ===
// Sekarang hanya menggunakan kredensial default.
// ==============================
void initWiFi() {
    // Tidak perlu inisialisasi Preferences/NVS karena kita tidak menyimpan/membaca kredensial
    
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

    // Deteksi PSRAM pada ESP32-S3
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
        s->set_framesize(s, FRAMESIZE_QVGA); // Default ke QVGA
    }
}

// =============================
// === Server HTTP & Streaming Implementasi ===
// =============================

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

static esp_err_t stream_handler(httpd_req_t *req){
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
                // Konversi ke JPEG jika format bukan JPEG
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
        
        // Kembalikan buffer ke pool atau bebaskan buffer yang dialokasikan (jika dikonversi)
        if(fb){
            esp_camera_fb_return(fb);
            fb = NULL;
        } else if(_jpg_buf) {
            // Jika fb==NULL, berarti _jpg_buf dialokasikan oleh frame2jpg
            if(fb == NULL) free(_jpg_buf); 
            _jpg_buf = NULL;
        }
        
        if(res != ESP_OK){ break; }
    }
    return res;
}

static esp_err_t led_handler(httpd_req_t *req){
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
    httpd_resp_send_chunk(req, NULL, 0); // Sinyal akhir respons
    return ESP_OK;
}

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
        #toggleLedBtn.on { background-color: #28a745; }
        #toggleLedBtn.off { background-color: #dc3545; }
        .status-info { margin-top: 20px; color: #555; }
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
        </div>
        <div class="status-info">
            <p><strong>IP Address:</strong> <span id="ip-address">Loading...</span></p>
        </div>
    </div>
    
    <script>
        window.onload = function() {
            document.getElementById('ip-address').innerText = window.location.hostname;
        };

        async function toggleLed() {
            const btn = document.getElementById('toggleLedBtn');
            const currentState = btn.classList.contains('on');
            const newState = !currentState;
            const action = newState ? 'on' : 'off';
            
            try {
                const response = await fetch(\/led?state=\${action}\);
                if (response.ok) {
                    btn.classList.toggle('on', newState);
                    btn.classList.toggle('off', !newState);
                } else {
                    console.error("Failed to change LED state");
                }
            } catch (error) {
                console.error("Error toggling LED:", error);
            }
        }
    </script>
</body>
</html>
)rawliteral";

static esp_err_t index_handler(httpd_req_t *req){
    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, html_dashboard, HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}

// Definisi URI
httpd_uri_t stream_uri = { .uri = "/stream", .method = HTTP_GET, .handler = stream_handler, .user_ctx = NULL };
httpd_uri_t index_uri = { .uri = "/", .method = HTTP_GET, .handler = index_handler, .user_ctx = NULL };
httpd_uri_t led_uri = { .uri = "/led", .method = HTTP_GET, .handler = led_handler, .user_ctx = NULL };

void startCameraServer(){
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.max_uri_handlers = 4;

    Serial.printf("Starting web server on port: '%d'\n", config.server_port);
    if (httpd_start(&stream_httpd, &config) == ESP_OK) {
        httpd_register_uri_handler(stream_httpd, &index_uri);
        httpd_register_uri_handler(stream_httpd, &stream_uri);
        httpd_register_uri_handler(stream_httpd, &led_uri);
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
    
    // 2. Koneksi Jaringan (Hanya menggunakan default)
    initWiFi();
    
    // 3. Mulai Web Server
    if (WiFi.status() == WL_CONNECTED) {
        startCameraServer();
    } else {
        Serial.println("Web server will not start due to WiFi connection failure.");
    }
}

void loop() {
    delay(10000); // Tidak ada yang perlu dilakukan di loop, semua ditangani oleh handler HTTP
}
