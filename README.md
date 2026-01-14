# BoBoBee - Smart Toddler Sleep Companion System

**1st Place Winner, National IoT Competition (MAGE 11 ITS, 2025)**

BoBoBee is an IoT-based smart sleep monitoring system designed to prevent Sudden Infant Death Syndrome (SIDS) through real-time monitoring of crying patterns, sleep posture, and environmental conditions.

> [Live Demo](https://bobobee.netlify.app/) | [Presentation (Canva)](https://www.canva.com/design/DAG3cDWQje0/tmKzxWcJe7yiXcl_XKY8bA/edit)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Hardware Components](#hardware-components)
- [Software Components](#software-components)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Technology Stack](#technology-stack)
- [Team](#team)
- [License](#license)

---

## Overview

BoBoBee addresses the critical need for infant safety during sleep. The system combines:

- **Audio Classification**: Cloud-based AI model for detecting infant distress through cry pattern analysis
- **Computer Vision**: Custom-trained pose detection model to identify unsafe sleep positions (supine vs. prone)
- **Environmental Monitoring**: Real-time temperature and humidity tracking using DHT22 sensors
- **Offline Communication**: ESP-NOW protocol enabling reliable device-to-device communication without internet dependency

---

## Key Features

### Sleep Position Monitoring

AI-powered detection ensures babies sleep in safe positions with instant alerts for prone (face-down) positioning that increases SIDS risk.

### Cry Detection and Response

Advanced audio analysis using TensorFlow.js and Teachable Machine models to detect different cry patterns and trigger appropriate alerts.

### Real-time Environmental Monitoring

24/7 monitoring of temperature and humidity conditions with configurable thresholds and automated alarm systems.

### Dual ESP32 Architecture

Robust sender-receiver design using ESP-NOW protocol for low-latency, reliable mesh communication without WiFi infrastructure dependency.

### React.js Dashboard

Modern web-based monitoring console with live camera feeds, real-time sensor data visualization, and alert management.

---

## System Architecture

```
                                    +-------------------+
                                    |   React.js Web    |
                                    |    Dashboard      |
                                    |  (Netlify/Local)  |
                                    +--------+----------+
                                             |
                                             | HTTP/WebSocket
                                             v
+-------------------+   ESP-NOW    +-------------------+
|   ESP32 Sender    | -----------> |   ESP32 Receiver  |
|                   |              |                   |
| - DHT22 Sensor    |              | - LCD Display     |
| - ESP32-S3 Camera |              | - I2S Audio       |
| - TFT Display     |              | - Alarm System    |
+-------------------+              +-------------------+
        |
        | Video Stream
        v
+-------------------+
|  Computer Vision  |
|   (TensorFlow)    |
|  Pose Detection   |
+-------------------+
```

---

## Hardware Components

| Component            | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| ESP32-S3 (Sender)    | Camera module, sensor data collection, video streaming |
| ESP32 (Receiver)     | Data aggregation, LCD display, audio alarm output      |
| DHT22                | Temperature and humidity sensing                       |
| OV2640/OV3660 Camera | Live video capture for pose detection                  |
| ST7735 TFT Display   | Local status display with animated expressions         |
| I2S Audio Module     | Alarm sound generation                                 |
| LCD 16x2 I2C         | Receiver status display                                |

---

## Software Components

### Firmware (`*.ino`, `*.c`)

| File                     | Description                                                                 |
| ------------------------ | --------------------------------------------------------------------------- |
| `sender_fix.ino`         | ESP32 sender node: DHT22 data collection, TFT display, ESP-NOW transmission |
| `receiver_fix.ino`       | ESP32 receiver node: data aggregation, LCD display, I2S audio alarm         |
| `bobobee.c`              | ESP32-S3 camera streaming server with LED flash control                     |
| `webcam-stream.ino`      | Alternative webcam streaming implementation                                 |
| `Webcam_image_audio.ino` | Combined image capture and audio processing                                 |

### Computer Vision (`ComputerVision/`)

- **ESP32-S3_ObjectDetect.py**: Python script for real-time pose detection using Teachable Machine models
- **my-pose-model/**: Pre-trained TensorFlow.js model for infant sleep position classification

### Web Dashboard (`BoboBee Web FIX LAST/`)

React.js application built with Vite, featuring:

- Real-time device monitoring dashboard
- Live camera feed integration
- Sensor data visualization
- Alert and notification system
- User authentication (Login/Register)
- TensorFlow.js-based ML inference

---

## Project Structure

```
MKBEEE/
├── README.md
├── sender_fix.ino          # ESP32 sender firmware
├── receiver_fix.ino        # ESP32 receiver firmware
├── bobobee.c               # ESP32-S3 camera server
├── webcam-stream.ino       # Webcam streaming
├── Webcam_image_audio.ino  # Audio + image processing
│
├── ComputerVision/
│   ├── ESP32-S3_ObjectDetect.py
│   └── my-pose-model/
│       ├── metadata.json
│       ├── model
│       └── weights.bin
│
├── BoboBee Stream/
│   └── 5_3/                # Camera streaming module
│       ├── 5_3.ino
│       ├── app_httpd.cpp
│       └── camera_index.h
│
└── BoboBee Web FIX LAST/   # React.js Dashboard
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── pages/
        │   ├── LandingPage.tsx
        │   ├── LoginPage.tsx
        │   ├── RegisterPage.tsx
        │   ├── DevicesPage.tsx
        │   └── DeviceDashboard.tsx
        ├── components/
        ├── ml/               # TensorFlow.js audio models
        ├── services/
        └── state/
```

---

## Getting Started

### Prerequisites

- Arduino IDE with ESP32 board support
- Node.js 18+ and npm
- Python 3.8+ (for computer vision)
- ESP32-S3 and ESP32 development boards

### Firmware Setup

1. **Install ESP32 Board Package**

   - In Arduino IDE: `File > Preferences > Additional Board URLs`
   - Add: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`

2. **Install Required Libraries**

   - Adafruit DHT Sensor Library
   - Adafruit GFX Library
   - Adafruit ST7735 Library
   - LiquidCrystal I2C
   - ESP32 Camera Library

3. **Flash Sender Node**

   ```bash
   # Open sender_fix.ino in Arduino IDE
   # Select ESP32 board and upload
   ```

4. **Flash Receiver Node**
   ```bash
   # Open receiver_fix.ino in Arduino IDE
   # Select ESP32 board and upload
   ```

### Web Dashboard Setup

```bash
cd "BoboBee Web FIX LAST"
npm install
npm run dev
```

Access the dashboard at `http://localhost:5173`

### Computer Vision Setup

```bash
cd ComputerVision
pip install tensorflow opencv-python numpy requests
python ESP32-S3_ObjectDetect.py
```

---

## Technology Stack

### Hardware

- ESP32 / ESP32-S3 Microcontrollers
- ESP-NOW Protocol for device communication
- DHT22 Temperature/Humidity Sensor
- OV2640/OV3660 Camera Module

### Software

- **Firmware**: C/C++ (Arduino Framework)
- **Frontend**: React.js, TypeScript, Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **ML/AI**: TensorFlow.js, Teachable Machine
- **Data Fetching**: TanStack React Query

### Cloud/Deployment

- Netlify (Web Dashboard)
- Teachable Machine (Model Training)

---

## Team

BoBoBee was developed by a dedicated team competing in the MAGE 11 ITS National IoT Competition 2025.

---

## License

This project is developed for educational and competition purposes. For licensing inquiries, please contact the development team.

---

**BoBoBee** - Smart Care, Sweet Dream
