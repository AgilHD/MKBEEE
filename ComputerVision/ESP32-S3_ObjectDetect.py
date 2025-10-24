import cv2
import requests
import numpy as np
import tensorflow as tf
import json
import os
from tensorflow.keras.models import model_from_json

# ========================
# KONFIGURASI ESP32-S3
# ========================
ESP32_IP = "http://10.47.136.243"  # Ganti dengan IP ESP32 kamu
STREAM_URL = f"{ESP32_IP}/stream"
LED_URL = f"{ESP32_IP}/led"

# ========================
# LOAD MODEL TEACHABLE MACHINE
# ========================
MODEL_DIR = "my-pose-model"

def load_teachable_machine_model(model_dir):
    """Memuat model Teachable Machine (model.json + weights.bin)"""
    model_json_path = os.path.join(model_dir, "model.json")
    weights_path = os.path.join(model_dir, "weights.bin")
    metadata_path = os.path.join(model_dir, "metadata.json")

    with open(model_json_path, "r") as f:
        model_json = json.load(f)

    # Model diubah dari TFJS menjadi model Sequential Keras
    model = tf.keras.models.model_from_json(json.dumps(model_json["modelTopology"]))
    weights_data = open(weights_path, "rb").read()
    with open(weights_path, "rb") as f:
        weights_bytes = f.read()

    # Load bobot (konversi dari TFJS)
    tfjs_loader = tf.keras.models.model_from_json(json.dumps(model_json["modelTopology"]))
    tfjs_loader.load_weights(weights_path)

    # Ambil metadata (label)
    with open(metadata_path, "r") as f:
        metadata = json.load(f)

    labels = [item["class_name"] for item in metadata["labels"]]
    return tfjs_loader, labels


print("📦 Memuat model Teachable Machine...")
try:
    model, class_names = load_teachable_machine_model(MODEL_DIR)
    print("✅ Model berhasil dimuat!")
    print("Kelas yang dikenali:", class_names)
except Exception as e:
    print("❌ Gagal memuat model:", e)
    model, class_names = None, []


# ========================
# FUNGSI KONTROL LED
# ========================
def toggle_led(state: bool):
    """Menghidupkan atau mematikan LED Flash di ESP32"""
    try:
        action = "on" if state else "off"
        r = requests.get(f"{LED_URL}?state={action}", timeout=2)
        if r.status_code == 200:
            print(f"✅ LED {action.upper()}")
        else:
            print(f"⚠️ Gagal ubah LED ({r.status_code})")
    except Exception as e:
        print("❌ Error toggle LED:", e)


# ========================
# FUNGSI STREAM + DETEKSI
# ========================
def preprocess_frame(frame):
    """Menyesuaikan frame ke format input model Teachable Machine"""
    img = cv2.resize(frame, (224, 224))  # Ukuran input Teachable Machine
    img = img.astype(np.float32) / 255.0
    img = np.expand_dims(img, axis=0)
    return img

def stream_camera():
    """Menampilkan stream video dari ESP32 + deteksi pose"""
    print("📡 Menghubungkan ke kamera ESP32...")
    session = requests.Session()
    response = session.get(STREAM_URL, stream=True)
    if response.status_code != 200:
        raise RuntimeError(f"Gagal membuka stream: {response.status_code}")

    bytes_data = b""
    led_on = False
    print("🎥 Tekan [L] untuk toggle LED, [Q] untuk keluar.")

    try:
        for chunk in response.iter_content(chunk_size=1024):
            bytes_data += chunk
            a = bytes_data.find(b'\xff\xd8')
            b = bytes_data.find(b'\xff\xd9')
            if a != -1 and b != -1:
                jpg = bytes_data[a:b+2]
                bytes_data = bytes_data[b+2:]
                frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)

                if frame is None:
                    continue

                # === Jalankan Prediksi ===
                if model is not None:
                    input_data = preprocess_frame(frame)
                    preds = model.predict(input_data, verbose=0)[0]
                    class_id = np.argmax(preds)
                    confidence = preds[class_id]
                    label = class_names[class_id] if class_names else f"Class {class_id}"

                    # Tampilkan label di layar
                    cv2.putText(frame, f"{label} ({confidence*100:.1f}%)",
                                (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

                cv2.imshow("ESP32-S3 Pose Detection", frame)

                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('l'):
                    led_on = not led_on
                    toggle_led(led_on)

    finally:
        cv2.destroyAllWindows()
        response.close()
        session.close()
        print("🔴 Stream dihentikan.")


# ========================
# MAIN
# ========================
if __name__ == "__main__":
    stream_camera()
