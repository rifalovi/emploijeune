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

import pandas as pd  # noqa: E402
from fastapi import APIRouter, FastAPI, HTTPException  # noqa: E402

from engine import (  # noqa: E402
    ENGINE_VERSION,
    MISSING_LABEL,
    SurveyDataset,
    build_cross,
    cleaned_frame,
    compute_frequency,
    compute_multi_groups,
    compute_multi_table,
    infer_variable_specs,
    run_tests,
)
from engine.sav_io import load_dataset  # noqa: E402

from .auth import AuthUser, CurrentUser  # noqa: E402
from .schemas import (  # noqa: E402
    AnalyzeRequest,
    CleanRequest,
    CrosstabRequest,
    FrequencyRequest,
    IngestFileRequest,
    ListRequest,
    MultiRequest,
    PreviewRequest,
    QualityRequest,
    SourceRequest,
    StatTestRequest,
)
from .serialize import (  # noqa: E402
    crosstab_to_json,
    frame_to_records,
    frequency_to_json,
)
from .storage import StorageError, download_to_temp, validate_object_path  # noqa: E402

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


def _load_from_storage(user: AuthUser, ref: str) -> SurveyDataset:
    """Charge un dataset depuis un fichier Storage, en vérifiant qu'il appartient
    à l'utilisateur (1er segment du chemin = son identifiant)."""
    try:
        path = validate_object_path(ref)
    except StorageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if path.split("/")[0] != user.user_id:
        raise HTTPException(status_code=403, detail="Fichier non autorisé.")
    try:
        tmp = download_to_temp(path)
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    try:
        return load_dataset(tmp)
    except Exception as exc:  # lecture/format
        raise HTTPException(status_code=422, detail=f"Lecture du fichier impossible : {exc}") from exc
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def _apply_filters(ds: SurveyDataset, filters) -> SurveyDataset:
    """Restreint la base aux lignes vérifiant TOUTES les conditions (ET)."""
    if not filters:
        return ds
    frame = ds.frame
    mask = pd.Series(True, index=frame.index)
    for f in filters:
        if f.col not in frame.columns:
            raise HTTPException(status_code=422, detail=f"Filtre : variable inconnue « {f.col} ».")
        if f.op in (">", "≥", "<", "≤"):
            num = pd.to_numeric(frame[f.col], errors="coerce")
            try:
                seuil = float(str(f.val).replace(",", "."))
            except ValueError as exc:
                raise HTTPException(
                    status_code=422, detail=f"Filtre numérique : valeur invalide « {f.val} »."
                ) from exc
            cond = {
                ">": num > seuil,
                "≥": num >= seuil,
                "<": num < seuil,
                "≤": num <= seuil,
            }[f.op]
        else:
            lab = ds.labelled_series(f.col).astype(str)
            sval = str(f.val)
            if f.op == "=":
                cond = lab == sval
            elif f.op == "≠":
                cond = lab != sval
            else:  # contient
                cond = lab.str.contains(sval, case=False, na=False, regex=False)
        mask &= cond.fillna(False)
    return SurveyDataset(
        frame=frame[mask].reset_index(drop=True),
        variable_labels=ds.variable_labels,
        value_labels=ds.value_labels,
        variable_measure=ds.variable_measure,
        name=ds.name,
    )


def _resolve_dataset(user: AuthUser, req: SourceRequest) -> SurveyDataset:
    """Résout la source (fichier Storage ou JSON) puis applique les filtres."""
    if req.dataset_ref:
        ds = _load_from_storage(user, req.dataset_ref)
    elif req.dataset is not None:
        ds = req.dataset.to_dataset()
    else:
        raise HTTPException(
            status_code=422, detail="Aucune source de données (dataset ou dataset_ref)."
        )
    return _apply_filters(ds, req.filters)


def _analyze_payload(ds: SurveyDataset) -> dict:
    """Métadonnées d'un jeu de données : variables, niveaux de mesure, batteries."""
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


@router.get("/health")
def health() -> dict:
    """Sonde de disponibilité (publique)."""
    return {"status": "ok", "engine": ENGINE_VERSION}


@router.post("/analyze")
def analyze(req: AnalyzeRequest, user: AuthUser = CurrentUser) -> dict:
    """Ingestion : décrit les variables, niveaux de mesure et batteries multi."""
    ds = _resolve_dataset(user, req)
    return _analyze_payload(ds)


@router.post("/ingest-file")
def ingest_file(req: IngestFileRequest, user: AuthUser = CurrentUser) -> dict:
    """Ingère un fichier déposé dans Storage (.sav / Kobo-CSPro .xlsx / .csv...).

    Le fichier est lu côté serveur (pyreadstat pour SPSS) ; on renvoie ses
    métadonnées et un `dataset_ref` (le chemin) que les calculs suivants
    référencent — les données volumineuses ne transitent jamais par le client.
    """
    ds = _load_from_storage(user, req.path)
    payload = _analyze_payload(ds)
    payload["dataset_ref"] = validate_object_path(req.path)
    payload["name"] = ds.name
    return payload


@router.post("/frequency")
def frequency(req: FrequencyRequest, user: AuthUser = CurrentUser) -> dict:
    """Tris à plat (Effectif, %, % valide, % cumulé)."""
    ds = _resolve_dataset(user, req)
    _require_columns(ds, *req.cols)
    freq_results, summary_rows = compute_frequency(ds, req.cols, exclure=req.exclure)
    return frequency_to_json(freq_results, summary_rows)


