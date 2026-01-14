# Modifikasi ESP LCD untuk Integrasi Web

## Endpoint yang Diperlukan

Web application memerlukan endpoint HTTP pada ESP LCD untuk mendapatkan data sensor. Berikut adalah kode yang perlu ditambahkan ke ESP LCD:

## 1. Tambahkan Handler untuk Endpoint `/sensors`

Tambahkan handler berikut ke fungsi `setup()` setelah `server.on("/cry", handleCryStatus);`:

```cpp
// Handler untuk mendapatkan data sensor
server.on("/sensors", HTTP_GET, []() {
  float suhu = dht.readTemperature();
  float kelembaban = dht.readHumidity();
  
  if (!isnan(suhu) && !isnan(kelembaban)) {
    // Kirim response JSON
    String json = "{";
    json += "\"tempC\":" + String(suhu, 2) + ",";
    json += "\"rh\":" + String(kelembaban, 2) + ",";
    json += "\"timestamp\":" + String(millis());
    json += "}";
    
    server.send(200, "application/json", json);
  } else {
    // Jika gagal membaca sensor
    server.send(500, "application/json", "{\"error\":\"Failed to read sensor\"}");
  }
});
```

## 2. Kode Lengkap (Modifikasi pada fungsi setup)

Tambahkan handler ini di dalam fungsi `setup()` setelah inisialisasi server:

```cpp
void setup() {
  // ... kode existing ...
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Tersambung. IP: " + WiFi.localIP().toString());
    server.on("/cry", handleCryStatus);
    
    // Tambahkan handler untuk sensor data
    server.on("/sensors", HTTP_GET, []() {
      float suhu = dht.readTemperature();
      float kelembaban = dht.readHumidity();
      
      if (!isnan(suhu) && !isnan(kelembaban)) {
        String json = "{";
        json += "\"tempC\":" + String(suhu, 2) + ",";
        json += "\"rh\":" + String(kelembaban, 2) + ",";
        json += "\"timestamp\":" + String(millis());
        json += "}";
        
        server.send(200, "application/json", json);
        Serial.println("[HTTP] Sensor data sent: " + json);
      } else {
        server.send(500, "application/json", "{\"error\":\"Failed to read sensor\"}");
        Serial.println("[HTTP] Failed to read sensor data");
      }
    });
    
    server.begin();
  }
  
  // ... kode existing ...
}
```

## 3. Konfigurasi Web Application

Pastikan IP ESP LCD dikonfigurasi dengan benar di web application:

1. Set environment variable `VITE_ESP_LCD_HOST` dengan IP ESP LCD (default: `10.24.69.244`)
2. Atau gunakan UI untuk mengubah IP ESP LCD di runtime (akan disimpan di localStorage)

## 4. Testing

Setelah modifikasi:

1. Upload kode ke ESP LCD
2. Pastikan ESP LCD terhubung ke WiFi
3. Buka browser dan akses: `http://<ESP_LCD_IP>/sensors`
4. Anda harus melihat JSON response seperti:
   ```json
   {
     "tempC": 25.50,
     "rh": 65.00,
     "timestamp": 123456
   }
   ```

## 5. Perbaikan Handler `/cry` untuk Menerima Status Prediksi

Handler `/cry` perlu diperbaiki agar bisa menampilkan ekspresi sesuai status tangisan. Ganti fungsi `handleCryStatus()` dengan kode berikut:

```cpp
void handleCryStatus() {
  if (server.hasArg("status")) {
    String newStatus = server.arg("status");
    
    // Validasi status (hanya terima "Menangis" atau "TidakMenangis" - tanpa spasi)
    if (newStatus == "Menangis" || newStatus == "TidakMenangis") {
      statusCry = newStatus;
      Serial.println("[HTTP] Status tangisan diterima: " + statusCry);
      
      // Update ekspresi wajah sesuai status
      if (statusCry == "Menangis") {
        // Tampilkan ekspresi sedih/terkejut (mode 1 atau 2)
        drawFace(1); // 😲 Terkejut
        Serial.println("[ESP-LCD] Menampilkan ekspresi: Menangis");
        
        // Kirim alert via ESP-NOW
        Payload alert{ counter++, -1.0f, -1.0f };  // -1 menandakan alert tangisan
        esp_now_send(TARGET_8266_MAC, (uint8_t*)&alert, sizeof(alert));
        esp_now_send(BCAST, (uint8_t*)&alert, sizeof(alert));
        Serial.println("[ESP-NOW] Alert tangisan dikirim!");
      } else {
        // Tampilkan ekspresi normal/senyum (mode 0)
        drawFace(0); // 😀 Senyum
        Serial.println("[ESP-LCD] Menampilkan ekspresi: TidakMenangis");
      }
    } else {
      Serial.println("[HTTP] Status tidak valid: " + newStatus);
      server.send(400, "text/plain", "Status harus 'Menangis' atau 'TidakMenangis'");
      return;
    }
  }
  
  server.send(200, "text/plain", "OK: " + statusCry);
}
```

**Catatan:** Hapus logika di `loop()` yang mengirim alert berdasarkan `statusCry`, karena sekarang sudah dikirim langsung dari handler.

## 6. Perbaikan di `loop()` - Hapus Logika Alert Lama

Hapus atau comment bagian ini di `loop()`:

```cpp
// HAPUS ATAU COMMENT BAGIAN INI:
// Jika status tangisan diterima dari web
// if (statusCry == "Menangis") {
//   Payload alert{ counter++, -1.0f, -1.0f };
//   esp_now_send(TARGET_8266_MAC, (uint8_t*)&alert, sizeof(alert));
//   esp_now_send(BCAST, (uint8_t*)&alert, sizeof(alert));
//   Serial.println("[ALERT] Anak Menangis - dikirim via ESP-NOW!");
//   statusCry = "Tidak Menangis"; // reset agar tidak berulang
// }
```

Karena alert sekarang sudah dikirim langsung dari handler `handleCryStatus()`.

## 7. Endpoint yang Tersedia

- `GET /cry?status=Menangis` - Menerima status tangisan dari web, menampilkan ekspresi di TFT, dan mengirim alert via ESP-NOW
- `GET /cry?status=TidakMenangis` - Menerima status normal, menampilkan ekspresi senyum di TFT (format tanpa spasi)
- `GET /sensors` - Mengembalikan data sensor (temperature & humidity) dalam format JSON

## Catatan

- Endpoint `/sensors` akan membaca data langsung dari sensor DHT22 setiap kali dipanggil
- Timestamp menggunakan `millis()` sebagai referensi waktu sejak boot
- Jika sensor gagal membaca, endpoint akan mengembalikan status 500 dengan pesan error
- Endpoint `/cry` akan langsung mengupdate tampilan TFT dan mengirim alert ESP-NOW saat status "Menangis"
- Web application akan mengirim status setiap kali prediksi berubah (hanya saat status berubah, tidak setiap detik)
