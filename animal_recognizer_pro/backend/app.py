"""
app.py
======
Flask backend for the Animal Recognizer.

Behavior:
- If a custom-trained model exists (model_out/animal_model.keras), it's used
  for predictions, restricted to the classes it was trained on.
- If no custom model exists yet, falls back automatically to a general
  pretrained model (MobileNetV2 + ImageNet, 1000 classes incl. ~130 animals)
  so the app can recognize ANY animal out of the box, before any training.

Endpoints:
    GET  /health              - liveness + which mode is active (custom/fallback)
    GET  /metrics             - the 4 metrics from the last custom training run
    POST /predict/image       - classify an uploaded image (or video frame)
    POST /train/start         - upload a dataset zip and begin training in the background
    GET  /train/status        - poll training progress
"""

import json
import shutil
import threading
import zipfile
from pathlib import Path

import numpy as np
import tensorflow as tf
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image

from train import run_training

MODEL_DIR = Path("model_out")
UPLOAD_DIR = Path("uploads")
DATASET_DIR = Path("dataset_uploaded")
IMG_SIZE = (224, 224)

UPLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__)
CORS(app)

# --- State ---
custom_model = None
custom_class_names = []
training_report = {}
fallback_model = None  # lazy-loaded general ImageNet model

training_state = {"status": "idle", "detail": {}}  # idle | running | done | error


def load_custom_artifacts():
    global custom_model, custom_class_names, training_report
    model_path = MODEL_DIR / "animal_model.keras"
    classes_path = MODEL_DIR / "class_names.json"
    report_path = MODEL_DIR / "training_report.json"

    if model_path.exists():
        custom_model = tf.keras.models.load_model(model_path)
        print(f"Loaded custom model from {model_path}")
    else:
        custom_model = None
        print("No custom model found yet — will use general pretrained fallback for predictions.")

    custom_class_names = json.loads(classes_path.read_text()) if classes_path.exists() else []
    training_report.clear()
    if report_path.exists():
        training_report.update(json.loads(report_path.read_text()))


def get_fallback_model():
    """Lazily load a general-purpose pretrained ImageNet model (recognizes ~130 animal classes)."""
    global fallback_model
    if fallback_model is None:
        print("Loading general pretrained fallback model (MobileNetV2 + ImageNet)...")
        fallback_model = tf.keras.applications.MobileNetV2(weights="imagenet")
        # Warm up with a dummy inference so weights are fully initialized and
        # the first real request doesn't pay this cost (avoids frontend timeouts).
        dummy = np.zeros((1, 224, 224, 3), dtype=np.float32)
        fallback_model.predict(dummy, verbose=0)
        print("Fallback model ready.")
    return fallback_model


ANIMAL_KEYWORDS = [
    "dog", "cat", "bird", "horse", "cow", "sheep", "pig", "elephant", "bear", "zebra",
    "giraffe", "lion", "tiger", "wolf", "fox", "rabbit", "deer", "monkey", "ape", "gorilla",
    "chimpanzee", "snake", "lizard", "turtle", "frog", "fish", "shark", "whale", "dolphin",
    "eagle", "owl", "parrot", "hen", "rooster", "duck", "goose", "peacock", "crab", "lobster",
    "spider", "butterfly", "bee", "hamster", "squirrel", "otter", "panda", "koala", "kangaroo",
    "camel", "leopard", "cheetah", "hippopotamus", "rhinoceros", "raccoon", "skunk", "hedgehog",
    "porcupine", "bat", "crocodile", "alligator", "iguana", "chameleon", "newt", "salamander",
    "jellyfish", "octopus", "squid", "starfish", "seahorse", "terrier", "retriever", "spaniel",
    "poodle", "bulldog", "shepherd", "collie", "hound", "mastiff", "tabby", "siamese", "persian",
    "egyptian",
]


def is_animal_label(label):
    l = label.lower().replace("_", " ")
    return any(k in l for k in ANIMAL_KEYWORDS)


def preprocess_image(pil_image):
    pil_image = pil_image.convert("RGB").resize(IMG_SIZE)
    arr = np.array(pil_image, dtype=np.float32)
    return arr


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "mode": "custom" if custom_model is not None else "fallback",
        "custom_model_loaded": custom_model is not None,
        "classes": custom_class_names,
    })


