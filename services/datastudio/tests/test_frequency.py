"""Tests des tris à plat (fréquences)."""

from engine import SurveyDataset, compute_frequency


def test_frequency_effectifs_et_pourcentages(enquete: SurveyDataset):
    results, summary = compute_frequency(enquete, ["Q1_sexe"])
    tab = results["Q1_sexe"]
    modal = dict(zip(tab["Modalité"], tab["Effectif"]))
    assert modal["Homme"] == 4
    assert modal["Femme"] == 5
    assert modal["[Manquant]"] == 1  # inclus par défaut
    assert modal["Total"] == 10       # base totale

    row = summary[0]
    assert row["Base valide"] == 9
    assert row["Manquants exclus"] == 1
    assert row["Modalité dominante"] == "Femme"


def test_frequency_exclure_manquants(enquete: SurveyDataset):
    results, summary = compute_frequency(enquete, ["Q1_sexe"], exclure=True)
    tab = results["Q1_sexe"]
    modalites = set(tab["Modalité"])
    assert "[Manquant]" not in modalites
    # Total = base valide quand les manquants sont exclus.
    total = tab[tab["Modalité"] == "Total"]["Effectif"].iloc[0]
    assert total == 9
    # % de « Femme » calculé sur la base valide (5/9), pas sur 10.
    femme = tab[tab["Modalité"] == "Femme"]
    assert abs(femme["%"].iloc[0] - 5 / 9) < 1e-9


def test_frequency_pourcentage_cumule(enquete: SurveyDataset):
    results, _ = compute_frequency(enquete, ["Q2_satisf"], exclure=True)
    tab = results["Q2_satisf"]
    valides = tab[~tab["Modalité"].isin(["Total"])]
    assert abs(valides["% cumulé"].dropna().iloc[-1] - 1.0) < 1e-9
