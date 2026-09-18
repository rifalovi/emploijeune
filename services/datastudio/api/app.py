"""Application FastAPI exposant le moteur SCS DataStudio.

Routes montées sous le préfixe /api/datastudio (le chemin reçu par la fonction
Vercel comme par le service autonome). Toutes les routes de calcul exigent un
JWT Supabase valide ; /health est public.
"""

from __future__ import annotations

import os
import sys

# Rend le paquet `engine` importable, que l'app tourne depuis services/datastudio
# (dev/tests) ou depuis la racine du dépôt (fonction Vercel).
_SERVICE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _SERVICE_DIR not in sys.path:
    sys.path.insert(0, _SERVICE_DIR)

from fastapi import APIRouter, FastAPI, HTTPException  # noqa: E402

from engine import (  # noqa: E402
    ENGINE_VERSION,
    build_cross,
    cleaned_frame,
    compute_frequency,
    compute_multi_groups,
    compute_multi_table,
    infer_variable_specs,
    run_tests,
)

from .auth import AuthUser, CurrentUser  # noqa: E402
from .schemas import (  # noqa: E402
    AnalyzeRequest,
    CleanRequest,
    CrosstabRequest,
    FrequencyRequest,
    MultiRequest,
    StatTestRequest,
)
from .serialize import (  # noqa: E402
    crosstab_to_json,
    frame_to_records,
    frequency_to_json,
)

PREFIX = "/api/datastudio"

app = FastAPI(title="SCS DataStudio API", version=ENGINE_VERSION)
router = APIRouter(prefix=PREFIX)


def _require_columns(dataset, *cols: str) -> None:
    missing = [c for c in cols if c and c not in dataset.frame.columns]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Variable(s) absente(s) du jeu de données : {', '.join(missing)}.",
        )


@router.get("/health")
def health() -> dict:
    """Sonde de disponibilité (publique)."""
    return {"status": "ok", "engine": ENGINE_VERSION}


@router.post("/analyze")
def analyze(req: AnalyzeRequest, user: AuthUser = CurrentUser) -> dict:
    """Ingestion : décrit les variables, niveaux de mesure et batteries multi."""
    ds = req.dataset.to_dataset()
    specs = infer_variable_specs(ds)
    groups = compute_multi_groups(ds)
    return {
        "n_rows": int(len(ds.frame)),
        "variables": [
            {
                "name": c,
                "display": ds.variable_display(c),
                "measure": specs[c]["measure"],
                "cardinality": specs[c]["cardinality"],
            }
            for c in ds.frame.columns
        ],
        "multi_groups": {
            prefix: [{"column": c, "option": opt} for c, opt in items]
            for prefix, items in groups.items()
        },
    }


@router.post("/frequency")
def frequency(req: FrequencyRequest, user: AuthUser = CurrentUser) -> dict:
    """Tris à plat (Effectif, %, % valide, % cumulé)."""
    ds = req.dataset.to_dataset()
    _require_columns(ds, *req.cols)
    freq_results, summary_rows = compute_frequency(ds, req.cols, exclure=req.exclure)
    return frequency_to_json(freq_results, summary_rows)


@router.post("/crosstab")
def crosstab(req: CrosstabRequest, user: AuthUser = CurrentUser) -> dict:
    """Croisement lignes × colonnes, éventuellement ventilé par une couche."""
    ds = req.dataset.to_dataset()
    _require_columns(ds, req.row, req.col, req.layer or "")
    if req.row == req.col or req.layer in (req.row, req.col):
        raise HTTPException(status_code=422, detail="Choisissez des variables différentes.")
    layers = build_cross(ds, req.row, req.col, layer=req.layer, pct_mode=req.pct_mode)
    result = crosstab_to_json(layers)
    result["row"] = req.row
    result["col"] = req.col
    result["layer"] = req.layer
    result["pct_mode"] = req.pct_mode
    return result


@router.post("/stat-test")
def stat_test(req: StatTestRequest, user: AuthUser = CurrentUser) -> dict:
    """Tests sur le croisement : Khi² d'indépendance et t-test de Welch."""
    ds = req.dataset.to_dataset()
    _require_columns(ds, req.row, req.col)
    if req.row == req.col:
        raise HTTPException(status_code=422, detail="Choisissez deux variables différentes.")
    try:
        return run_tests(ds, req.row, req.col)
    except RuntimeError as exc:  # scipy absent
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/multi")
def multi(req: MultiRequest, user: AuthUser = CurrentUser) -> dict:
    """Questions à réponses multiples : une batterie précise ou toutes."""
    ds = req.dataset.to_dataset()
    groups = compute_multi_groups(ds)
    if not groups:
        return {"groups": {}, "tables": {}}
    selected = groups if req.group is None else {
        k: v for k, v in groups.items() if k == req.group
    }
    if req.group is not None and not selected:
        raise HTTPException(status_code=422, detail=f"Batterie inconnue : {req.group}.")
    tables = {}
    for prefix, items in selected.items():
        table, base = compute_multi_table(ds, items)
        tables[prefix] = {"base": int(base), "rows": frame_to_records(table)}
    return {
        "groups": {
            prefix: [{"column": c, "option": opt} for c, opt in items]
            for prefix, items in groups.items()
        },
        "tables": tables,
    }


@router.post("/clean")
def clean(req: CleanRequest, user: AuthUser = CurrentUser) -> dict:
    """Épuration : renvoie un aperçu de la base épurée et les caractéristiques."""
    ds = req.dataset.to_dataset()
    specs = infer_variable_specs(ds)
    cleaned = cleaned_frame(
        ds,
        specs=specs,
        drop_empty=req.drop_empty,
        key_columns=req.key_columns,
        drop_duplicates=req.drop_duplicates,
    )
    return {
        "n_rows_source": int(len(ds.frame)),
        "n_rows_cleaned": int(len(cleaned)),
        "n_removed": int(len(ds.frame) - len(cleaned)),
        "preview": frame_to_records(cleaned.head(100)),
        "specs": [
            {"name": c, "measure": s["measure"], "decimals": s["decimals"]}
            for c, s in specs.items()
        ],
    }


app.include_router(router)


@app.get("/health")
def root_health() -> dict:
    """Alias racine de la sonde (pratique en déploiement autonome)."""
    return {"status": "ok", "engine": ENGINE_VERSION}
