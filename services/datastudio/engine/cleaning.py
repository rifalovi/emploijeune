"""Épuration de la base : normalisation des manquants, arrondis, dédoublonnage.

Porté depuis `cleaned_copy` de l'application desktop V4.8. Retire les espaces
superflus, convertit les codes d'absence en valeurs manquantes, arrondit les
variables numériques selon leurs décimales cibles, puis retire (optionnellement)
les lignes vides, les lignes sans variables-clés et les doublons stricts.
"""

from __future__ import annotations

from typing import Optional

import pandas as pd

from .constants import MISSING_CODES
from .dataset import SurveyDataset
from .specs import infer_variable_specs


def cleaned_frame(
    dataset: SurveyDataset,
    specs: Optional[dict] = None,
    drop_empty: bool = True,
    key_columns: Optional[list] = None,
    drop_duplicates: bool = True,
    drop_missing: bool = False,
) -> pd.DataFrame:
    """Retourne une copie épurée du tableau de `dataset`.

    Args:
        dataset: le jeu de données source.
        specs: caractéristiques de variables (inférées si absentes).
        drop_empty: retirer les lignes entièrement vides.
        key_columns: variables-clés dont l'absence entraîne le retrait de la ligne.
        drop_duplicates: retirer les doublons stricts.
        drop_missing: retirer toute ligne comportant AU MOINS une valeur manquante
            (après normalisation des codes d'absence en NA).
    """
    if specs is None:
        specs = infer_variable_specs(dataset)
    d = dataset.frame.copy()

    # Colonnes textuelles : object, str (pandas 3) ou category — tout sauf
    # numérique / date. Évite l'avertissement de dépréciation de select_dtypes.
    text_cols = [
        c
        for c in d.columns
        if not pd.api.types.is_numeric_dtype(d[c])
        and not pd.api.types.is_datetime64_any_dtype(d[c])
    ]
    for c in text_cols:
        d[c] = d[c].map(lambda x: x.strip() if isinstance(x, str) else x)
        d.loc[d[c].astype(str).str.strip().str.lower().isin(MISSING_CODES), c] = pd.NA

    for c, spec in specs.items():
        if c not in d.columns or spec["decimals"] is None:
            continue
        num = pd.to_numeric(d[c], errors="coerce")
        if spec["decimals"] == 0:
            d[c] = num.round(0).astype("Int64") if num.isna().any() else num.round(0).astype("int64")
        else:
            d[c] = num.round(2)

    if drop_empty:
        d = d.dropna(how="all")
    keys = [c for c in (key_columns or []) if c in d.columns]
    if keys:
        d = d.dropna(subset=keys)
    if drop_missing:
        # Retire toute ligne incomplète (au moins une valeur manquante).
        d = d.dropna(how="any")
    if drop_duplicates:
        d = d.drop_duplicates()
    return d
