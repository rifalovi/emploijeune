"""Moteur de calcul SCS DataStudio (sans interface).

Cœur de traitement extrait de l'application desktop SCS DataStudio V4.8 pour
intégration en ligne dans la plateforme Emploi Jeune. Aucune dépendance à
Tkinter : uniquement pandas, et (paresseusement) scipy pour les tests
statistiques et pyreadstat pour les fichiers .sav.
"""

from .constants import MISSING_CODES, MISSING_LABEL
from .dataset import SurveyDataset
from .specs import infer_variable_specs
from .frequency import compute_frequency
from .crosstab import CrossLayer, build_cross
from .multi import compute_multi_groups, compute_multi_table
from .stats import chi_square, run_tests, welch_ttest
from .cleaning import cleaned_frame, cleaned_frame_report

__all__ = [
    "MISSING_CODES",
    "MISSING_LABEL",
    "SurveyDataset",
    "infer_variable_specs",
    "compute_frequency",
    "CrossLayer",
    "build_cross",
    "compute_multi_groups",
    "compute_multi_table",
    "chi_square",
    "welch_ttest",
    "run_tests",
    "cleaned_frame",
    "cleaned_frame_report",
]

APP_NAME = "SCS DataStudio"
ENGINE_VERSION = "4.8.0"
