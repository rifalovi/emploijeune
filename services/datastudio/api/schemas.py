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
    # --- Corrections (ne retirent aucune ligne) ---
    # normaliser_manquants : convertir les codes d'absence en valeurs manquantes.
    normaliser_manquants: bool = True
    # trim_espaces : retirer les espaces superflus des cellules texte.
    trim_espaces: bool = True
    # arrondir : arrondir les variables numériques selon leurs décimales cibles.
    arrondir: bool = True
    # --- Épuration (retrait de lignes) ---
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


class ModalitiesRequest(SourceRequest):
    """Modalités (valeurs en libellés) d'une variable, pour alimenter un filtre."""

    col: str
    limit: int = 500


class TranslationTermsRequest(SourceRequest):
    """Termes à traduire d'une base importée : en-têtes de colonnes + modalités
    des colonnes catégorielles (faible cardinalité). Les colonnes de texte libre
    (haute cardinalité) et purement numériques ne renvoient pas leurs valeurs."""

    # Au-delà de ce nombre de valeurs distinctes, la colonne est traitée comme du
    # texte libre : seul son en-tête est traduit, pas ses valeurs.
    max_cardinalite: int = 80
    # Plafond global du nombre de valeurs distinctes renvoyées (borne le coût IA).
    max_valeurs: int = 1200


class TranslationFreetextRequest(SourceRequest):
    """Valeurs distinctes des colonnes de TEXTE LIBRE (réponses ouvertes) à
    traduire par lots. Bornées pour maîtriser le coût IA."""

    cols: list[str] = Field(default_factory=list)
    max_par_colonne: int = 3000
    max_total: int = 8000


class TranslateRequest(SourceRequest):
    """Applique une table de traduction produite par l'IA à la base :
    - `column_map` : {en-tête d'origine -> en-tête traduit}
    - `value_maps` : {en-tête d'origine -> {valeur d'origine -> valeur traduite}}
    - `free_text_columns` : colonnes de réponses ouvertes traduites EN PLACE et
      dont l'original est conservé dans une colonne compagnon « <col> (VO) »
      (marquée « texte » pour rester hors des analyses et des rapports).

    Le renommage et le remplacement préservent l'ordre des lignes et des
    colonnes ; les valeurs non listées restent inchangées (aucune déformation).
    `full=True` renvoie la base traduite complète (adoptable comme base de
    travail)."""

    column_map: dict[str, str] = Field(default_factory=dict)
    value_maps: dict[str, dict[str, str]] = Field(default_factory=dict)
    free_text_columns: list[str] = Field(default_factory=list)
    # Traduction des LIBELLÉS SPSS (bases .sav à modalités codées) :
    # - variable_label_map : {colonne d'origine -> libellé de variable traduit}
    # - value_label_text_map : {texte d'étiquette de valeur d'origine -> traduit}
    #   (appliqué à toutes les colonnes ; les CODES sont conservés, seuls les
    #   libellés lisibles des modalités sont traduits).
    variable_label_map: dict[str, str] = Field(default_factory=dict)
    value_label_text_map: dict[str, str] = Field(default_factory=dict)
    full: bool = False
    name: Optional[str] = None


class IngestFileRequest(BaseModel):
    """Ingestion d'un fichier déjà déposé dans le bucket Storage « datastudio ».

    `path` est le chemin de l'objet, sous la forme {user_id}/uploads/{fichier}.
    `sheet` (classeurs multi-feuilles) et `header_row` (n° 0-indexé de la ligne
    d'en-tête ; auto-détecté si absent) sont optionnels.
    """

    path: str
    sheet: Optional[str] = None
    header_row: Optional[int] = None


class ConsolidationPlanRequest(SourceRequest):
    """Détection des colonnes-variantes de langue (`x_kh`, `x_viet`…) à fusionner.
    Aucun paramètre : le plan est calculé à partir des noms et libellés."""


class ConsolidateGroup(BaseModel):
    """Un groupe à fusionner : `canonical` = colonne finale ; `members` = toutes
    les colonnes du groupe (canonical inclus) à coalescer puis supprimer."""

    canonical: str
    members: list[str]


class ConsolidateRequest(SourceRequest):
    """Applique la consolidation multilingue : fusionne chaque groupe en une seule
    variable (1re valeur non vide) et renvoie la base consolidée."""

    groups: list[ConsolidateGroup] = Field(default_factory=list)
    full: bool = True
    name: Optional[str] = None
