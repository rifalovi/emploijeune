"""Nettoyage et épuration de la base.

Deux familles d'opérations, distinctes et activables séparément :

- **Corrections (nettoyage)** — ne retirent AUCUNE ligne : on retire les espaces
  superflus, on convertit les codes d'absence en valeurs manquantes (NA) et on
  arrondit les variables numériques selon leurs décimales cibles.
- **Épuration (retrait de lignes)** — retirent des lignes : lignes entièrement
  vides, lignes sans variable-clé renseignée, lignes incomplètes, doublons stricts.

Chaque appel produit aussi un `rapport` détaillant ce qui a été corrigé et ce qui
a été retiré (par motif), afin de rendre le traitement transparent.

Porté depuis `cleaned_copy` de l'application desktop V4.8.
"""

from __future__ import annotations

from typing import Optional

import pandas as pd

from .constants import MISSING_CODES
from .dataset import SurveyDataset
from .specs import infer_variable_specs


def cleaned_frame_report(
    dataset: SurveyDataset,
    specs: Optional[dict] = None,
    drop_empty: bool = True,
    key_columns: Optional[list] = None,
    drop_duplicates: bool = True,
    drop_missing: bool = False,
    normaliser_manquants: bool = True,
    arrondir: bool = True,
    trim_espaces: bool = True,
) -> tuple[pd.DataFrame, dict]:
    """Épure la base et renvoie ``(frame_épurée, rapport)``.

    Les corrections (espaces, codes d'absence, arrondis) et les retraits de lignes
    (vides, clés, incomplètes, doublons) sont chacun activables séparément. Le
    rapport recense le nombre de cellules corrigées et, pour chaque motif, le
    nombre de lignes retirées — dans l'ordre réel d'application.
    """
    if specs is None:
        specs = infer_variable_specs(dataset)
    d = dataset.frame.copy()
    n_source = int(len(d))

    espaces_nettoyes = 0
    codes_normalises = 0
    colonnes_arrondies = 0

    # Colonnes textuelles : object, str (pandas 3) ou category — tout sauf
    # numérique / date. Évite l'avertissement de dépréciation de select_dtypes.
    text_cols = [
        c
        for c in d.columns
        if not pd.api.types.is_numeric_dtype(d[c])
        and not pd.api.types.is_datetime64_any_dtype(d[c])
    ]
    if trim_espaces:
        for c in text_cols:
            avant = d[c]
            apres = avant.map(lambda x: x.strip() if isinstance(x, str) else x)
            # Compte les cellules réellement modifiées (chaînes avec espaces superflus).
            espaces_nettoyes += int(
                sum(
                    1
                    for a, b in zip(avant, apres)
                    if isinstance(a, str) and a != b
                )
            )
            d[c] = apres
    if normaliser_manquants:
        for c in text_cols:
            masque = d[c].astype(str).str.strip().str.lower().isin(MISSING_CODES)
            # Ne compte que les cellules qui n'étaient pas DÉJÀ manquantes.
            codes_normalises += int((masque & d[c].notna()).sum())
            d.loc[masque, c] = pd.NA

    if arrondir:
        for c, spec in specs.items():
            if c not in d.columns or spec["decimals"] is None:
                continue
            num = pd.to_numeric(d[c], errors="coerce")
            if spec["decimals"] == 0:
                d[c] = (
                    num.round(0).astype("Int64")
                    if num.isna().any()
                    else num.round(0).astype("int64")
                )
            else:
                d[c] = num.round(2)
            colonnes_arrondies += 1

    # --- Retraits de lignes, dans l'ordre, en comptant chaque étape ---
    retraits: list[dict] = []

    if drop_empty:
        avant = len(d)
        d = d.dropna(how="all")
        retraits.append({"motif": "Lignes entièrement vides", "n": int(avant - len(d))})

    keys = [c for c in (key_columns or []) if c in d.columns]
    if keys:
        avant = len(d)
        d = d.dropna(subset=keys)
        retraits.append(
            {"motif": "Lignes sans variable-clé renseignée", "n": int(avant - len(d))}
        )

    if drop_missing:
        avant = len(d)
        d = d.dropna(how="any")
        retraits.append(
            {"motif": "Lignes incomplètes (valeur manquante)", "n": int(avant - len(d))}
        )

    if drop_duplicates:
        avant = len(d)
        d = d.drop_duplicates()
        retraits.append({"motif": "Doublons stricts", "n": int(avant - len(d))})

    n_cleaned = int(len(d))
    rapport = {
        "n_source": n_source,
        "n_cleaned": n_cleaned,
        "n_retirees": n_source - n_cleaned,
        "corrections": {
            "espaces_nettoyes": espaces_nettoyes,
            "codes_manquants_normalises": codes_normalises,
            "colonnes_arrondies": colonnes_arrondies,
        },
        "retraits": retraits,
    }
    return d, rapport


def cleaned_frame(
    dataset: SurveyDataset,
    specs: Optional[dict] = None,
    drop_empty: bool = True,
    key_columns: Optional[list] = None,
    drop_duplicates: bool = True,
    drop_missing: bool = False,
    normaliser_manquants: bool = True,
    arrondir: bool = True,
    trim_espaces: bool = True,
) -> pd.DataFrame:
    """Retourne une copie épurée du tableau de `dataset` (sans le rapport).

    Conserve la signature historique ; délègue à :func:`cleaned_frame_report`.
    """
    frame, _ = cleaned_frame_report(
        dataset,
        specs=specs,
        drop_empty=drop_empty,
        key_columns=key_columns,
        drop_duplicates=drop_duplicates,
        drop_missing=drop_missing,
        normaliser_manquants=normaliser_manquants,
        arrondir=arrondir,
        trim_espaces=trim_espaces,
    )
    return frame
