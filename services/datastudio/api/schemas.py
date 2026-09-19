"""Schémas d'entrée/sortie de l'API DataStudio (pydantic v2)."""

from __future__ import annotations

from typing import Any, Literal, Optional

import pandas as pd
from pydantic import BaseModel, Field

# Import du moteur (le chemin est ajouté par app.py / l'entrypoint Vercel).
from engine import SurveyDataset


class DatasetInput(BaseModel):
    """Jeu de données transmis en JSON (données d'enquête ou fichier importé).

    `rows` est une liste d'enregistrements {colonne: valeur}. Les libellés de
    variables et de valeurs (métadonnées SPSS) sont optionnels ; sans eux, les
    modalités s'affichent avec leur code.
    """

    rows: list[dict[str, Any]] = Field(default_factory=list)
    columns: Optional[list[str]] = Field(
        default=None,
        description="Ordre des colonnes ; déduit des lignes si absent.",
    )
    variable_labels: dict[str, str] = Field(default_factory=dict)
    value_labels: dict[str, dict[str, str]] = Field(
        default_factory=dict,
        description="col -> {code: libellé}. Les codes sont des chaînes en JSON ; "
        "l'appariement code→libellé du moteur gère int/float/str.",
    )
    variable_measure: dict[str, str] = Field(default_factory=dict)
    name: str = "Données"

    def to_dataset(self) -> SurveyDataset:
        frame = pd.DataFrame(self.rows, columns=self.columns)
        return SurveyDataset(
            frame=frame,
            variable_labels=dict(self.variable_labels),
            value_labels={k: dict(v) for k, v in self.value_labels.items()},
            variable_measure=dict(self.variable_measure),
            name=self.name,
        )


class FilterCond(BaseModel):
    """Condition de filtre (combinées par ET). op ∈ =, ≠, contient, >, ≥, <, ≤."""

    col: str
    op: Literal["=", "≠", "contient", ">", "≥", "<", "≤"]
    val: str = ""


class SourceRequest(BaseModel):
    """Base des requêtes de calcul : le jeu de données provient soit d'un envoi
    JSON en ligne (`dataset`, cas des enquêtes), soit d'un fichier déjà déposé
    dans Storage (`dataset_ref` = chemin de l'objet, cas des imports .sav).

    `filters` (optionnel) restreint la base à une sous-population (conditions ET),
    appliqué à TOUTES les analyses qui étendent cette requête."""

    dataset: Optional[DatasetInput] = None
    dataset_ref: Optional[str] = None
    filters: Optional[list[FilterCond]] = None


class FrequencyRequest(SourceRequest):
    cols: list[str]
    exclure: bool = False


class CrosstabRequest(SourceRequest):
    row: str
    col: str
    layer: Optional[str] = None
    pct_mode: Literal["Ligne", "Colonne"] = "Ligne"


class StatTestRequest(SourceRequest):
    row: str
    col: str


class MultiRequest(SourceRequest):
    # Préfixe d'une batterie précise ; si absent, renvoie toutes les batteries.
    group: Optional[str] = None


class CleanRequest(SourceRequest):
    drop_empty: bool = True
    key_columns: list[str] = Field(default_factory=list)
    drop_duplicates: bool = True
    # drop_missing=True : retire toute ligne comportant au moins une valeur
    # manquante (lignes incomplètes), en plus des lignes entièrement vides.
    drop_missing: bool = False
    # full=True : renvoie aussi la base épurée COMPLÈTE (rows + labels) pour
    # l'adopter comme base de travail (et l'enregistrer).
    full: bool = False


class AnalyzeRequest(SourceRequest):
    pass


class PreviewRequest(SourceRequest):
    """Aperçu de la base (brute/filtrée) : premières lignes en libellés."""

    limit: int = 100


class ListRequest(SourceRequest):
    """Liste : juxtaposition de variables choisies (en libellés)."""

    cols: list[str]
    limit: int = 200
    # exclure_vides=True : n'affiche pas les lignes vides sur TOUTES les
    # variables sélectionnées (évite les lignes blanches dans la liste).
    exclure_vides: bool = True


class QualityRequest(SourceRequest):
    """Diagnostic qualité : complétude par variable, doublons, score."""

    pass


class IngestFileRequest(BaseModel):
    """Ingestion d'un fichier déjà déposé dans le bucket Storage « datastudio ».

    `path` est le chemin de l'objet, sous la forme {user_id}/uploads/{fichier}.
    """

    path: str
