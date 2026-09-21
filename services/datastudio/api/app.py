"""Application FastAPI exposant le moteur SCS DataStudio.

Routes montées sous le préfixe /api/datastudio (le chemin reçu par la fonction
Vercel comme par le service autonome). Toutes les routes de calcul exigent un
JWT Supabase valide ; /health est public.
"""

from __future__ import annotations

import os
import sys
from typing import Optional
from urllib.parse import quote, unquote

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
from engine.sav_io import list_sheets, load_dataset  # noqa: E402

from .auth import AuthUser, CurrentUser  # noqa: E402
from .schemas import (  # noqa: E402
    AnalyzeRequest,
    CleanRequest,
    CrosstabRequest,
    FrequencyRequest,
    IngestFileRequest,
    ListRequest,
    ModalitiesRequest,
    MultiRequest,
    PreviewRequest,
    QualityRequest,
    SourceRequest,
    StatTestRequest,
    TranslateRequest,
    TranslationFreetextRequest,
    TranslationTermsRequest,
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


def _parse_ref(ref: str) -> tuple[str, Optional[str], Optional[int]]:
    """Sépare un `dataset_ref` de la forme `chemin#sheet=Feuille&header=3`.

    La feuille et la ligne d'en-tête (0-indexée) voyagent AVEC la référence, pour
    que chaque calcul relise la BONNE feuille sans état serveur. Renvoie
    (chemin, feuille|None, header_row|None)."""
    base, sep, frag = ref.partition("#")
    if not sep:
        return ref, None, None
    sheet: Optional[str] = None
    header: Optional[int] = None
    for part in frag.split("&"):
        cle, _, val = part.partition("=")
        val = unquote(val)
        if cle == "sheet" and val:
            sheet = val
        elif cle == "header" and val:
            try:
                header = int(val)
            except ValueError:
                header = None
    return base, sheet, header


def _load_from_storage(user: AuthUser, ref: str) -> SurveyDataset:
    """Charge un dataset depuis un fichier Storage, en vérifiant qu'il appartient
    à l'utilisateur (1er segment du chemin = son identifiant)."""
    base, sheet, header_row = _parse_ref(ref)
    try:
        path = validate_object_path(base)
    except StorageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if path.split("/")[0] != user.user_id:
        raise HTTPException(status_code=403, detail="Fichier non autorisé.")
    try:
        tmp = download_to_temp(path)
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    try:
        return load_dataset(tmp, sheet=sheet, header_row=header_row)
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
    métadonnées et un `dataset_ref` (le chemin, éventuellement suffixé de la
    feuille/ligne d'en-tête choisies) que les calculs suivants référencent — les
    données volumineuses ne transitent jamais par le client. On renvoie aussi la
    liste des feuilles (`sheets`) et la ligne d'en-tête retenue (`header_row`).
    """
    base, _, _ = _parse_ref(req.path)
    # Construit la référence portant la feuille / l'en-tête choisies.
    frags: list[str] = []
    if req.sheet:
        frags.append(f"sheet={quote(req.sheet)}")
    if req.header_row is not None:
        frags.append(f"header={int(req.header_row)}")
    ref = base + ("#" + "&".join(frags) if frags else "")

    ds = _load_from_storage(user, ref)
    payload = _analyze_payload(ds)
    payload["dataset_ref"] = validate_object_path(base) + ("#" + "&".join(frags) if frags else "")
    payload["name"] = ds.name
    payload["sheet"] = req.sheet
    payload["header_row"] = req.header_row

    # Feuilles disponibles (pour un classeur multi-feuilles) — téléchargement léger.
    sheets: list[str] = []
    try:
        p = validate_object_path(base)
        if p.split("/")[0] == user.user_id:
            tmp = download_to_temp(p)
            try:
                sheets = list_sheets(tmp)
            finally:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
    except Exception:  # liste de feuilles best-effort
        sheets = []
    payload["sheets"] = sheets
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


@router.post("/modalities")
def modalities(req: ModalitiesRequest, user: AuthUser = CurrentUser) -> dict:
    """Modalités d'une variable (valeurs en libellés), triées par fréquence.

    Sert à alimenter le champ « valeur » d'un filtre : l'utilisateur choisit une
    modalité existante (le filtre `=`/`≠` compare sur ces libellés), au lieu de
    la saisir à la main au risque de ne pas retomber sur la valeur exacte.
    """
    # On ne veut PAS que les filtres déjà posés restreignent la liste proposée.
    base = SourceRequest(dataset=req.dataset, dataset_ref=req.dataset_ref, filters=None)
    ds = _resolve_dataset(user, base)
    _require_columns(ds, req.col)
    lab = ds.labelled_series(req.col).astype(str)
    counts = lab[lab != MISSING_LABEL].value_counts()
    limit = max(1, min(int(req.limit), 2000))
    valeurs = [
        {"valeur": str(v), "effectif": int(n)} for v, n in counts.head(limit).items()
    ]
    return {
        "col": req.col,
        "display": ds.variable_display(req.col),
        "n_modalites": int(counts.shape[0]),
        "modalites": valeurs,
        "tronque": bool(counts.shape[0] > limit),
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


def _est_nombre(txt: str) -> bool:
    """Vrai si la chaîne est purement numérique (rien à traduire)."""
    s = str(txt).strip().replace(" ", "").replace(" ", "")
    if not s:
        return True
    s = s.replace(",", ".")
    try:
        float(s)
        return True
    except ValueError:
        return False


@router.post("/translation-terms")
def translation_terms(req: TranslationTermsRequest, user: AuthUser = CurrentUser) -> dict:
    """Recense les termes à traduire d'une base importée en langue étrangère :
    en-têtes de colonnes + valeurs distinctes des colonnes catégorielles. Sert
    d'entrée à la détection de langue et à la traduction IA (côté Next)."""
    # Les filtres ne doivent pas restreindre les termes proposés à la traduction.
    base = SourceRequest(dataset=req.dataset, dataset_ref=req.dataset_ref, filters=None)
    ds = _resolve_dataset(user, base)
    frame = ds.frame
    columns = [str(c) for c in frame.columns]
    values: dict[str, list[str]] = {}
    free_text_columns: list[str] = []
    total = 0
    for c in frame.columns:
        serie = frame[c].dropna()
        distinct = []
        vus: set[str] = set()
        textuel = False
        depasse = False
        for v in serie.tolist():
            s = str(v).strip()
            if not s or s in vus:
                continue
            vus.add(s)
            if _est_nombre(s):
                continue
            textuel = True
            distinct.append(s)
            if len(distinct) > req.max_cardinalite:
                depasse = True
                break
        if not textuel:
            # Colonne purement numérique (ou vide) : rien à traduire.
            continue
        if depasse:
            # Haute cardinalité textuelle → réponses ouvertes (traduction en option).
            free_text_columns.append(str(c))
        elif total + len(distinct) <= req.max_valeurs:
            # Colonne catégorielle : modalités traduisibles en une table.
            values[str(c)] = distinct
            total += len(distinct)
        else:
            # Trop de valeurs au global → proposée en réponses ouvertes (par lots).
            free_text_columns.append(str(c))
    # Échantillon pour la détection de langue : en-têtes + quelques valeurs.
    apercu = list(columns[:60])
    for vals in list(values.values())[:20]:
        apercu.extend(vals[:5])
    return {
        "columns": columns,
        "values": values,
        "free_text_columns": free_text_columns,
        "sample": " | ".join(apercu[:200]),
        "n_rows": int(len(frame)),
    }


@router.post("/translation-freetext")
def translation_freetext(req: TranslationFreetextRequest, user: AuthUser = CurrentUser) -> dict:
    """Valeurs distinctes des colonnes de réponses ouvertes sélectionnées, pour
    traduction par lots côté Next. Bornées (max par colonne + max global)."""
    base = SourceRequest(dataset=req.dataset, dataset_ref=req.dataset_ref, filters=None)
    ds = _resolve_dataset(user, base)
    frame = ds.frame
    out: dict[str, list[str]] = {}
    total = 0
    for col in req.cols:
        if col not in frame.columns or total >= req.max_total:
            continue
        distinct: list[str] = []
        vus: set[str] = set()
        for v in frame[col].dropna().tolist():
            s = str(v).strip()
            if not s or s in vus or _est_nombre(s):
                continue
            vus.add(s)
            distinct.append(s)
            if len(distinct) >= req.max_par_colonne:
                break
        if not distinct:
            continue
        if total + len(distinct) > req.max_total:
            distinct = distinct[: max(0, req.max_total - total)]
        if distinct:
            out[col] = distinct
            total += len(distinct)
    return {"values": out, "n_cols": len(out), "n_valeurs": total}


def _uniquifier(noms: list[str]) -> list[str]:
    """Suffixe les doublons d'en-têtes (deux termes traduits identiques)."""
    vus: dict[str, int] = {}
    sortie: list[str] = []
    for nom in noms:
        base = nom if nom else "Colonne"
        if base in vus:
            vus[base] += 1
            sortie.append(f"{base}_{vus[base]}")
        else:
            vus[base] = 1
            sortie.append(base)
    return sortie


@router.post("/translate")
def translate(req: TranslateRequest, user: AuthUser = CurrentUser) -> dict:
    """Applique la table de traduction (renommage d'en-têtes + remplacement de
    valeurs) et renvoie la base traduite. Les valeurs absentes de la table sont
    conservées telles quelles : aucune donnée n'est inventée ni déformée."""
    ds = _resolve_dataset(user, req)
    frame = ds.frame.copy()

    # 0) Réponses ouvertes : on mémorise le texte ORIGINAL avant toute traduction,
    #    pour le conserver ensuite dans une colonne compagnon « <col> (VO) ».
    free_cols = [str(c) for c in (req.free_text_columns or []) if str(c) in frame.columns]
    originaux = {c: frame[c].copy() for c in free_cols}

    # 1) Remplacement des valeurs, colonne par colonne (sur les en-têtes d'origine).
    #    Couvre les modalités catégorielles ET les valeurs de réponses ouvertes.
    for col, mapping in (req.value_maps or {}).items():
        if col in frame.columns and mapping:
            table = {str(k): v for k, v in mapping.items()}

            def _remap(v, _table=table):
                if v is None:
                    return v
                if isinstance(v, float) and pd.isna(v):
                    return v
                return _table.get(str(v).strip(), v)

            frame[col] = frame[col].map(_remap)

    # 2) Renommage des en-têtes, en évitant les collisions de noms traduits.
    colmap = {
        str(k): str(v).strip()
        for k, v in (req.column_map or {}).items()
        if str(k) in frame.columns and str(v).strip()
    }
    nouveaux = [colmap.get(str(c), str(c)) for c in frame.columns]
    nouveaux = _uniquifier(nouveaux)
    # Table d'origine -> nom final (après unicité) pour reporter les libellés.
    rename_final = {str(c): nouveaux[i] for i, c in enumerate(frame.columns)}
    frame.columns = nouveaux

    # 3) Colonnes compagnons « (VO) » : le texte ORIGINAL des réponses ouvertes,
    #    inséré juste après la colonne traduite, et marqué « texte » (donc exclu
    #    des analyses et des rapports côté client).
    mesure_vo: dict[str, str] = {}
    final_free = {rename_final.get(c, c): c for c in free_cols}
    if final_free:
        ordre: list[str] = []
        for fc in list(frame.columns):
            ordre.append(fc)
            if fc in final_free:
                vo = f"{fc} (VO)"
                # Unicité si un « (VO) » existe déjà.
                base_vo = vo
                k = 2
                while vo in frame.columns or vo in ordre[:-1]:
                    vo = f"{base_vo}_{k}"
                    k += 1
                frame[vo] = originaux[final_free[fc]].to_numpy()
                mesure_vo[vo] = "texte"
                ordre.append(vo)
        frame = frame[ordre]

    result = {
        "n_rows": int(len(frame)),
        "columns": [str(c) for c in frame.columns],
        "n_columns_renamed": int(sum(1 for c in ds.frame.columns if str(c) in colmap)),
        "vo_columns": list(mesure_vo.keys()),
    }
    if req.full:
        result["dataset"] = {
            "rows": frame_to_records(frame),
            "columns": [str(c) for c in frame.columns],
            "variable_labels": {
                rename_final.get(str(k), str(k)): str(v)
                for k, v in (ds.variable_labels or {}).items()
            },
            "value_labels": {},
            "variable_measure": mesure_vo,
            "name": req.name or f"{ds.name} (traduit)",
        }
    return result


app.include_router(router)


@app.get("/health")
def root_health() -> dict:
    """Alias racine de la sonde (pratique en déploiement autonome)."""
    return {"status": "ok", "engine": ENGINE_VERSION}
