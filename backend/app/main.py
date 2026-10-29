
from pathlib import Path
import json
import sqlite3
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .model import load_model, make_features, METRICS_PATH, ROOT

app = FastAPI(title="Transit Delay Prediction API", version="1.0.0",
              description="Demonstration API for IoT-based public transport delay prediction.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

DB_PATH = ROOT / "predictions.db"

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL, route_id TEXT NOT NULL,
            latitude REAL NOT NULL, longitude REAL NOT NULL,
            speed_kmph REAL NOT NULL, timestamp TEXT NOT NULL,
            predicted_delay_minutes REAL NOT NULL, risk_level TEXT NOT NULL,
            data_mode TEXT NOT NULL
        )""")
init_db()

class PredictionRequest(BaseModel):
    route_id: str = Field(min_length=1, max_length=20)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speed_kmph: float = Field(ge=0, le=160)
    timestamp: datetime
    data_mode: str = Field(default="simulated", pattern="^(simulated|sensor)$")

class PredictionResponse(BaseModel):
    route_id: str
    predicted_delay_minutes: float
    risk_level: str
    warning: str
    data_mode: str

def risk_for(delay: float):
    if delay < 5:
        return "Low", "No significant delay predicted."
    if delay < 15:
        return "Medium", "Possible delay. Allow extra travel time."
    return "High", "High delay risk. Consider an alternative or allow extra time."

@app.get("/api/health")
def health():
    model_ready = (ROOT / "artifacts" / "delay_model.joblib").exists()
    return {"status": "ok", "model_ready": model_ready,
            "message": "Model ready" if model_ready else "Run python train_model.py"}

@app.get("/api/model/metrics")
def metrics():
    if not METRICS_PATH.exists():
        raise HTTPException(503, "Metrics not found. Train the model first.")
    return json.loads(METRICS_PATH.read_text(encoding="utf-8"))

@app.post("/api/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    try:
        model = load_model()
        features = make_features(request.model_dump())
        predicted = max(0.0, float(model.predict(features)[0]))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}")
    risk, warning = risk_for(predicted)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""INSERT INTO predictions
            (created_at, route_id, latitude, longitude, speed_kmph, timestamp,
             predicted_delay_minutes, risk_level, data_mode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (datetime.now(timezone.utc).isoformat(), request.route_id,
             request.latitude, request.longitude, request.speed_kmph,
             request.timestamp.isoformat(), round(predicted, 2), risk, request.data_mode))
    return PredictionResponse(route_id=request.route_id,
        predicted_delay_minutes=round(predicted, 2), risk_level=risk,
        warning=warning, data_mode=request.data_mode)

@app.get("/api/predictions")
def history(limit: int = Query(default=50, ge=1, le=500)):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""SELECT * FROM predictions ORDER BY id DESC LIMIT ?""", (limit,)).fetchall()
    return [dict(row) for row in rows]

@app.get("/api/analytics/summary")
def summary():
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("""SELECT COUNT(*), AVG(predicted_delay_minutes),
            SUM(CASE WHEN risk_level='High' THEN 1 ELSE 0 END) FROM predictions""").fetchone()
    return {"predictions": row[0] or 0, "average_predicted_delay_minutes": round(row[1] or 0, 2),
            "high_risk_predictions": row[2] or 0}
