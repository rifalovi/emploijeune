"""Tests des croisements."""

from engine import SurveyDataset, build_cross


def test_crosstab_ensemble_effectifs(enquete: SurveyDataset):
    layers = build_cross(enquete, "Q1_sexe", "Q2_satisf", pct_mode="Ligne")
    assert len(layers) == 1
    layer = layers[0]
    assert layer.layer_value == "Ensemble"
    # La ligne manquante de Q1_sexe est exclue : base = 9.
    assert layer.base == 9
    assert layer.counts.loc["Total", "Total"] == 9


def test_crosstab_pourcentage_ligne_somme_a_un(enquete: SurveyDataset):
    layers = build_cross(enquete, "Q1_sexe", "Q2_satisf", pct_mode="Ligne")
    pct = layers[0].pct
    # Chaque ligne de pourcentages (hors colonne Total) somme à 1.
    modal_cols = [c for c in pct.columns if c != "Total"]
    for idx in pct.index:
        if idx == "Total":
            continue
        assert abs(pct.loc[idx, modal_cols].sum() - 1.0) < 1e-9


def test_crosstab_avec_couche(enquete: SurveyDataset):
    layers = build_cross(enquete, "Q2_satisf", "Q4_canal_radio", layer="Q1_sexe")
    # Une table par modalité de la couche Sexe (Homme, Femme).
    valeurs = {layer.layer_value for layer in layers}
    assert valeurs == {"Homme", "Femme"}
