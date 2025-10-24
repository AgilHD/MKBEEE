#pragma once
#include "esp_camera.h"
#include "esp_http_server.h"
#include <string.h>

// === PIN DFRobot ESP32-S3 AI Camera (ubah jika board berbeda)
#ifndef CAM_PINS_DEFINED
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
#endif

// ===== API yg dipanggil dari sketch
bool CAM_initCamera();                   // aman dipanggil meski kamera sudah aktif
bool CAM_attachToHttpd(httpd_handle_t);  // daftarkan endpoints ke server kamu
bool CAM_startOwnServer(uint16_t port);  // start server kecil sendiri (mis. :82)

// ====== Internal
static httpd_handle_t _cam_httpd = NULL;

static const char* _CAM_STREAM_CT = "multipart/x-mixed-replace;boundary=frame";
static const char* _CAM_BOUNDARY  = "\r\n--frame\r\n";
static const char* _CAM_PART_HDR  = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// ---------- Halaman TM Pose (served by ESP, same-origin) ----------
static const char TM_HTML[] PROGMEM = R"rawliteral(
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Teachable Machine Pose — ESP32-S3</title>
  <style>
    body { font-family: system-ui, Arial; margin:16px }
    #wrap { display:flex; gap:16px; align-items:flex-start }
    #left, #right { flex:1 }
    #canvas { border:1px solid #ccc; width:320px; height:320px }
    .row { margin:8px 0 }
    #label-container div { line-height:1.6 }
    #status { margin-left:8px; color:#666 }
    #err { color:#b00; margin-top:6px; white-space:pre-wrap }
    input{ width:520px; }
  </style>
</head>
<body>
  <h2>Teachable Machine Pose — ESP32-S3</h2>
  <div class="row">
    Stream: <code id="u"></code>
    &nbsp;&nbsp;TM Model URL:
    <input id="modelUrl" value="https://teachablemachine.withgoogle.com/models/gtwW8jlvq/" />
    <button id="btnStart">Start</button>
    <span id="status">Idle</span>
  </div>
  <div id="err"></div>

  <div id="wrap">
    <div id="left">
      <img id="esp" src="/stream" style="display:none" />
      <canvas id="canvas" width="200" height="200"></canvas>
      <div class="row"><small id="perf"></small></div>
    </div>
    <div id="right">
      <h4>Predictions</h4>
      <div id="label-container"></div>
    </div>
  </div>

  <!-- load libs via HTTPS (aman ditarik dari halaman HTTP) -->
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8/dist/teachablemachine-pose.min.js"></script>
  <script>
    let model, maxPredictions, ctx, canvas, img, labelContainer, running=false;

    function setStatus(s){ document.getElementById("status").textContent = s; }
    function setErr(e){ document.getElementById("err").textContent = e || ""; }

    // tampilkan URL stream yg dipakai (origin yg sama)
    document.addEventListener("DOMContentLoaded", ()=>{
      const u = location.origin + "/stream";
      document.getElementById("u").textContent = u;
    });

    document.getElementById("btnStart").addEventListener("click", start);

    async function start() {
      setErr("");
      setStatus("Loading model...");

      const base = document.getElementById("modelUrl").value.trim().replace(/\/?$/, "/");
      const modelURL = base + "model.json";
      const metadataURL = base + "metadata.json";

      try {
        model = await tmPose.load(modelURL, metadataURL);
      } catch (e) {
        setErr("Gagal load model TM:\\n" + e);
        return;
      }
      maxPredictions = model.getTotalClasses();

      canvas = document.getElementById("canvas");
      ctx = canvas.getContext("2d");
      img = document.getElementById("esp"); // same-origin, no CORS/PNA

      labelContainer = document.getElementById("label-container");
      labelContainer.innerHTML = "";
      for (let i = 0; i < maxPredictions; i++) {
        labelContainer.appendChild(document.createElement("div"));
      }

      setStatus("Running...");
      running = true;
      requestAnimationFrame(loop);
    }

    async function loop() {
      if (!running) return;

      if (!img.naturalWidth || !img.naturalHeight) {
        requestAnimationFrame(loop); return;
      }

      const t0 = performance.now();

      try { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); }
      catch (e) { setErr("Gagal draw frame: " + e); running=false; return; }

      let result;
      try { result = await model.estimatePose(canvas); }
      catch (e) { requestAnimationFrame(loop); return; }

      if (!result || !result.pose) { requestAnimationFrame(loop); return; }

      const { pose, posenetOutput } = result;

      try {
        if (posenetOutput) {
          const prediction = await model.predict(posenetOutput);
          for (let i = 0; i < prediction.length; i++) {
            const p = prediction[i];
            let div = labelContainer.childNodes[i];
            if (!div) div = labelContainer.appendChild(document.createElement("div"));
            div.textContent = p.className + ": " + p.probability.toFixed(2);
          }
        }
      } catch (e) { /* skip frame */ }

      if (pose && pose.keypoints) {
        tmPose.drawKeypoints(pose.keypoints, 0.5, ctx);
        tmPose.drawSkeleton(pose.keypoints, 0.5, ctx);
      }

      const dt = performance.now() - t0;
      document.getElementById("perf").textContent =
        `Frame time: ${dt.toFixed(1)} ms (${(1000/dt).toFixed(1)} FPS)`;

      requestAnimationFrame(loop);
    }
  </script>
</body>
</html>
)rawliteral";

