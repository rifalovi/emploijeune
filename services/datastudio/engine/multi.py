"""Questions à réponses multiples (batteries 0/1).

Porté depuis `compute_multi_groups` et `render_multi` de l'application desktop
V4.8. Détecte les batteries de variables binaires (0/1) partageant un même
préfixe d'étiquette, puis produit le tri à plat multi-réponses (le total des
pourcentages peut dépasser 100 %).
"""

from __future__ import annotations

import re
from typing import Optional

import pandas as pd

from .dataset import SurveyDataset


def compute_multi_groups(dataset: SurveyDataset, frame: Optional[pd.DataFrame] = None) -> dict:
    """Détecte les batteries multi-réponses 0/1 par préfixe commun d'étiquette.

    Returns:
        {préfixe: [(colonne, libellé_option), ...]} pour les groupes d'au moins
        deux options.
    """
    df = dataset.frame if frame is None else frame
    groups: dict = {}
    if df is None:
        return {}
    for c in df.columns:
        label = dataset.variable_label(c) or str(c)
        parts = re.split(r"\s*[:?]\s*", label, maxsplit=1)
        prefix = parts[0].strip()
        vals = set(pd.to_numeric(df[c], errors="coerce").dropna().unique())
        if len(parts) > 1 and vals and vals.issubset({0, 1}):
            groups.setdefault(prefix, []).append((c, parts[1].strip()))
    return {k: v for k, v in groups.items() if len(v) >= 2}


def compute_multi_table(
    dataset: SurveyDataset,
    items: list,
    frame: Optional[pd.DataFrame] = None,
) -> tuple[pd.DataFrame, int]:
    """Tri à plat multi-réponses pour une batterie `items` = [(colonne, option)].

    La base valide compte les répondants ayant renseigné au moins une option.

    Returns:
        (tableau, base_valide).
    """
    df = dataset.frame if frame is None else frame
    valid = df[[c for c, _ in items]].notna().any(axis=1)
    base = int(valid.sum())
    rows = []
    for c, opt in items:
        x = pd.to_numeric(df.loc[valid, c], errors="coerce")
        n = int((x == 1).sum())
        rows.append(
            {"Option": opt, "Effectif": n, "Pourcentage répondants": n / max(1, base)}
        )
    rows.append(
        {"Option": "Total répondants valides", "Effectif": base, "Pourcentage répondants": 1.0}
    )
    return pd.DataFrame(rows), base
