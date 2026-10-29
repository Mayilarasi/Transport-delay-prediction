
from pathlib import Path
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.neural_network import MLPRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "synthetic_transport_delays.csv"
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)

def main():
    df = pd.read_csv(DATA)
    features = ["route_id", "latitude", "longitude", "speed_kmph", "hour", "day_of_week"]
    target = "delay_minutes"
    X, y = df[features], df[target]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    categorical = ["route_id"]
    numeric = ["latitude", "longitude", "speed_kmph", "hour", "day_of_week"]
    prep = ColumnTransformer([
        ("route", OneHotEncoder(handle_unknown="ignore"), categorical),
        ("numeric", StandardScaler(), numeric)
    ])
    model = Pipeline([
        ("preprocess", prep),
        ("dnn", MLPRegressor(hidden_layer_sizes=(64, 32, 16),
            activation="relu", solver="adam", alpha=0.001,
            learning_rate_init=0.001, max_iter=800, early_stopping=True,
            validation_fraction=0.15, random_state=42))
    ])
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    metrics = {
        "dataset": DATA.name,
        "dataset_type": "synthetic demonstration data",
        "rows": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "model": "scikit-learn MLPRegressor with hidden layers 64, 32, 16 (DNN-style multilayer perceptron)",
        "mae_minutes": round(float(mean_absolute_error(y_test, pred)), 3),
        "rmse_minutes": round(float(np.sqrt(mean_squared_error(y_test, pred))), 3),
        "r2": round(float(r2_score(y_test, pred)), 4),
        "note": "Metrics measure performance on a held-out split of synthetic data only; they do not establish real-world transit accuracy."
    }
    joblib.dump(model, ARTIFACTS / "delay_model.joblib")
    (ARTIFACTS / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print("Training complete.")
    print(json.dumps(metrics, indent=2))
    print(f"Saved model: {ARTIFACTS / 'delay_model.joblib'}")

if __name__ == "__main__":
    main()
