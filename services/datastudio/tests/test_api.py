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
    body = r.json()
    assert body["welch_ttest"]["applicable"] is True
    assert "chi_square" in body


def test_stat_test_same_variable_422():
    r = client.post(
        "/api/datastudio/stat-test",
        json={"dataset": DATASET, "row": "Q1_sexe", "col": "Q1_sexe"},
        headers=auth_headers(),
    )
    assert r.status_code == 422


def test_multi_shape():
    r = client.post("/api/datastudio/multi", json={"dataset": DATASET}, headers=auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert "Canal d'information" in body["tables"]
    table = body["tables"]["Canal d'information"]
    assert "base" in table
    cols = set(table["rows"][0].keys())
    assert {"Option", "Effectif", "Pourcentage répondants"}.issubset(cols)


def test_clean_ok():
    r = client.post(
        "/api/datastudio/clean",
        json={"dataset": DATASET, "drop_empty": True, "drop_duplicates": True},
        headers=auth_headers(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["n_rows_source"] == 6
    assert body["n_rows_cleaned"] <= body["n_rows_source"]
    assert body["n_removed"] == body["n_rows_source"] - body["n_rows_cleaned"]
    assert isinstance(body["preview"], list)
    assert isinstance(body["specs"], list)
    # Sans full, la base épurée complète n'est pas renvoyée.
    assert body.get("dataset") in (None, {})


def test_clean_full_returns_dataset():
    r = client.post(
        "/api/datastudio/clean",
        json={
            "dataset": DATASET,
            "drop_empty": True,
            "drop_duplicates": True,
            "full": True,
        },
        headers=auth_headers(),
    )
    assert r.status_code == 200
    body = r.json()
    ds = body["dataset"]
    assert ds is not None
    # La base épurée complète est adoptable comme base de travail.
    assert isinstance(ds["rows"], list)
    assert len(ds["rows"]) == body["n_rows_cleaned"]
    assert isinstance(ds["columns"], list)
    assert "(épurée)" in ds["name"]


# ------------------------------------------------------------------ source par fichier
def test_no_source_422():
    # Ni dataset ni dataset_ref → requête invalide.
    r = client.post("/api/datastudio/analyze", json={}, headers=auth_headers())
    assert r.status_code == 422


def test_dataset_ref_ownership_403():
    # Le token a sub="user-123" ; un chemin appartenant à un autre utilisateur
    # est refusé AVANT tout accès à Storage.
    r = client.post(
        "/api/datastudio/frequency",
        json={"dataset_ref": "autre-user/uploads/enquete.sav", "cols": ["Q1_sexe"]},
        headers=auth_headers(),
    )
    assert r.status_code == 403


def test_dataset_ref_chemin_invalide_422():
    r = client.post(
        "/api/datastudio/frequency",
        json={"dataset_ref": "../etc/passwd", "cols": ["Q1_sexe"]},
        headers=auth_headers(),
    )
    assert r.status_code == 422


def test_ingest_file_ownership_403():
    r = client.post(
        "/api/datastudio/ingest-file",
        json={"path": "autre-user/uploads/enquete.sav"},
        headers=auth_headers(),
    )
    assert r.status_code == 403


# ------------------------------------------------------------------ vague 2
def test_preview_ok():
    r = client.post("/api/datastudio/preview", json={"dataset": DATASET}, headers=auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["n_rows"] == 6
    assert "Q1_sexe" in body["codes"]
    assert len(body["rows"]) == 6


def test_list_ok():
    r = client.post(
        "/api/datastudio/list",
        json={"dataset": DATASET, "cols": ["Q1_sexe", "Q2_satisf"]},
        headers=auth_headers(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["codes"] == ["Q1_sexe", "Q2_satisf"]
    assert len(body["rows"]) == 6
    # Les libellés de valeur sont appliqués (Homme/Femme).
    valeurs = {row["Q1_sexe"] for row in body["rows"]}
    assert "Homme" in valeurs or "Femme" in valeurs


def test_list_missing_col_422():
    r = client.post(
        "/api/datastudio/list",
        json={"dataset": DATASET, "cols": ["Q9_absent"]},
        headers=auth_headers(),
    )
    assert r.status_code == 422


def test_quality_ok():
    r = client.post("/api/datastudio/quality", json={"dataset": DATASET}, headers=auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["n_rows"] == 6
    assert body["n_variables"] == 5
    # Q1_sexe a une valeur manquante (None) sur 6 lignes.
    q1 = next(v for v in body["variables"] if v["name"] == "Q1_sexe")
    assert q1["n_manquant"] == 1
    assert 0.0 <= body["taux_completude"] <= 1.0


def test_filters_reduisent_la_base():
    # Filtre Q1_sexe = Femme (label) : la base passe de 6 à 3 lignes.
    r = client.post(
        "/api/datastudio/preview",
        json={"dataset": DATASET, "filters": [{"col": "Q1_sexe", "op": "=", "val": "Femme"}]},
        headers=auth_headers(),
    )
    assert r.status_code == 200
    assert r.json()["n_rows"] == 3


def test_filters_numerique():
    # Q3_note ≥ 15 : 3 lignes (15.5, 18.0, 16.0).
    r = client.post(
        "/api/datastudio/preview",
        json={"dataset": DATASET, "filters": [{"col": "Q3_note", "op": "≥", "val": "15"}]},
        headers=auth_headers(),
    )
    assert r.status_code == 200
    assert r.json()["n_rows"] == 3


def test_filters_variable_inconnue_422():
    r = client.post(
        "/api/datastudio/preview",
        json={"dataset": DATASET, "filters": [{"col": "Q9_absent", "op": "=", "val": "x"}]},
        headers=auth_headers(),
    )
    assert r.status_code == 422


# ------------------------------------------------------------------ ES256 (JWKS)
def _make_es256_token(sub: str = "user-123", exp_delta: int = 3600, aud: str = "authenticated"):
    """Génère une paire de clés EC P-256, enregistre le JWK dans le cache de
    l'auth (pas d'appel réseau) et forge un jeton ES256 signé (r‖s, 64 octets).

    Returns (token, kid).
    """
    ecdsa = pytest.importorskip("ecdsa")
    from api import auth as auth_mod

    sk = ecdsa.SigningKey.generate(curve=ecdsa.NIST256p)
    vk = sk.get_verifying_key()
    point = vk.pubkey.point
    kid = "test-kid-es256"
    jwk = {
        "kty": "EC",
        "crv": "P-256",
        "kid": kid,
        "x": _b64url(point.x().to_bytes(32, "big")),
        "y": _b64url(point.y().to_bytes(32, "big")),
    }
    auth_mod._jwks_cache[kid] = jwk  # pré-remplit le cache : aucun appel HTTP

    header = {"alg": "ES256", "typ": "JWT", "kid": kid}
    payload = {"sub": sub, "role": "authenticated", "aud": aud, "exp": int(time.time()) + exp_delta}
    h = _b64url(json.dumps(header).encode())
    p = _b64url(json.dumps(payload).encode())
    signing_input = f"{h}.{p}".encode("ascii")
    sig = sk.sign(signing_input, hashfunc=hashlib.sha256, sigencode=ecdsa.util.sigencode_string)
    return f"{h}.{p}.{_b64url(sig)}", kid


def test_frequency_es256_ok():
    token, _ = _make_es256_token()
    r = client.post(
        "/api/datastudio/frequency",
        json={"dataset": DATASET, "cols": ["Q1_sexe"], "exclure": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    modal = {row["Modalité"]: row["Effectif"] for row in r.json()["tables"]["Q1_sexe"]}
    assert modal["Homme"] == 2
    assert modal["Femme"] == 3


def test_es256_bad_signature_rejected():
    # Jeton ES256 signé par une autre clé que celle publiée dans le cache.
    ecdsa = pytest.importorskip("ecdsa")
    from api import auth as auth_mod

    good, kid = _make_es256_token()
    # Remplace la clé publique du cache par une clé sans rapport.
    other = ecdsa.SigningKey.generate(curve=ecdsa.NIST256p)
    pt = other.get_verifying_key().pubkey.point
    auth_mod._jwks_cache[kid] = {
        "kty": "EC",
        "crv": "P-256",
        "kid": kid,
        "x": _b64url(pt.x().to_bytes(32, "big")),
        "y": _b64url(pt.y().to_bytes(32, "big")),
    }
    r = client.post(
        "/api/datastudio/frequency",
        json={"dataset": DATASET, "cols": ["Q1_sexe"]},
        headers={"Authorization": f"Bearer {good}"},
    )
    assert r.status_code == 401


def test_unsupported_algorithm_rejected():
    # Un en-tête avec un algorithme non géré doit être refusé (401), pas planter.
    header = {"alg": "RS512", "typ": "JWT", "kid": "x"}
    payload = {"sub": "user-123", "aud": "authenticated", "exp": int(time.time()) + 3600}
    h = _b64url(json.dumps(header).encode())
    p = _b64url(json.dumps(payload).encode())
    token = f"{h}.{p}.{_b64url(b'signature-bidon')}"
    r = client.post(
        "/api/datastudio/frequency",
        json={"dataset": DATASET, "cols": ["Q1_sexe"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 401
