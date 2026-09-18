"""Tests de la couche API FastAPI : authentification JWT + endpoints."""

import base64
import hashlib
import hmac
import json
import os
import sys
import time
from pathlib import Path

import pytest

# Secret de test AVANT tout import de l'app (l'auth le lit à l'exécution).
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret-de-test-pour-les-tests-unitaires")
SECRET = os.environ["SUPABASE_JWT_SECRET"]

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from api.app import app  # noqa: E402

client = TestClient(app)


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def make_token(secret: str = SECRET, *, sub: str = "user-123", exp_delta: int = 3600, aud: str = "authenticated") -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": sub, "role": "authenticated", "aud": aud, "exp": int(time.time()) + exp_delta}
    h = _b64url(json.dumps(header).encode())
    p = _b64url(json.dumps(payload).encode())
    sig = hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    return f"{h}.{p}.{_b64url(sig)}"


def auth_headers(**kw) -> dict:
    return {"Authorization": f"Bearer {make_token(**kw)}"}


DATASET = {
    "rows": [
        {"Q1_sexe": 1, "Q2_satisf": 4, "Q3_note": 12.0, "Q4_radio": 1, "Q4_web": 0},
        {"Q1_sexe": 2, "Q2_satisf": 3, "Q3_note": 15.5, "Q4_radio": 0, "Q4_web": 1},
        {"Q1_sexe": 2, "Q2_satisf": 4, "Q3_note": 18.0, "Q4_radio": 1, "Q4_web": 1},
        {"Q1_sexe": 1, "Q2_satisf": 2, "Q3_note": 9.0, "Q4_radio": 1, "Q4_web": 0},
        {"Q1_sexe": 2, "Q2_satisf": 4, "Q3_note": 16.0, "Q4_radio": 0, "Q4_web": 1},
        {"Q1_sexe": None, "Q2_satisf": 3, "Q3_note": 14.0, "Q4_radio": 0, "Q4_web": 1},
    ],
    "variable_labels": {
        "Q1_sexe": "Sexe du répondant",
        "Q2_satisf": "Satisfaction globale",
        "Q3_note": "Note sur 20",
        "Q4_radio": "Canal d'information : Radio",
        "Q4_web": "Canal d'information : Site web",
    },
    "value_labels": {
        "Q1_sexe": {"1": "Homme", "2": "Femme"},
        "Q2_satisf": {"1": "Pas du tout", "2": "Un peu", "3": "Plutôt", "4": "Tout à fait"},
    },
}


# ------------------------------------------------------------------ auth
def test_health_public():
    r = client.get("/api/datastudio/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_frequency_requires_auth():
    r = client.post("/api/datastudio/frequency", json={"dataset": DATASET, "cols": ["Q1_sexe"]})
    assert r.status_code == 401


def test_frequency_rejects_bad_signature():
    headers = {"Authorization": f"Bearer {make_token(secret='mauvais-secret')}"}
    r = client.post("/api/datastudio/frequency", json={"dataset": DATASET, "cols": ["Q1_sexe"]}, headers=headers)
    assert r.status_code == 401


def test_frequency_rejects_expired():
    headers = {"Authorization": f"Bearer {make_token(exp_delta=-10)}"}
    r = client.post("/api/datastudio/frequency", json={"dataset": DATASET, "cols": ["Q1_sexe"]}, headers=headers)
    assert r.status_code == 401


# ------------------------------------------------------------------ endpoints
def test_frequency_ok():
    r = client.post(
        "/api/datastudio/frequency",
        json={"dataset": DATASET, "cols": ["Q1_sexe"], "exclure": False},
        headers=auth_headers(),
    )
    assert r.status_code == 200
    tab = r.json()["tables"]["Q1_sexe"]
    modal = {row["Modalité"]: row["Effectif"] for row in tab}
    assert modal["Homme"] == 2
    assert modal["Femme"] == 3
    assert modal["[Manquant]"] == 1


def test_analyze_ok():
    r = client.post("/api/datastudio/analyze", json={"dataset": DATASET}, headers=auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["n_rows"] == 6
    names = {v["name"] for v in body["variables"]}
    assert "Q1_sexe" in names
    assert "Canal d'information" in body["multi_groups"]


def test_crosstab_ok():
    r = client.post(
        "/api/datastudio/crosstab",
        json={"dataset": DATASET, "row": "Q1_sexe", "col": "Q2_satisf", "pct_mode": "Ligne"},
        headers=auth_headers(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["layers"][0]["layer_value"] == "Ensemble"
    assert "Total" in body["layers"][0]["columns"]


def test_crosstab_same_variable_rejected():
    r = client.post(
        "/api/datastudio/crosstab",
        json={"dataset": DATASET, "row": "Q1_sexe", "col": "Q1_sexe"},
        headers=auth_headers(),
    )
    assert r.status_code == 422


def test_multi_ok():
    r = client.post("/api/datastudio/multi", json={"dataset": DATASET}, headers=auth_headers())
    assert r.status_code == 200
    tables = r.json()["tables"]
    assert "Canal d'information" in tables


def test_missing_column_422():
    r = client.post(
        "/api/datastudio/frequency",
        json={"dataset": DATASET, "cols": ["Q9_inexistante"]},
        headers=auth_headers(),
    )
    assert r.status_code == 422


def test_stat_test_ok():
    pytest.importorskip("scipy")
    r = client.post(
        "/api/datastudio/stat-test",
        json={"dataset": DATASET, "row": "Q3_note", "col": "Q1_sexe"},
        headers=auth_headers(),
    )
    assert r.status_code == 200
    assert r.json()["welch_ttest"]["applicable"] is True
