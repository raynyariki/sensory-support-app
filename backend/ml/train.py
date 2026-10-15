"""Train and evaluate the sound classifier.

    python -m ml.train --esc50 data/ESC-50-master
    python -m ml.train --esc50 data/ESC-50-master --urbansound8k data/UrbanSound8K

What it does
    1. Reads the dataset(s) and maps their classes to the app's sounds (everything
       else becomes "other", see app/catalogue.py).
    2. Turns each clip into the same 64 features the live API uses (app/audio.py).
    3. Splits the data by the datasets' own folds, so clips cut from one original
       recording never sit on both sides of a split (that would inflate the scores).
    4. Trains a Random Forest and an SVM on the training folds, chooses between them
       using the validation folds, and measures the winner ONCE on the test folds.
    5. Saves the model, plus metrics.json and confusion_matrix.csv with what was measured.

Only measured numbers are written. Nothing is hard-coded.
"""

import argparse
import csv
import json
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import LeaveOneGroupOut, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from app.audio import FEATURE_NAMES, TARGET_SR, AudioError, clip_features_from_file
from app.catalogue import OTHER, dataset_class_map

warnings.filterwarnings("ignore", message=".*probability.*deprecated.*", category=FutureWarning)

SEED = 42
THRESHOLDS = (0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9)


# ------------------------------------------------------------------ reading data


def read_esc50(root: Path) -> list[dict]:
    """ESC-50: 2,000 five-second clips in 5 folds."""
    mapping = dataset_class_map("esc50")
    rows = []
    with open(root / "meta" / "esc50.csv", newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rows.append(
                {
                    "path": root / "audio" / row["filename"],
                    "label": mapping.get(row["category"], OTHER),
                    "source_class": row["category"],
                    "group": f"esc50_fold{row['fold']}",
                    "split_key": ("esc50", int(row["fold"])),
                }
            )
    return rows


def read_urbansound8k(root: Path) -> list[dict]:
    """UrbanSound8K: 8,732 clips in 10 folds."""
    mapping = dataset_class_map("urbansound8k")
    rows = []
    with open(root / "metadata" / "UrbanSound8K.csv", newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rows.append(
                {
                    "path": root / "audio" / f"fold{row['fold']}" / row["slice_file_name"],
                    "label": mapping.get(row["class"], OTHER),
                    "source_class": row["class"],
                    "group": f"urbansound8k_fold{row['fold']}",
                    "split_key": ("urbansound8k", int(row["fold"])),
                }
            )
    return rows


# Which folds go where. ESC-50 has 5 folds, UrbanSound8K has 10.
VALIDATION_FOLDS = {"esc50": {4}, "urbansound8k": {7, 8}}
TEST_FOLDS = {"esc50": {5}, "urbansound8k": {9, 10}}


def assign_split(split_key: tuple[str, int]) -> str:
    dataset, fold = split_key
    if fold in TEST_FOLDS[dataset]:
        return "test"
    if fold in VALIDATION_FOLDS[dataset]:
        return "val"
    return "train"


def limit_other(rows: list[dict], per_class: int) -> list[dict]:
    """The 'other' class would otherwise swamp the real sounds, so keep a few clips per source class."""
    rng = np.random.default_rng(SEED)
    kept, seen = [], {}
    order = rng.permutation(len(rows))
    for index in order:
        row = rows[index]
        if row["label"] == OTHER:
            key = (row["split_key"][0], row["source_class"], assign_split(row["split_key"]))
            if seen.get(key, 0) >= per_class:
                continue
            seen[key] = seen.get(key, 0) + 1
        kept.append(row)
    return sorted(kept, key=lambda r: str(r["path"]))


# ---------------------------------------------------------------------- features


def build_matrix(rows: list[dict], cache_file: Path | None):
    """Feature matrix for all rows; results are cached so a re-run is fast."""
    cache: dict[str, np.ndarray] = {}
    if cache_file and cache_file.exists():
        stored = np.load(cache_file, allow_pickle=False)
        if list(stored["names"]) == FEATURE_NAMES:
            cache = dict(zip(stored["paths"].tolist(), stored["features"]))

    features, kept = [], []
    skipped = 0
    for number, row in enumerate(rows, 1):
        key = str(row["path"])
        vector = cache.get(key)
        if vector is None:
            try:
                vector = clip_features_from_file(row["path"])
            except (AudioError, OSError, ValueError) as exc:
                skipped += 1
                print(f"  skipped {row['path'].name}: {exc}")
                continue
            cache[key] = vector
        features.append(vector)
        kept.append(row)
        if number % 200 == 0:
            print(f"  features {number}/{len(rows)}")

    if cache_file:
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        paths = np.array(list(cache.keys()))
        np.savez(cache_file, paths=paths, features=np.array(list(cache.values())), names=np.array(FEATURE_NAMES))
    if skipped:
        print(f"  {skipped} unusable clip(s) skipped")
    return np.array(features, dtype=np.float32), kept


# ------------------------------------------------------------------------ models


def candidates() -> dict:
    return {
        "random_forest": make_pipeline(
            StandardScaler(),
            RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=SEED, n_jobs=-1),
        ),
        "svm": make_pipeline(
            StandardScaler(),
            SVC(kernel="rbf", C=10, gamma="scale", class_weight="balanced", probability=True, random_state=SEED),
        ),
    }


def summarise(y_true, y_pred, classes: list[str]) -> dict:
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=classes, zero_division=0
    )
    macro = precision_recall_fscore_support(y_true, y_pred, labels=classes, average="macro", zero_division=0)
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macro_precision": round(float(macro[0]), 4),
        "macro_recall": round(float(macro[1]), 4),
        "macro_f1": round(float(macro[2]), 4),
        "per_class": {
            cls: {
                "precision": round(float(precision[i]), 4),
                "recall": round(float(recall[i]), 4),
                "f1": round(float(f1[i]), 4),
                "support": int(support[i]),
            }
            for i, cls in enumerate(classes)
        },
    }


