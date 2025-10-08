import cv2

ip = "192.168.1.67"  # ganti dengan IP kamera Anda
stream_url = f"http://{ip}:80/stream"  # coba :81/stream, atau /jpg, atau RTSP jika tersedia

cap = cv2.VideoCapture(stream_url)

if not cap.isOpened():
    raise RuntimeError("Tidak dapat membuka stream. Periksa IP/URL dan firmware kamera.")

while True:
    ret, frame = cap.read()
    if not ret:
        print("Frame kosong, mencoba lagi...")
        continue

    cv2.imshow("Camera", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
