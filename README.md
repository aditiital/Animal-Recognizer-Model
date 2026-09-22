<div align="center">

# 🐾 Animal Recognizer Pro

**An AI-powered multi-modal application for real-time animal recognition across Image, Video, and Audio streams.**

[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Backend-Flask-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![JavaScript](https://img.shields.io/badge/Frontend-Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

[Key Features](#-key-features) • [Project Structure](#-project-structure) • [Getting Started](#-getting-started) • [Usage](#-usage) • [License](#-license)

---

</div>

## 🌟 Overview

**Animal Recognizer Pro** is a full-stack, interactive AI application designed to classify and recognize animals across multiple media types. Combining a lightweight **Flask backend** for model training and endpoint management with a modern **responsive web UI**, this project features real-time classification for static images, live video streams, and audio inputs—complete with custom web-based training workflows!

---

## ✨ Key Features

- 📸 **Image Classification:** Upload pictures to instantly identify animal species.
- 📹 **Video Stream Recognition:** Process live camera feeds or uploaded videos for real-time detection.
- 🎙️ **Audio Classifier:** Detect animal species based on sound clips and animal vocalizations.
- 🏋️ **In-Browser/Custom Training Panel:** Fine-tune or retrain models directly through an intuitive UI panel (`js/train-panel.js`).
- 🎨 **Dynamic Animated UI:** Modern interface styled with responsive CSS and playful ambient elements (`js/emoji-background.js`).

---

## 📁 Project Structure

```text
animal_recognizer_pro/
│
├── 📂 backend/
│   ├── 📄 app.py                  # Flask API server & endpoint routes
│   ├── 📄 train.py                # Python model training script
│   ├── 📄 requirements.txt        # Python dependencies
│   └── 📂 uploads/                # Temporary storage for uploaded media
│
├── 📂 css/
│   └── 📄 style.css               # Responsive design & UI styling
│
├── 📂 js/
│   ├── 📄 main.js                 # App initialization & core logic
│   ├── 📄 model-loader.js         # Model loading orchestrator
│   ├── 📄 image-classifier.js     # Image processing script
│   ├── 📄 video-classifier.js     # Real-time video/webcam processing
│   ├── 📄 audio-classifier.js     # Audio input & signal processing
│   ├── 📄 train-panel.js          # Interactive training workflow UI
│   ├── 📄 ui.js                   # UI manipulation & state updates
│   └── 📄 emoji-background.js     # Dynamic background particle script
│
├── 📄 index.html                  # Main web application UI
└── 📄 README.md                   # Project documentation
