"""Inférence des caractéristiques de variables (niveau de mesure, décimales).

Porté depuis `infer_variable_specs` de l'application desktop V4.8. Détermine
pour chaque variable son niveau de mesure (NOMINAL / ORDINAL / ÉCHELLE) et le
nombre de décimales cible, à partir du libellé, des étiquettes de valeurs, du
type observé et du niveau de mesure éventuellement déclaré dans le fichier SPSS.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from .dataset import SurveyDataset

ORDINAL_TERMS = (
    "pas du tout", "un peu", "moyenn", "plutôt", "tres", "très", "beaucoup",
    "faible", "élev", "excellent", "mauvais", "satisf", "clair", "facile",
    "difficile", "jamais", "parfois", "souvent", "toujours", "moins de",
    "plus de", "18-", "35-", "45-",
)
NOMINAL_TERMS = (
    "sexe", "genre", "pays", "centre", "programme", "profil", "type", "région",
    "region", "statut", "fonction", "activité", "activite", "établissement",
    "etablissement",
)


def infer_variable_specs(dataset: SurveyDataset) -> dict:
    """Retourne {colonne: {label, source, measure, decimals, cardinality, reason}}."""
    df = dataset.frame
    existing = dataset.variable_measure or {}
    formats = dataset.original_variable_types or {}
    specs: dict = {}
    for col in df.columns:
        ser = df[col]
        label = dataset.variable_label(col)
        text = (str(col) + " " + label).lower()
        non = ser.dropna()
        card = int(non.nunique())
        source = str(formats.get(col, "") or formats.get(str(col), "") or ser.dtype)
        value_labels = " ".join(map(str, dataset.value_label_map(col).values())).lower()
        is_num = pd.api.types.is_numeric_dtype(ser)
        current = str(existing.get(col, "") or existing.get(str(col), "")).lower()
        if current in ("nominal", "ordinal", "scale"):
            measure = current.upper()
        elif any(t in text for t in NOMINAL_TERMS):
            measure = "NOMINAL"
        elif card and card <= 12 and any(t in value_labels for t in ORDINAL_TERMS):
            measure = "ORDINAL"
        elif is_num and (card > 15 or card / max(1, len(non)) > 0.20):
            measure = "ÉCHELLE"
        elif dataset.value_label_map(col):
            measure = "NOMINAL"
        else:
            measure = "ÉCHELLE" if is_num else "NOMINAL"
        if is_num:
            vals = pd.to_numeric(non, errors="coerce").dropna()
            integer = bool(len(vals) == 0 or ((vals - vals.round()).abs() < 1e-9).all())
            decimals: Any = 0 if (measure in ("NOMINAL", "ORDINAL") or integer) else 2
            target = "Entier" if decimals == 0 else "Deux décimales"
        else:
            decimals = None
            target = "Texte"
        reason = (
            f"{measure} proposé d'après le libellé, {card} valeur(s) distincte(s), "
            f"les étiquettes SPSS et le type observé. Format cible : {target}."
        )
        specs[col] = {
            "label": label,
            "source": source,
            "measure": measure,
            "decimals": decimals,
            "cardinality": card,
            "reason": reason,
        }
    return specs