@router.post("/crosstab")
def crosstab(req: CrosstabRequest, user: AuthUser = CurrentUser) -> dict:
    """Croisement lignes × colonnes, éventuellement ventilé par une couche."""
    ds = _resolve_dataset(user, req)
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
    ds = _resolve_dataset(user, req)
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
    ds = _resolve_dataset(user, req)
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
    ds = _resolve_dataset(user, req)
    specs = infer_variable_specs(ds)
    cleaned = cleaned_frame(
        ds,
        specs=specs,
        drop_empty=req.drop_empty,
        key_columns=req.key_columns,
        drop_duplicates=req.drop_duplicates,
        drop_missing=req.drop_missing,
    )
    result = {
        "n_rows_source": int(len(ds.frame)),
        "n_rows_cleaned": int(len(cleaned)),
        "n_removed": int(len(ds.frame) - len(cleaned)),
        "preview": frame_to_records(cleaned.head(100)),
        "specs": [
            {"name": c, "measure": s["measure"], "decimals": s["decimals"]}
            for c, s in specs.items()
        ],
    }
    if req.full:
        # Base épurée complète, réutilisable comme jeu de données de travail.
        result["dataset"] = {
            "rows": frame_to_records(cleaned),
            "columns": [str(c) for c in cleaned.columns],
            "variable_labels": {str(k): str(v) for k, v in (ds.variable_labels or {}).items()},
            "value_labels": {
                str(col): {str(code): str(lab) for code, lab in mapping.items()}
                for col, mapping in (ds.value_labels or {}).items()
            },
            "name": f"{ds.name} (épurée)",
        }
    return result


@router.post("/preview")
def preview(req: PreviewRequest, user: AuthUser = CurrentUser) -> dict:
    """Base brute : aperçu des premières lignes (en libellés), filtres appliqués."""
    ds = _resolve_dataset(user, req)
    limit = max(1, min(int(req.limit), 500))
    display = ds.to_display_frame(mode_libelle=True, frame=ds.frame.head(limit))
    return {
        "n_rows": int(len(ds.frame)),
        "columns": [ds.variable_display(c) for c in ds.frame.columns],
        "codes": [str(c) for c in ds.frame.columns],
        "rows": frame_to_records(display),
    }


@router.post("/list")
def liste(req: ListRequest, user: AuthUser = CurrentUser) -> dict:
    """Liste : juxtaposition de variables choisies (en libellés)."""
    ds = _resolve_dataset(user, req)
    _require_columns(ds, *req.cols)
    if not req.cols:
        raise HTTPException(status_code=422, detail="Choisissez au moins une variable.")
    limit = max(1, min(int(req.limit), 1000))
    sub = ds.frame[list(req.cols)]
    if req.exclure_vides:
        # Retire les lignes vides sur TOUTES les variables listées (lignes
        # blanches sans nom/prénom/… qui n'apportent rien à une liste).
        sub = sub.dropna(how="all")
    n_listees = int(len(sub))
    display = ds.to_display_frame(mode_libelle=True, frame=sub.head(limit))
    return {
        "n_rows": n_listees,
        "columns": [ds.variable_display(c) for c in req.cols],
        "codes": [str(c) for c in req.cols],
        "rows": frame_to_records(display),
    }


@router.post("/quality")
def quality(req: QualityRequest, user: AuthUser = CurrentUser) -> dict:
    """Diagnostic qualité : complétude par variable, doublons, score global."""
    ds = _resolve_dataset(user, req)
    n = int(len(ds.frame))
    variables = []
    total_rempli = 0
    for c in ds.frame.columns:
        lab = ds.labelled_series(c)
        n_rempli = int((lab != MISSING_LABEL).sum())
        total_rempli += n_rempli
        variables.append(
            {
                "name": str(c),
                "display": ds.variable_display(c),
                "n_rempli": n_rempli,
                "n_manquant": n - n_rempli,
                "taux_rempli": (n_rempli / n) if n else 0.0,
            }
        )
    n_dupes = int(ds.frame.duplicated().sum())
    completude = (total_rempli / (n * max(1, len(ds.frame.columns)))) if n else 0.0
    unicite = ((n - n_dupes) / n) if n else 1.0
    # Anomalies principales : variables les moins remplies + doublons.
    anomalies = [
        {
            "type": "Complétude",
            "cible": v["display"],
            "detail": f"{v['n_manquant']} valeur(s) manquante(s) ({(1 - v['taux_rempli']) * 100:.1f} %).",
            "priorite": "Haute" if v["taux_rempli"] < 0.8 else "Moyenne",
        }
        for v in sorted(variables, key=lambda x: x["taux_rempli"])
        if v["taux_rempli"] < 1.0
    ][:15]
    if n_dupes:
        anomalies.insert(
            0,
            {
                "type": "Doublons",
                "cible": "Lignes entières",
                "detail": f"{n_dupes} ligne(s) strictement dupliquée(s).",
                "priorite": "Haute",
            },
        )
    return {
        "n_rows": n,
        "n_variables": int(len(ds.frame.columns)),
        "n_duplicates": n_dupes,
        "taux_completude": completude,
        "taux_unicite": unicite,
        "variables": variables,
        "anomalies": anomalies,
    }


app.include_router(router)


@app.get("/health")
def root_health() -> dict:
    """Alias racine de la sonde (pratique en déploiement autonome)."""
    return {"status": "ok", "engine": ENGINE_VERSION}
