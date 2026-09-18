"""Tableaux croisés (croisements) avec couche et sens du pourcentage.

Porté depuis `build_cross` de l'application desktop V4.8. Croise deux variables
(lignes × colonnes), éventuellement ventilé par une troisième (« couche »), avec
des pourcentages calculés en ligne ou en colonne. Les valeurs manquantes sont
exclues avant le croisement.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pandas as pd

from .constants import MISSING_LABEL
from .dataset import SurveyDataset


@dataclass
class CrossLayer:
    """Une table de croisement pour une valeur de couche donnée."""

    layer_value: str
    counts: pd.DataFrame  # effectifs, avec marges « Total »
    pct: pd.DataFrame     # pourcentages (ligne ou colonne)
    base: int             # nombre d'observations valides


def build_cross(
    dataset: SurveyDataset,
    r: str,
    c: str,
    layer: Optional[str] = None,
    pct_mode: str = "Ligne",
    frame: Optional[pd.DataFrame] = None,
) -> list[CrossLayer]:
    """Construit le croisement `r` × `c`, éventuellement ventilé par `layer`.

    Args:
        dataset: le jeu de données (pour l'étiquetage).
        r: variable en lignes.
        c: variable en colonnes.
        layer: variable de ventilation (couche) ou None.
        pct_mode: 'Ligne' ou 'Colonne'.
        frame: base active (par défaut `dataset.frame`).

    Returns:
        Une liste de `CrossLayer` (une seule entrée « Ensemble » sans couche).
    """
    df = dataset.frame if frame is None else frame
    cols = [r, c] + ([layer] if layer else [])
    d = df[cols].dropna().copy()
    for x in cols:
        d[x] = dataset.labelled_series(x, frame=d)
        d = d[d[x] != MISSING_LABEL]
    results: list[CrossLayer] = []
    groups = (
        [("Ensemble", d)]
        if not layer
        else [(str(k), g) for k, g in d.groupby(layer, dropna=False)]
    )
    for layer_value, g in groups:
        counts = pd.crosstab(g[r], g[c], dropna=False, margins=True, margins_name="Total")
        if pct_mode == "Colonne":
            pct = counts.div(counts.loc["Total"].replace(0, pd.NA), axis=1)
        else:
            pct = counts.div(counts["Total"].replace(0, pd.NA), axis=0)
        pct.loc["Total", "Total"] = 1.0
        results.append(CrossLayer(layer_value=layer_value, counts=counts, pct=pct, base=len(g)))
    return results
