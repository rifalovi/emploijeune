"""Tests de l'étiquetage des valeurs (cœur du comportement « libellé vs code »)."""

import pandas as pd

from engine import SurveyDataset, MISSING_LABEL


def test_value_label_map_robuste(enquete: SurveyDataset):
    m = enquete.value_label_map("Q1_sexe")
    # L'étiquette est retrouvable via int, float, str et str strippée.
    for key in (1, 1.0, "1", " 1 "):
        assert enquete.lookup_label(m, key) == "Homme"


def test_labelled_series_manquant(enquete: SurveyDataset):
    s = enquete.labelled_series("Q1_sexe")
    assert s.iloc[0] == "Homme"
    assert s.iloc[1] == "Femme"
    assert s.iloc[6] == MISSING_LABEL  # None -> [Manquant]


def test_format_code_sans_point_zero():
    assert SurveyDataset.format_code(2.0) == "2"
    assert SurveyDataset.format_code(3) == "3"
    assert SurveyDataset.format_code(3.5) == "3.5"
    assert SurveyDataset.format_code(pd.NA) == ""


def test_to_display_frame_mode_libelle(enquete: SurveyDataset):
    disp = enquete.to_display_frame(mode_libelle=True)
    assert disp["Q1_sexe"].iloc[0] == "Homme"
    assert disp["Q1_sexe"].iloc[6] == ""  # NaN -> vide
    # Mode code : les valeurs restent des codes entiers propres.
    codes = enquete.to_display_frame(mode_libelle=False)
    assert codes["Q1_sexe"].iloc[0] == "1"


def test_variable_display(enquete: SurveyDataset):
    assert enquete.variable_display("Q1_sexe") == "Sexe du répondant [Q1_sexe]"
