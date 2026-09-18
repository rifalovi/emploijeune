"""Tests statistiques sur un croisement : Khi² d'indépendance et t-test de Welch.

Porté depuis `render_stat_test` de l'application desktop V4.8, découplé de
l'interface : les fonctions renvoient des dictionnaires de résultats plutôt que
d'afficher des boîtes de dialogue. scipy est importé paresseusement pour ne pas
imposer la dépendance aux appels qui n'en ont pas besoin.
"""

from __future__ import annotations

from typing import Optional

import pandas as pd

from .constants import MISSING_LABEL
from .dataset import SurveyDataset
from .specs import infer_variable_specs


def _scipy_stats():
    try:
        from scipy import stats as scipy_stats  # import paresseux
    except ImportError as exc:  # pragma: no cover - dépend de l'environnement
        raise RuntimeError(
            "Le module scipy est requis pour les tests statistiques : pip install scipy"
        ) from exc
    return scipy_stats


def chi_square(dataset: SurveyDataset, r: str, c: str, frame: Optional[pd.DataFrame] = None) -> dict:
    """Khi² d'indépendance entre `r` et `c` (valeurs manquantes exclues).

    Returns:
        {applicable, chi2, dof, p, significatif, message}.
    """
    df = dataset.frame if frame is None else frame
    lab_r = dataset.labelled_series(r, frame=df)
    lab_c = dataset.labelled_series(c, frame=df)
    mask = (lab_r != MISSING_LABEL) & (lab_c != MISSING_LABEL)
    ct = pd.crosstab(lab_r[mask], lab_c[mask])
    if ct.shape[0] < 2 or ct.shape[1] < 2:
        return {
            "applicable": False,
            "message": "Khi² : il faut au moins 2 modalités par variable (après exclusion des manquants).",
        }
    chi2, p, dof, _ = _scipy_stats().chi2_contingency(ct)
    significatif = bool(p < 0.05)
    return {
        "applicable": True,
        "chi2": float(chi2),
        "dof": int(dof),
        "p": float(p),
        "significatif": significatif,
        "message": (
            f"χ² = {chi2:.3f} · ddl = {dof} · p = {p:.4f} → association "
            f"{'significative' if significatif else 'non significative'} au seuil de 5 % entre "
            f"« {dataset.variable_label(r) or r} » et « {dataset.variable_label(c) or c} »."
        ),
    }


def welch_ttest(
    dataset: SurveyDataset,
    r: str,
    c: str,
    specs: Optional[dict] = None,
    frame: Optional[pd.DataFrame] = None,
) -> dict:
    """t-test de Welch : variable ÉCHELLE × variable à exactement 2 modalités.

    Returns:
        {applicable, t, p, significatif, groups, message}.
    """
    df = dataset.frame if frame is None else frame
    if specs is None:
        specs = infer_variable_specs(dataset)
    lab_r = dataset.labelled_series(r, frame=df)
    lab_c = dataset.labelled_series(c, frame=df)
    num_r = pd.to_numeric(df[r], errors="coerce")
    num_c = pd.to_numeric(df[c], errors="coerce")
    is_num_r = specs.get(r, {}).get("measure") == "ÉCHELLE"
    is_num_c = specs.get(c, {}).get("measure") == "ÉCHELLE"
    mask = (lab_r != MISSING_LABEL) & (lab_c != MISSING_LABEL)

    num = grp = num_name = None
    if is_num_r and lab_c[mask].nunique() == 2:
        num, grp, num_name = num_r, lab_c, r
    elif is_num_c and lab_r[mask].nunique() == 2:
        num, grp, num_name = num_c, lab_r, c
    if num is None:
        return {
            "applicable": False,
            "message": "T-test : non applicable ici (il faut une variable ÉCHELLE croisée à une variable à exactement 2 modalités).",
        }

    gg = pd.DataFrame({"v": num, "g": grp})
    gg = gg[(gg["g"] != MISSING_LABEL) & (gg["v"].notna())]
    groups = list(gg["g"].unique())[:2]
    a = gg[gg["g"] == groups[0]]["v"]
    b = gg[gg["g"] == groups[1]]["v"]
    if len(a) < 2 or len(b) < 2:
        return {"applicable": False, "message": "T-test : effectifs insuffisants (< 2) dans un groupe."}
    t, p = _scipy_stats().ttest_ind(a, b, equal_var=False)
    significatif = bool(p < 0.05)
    return {
        "applicable": True,
        "t": float(t),
        "p": float(p),
        "significatif": significatif,
        "variable": dataset.variable_label(num_name) or num_name,
        "groups": [
            {"nom": groups[0], "moyenne": float(a.mean()), "n": int(len(a))},
            {"nom": groups[1], "moyenne": float(b.mean()), "n": int(len(b))},
        ],
        "message": (
            f"t = {t:.3f} · p = {p:.4f} → différence "
            f"{'significative' if significatif else 'non significative'} au seuil de 5 %."
        ),
    }


def run_tests(
    dataset: SurveyDataset,
    r: str,
    c: str,
    specs: Optional[dict] = None,
    frame: Optional[pd.DataFrame] = None,
) -> dict:
    """Exécute le Khi² et (si applicable) le t-test de Welch sur `r` × `c`."""
    if specs is None:
        specs = infer_variable_specs(dataset)
    return {
        "chi_square": chi_square(dataset, r, c, frame=frame),
        "welch_ttest": welch_ttest(dataset, r, c, specs=specs, frame=frame),
    }
