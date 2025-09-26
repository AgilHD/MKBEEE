#include <ESP8266WiFi.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>   // Library LCD I2C

extern "C" {
  #include <espnow.h>
  #include <user_interface.h>
}

// --- Struktur data payload ---
typedef struct _attribute_((packed)) { 
  uint32_t counter;  
  float suhu;        // misalnya suhu
  float kelembaban;  // misalnya kelembaban
} Payload;

LiquidCrystal_I2C lcd(0x27, 16, 2); // alamat I2C biasanya 0x27 atau 0x3F

// --- Callback ketika data diterima ---
void onRecv(uint8_t *mac, uint8_t *incomingData, uint8_t len){
  Payload p{};
  memcpy(&p, incomingData, min((int)len, (int)sizeof(Payload)));

  Serial.printf("[RX] from %02X:%02X:%02X:%02X:%02X:%02X | ch=%d | len=%u | ctr=%lu | suhu=%.2f | hum=%.2f\n",
                mac[0],mac[1],mac[2],mac[3],mac[4],mac[5], 
                wifi_get_channel(), len, p.counter, p.suhu, p.kelembaban);

  // --- Tampilkan di LCD ---
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("Suhu : ");
  lcd.print(p.suhu,1);   // 1 angka di belakang koma
  lcd.print(" C");

  lcd.setCursor(0,1);
  lcd.print("Hum  : ");
  lcd.print(p.kelembaban,1);
  lcd.print(" %");
}

void forceChannel(uint8_t ch){
  wifi_promiscuous_enable(1);
  wifi_set_channel(ch);
  wifi_promiscuous_enable(0);
}

void setup(){
  Serial.begin(115200);

  // --- LCD init ---
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0,0);
  lcd.print("ESP8266 Ready");

  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setSleepMode(WIFI_NONE_SLEEP);
  forceChannel(1); // harus match ESPNOW_CH di ESP sender

  if (esp_now_init() != 0){ 
    Serial.println("ESP-NOW init failed"); 
    lcd.setCursor(0,1);
    lcd.print("ESPNOW FAIL");
    while(true){} 
  }
  esp_now_set_self_role(ESP_NOW_ROLE_SLAVE);
  esp_now_register_recv_cb(onRecv);

  Serial.printf("ESP8266 MAC: %s | listening on CH=%d\n", WiFi.macAddress().c_str(), wifi_get_channel());
}

void loop(){
  static unsigned long t=0;
  if (millis()-t >= 2000){ 
    Serial.println("(listening...)"); 
    t = millis(); 
  }
}