// ---------- Handlers ----------
static esp_err_t _CAM_tm_handler(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/html; charset=utf-8");
  // same-origin: TIDAK perlu CORS header apa pun
  return httpd_resp_send(req, TM_HTML, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t _CAM_stream_handler(httpd_req_t *req) {
  // same-origin: TIDAK perlu CORS header apa pun
  httpd_resp_set_type(req, _CAM_STREAM_CT);

  while (true) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) break;

    httpd_resp_send_chunk(req, _CAM_BOUNDARY, strlen(_CAM_BOUNDARY));
    char hdr[64];
    size_t hlen = snprintf(hdr, sizeof(hdr), _CAM_PART_HDR, fb->len);
    httpd_resp_send_chunk(req, hdr, hlen);
    httpd_resp_send_chunk(req, (const char*)fb->buf, fb->len);
    esp_camera_fb_return(fb);
    vTaskDelay(1);
  }
  return ESP_OK;
}

// ---------- Camera init (idempotent) ----------
inline bool CAM_initCamera() {
  sensor_t *s = esp_camera_sensor_get();
  if (s != nullptr) {
    s->set_framesize(s, FRAMESIZE_QVGA);
    Serial.println("[CAM] camera already active -> reuse (set QVGA)");
    return true;
  }

  camera_config_t cfg;
  cfg.ledc_channel = LEDC_CHANNEL_0;
  cfg.ledc_timer   = LEDC_TIMER_0;
  cfg.pin_d0=Y2_GPIO_NUM; cfg.pin_d1=Y3_GPIO_NUM; cfg.pin_d2=Y4_GPIO_NUM; cfg.pin_d3=Y5_GPIO_NUM;
  cfg.pin_d4=Y6_GPIO_NUM; cfg.pin_d5=Y7_GPIO_NUM; cfg.pin_d6=Y8_GPIO_NUM; cfg.pin_d7=Y9_GPIO_NUM;
  cfg.pin_xclk=XCLK_GPIO_NUM; cfg.pin_pclk=PCLK_GPIO_NUM; cfg.pin_vsync=VSYNC_GPIO_NUM; cfg.pin_href=HREF_GPIO_NUM;
  cfg.pin_sscb_sda = SIOD_GPIO_NUM;  // core ESP32 3.x
  cfg.pin_sscb_scl = SIOC_GPIO_NUM;
  cfg.pin_pwdn = PWDN_GPIO_NUM;
  cfg.pin_reset= RESET_GPIO_NUM;

  cfg.xclk_freq_hz = 20000000;
  cfg.pixel_format = PIXFORMAT_JPEG;
  cfg.frame_size   = FRAMESIZE_QVGA;   // ringan & stabil
  cfg.jpeg_quality = 12;
  cfg.fb_count     = 1;
  cfg.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  cfg.fb_location  = CAMERA_FB_IN_PSRAM;

  Serial.println("[CAM] camera not active -> init now");
  esp_err_t err = esp_camera_init(&cfg);
  if (err != ESP_OK) {
    Serial.printf("[CAM] camera init failed 0x%x\n", err);
    return false;
  }

  s = esp_camera_sensor_get();
  if (s) {
    if (s->id.PID == OV3660_PID) {
      s->set_vflip(s, 1);
      s->set_brightness(s, 1);
      s->set_saturation(s, -2);
    }
    s->set_framesize(s, FRAMESIZE_QVGA);
  }
  Serial.println("[CAM] camera ready (QVGA, JPEG)");
  return true;
}

// ---------- Register endpoints ke server yg sudah ada ----------
inline bool CAM_attachToHttpd(httpd_handle_t server) {
  if (!server) return false;

  httpd_uri_t tm_uri     = { .uri="/tm",     .method=HTTP_GET, .handler=_CAM_tm_handler,     .user_ctx=NULL };
  httpd_uri_t stream_uri = { .uri="/stream", .method=HTTP_GET, .handler=_CAM_stream_handler, .user_ctx=NULL };

  esp_err_t ok1 = httpd_register_uri_handler(server, &tm_uri);
  esp_err_t ok2 = httpd_register_uri_handler(server, &stream_uri);

  if (ok1 == ESP_OK && ok2 == ESP_OK) {
    Serial.println("[CAM] mounted /tm and /stream on existing server");
    return true;
  }
  Serial.printf("[CAM] attach failed: 0x%x / 0x%x\n", ok1, ok2);
  return false;
}

// ---------- Start server kecil sendiri (mis. :82) ----------
inline bool CAM_startOwnServer(uint16_t port) {
  if (_cam_httpd) return true;

  httpd_config_t cfg = HTTPD_DEFAULT_CONFIG();
  cfg.server_port = port;

  esp_err_t ok = httpd_start(&_cam_httpd, &cfg);
  if (ok != ESP_OK) {
    Serial.printf("[CAM] httpd start failed: 0x%x\n", ok);
    return false;
  }

  httpd_uri_t tm_uri     = { .uri="/tm",     .method=HTTP_GET, .handler=_CAM_tm_handler,     .user_ctx=NULL };
  httpd_uri_t stream_uri = { .uri="/stream", .method=HTTP_GET, .handler=_CAM_stream_handler, .user_ctx=NULL };

  httpd_register_uri_handler(_cam_httpd, &tm_uri);
  httpd_register_uri_handler(_cam_httpd, &stream_uri);

  Serial.printf("[CAM] own HTTP server on :%u, endpoints: /tm, /stream\n", port);
  return true;
}
