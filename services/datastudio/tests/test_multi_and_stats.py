"""Tests des questions multi-réponses, des tests statistiques et de l'épuration."""

import pandas as pd
import pytest

from engine import (
    SurveyDataset,
    cleaned_frame,
    compute_multi_groups,
    compute_multi_table,
    infer_variable_specs,
    run_tests,
)


def test_multi_groups_detection(enquete: SurveyDataset):
    groups = compute_multi_groups(enquete)
    assert "Canal d'information" in groups
    options = dict(groups["Canal d'information"])
    assert set(options.values()) == {"Radio", "Site web"}


def test_multi_table_pourcentages(enquete: SurveyDataset):
    items = compute_multi_groups(enquete)["Canal d'information"]
    table, base = compute_multi_table(enquete, items)
    assert base == 10  # tous ont répondu à au moins un canal
    radio = table[table["Option"] == "Radio"]["Effectif"].iloc[0]
    assert radio == 6  # six « 1 » dans Q4_canal_radio


def test_infer_specs_niveaux_de_mesure(enquete: SurveyDataset):
    specs = infer_variable_specs(enquete)
    assert specs["Q1_sexe"]["measure"] == "NOMINAL"     # libellé « sexe »
    assert specs["Q3_note"]["measure"] == "ÉCHELLE"     # forte cardinalité numérique
    assert specs["Q2_satisf"]["measure"] == "ORDINAL"   # étiquettes ordinales


def test_cleaning_retire_lignes_vides_et_doublons():
    frame = pd.DataFrame(
        {
            "a": [1, 1, None, 2, "NA"],
            "b": ["x", "x", None, "y", "z"],
        }
    )
    ds = SurveyDataset(frame=frame)
    cleaned = cleaned_frame(ds, drop_empty=True, drop_duplicates=True)
    # La ligne entièrement vide (index 2) est retirée ; le doublon (0==1) aussi.
    assert len(cleaned) == 3
    # Le code d'absence « NA » est converti en valeur manquante.
    assert cleaned["a"].isna().sum() == 1


def test_stats_chi2(enquete: SurveyDataset):
    pytest.importorskip("scipy")
    res = run_tests(enquete, "Q1_sexe", "Q2_satisf")
    assert res["chi_square"]["applicable"] is True
    assert 0.0 <= res["chi_square"]["p"] <= 1.0


def test_stats_welch_applicable(enquete: SurveyDataset):
    pytest.importorskip("scipy")
    # Q3_note (ÉCHELLE) × Q1_sexe (2 modalités) -> t-test applicable.
    res = run_tests(enquete, "Q3_note", "Q1_sexe")
    welch = res["welch_ttest"]
    assert welch["applicable"] is True
    assert {g["nom"] for g in welch["groups"]} == {"Homme", "Femme"}
