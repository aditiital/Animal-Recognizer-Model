"""
train.py
========
Trains an animal image classifier using transfer learning (MobileNetV2
backbone, pretrained on ImageNet) and reports 4 standard classification
metrics: Accuracy, Precision, Recall, and F1-score.

Can be run from the CLI:
    python train.py --data_dir dataset --epochs 15 --output_dir model_out

...or imported and called as a function (used by app.py's /train endpoint):
    from train import run_training
    run_training(data_dir="dataset", epochs=15, output_dir="model_out", progress_cb=...)
"""

import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

IMG_SIZE = (224, 224)
BATCH_SIZE = 32
SEED = 42


def build_datasets(data_dir):
    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir, validation_split=0.2, subset="training",
        seed=SEED, image_size=IMG_SIZE, batch_size=BATCH_SIZE,
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir, validation_split=0.2, subset="validation",
        seed=SEED, image_size=IMG_SIZE, batch_size=BATCH_SIZE,
    )
    class_names = train_ds.class_names

    augment = models.Sequential([
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.1),
        layers.RandomZoom(0.1),
        layers.RandomContrast(0.1),
    ])
    preprocess = tf.keras.applications.mobilenet_v2.preprocess_input

    train_ds = train_ds.map(lambda x, y: (preprocess(augment(x)), y)).prefetch(tf.data.AUTOTUNE)
    val_ds = val_ds.map(lambda x, y: (preprocess(x), y)).prefetch(tf.data.AUTOTUNE)
    return train_ds, val_ds, class_names


def build_model(num_classes):
    base = tf.keras.applications.MobileNetV2(
        input_shape=IMG_SIZE + (3,), include_top=False, weights="imagenet"
    )
    base.trainable = False

    inputs = tf.keras.Input(shape=IMG_SIZE + (3,))
    x = base(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(128, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)
    return tf.keras.Model(inputs, outputs), base


def compute_four_metrics(y_true, y_pred, class_names):
    """Returns Accuracy, Precision, Recall, F1 — the 4 core classification metrics."""
    average = "binary" if len(class_names) == 2 else "macro"
    pos_label = 1 if len(class_names) == 2 else None

    kwargs = {"average": average, "zero_division": 0}
    if pos_label is not None:
        kwargs["pos_label"] = pos_label

    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, **kwargs),
        "recall": recall_score(y_true, y_pred, **kwargs),
        "f1_score": f1_score(y_true, y_pred, **kwargs),
    }


def run_training(data_dir, epochs=15, output_dir="model_out", progress_cb=None):
    """
    Runs the full training pipeline. progress_cb, if given, is called with
    a dict describing progress: {"stage": str, "epoch": int, "total_epochs": int}
    so a caller (e.g. a Flask endpoint) can report live status to the frontend.
    """
    def report(stage, **kw):
        if progress_cb:
            progress_cb({"stage": stage, **kw})

    report("loading_dataset")
    train_ds, val_ds, class_names = build_datasets(data_dir)
    num_classes = len(class_names)
    if num_classes < 2:
        raise ValueError(
            f"Found only {num_classes} class folder(s) in {data_dir}. "
            "Need at least 2 animal folders (e.g. cat/, dog/) to train a classifier."
        )

    model, base = build_model(num_classes)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    class ProgressCallback(tf.keras.callbacks.Callback):
        def __init__(self, phase, total):
            self.phase = phase
            self.total = total
        def on_epoch_end(self, epoch, logs=None):
            report("training", phase=self.phase, epoch=epoch + 1, total_epochs=self.total,
                    accuracy=round(float(logs.get("accuracy", 0)) * 100, 1),
                    val_accuracy=round(float(logs.get("val_accuracy", 0)) * 100, 1))

    report("training", phase="head", epoch=0, total_epochs=epochs)
    model.fit(train_ds, validation_data=val_ds, epochs=epochs,
              callbacks=[ProgressCallback("head", epochs)], verbose=0)

    fine_tune_epochs = max(5, epochs // 3)
    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    report("training", phase="fine_tune", epoch=0, total_epochs=fine_tune_epochs)
    model.fit(train_ds, validation_data=val_ds, epochs=fine_tune_epochs,
              callbacks=[ProgressCallback("fine_tune", fine_tune_epochs)], verbose=0)

    report("evaluating")
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    model.save(out_dir / "animal_model.keras")
    with open(out_dir / "class_names.json", "w") as f:
        json.dump(class_names, f, indent=2)

    y_true, y_pred = [], []
    for x, y in val_ds:
        preds = model.predict(x, verbose=0)
        y_pred.extend(np.argmax(preds, axis=1).tolist())
        y_true.extend(y.numpy().tolist())

    metrics = compute_four_metrics(y_true, y_pred, class_names)
    cm = confusion_matrix(y_true, y_pred).tolist()
    full_report = classification_report(
        y_true, y_pred, target_names=class_names, output_dict=True, zero_division=0
    )

    report_data = {
        "metrics": {
            "accuracy": round(metrics["accuracy"] * 100, 2),
            "precision": round(metrics["precision"] * 100, 2),
            "recall": round(metrics["recall"] * 100, 2),
            "f1_score": round(metrics["f1_score"] * 100, 2),
        },
        "confusion_matrix": cm,
        "class_names": class_names,
        "per_class_report": full_report,
    }
    with open(out_dir / "training_report.json", "w") as f:
        json.dump(report_data, f, indent=2)

    report("done", metrics=report_data["metrics"])
    return report_data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data_dir", type=str, required=True, help="Path to training dataset folder")
    parser.add_argument("--epochs", type=int, default=15, help="Number of head-training epochs")
    parser.add_argument("--output_dir", type=str, default="model_out", help="Where to save model/reports")
    args, _unknown = parser.parse_known_args()

    def cli_progress(info):
        if info["stage"] == "training":
            print(f"[{info['phase']}] epoch {info['epoch']}/{info['total_epochs']} "
                  f"acc={info.get('accuracy','-')}% val_acc={info.get('val_accuracy','-')}%")
        else:
            print(f"[{info['stage']}]")

    result = run_training(args.data_dir, args.epochs, args.output_dir, progress_cb=cli_progress)
    print("\n===== Final Metrics (validation set) =====")
    for k, v in result["metrics"].items():
        print(f"{k.capitalize():<10}: {v}%")