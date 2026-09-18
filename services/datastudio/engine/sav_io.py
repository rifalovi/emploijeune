"""Lecture / écriture de fichiers SPSS (.sav) et construction d'un SurveyDataset.

Porté depuis `load` et `export_sav` de l'application desktop V4.8. pyreadstat
est importé paresseusement : les autres formats (CSV, Excel Kobo/CSPro) et tout
le reste du moteur fonctionnent sans lui.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import pandas as pd

from .dataset import SurveyDataset
from .specs import infer_variable_specs


def _pyreadstat():
    try:
        import pyreadstat  # import paresseux
    except ImportError as exc:  # pragma: no cover - dépend de l'environnement
        raise RuntimeError(
            "Le module pyreadstat est requis pour les fichiers .sav : pip install pyreadstat"
        ) from exc
    return pyreadstat


def read_sav(path: str, name: str = "Données SPSS") -> SurveyDataset:
    """Lit un fichier .sav (codes bruts + métadonnées SPSS) en SurveyDataset."""
    df, meta = _pyreadstat().read_sav(path, apply_value_formats=False)
    return SurveyDataset(
        frame=df,
        variable_labels=meta.column_names_to_labels,
        value_labels=meta.variable_value_labels,
        variable_measure=getattr(meta, "variable_measure", {}) or {},
        original_variable_types=getattr(meta, "original_variable_types", {}) or {},
        name=name,
    )


def read_tabular(path: str) -> SurveyDataset:
    """Lit un fichier tabulaire non-SPSS (Excel Kobo/CSPro, CSV, TSV, ODS...).

    Aucune métadonnée SPSS n'accompagne ces formats ; les libellés de valeurs
    sont donc vides et les modalités s'affichent avec leur code.
    """
    ext = Path(path).suffix.lower()
    if ext in (".xlsx", ".xls"):
        engine = "openpyxl" if ext == ".xlsx" else None
        sheets = pd.read_excel(path, sheet_name=None, engine=engine)
        first = next(iter(sheets))
        return SurveyDataset(frame=sheets[first], name=str(first))
    if ext == ".ods":
        sheets = pd.read_excel(path, sheet_name=None, engine="odf")
        first = next(iter(sheets))
        return SurveyDataset(frame=sheets[first], name=str(first))
    if ext in (".csv", ".tsv", ".tab"):
        sep = "\t" if ext in (".tsv", ".tab") else None
        return SurveyDataset(frame=pd.read_csv(path, sep=sep, engine="python"))
    if ext == ".json":
        return SurveyDataset(frame=pd.read_json(path))
    raise ValueError(f"Format non pris en charge : {ext}")


def load_dataset(path: str) -> SurveyDataset:
    """Charge n'importe quel format supporté vers un SurveyDataset."""
    if Path(path).suffix.lower() == ".sav":
        return read_sav(path)
    return read_tabular(path)


def write_sav(dataset: SurveyDataset, frame: pd.DataFrame, path: str, specs: Optional[dict] = None) -> None:
    """Écrit `frame` en .sav en conservant étiquettes et niveaux de mesure SPSS."""
    if specs is None:
        specs = infer_variable_specs(dataset)
    measures = {
        c: ("scale" if sp["measure"] == "ÉCHELLE" else sp["measure"].lower())
        for c, sp in specs.items()
        if c in frame.columns
    }
    formats = {
        c: ("F12.0" if sp["decimals"] == 0 else "F12.2")
        for c, sp in specs.items()
        if c in frame.columns and sp["decimals"] is not None
    }
    _pyreadstat().write_sav(
        frame,
        path,
        column_labels=dataset.variable_labels or None,
        variable_value_labels=dataset.value_labels or None,
        variable_measure=measures or None,
        variable_format=formats or None,
    )
