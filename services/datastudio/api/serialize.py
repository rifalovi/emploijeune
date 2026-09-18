"""Sérialisation JSON des sorties du moteur (DataFrame -> structures simples)."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from engine.crosstab import CrossLayer


def _clean(value: Any) -> Any:
    """Convertit une valeur pandas/numpy en type JSON natif ; NaN/NaT -> None."""
    if value is None:
        return None
    if isinstance(value, float) and (pd.isna(value) or np.isinf(value)):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if np.isnan(value) else float(value)
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def frame_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """DataFrame -> liste d'enregistrements, valeurs manquantes en None."""
    return [{k: _clean(v) for k, v in row.items()} for row in df.to_dict(orient="records")]


def frequency_to_json(freq_results: dict, summary_rows: list) -> dict:
    """Sérialise la sortie de compute_frequency."""
    return {
        "tables": {
            str(col): frame_to_records(tab) for col, tab in freq_results.items()
        },
        "summary": [{k: _clean(v) for k, v in row.items()} for row in summary_rows],
    }


def crosslayer_to_json(layer: CrossLayer) -> dict:
    """Sérialise une couche de croisement (effectifs + pourcentages)."""
    counts = layer.counts
    pct = layer.pct
    return {
        "layer_value": layer.layer_value,
        "base": int(layer.base),
        "index": [str(i) for i in counts.index],
        "columns": [str(c) for c in counts.columns],
        "counts": [[_clean(v) for v in row] for row in counts.to_numpy()],
        "pct": [[_clean(v) for v in row] for row in pct.to_numpy()],
    }


def crosstab_to_json(layers: list[CrossLayer]) -> dict:
    return {"layers": [crosslayer_to_json(layer) for layer in layers]}
