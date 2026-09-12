# Animal Recognizer — Full-Stack, Any-Animal, Self-Training

Recognizes animals from **photos, videos, or sounds**. Comes with a general
pretrained model out of the box (so it works immediately on any common
animal), and lets you upload your own dataset to train a specialized model
right from the browser — no command line needed after setup.

Theme: wine red + neon black.

## Project structure

```
animal_recognizer_pro/
├── index.html                   Page markup (Image / Video / Sound / Train tabs)
├── css/
│   └── style.css                 Wine-red + neon-black theme, animations
├── js/
│   ├── model-loader.js           Shared CDN-fallback + timeout utilities
│   ├── image-classifier.js       Calls backend for image predictions
│   ├── video-classifier.js       Extracts a video frame, reuses image endpoint
│   ├── audio-classifier.js       YAMNet (still runs client-side) for sound
│   ├── train-panel.js            Dataset upload + live training progress
│   ├── ui.js                     Tabs, dropzones, result rendering, emoji mapping
│   ├── emoji-background.js       Animated floating-emoji background
│   └── main.js                   Entry point — wires everything together
├── backend/
│   ├── train.py                   Trainable as CLI or as a function (used by app.py)
│   ├── app.py                     Flask API: predict, train, metrics, fallback model
│   ├── requirements.txt
│   ├── uploads/                   Uploaded dataset zips land here temporarily
│   ├── dataset_uploaded/          Extracted dataset from the last upload
│   └── model_out/                 Trained model + metrics (created after training)
└── README.md
```

## How "any animal, with or without a dataset" works

- **No custom model yet?** The backend automatically falls back to a general
  pretrained model (MobileNetV2 + ImageNet — 1000 classes, ~130 of them
  animals). This means the app recognizes common animals **immediately**,
  with zero setup.
- **Uploaded a dataset and trained?** The backend automatically switches to
  your custom model instead, scoped to your classes. If you later want the
  general fallback again, just delete `backend/model_out/`.
- This switch is automatic and reported in the UI status line so you always
  know which mode is active.

## Running it

### 1. Install & start the backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Runs on `http://localhost:5000`. On first run (no dataset trained yet),
predictions immediately work using the general fallback model.

### 2. Serve the frontend (separate terminal)

```bash
cd animal_recognizer_pro
python -m http.server 8080
```

Open `http://localhost:8080`.

### 3. Try it immediately (no training needed)

Upload any animal photo or video on the Image/Video tab — you'll get real
predictions right away via the pretrained fallback model.

### 4. Train on your own dataset (from the browser)

1. Prepare a `.zip` file with one folder per animal class:
   ```
   my_dataset.zip
     tiger/     photo1.jpg photo2.jpg ...
     elephant/  photo1.jpg photo2.jpg ...
     panda/     photo1.jpg photo2.jpg ...
   ```
2. Go to the **Train** tab, upload the zip, set epochs, click **Start Training**.
3. Watch live progress (per-epoch accuracy) until it completes.
4. The app automatically switches to your custom model and refreshes the
   4-metric dashboard (Accuracy, Precision, Recall, F1-score) below.

You can retrain any time by uploading a new zip — it replaces the current
custom model.

## The 4 metrics

| Metric | What it measures |
|---|---|
| **Accuracy** | Overall fraction of correct predictions |
| **Precision** | Of everything predicted as class X, how much actually was X |
| **Recall** | Of everything that actually was class X, how much was caught |
| **F1-score** | Harmonic mean of Precision and Recall |

These are computed on a held-out validation split after every training run
and served via `GET /metrics`.

## API reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness + current mode (`custom` or `fallback`) |
| `/metrics` | GET | 4 metrics + confusion matrix from the last training run |
| `/predict/image` | POST | Upload an image (`file` field), get top-5 predictions |
| `/train/start` | POST | Upload a dataset `.zip` (`dataset` field) + `epochs`, starts training |
| `/train/status` | GET | Poll current training progress |

## Notes

- Video classification samples **one representative frame** (10% into the
  clip) rather than processing every frame — fast, and sufficient for
  identifying which animal is present. For frame-by-frame video analysis,
  this would need extending.
- Sound classification still runs fully in-browser via YAMNet — no backend
  round-trip needed for audio.
- Training runs in a background thread on the Flask server; only one
  training job can run at a time (`/train/start` returns 409 if one is
  already in progress).
- On Windows, use `python` not `python3` for the frontend static server.