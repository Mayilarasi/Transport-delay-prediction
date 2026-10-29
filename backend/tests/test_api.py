
from fastapi.testclient import TestClient
from app.main import app, risk_for

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert "model_ready" in response.json()

def test_risk_levels():
    assert risk_for(2)[0] == "Low"
    assert risk_for(8)[0] == "Medium"
    assert risk_for(20)[0] == "High"

def test_invalid_coordinates_rejected():
    response = client.post("/api/predict", json={
        "route_id": "R01", "latitude": 120, "longitude": 77,
        "speed_kmph": 20, "timestamp": "2026-10-29T08:30:00",
        "data_mode": "simulated"
    })
    assert response.status_code == 422
