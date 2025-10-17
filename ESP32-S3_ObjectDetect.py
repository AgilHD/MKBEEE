# Ganti stream_url dengan URL MJPEG Anda, misal "http://10.157.147.243:81/stream"
import cv2
import requests
import numpy as np

stream_url = "http://10.157.147.243:80/stream"
sess = requests.Session()
resp = sess.get(stream_url, stream=True, timeout=10)

if resp.status_code != 200:
    raise RuntimeError(f"HTTP {resp.status_code} dari {stream_url}")

bytes_stream = b''
for chunk in resp.iter_content(chunk_size=1024):
    bytes_stream += chunk
    a = bytes_stream.find(b'\xff\xd8')  # start JPEG
    b = bytes_stream.find(b'\xff\xd9')  # end JPEG
    if a != -1 and b != -1:
        jpg = bytes_stream[a:b+2]
        bytes_stream = bytes_stream[b+2:]
        img = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
        if img is not None:
            cv2.imshow("Camera", img)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

resp.close()
cv2.destroyAllWindows()
