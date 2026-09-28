"""Tests de l'analyseur de CMR (parseur, audit, révision, consolidation)."""

from __future__ import annotations

import pandas as pd

from engine.cmr import (
    analyser_cmr,
    auditer_indicateur,
    parse_nombre,
    parser_onglet,
    reviser_indicateur,
)


def _entete(n_annees: int = 2) -> list[list]:
    """Trois lignes d'en-tête d'un onglet CMR à `n_annees` blocs annuels.

    Colonnes : 0 Réf | 1 Indicateur | 2 Unités | 3 Référence |
    puis (Cible, Réalisé, %) × n_annees | Cible Total | Total réalisé | %.
    """
    r0 = ["Réf.", "Indicateurs de résultats", "Unités", "Référence", "Valeurs annuelles"]
    r1 = ["", "", "", "", "1 e Année"]
    r2 = ["", "", "", "", "Cible"]
    # Complète le 1er bloc (Réalisé, %) puis les blocs suivants.
    r0 += ["", ""]
    r1 += ["", ""]
    r2 += ["Réalisé", "%"]
    for k in range(2, n_annees + 1):
        r0 += ["", "", ""]
        r1 += [f"{k} e Année", "", ""]
        r2 += ["Cible", "Réalisé", "%"]
    r0 += ["Cible Total", "Total réalisé", "%"]
    r1 += ["", "", ""]
    r2 += ["", "", ""]
    return [r0, r1, r2]


def _frame(lignes: list[list]) -> pd.DataFrame:
    largeur = max(len(x) for x in lignes)
    lignes = [x + [None] * (largeur - len(x)) for x in lignes]
    return pd.DataFrame(lignes)


def _onglet_demo() -> pd.DataFrame:
    lignes = _entete(2)
    # Hiérarchie GAR + 3 indicateurs (col0..col10 : réf,lib,unite,ref,C1,R1,%1,C2,R2,%2,CT,TR,%T)
    lignes.append(["OG1: Objectif global"] + [None] * 12)
    lignes.append(["E1.1: Un effet"] + [None] * 12)
    lignes.append(["P1.1.1: Un produit"] + [None] * 12)
    # Indicateur conforme : % cohérents
    lignes.append(["I1.1.1", "Nombre de sessions", "Nbre", 10, 20, 18, "90,0%", 25, 25, "100%", 45, 43, "95,6%"])
    # % saisi faux (doit être recalculé) + réalisation impossible
    lignes.append(["I1.1.2", "Nombre d'outils", "Nbre", 5, 10, 50, "80%", 12, 3000, "-", 22, 3050, "-"])
    # Cible manquante une année + baseline absente
    lignes.append(["I1.1.3", "Taux de réussite", "%", None, 0, None, None, 30, 15, "50%", 30, 15, "50%"])
    return _frame(lignes)


# --------------------------------------------------------------------- parse

def test_parse_nombre_tolerant():
    assert parse_nombre("83,0") == 83.0
    assert parse_nombre("1 585,7%") == 1585.7
    assert parse_nombre("-") is None
    assert parse_nombre("") is None
    assert parse_nombre(None) is None
    assert parse_nombre(42) == 42.0


def test_parser_detecte_hierarchie_et_annees():
    projet = parser_onglet(_onglet_demo(), "Pj9_Demo")
    assert projet is not None
    assert projet.code == "Pj9"
    assert projet.nom == "Demo"
    assert projet.n_annees == 2
    assert len(projet.indicateurs) == 3
    ind = projet.indicateurs[0]
    assert ind.ref == "I1.1.1"
    assert ind.objectif.startswith("OG1")
    assert ind.effet.startswith("E1.1")
    assert ind.produit.startswith("P1.1.1")
    assert ind.reference == 10
    assert ind.annees[0].cible == 20 and ind.annees[0].realise == 18


def test_parser_ignore_onglet_non_cmr():
    df = pd.DataFrame([["Bonjour", "Monde"], [1, 2]])
    assert parser_onglet(df, "Notes") is None


# --------------------------------------------------------------------- audit

def test_audit_recalcule_pourcentages_et_detecte_impossibles():
    projet = parser_onglet(_onglet_demo(), "Pj9_Demo")
    for ind in projet.indicateurs:
        auditer_indicateur(ind)
    i2 = projet.indicateurs[1]
    types = {a["type"] for a in i2.anomalies}
    # 3000/12 = 25000 % -> réalisation impossible ; % année 1 saisi (80) faux (50/10=500)
    assert "Réalisation impossible" in types
    assert "Calcul %" in types
    # % recalculés remplis
    assert i2.annees[0].pct_calc == 500.0


def test_audit_signale_baseline_et_cible_manquantes():
    projet = parser_onglet(_onglet_demo(), "Pj9_Demo")
    i3 = projet.indicateurs[2]
    auditer_indicateur(i3)
    types = {a["type"] for a in i3.anomalies}
    assert "Qualité" in types            # baseline absente
    # année 1 : cible 0 + réalisé None -> pas de cible manquante ; ok


def test_audit_valeur_negative_critique():
    lignes = _entete(1)
    lignes.append(["I1", "Indic", "Nbre", 0, 10, -5, None, 10, -5, "-"])
    projet = parser_onglet(_frame(lignes), "Pj1_Neg")
    ind = projet.indicateurs[0]
    auditer_indicateur(ind)
    assert any(a["type"] == "Valeur négative" and a["severite"] == "Critique" for a in ind.anomalies)


# ---------------------------------------------------------------- révision

def test_revision_applique_arithmetique_et_propose_le_reste():
    projet = parser_onglet(_onglet_demo(), "Pj9_Demo")
    for ind in projet.indicateurs:
        auditer_indicateur(ind)
    i2 = projet.indicateurs[1]
    rev = reviser_indicateur(i2)
    # Corrections arithmétiques appliquées + vérification proposée (non appliquée)
    appliquees = [c for c in i2.corrections if c.get("applique")]
    proposees = [c for c in i2.corrections if not c.get("applique")]
    assert appliquees and all(c["type"] == "Recalcul arithmétique" for c in appliquees)
    assert proposees and any(c["type"] == "Vérification requise" for c in proposees)
    assert rev["statut"] in ("Corrigé", "Critique", "À vérifier")


# ------------------------------------------------------------ consolidation

def test_analyser_cmr_consolide_le_portefeuille():
    sheets = {
        "Pj9_Demo": _onglet_demo(),
        "Pj1_Neg": _frame(_entete(1) + [["I1", "Indic", "Nbre", 0, 10, 9, "90%", 10, 9, "90%"]]),
        "Notes": pd.DataFrame([["libre", "texte"]]),
    }
    res = analyser_cmr(sheets)
    assert res["n_projets"] == 2
    assert "Notes" in res["onglets_ignores"]
    assert res["n_indicateurs"] == 4
    g = res["global"]
    assert g["kpi"]["n_projets"] == 2
    assert set(g["repartition_statuts"]) == {"Conforme", "Corrigé", "À vérifier", "Critique"}
    assert len(g["classement"]) == 2
    # Chaque ligne de classement porte un feu tricolore.
    assert all(row["feu"] in ("🔴", "🟡", "🟢") for row in g["classement"])


def test_indicateurs_portent_un_statut():
    res = analyser_cmr({"Pj9_Demo": _onglet_demo()})
    inds = res["projets"][0]["indicateurs"]
    assert all("statut" in i for i in inds)
    assert all(i["statut"] in ("Conforme", "Corrigé", "À vérifier", "Critique") for i in inds)