@app.route("/metrics", methods=["GET"])
def metrics():
    if not training_report:
        return jsonify({
            "error": "No custom training report yet. Train a model via /train/start, "
                     "or the app will keep using the general pretrained fallback."
        }), 404
    return jsonify(training_report)


@app.route("/predict/image", methods=["POST"])
def predict_image():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Send it as multipart/form-data under key 'file'."}), 400

    file = request.files["file"]
    try:
        pil_image = Image.open(file.stream)
    except Exception as e:
        return jsonify({"error": f"Could not read image: {e}"}), 400

    arr = preprocess_image(pil_image)

    if custom_model is not None:
        # --- Use the custom-trained model ---
        pre = tf.keras.applications.mobilenet_v2.preprocess_input(arr.copy())
        pre = np.expand_dims(pre, axis=0)
        preds = custom_model.predict(pre, verbose=0)[0]
        top_indices = np.argsort(preds)[::-1][:5]
        results = [
            {"label": custom_class_names[i] if i < len(custom_class_names) else f"class_{i}",
             "confidence": round(float(preds[i]) * 100, 2)}
            for i in top_indices
        ]
        return jsonify({"predictions": results, "mode": "custom"})

    else:
        # --- Fallback: general pretrained ImageNet model, any animal ---
        model = get_fallback_model()
        pre = tf.keras.applications.mobilenet_v2.preprocess_input(arr.copy())
        pre = np.expand_dims(pre, axis=0)
        preds = model.predict(pre, verbose=0)
        decoded = tf.keras.applications.mobilenet_v2.decode_predictions(preds, top=10)[0]

        all_results = [
            {"label": label.replace("_", " "), "confidence": round(float(conf) * 100, 2)}
            for (_id, label, conf) in decoded
        ]
        animal_results = [r for r in all_results if is_animal_label(r["label"])][:5]
        results = animal_results if animal_results else all_results[:5]

        return jsonify({"predictions": results, "mode": "fallback"})


@app.route("/train/start", methods=["POST"])
def train_start():
    if training_state["status"] == "running":
        return jsonify({"error": "Training is already running."}), 409

    if "dataset" not in request.files:
        return jsonify({"error": "No dataset uploaded. Send a .zip file under key 'dataset'."}), 400

    zip_file = request.files["dataset"]
    epochs = int(request.form.get("epochs", 15))

    zip_path = UPLOAD_DIR / "dataset.zip"
    zip_file.save(zip_path)

    if DATASET_DIR.exists():
        shutil.rmtree(DATASET_DIR)
    DATASET_DIR.mkdir(parents=True)

    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(DATASET_DIR)
    except zipfile.BadZipFile:
        return jsonify({"error": "Uploaded file is not a valid .zip archive."}), 400

    # Zip files sometimes nest everything under one extra folder — flatten if so.
    contents = [c for c in DATASET_DIR.iterdir() if not c.name.startswith('.') and c.name != '__MACOSX']
    data_root = DATASET_DIR
    if len(contents) == 1 and contents[0].is_dir():
        data_root = contents[0]

    class_folders = [
        d for d in data_root.iterdir()
        if d.is_dir() and not d.name.startswith('.') and d.name != '__MACOSX'
    ]
    if len(class_folders) < 2:
        return jsonify({
            "error": f"Found {len(class_folders)} class folder(s) in the zip. "
                     "Need at least 2 (e.g. cat/, dog/, tiger/...)."
        }), 400

    training_state["status"] = "running"
    training_state["detail"] = {"stage": "starting"}

    def progress_cb(info):
        training_state["detail"] = info

    def run_in_background():
        try:
            run_training(str(data_root), epochs=epochs, output_dir=str(MODEL_DIR), progress_cb=progress_cb)
            load_custom_artifacts()
            training_state["status"] = "done"
        except Exception as e:
            training_state["status"] = "error"
            training_state["detail"] = {"stage": "error", "message": str(e)}

    thread = threading.Thread(target=run_in_background, daemon=True)
    thread.start()

    return jsonify({"message": "Training started.", "classes_found": [d.name for d in class_folders]})


@app.route("/train/status", methods=["GET"])
def train_status():
    return jsonify(training_state)


if __name__ == "__main__":
    load_custom_artifacts()
    if custom_model is None:
        # Pre-load and warm up the fallback model at startup so the first
        # real prediction request from the frontend doesn't time out.
        get_fallback_model()
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)