def threshold_table(probabilities: np.ndarray, classes: list[str], y_true) -> list[dict]:
    """At each confidence threshold: how often the app would name a sound, and how often it is right."""
    classes_arr = np.array(classes)
    best = classes_arr[probabilities.argmax(axis=1)]
    confidence = probabilities.max(axis=1)
    y_true = np.asarray(y_true)
    rows = []
    for threshold in THRESHOLDS:
        named = (best != OTHER) & (confidence >= threshold)
        true_sound = y_true != OTHER
        correct = named & (best == y_true)
        rows.append(
            {
                "threshold": threshold,
                "named_sounds": int(named.sum()),
                "precision_of_named": round(float(correct.sum() / named.sum()), 4) if named.sum() else None,
                "recall_of_real_sounds": round(float(correct.sum() / true_sound.sum()), 4) if true_sound.sum() else None,
            }
        )
    return rows


# -------------------------------------------------------------------------- main


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Train the sound classifier.")
    parser.add_argument("--esc50", type=Path, help="path to the ESC-50 folder (contains audio/ and meta/)")
    parser.add_argument("--urbansound8k", type=Path, help="path to the UrbanSound8K folder (optional)")
    parser.add_argument("--out", type=Path, default=Path("models"), help="where to save the model")
    parser.add_argument("--other-per-class", type=int, default=10,
                        help="clips kept per non-app source class and split (keeps 'other' from dominating)")
    parser.add_argument("--no-cache", action="store_true", help="recompute all features")
    parser.add_argument("--cv", action="store_true", help="also run leave-one-fold-out cross-validation")
    args = parser.parse_args(argv)

    if not args.esc50 and not args.urbansound8k:
        parser.error("give at least one dataset: --esc50 and/or --urbansound8k")

    rows: list[dict] = []
    datasets_used = []
    if args.esc50:
        rows += read_esc50(args.esc50)
        datasets_used.append("ESC-50")
    if args.urbansound8k:
        rows += read_urbansound8k(args.urbansound8k)
        datasets_used.append("UrbanSound8K")

    rows = limit_other(rows, args.other_per_class)
    print(f"{len(rows)} clips selected from {', '.join(datasets_used)}")

    args.out.mkdir(parents=True, exist_ok=True)
    X, rows = build_matrix(rows, None if args.no_cache else args.out / "feature_cache.npz")
    y = np.array([r["label"] for r in rows])
    split = np.array([assign_split(r["split_key"]) for r in rows])
    groups = np.array([r["group"] for r in rows])

    classes = sorted({str(c) for c in y})
    counts = {cls: int((y == cls).sum()) for cls in classes}
    print("clips per class:", counts)
    if len(classes) < 2:
        print("Need at least two classes to train.")
        return 1
    for name in ("train", "val", "test"):
        missing = [c for c in classes if not ((y == c) & (split == name)).any()]
        if missing:
            print(f"Warning: no {name} clips for {missing}. Their {name} scores will be missing.")

    train, val, test = split == "train", split == "val", split == "test"
    if not (train.any() and val.any() and test.any()):
        print("The dataset(s) did not fill the train, validation and test splits. Check the paths.")
        return 1

    # Fit both candidates, choose on validation only.
    fitted, val_scores = {}, {}
    for name, pipeline in candidates().items():
        print(f"training {name} ...")
        pipeline.fit(X[train], y[train])
        fitted[name] = pipeline
        predicted = pipeline.predict(X[val])
        val_scores[name] = float(precision_recall_fscore_support(y[val], predicted, average="macro", zero_division=0)[2])
        print(f"  validation macro-F1: {val_scores[name]:.3f}")
    chosen = max(val_scores, key=val_scores.get)
    model = fitted[chosen]
    print(f"chosen on validation: {chosen}")

    # Measure the chosen model once on data it has never seen.
    model_classes = [str(c) for c in model.classes_]
    probabilities = model.predict_proba(X[test])
    predicted = np.array(model_classes)[probabilities.argmax(axis=1)]
    test_summary = summarise(y[test], predicted, model_classes)
    matrix = confusion_matrix(y[test], predicted, labels=model_classes)
    thresholds = threshold_table(probabilities, model_classes, y[test])

    metrics = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "datasets": datasets_used,
        "model_type": chosen,
        "validation_macro_f1": {k: round(v, 4) for k, v in val_scores.items()},
        "clips_per_class": counts,
        "split_sizes": {"train": int(train.sum()), "val": int(val.sum()), "test": int(test.sum())},
        "test": test_summary,
        "confidence_thresholds": thresholds,
    }

    if args.cv:
        print("running leave-one-fold-out cross-validation ...")
        cv_pred = cross_val_predict(candidates()[chosen], X, y, groups=groups, cv=LeaveOneGroupOut(), n_jobs=1)
        metrics["leave_one_fold_out"] = summarise(y, cv_pred, classes)
        metrics["leave_one_fold_out"]["note"] = "Whole dataset, each fold predicted by a model trained on the others."

    with open(args.out / "confusion_matrix.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["true \\ predicted", *model_classes])
        for cls, line in zip(model_classes, matrix):
            writer.writerow([cls, *line.tolist()])
    (args.out / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    joblib.dump(model, args.out / "model.joblib")
    meta = {
        "trained_at": metrics["trained_at"],
        "model_type": chosen,
        "datasets": datasets_used,
        "classes": model_classes,
        "feature_names": FEATURE_NAMES,
        "sample_rate": TARGET_SR,
        "sklearn_version": sklearn.__version__,
    }
    (args.out / "model_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print("\nTEST RESULTS (clips the model never saw)")
    print(f"  accuracy {test_summary['accuracy']:.3f}   macro precision {test_summary['macro_precision']:.3f}"
          f"   macro recall {test_summary['macro_recall']:.3f}   macro F1 {test_summary['macro_f1']:.3f}")
    for cls, scores in test_summary["per_class"].items():
        print(f"  {cls:12s} P {scores['precision']:.2f}  R {scores['recall']:.2f}  F1 {scores['f1']:.2f}  (n={scores['support']})")
    print(f"\nSaved model and metrics to {args.out}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())