
from pathlib import Path
import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "artifacts" / "delay_model.joblib"
METRICS_PATH = ROOT / "artifacts" / "metrics.json"

def load_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            "Trained model not found. From the backend folder run: python train_model.py"
        )
    return joblib.load(MODEL_PATH)

def make_features(payload: dict) -> pd.DataFrame:
    timestamp = pd.to_datetime(payload["timestamp"])
    return pd.DataFrame([{
        "route_id": str(payload["route_id"]),
        "latitude": float(payload["latitude"]),
        "longitude": float(payload["longitude"]),
        "speed_kmph": float(payload["speed_kmph"]),
        "hour": int(timestamp.hour),
        "day_of_week": int(timestamp.dayofweek),
    }])
