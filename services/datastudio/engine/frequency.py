"""Tris à plat et tableaux de fréquences (style SPSS).

Porté depuis `compute_frequency` de l'application desktop V4.8. Produit, pour
chaque variable, un tableau { Modalité, Effectif, %, % valide, % cumulé, Total }
et une ligne de synthèse. L'option `exclure` retire la ligne « [Manquant] » et
calcule les pourcentages sur la base valide.
"""

from __future__ import annotations

from typing import Any, Optional

import pandas as pd

from .constants import MISSING_LABEL
from .dataset import SurveyDataset


def compute_frequency(
    dataset: SurveyDataset,
    cols: list,
    frame: Optional[pd.DataFrame] = None,
    exclure: bool = False,
) -> tuple[dict, list]:
    """Calcule les tris à plat.

    Args:
        dataset: le jeu de données (pour l'étiquetage des valeurs).
        cols: variables à analyser.
        frame: base active (par défaut `dataset.frame`) — utile après filtres.
        exclure: si vrai, exclut les valeurs manquantes et calcule les % sur la
            base valide.

    Returns:
        (freq_results, summary_rows) où freq_results est {colonne: DataFrame} et
        summary_rows une liste de dictionnaires de synthèse.
    """
    df = dataset.frame if frame is None else frame
    freq_results: dict = {}
    summary_rows: list = []
    for col in cols:
        series = dataset.labelled_series(col, frame=df)
        total_all = len(series)
        valid = series[series != MISSING_LABEL]
        base = len(valid)
        missing = total_all - base
        denom = base if exclure else total_all
        vc = valid.value_counts(dropna=False)
        tab_rows: list[dict[str, Any]] = []
        cumul = 0.0
        for modalite, eff in vc.items():
            eff = int(eff)
            p_total = eff / max(1, denom)
            p_valid = eff / max(1, base)
            cumul += p_valid
            tab_rows.append(
                {
                    "Modalité": modalite,
                    "Effectif": eff,
                    "%": p_total,
                    "% valide": p_valid,
                    "% cumulé": cumul,
                }
            )
        if missing > 0 and not exclure:
            tab_rows.append(
                {
                    "Modalité": MISSING_LABEL,
                    "Effectif": int(missing),
                    "%": missing / max(1, total_all),
                    "% valide": None,
                    "% cumulé": None,
                }
            )
        tab_rows.append(
            {
                "Modalité": "Total",
                "Effectif": int(denom),
                "%": 1.0,
                "% valide": None,
                "% cumulé": None,
            }
        )
        freq_results[col] = pd.DataFrame(tab_rows)
        top = vc.index[0] if base else "Aucune"
        top_share = (int(vc.iloc[0]) / max(1, base)) if base else 0
        summary_rows.append(
            {
                "Variable": dataset.variable_display(col),
                "Base valide": base,
                "Manquants exclus": missing,
                "Taux de réponse": base / max(1, total_all) * 100,
                "Modalités": int(len(vc)),
                "Modalité dominante": top,
                "Part dominante": top_share * 100,
            }
        )
    return freq_results, summary_rows
