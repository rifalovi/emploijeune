"""Modèle de données central du moteur SCS DataStudio.

`SurveyDataset` encapsule un tableau (pandas.DataFrame) accompagné de ses
métadonnées SPSS (étiquettes de variables, étiquettes de valeurs, niveaux de
mesure). Toute la logique d'étiquetage — correspondance robuste code→libellé,
mise en forme des codes entiers, séries étiquetées — est portée telle quelle
depuis l'application desktop V4.8, sans aucune dépendance à Tkinter.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional

import pandas as pd

from .constants import MISSING_LABEL


@dataclass
class SurveyDataset:
    """Un jeu de données d'enquête et ses métadonnées SPSS.

    Attributes:
        frame: le tableau des données.
        variable_labels: nom technique de colonne -> étiquette de variable.
        value_labels: nom de colonne -> {code: étiquette de valeur}.
        variable_measure: nom de colonne -> 'nominal' | 'ordinal' | 'scale'.
        original_variable_types: nom de colonne -> format source SPSS.
        name: nom logique du jeu de données (feuille/source).
    """

    frame: pd.DataFrame
    variable_labels: dict = field(default_factory=dict)
    value_labels: dict = field(default_factory=dict)
    variable_measure: dict = field(default_factory=dict)
    original_variable_types: dict = field(default_factory=dict)
    name: str = "Données"

    # ------------------------------------------------------------------ labels
    def variable_label(self, col: Any) -> str:
        """Étiquette de la variable `col`, ou chaîne vide si absente."""
        labels = self.variable_labels or {}
        label = labels.get(col) or labels.get(str(col)) or ""
        return str(label).strip()

    def variable_display(self, col: Any) -> str:
        """Libellé lisible « Étiquette [nom_technique] » pour les listes."""
        label = self.variable_label(col)
        return f"{label} [{col}]" if label and label != str(col) else str(col)

    def value_label_map(self, col: Any) -> dict:
        """Dictionnaire code->label indexé de façon robuste (int / float / str).

        On multiplie les clés (valeur brute, str, str strippée, float, int) afin
        de retrouver l'étiquette quelle que soit la façon dont pandas a typé la
        modalité à la lecture du fichier.
        """
        maps = self.value_labels or {}
        raw = maps.get(col) or maps.get(str(col)) or {}
        out: dict = {}
        for k, v in raw.items():
            sv = str(v)
            out[k] = sv
            out[str(k)] = sv
            out[str(k).strip()] = sv
            try:
                fk = float(k)
                out[fk] = sv
                if float(fk).is_integer():
                    out[int(fk)] = sv
                    out[str(int(fk))] = sv
            except (TypeError, ValueError):
                pass
        return out

    @staticmethod
    def format_code(v: Any) -> str:
        """Affiche un code numérique entier sans « .0 » (2.0 -> 2)."""
        if pd.isna(v):
            return ""
        if isinstance(v, float) and float(v).is_integer():
            return str(int(v))
        try:
            fv = float(v)
            if fv.is_integer() and re.fullmatch(r"-?\d+(\.0+)?", str(v).strip()):
                return str(int(fv))
        except (TypeError, ValueError):
            pass
        return str(v).strip()

    @staticmethod
    def lookup_label(mapping: dict, v: Any) -> Optional[str]:
        """Étiquette de valeur pour `v` (essais int/float/str + casse/espaces)."""
        candidates = [v, str(v).strip()]
        try:
            fv = float(v)
            candidates.append(fv)
            if fv.is_integer():
                candidates.append(int(fv))
                candidates.append(str(int(fv)))
        except (TypeError, ValueError):
            pass
        for cand in candidates:
            if cand in mapping:
                return mapping[cand]
        sv = str(v).strip().lower()
        for kk, vv in mapping.items():
            if isinstance(kk, str) and kk.strip().lower() == sv:
                return vv
        return None

    def labelled_series(self, col: Any, frame: Optional[pd.DataFrame] = None) -> pd.Series:
        """Série des libellés SPSS de `col`.

        Le code entier propre n'apparaît que si aucune étiquette de valeur
        n'existe pour la modalité ; les valeurs manquantes deviennent
        « [Manquant] ».
        """
        df = self.frame if frame is None else frame
        mapping = self.value_label_map(col)

        def lab(v: Any) -> str:
            if pd.isna(v):
                return MISSING_LABEL
            found = self.lookup_label(mapping, v)
            return found if found is not None else self.format_code(v)

        return df[col].map(lab)

    def to_display_frame(self, mode_libelle: bool = True, frame: Optional[pd.DataFrame] = None) -> pd.DataFrame:
        """Copie du tableau avec les valeurs en LIBELLÉ (si `mode_libelle` et
        étiquettes disponibles), sinon en code entier propre ; NaN -> vide.

        Utilisée pour la base épurée, les aperçus et les exports Excel — jamais
        pour l'écriture d'un .sav, qui doit conserver les codes et les
        métadonnées SPSS.
        """
        df = self.frame if frame is None else frame
        out = pd.DataFrame(index=df.index)
        for c in df.columns:
            mapping = self.value_label_map(c) if mode_libelle else {}

            def cell(v: Any, mapping: dict = mapping) -> str:
                if pd.isna(v):
                    return ""
                if mapping:
                    found = self.lookup_label(mapping, v)
                    if found is not None:
                        return found
                return self.format_code(v)

            out[c] = df[c].map(cell)
        return out
