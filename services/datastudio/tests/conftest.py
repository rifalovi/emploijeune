"""Fixtures partagées : un SurveyDataset synthétique de type enquête OIF/SCS.

Reproduit la structure d'un export .sav (codes numériques + étiquettes de
valeurs SPSS) sans dépendre de pyreadstat, afin que le moteur soit testable
partout, y compris là où le lecteur SPSS n'est pas installé.
"""

import sys
from pathlib import Path

import pandas as pd
import pytest

# Rend le paquet `engine` importable quand les tests sont lancés depuis la racine.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine import SurveyDataset  # noqa: E402


@pytest.fixture
def enquete() -> SurveyDataset:
    frame = pd.DataFrame(
        {
            # Sexe : 1=Homme, 2=Femme, avec un manquant.
            "Q1_sexe": [1, 2, 2, 1, 2, 1, None, 2, 1, 2],
            # Satisfaction ordinale : 1..4.
            "Q2_satisf": [4, 3, 4, 2, 4, 1, 3, 4, 2, 3],
            # Note /20 (variable ÉCHELLE, forte cardinalité).
            "Q3_note": [12.0, 15.5, 18.0, 9.0, 16.0, 7.5, 14.0, 19.0, 11.0, 13.5],
            # Batterie multi-réponses 0/1 (canaux d'information).
            "Q4_canal_radio": [1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
            "Q4_canal_web": [0, 1, 1, 0, 1, 1, 1, 0, 1, 0],
        }
    )
    variable_labels = {
        "Q1_sexe": "Sexe du répondant",
        "Q2_satisf": "Satisfaction globale",
        "Q3_note": "Note sur 20",
        "Q4_canal_radio": "Canal d'information : Radio",
        "Q4_canal_web": "Canal d'information : Site web",
    }
    value_labels = {
        "Q1_sexe": {1: "Homme", 2: "Femme"},
        "Q2_satisf": {1: "Pas du tout", 2: "Un peu", 3: "Plutôt", 4: "Tout à fait"},
    }
    return SurveyDataset(
        frame=frame,
        variable_labels=variable_labels,
        value_labels=value_labels,
        name="Enquête test",
    )
