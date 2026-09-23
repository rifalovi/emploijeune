"""Consolidation d'enquêtes multilingues.

Certains questionnaires sont DUPLIQUÉS par langue avant administration : quand le
répondant choisit sa langue, il ne remplit que le bloc de colonnes de SA langue
(ex. `act_rsx_kh` pour le khmer, `email_viet` pour le vietnamien), les autres
blocs restant vides. Résultat : une même question apparaît en 2-4 variables
différentes, et chaque ligne comporte de longues séries de valeurs vides « par
construction » (le « saut » de langue) — ce qui fait échouer le nettoyage.

Ce module détecte les variantes de langue d'une même question et les FUSIONNE en
une seule variable (valeur non vide de la langue du répondant), pour obtenir un
questionnaire unique, avec réponses des 4 langues empilées par variable.
"""

from __future__ import annotations

import difflib
import re
from typing import Optional

import pandas as pd

from .dataset import SurveyDataset

# Suffixes de langue reconnus (du plus long au plus court, pour ne pas confondre
# « _fr » avec la fin d'un vrai mot). On ne coupe qu'après un « _ ».
LANG_SUFFIXES = [
    "khmer",
    "francais",
    "portugais",
    "espagnol",
    "anglais",
    "arabe",
    "viet",
    "khm",
    "por",
    "fra",
    "ang",
    "esp",
    "eng",
    "ara",
    "kh",
    "vi",
    "vn",
    "fr",
    "pt",
    "en",
    "es",
    "ar",
]


def _strip_lang(name: str) -> tuple[str, Optional[str]]:
    """Retire un suffixe de langue (`nom_kh` -> (`nom`, `kh`)) ; sinon (name, None)."""
    low = name.lower()
    for suf in LANG_SUFFIXES:
        if low.endswith("_" + suf):
            return name[: -(len(suf) + 1)], suf
    return name, None


def _norm_label(s: object) -> str:
    """Normalise un libellé pour comparaison : minuscules, sans parenthèses ni
    ponctuation (« Sexe du bénéficiaire (vietnamien) » ~ « sexe du beneficiaire »)."""
    t = re.sub(r"\(.*?\)", " ", str(s or ""))
    t = t.lower()
    t = re.sub(r"[^a-z0-9À-ɏ]+", " ", t)
    return t.strip()


def detecter_groupes(ds: SurveyDataset, min_similar: float = 0.82) -> tuple[list[dict], list[dict]]:
    """Détecte les groupes de colonnes variantes d'une même question.

    Rattachement d'une variante `x_kh` à sa base :
      1. par NOM (exact, puis insensible à la casse) : si `x` existe.
      2. sinon par LIBELLÉ : la colonne (non-variante) dont l'étiquette de variable
         est la plus proche (≥ `min_similar`). Peu fiable entre langues (le libellé
         de la variante est dans SA langue) — d'où l'étape de validation manuelle.
    Renvoie (plan, orphelins) où `plan` = [{canonical, label, members, variants}]
    et `orphelins` = [{variant, suggestion}] (variantes non rattachées + meilleure
    base proposée par similarité de NOM, à confirmer par l'utilisateur)."""
    cols = [str(c) for c in ds.frame.columns]
    colset = set(cols)
    ci_map = {c.lower(): c for c in cols}  # rattachement insensible à la casse
    var_labels = {str(k): str(v) for k, v in (ds.variable_labels or {}).items()}
    bases_non_variant = [c for c in cols if _strip_lang(c)[1] is None]

    rattachement: dict[str, Optional[str]] = {}
    for c in cols:
        base, suf = _strip_lang(c)
        if suf is None:
            continue
        # 1) nom exact, puis insensible à la casse
        if base in colset and base != c:
            rattachement[c] = base
            continue
        if base.lower() in ci_map and ci_map[base.lower()] != c:
            rattachement[c] = ci_map[base.lower()]
            continue
        # 2) libellé (fiable seulement en intra-langue)
        lab = _norm_label(var_labels.get(c, c))
        meilleur, score = None, 0.0
        for cand in bases_non_variant:
            if cand == c:
                continue
            cl = _norm_label(var_labels.get(cand, cand))
            if not lab or not cl:
                continue
            r = difflib.SequenceMatcher(None, lab, cl).ratio()
            if r > score:
                meilleur, score = cand, r
        rattachement[c] = meilleur if (meilleur and score >= min_similar) else None

    groupes: dict[str, list[str]] = {}
    for variante, base in rattachement.items():
        if base is None:
            continue
        groupes.setdefault(base, []).append(variante)

    plan: list[dict] = []
    for base, variantes in groupes.items():
        plan.append(
            {
                "canonical": base,
                "label": var_labels.get(base, base),
                "members": [base] + sorted(variantes),
                "variants": sorted(variantes),
            }
        )
    plan.sort(key=lambda g: g["canonical"])

    # Orphelins : variantes non rattachées + meilleure base suggérée par NOM
    # (les libellés étant dans des langues différentes, on compare les noms).
    orphelins: list[dict] = []
    for v, b in sorted(rattachement.items()):
        if b is not None:
            continue
        racine = _strip_lang(v)[0].lower()
        meilleur, score = None, 0.0
        for cand in bases_non_variant:
            r = difflib.SequenceMatcher(None, racine, cand.lower()).ratio()
            if r > score:
                meilleur, score = cand, r
        orphelins.append({"variant": v, "suggestion": meilleur if score >= 0.5 else None})
    return plan, orphelins


def consolider(ds: SurveyDataset, groupes: list[dict]) -> SurveyDataset:
    """Fusionne chaque groupe en UNE colonne (1re valeur non vide de la ligne),
    conserve les libellés de la base (français) et supprime les variantes."""
    frame = ds.frame.copy()
    var_labels = dict(ds.variable_labels or {})
    val_labels = {k: dict(v) for k, v in (ds.value_labels or {}).items()}
    var_measure = dict(ds.variable_measure or {})
    a_supprimer: list[str] = []

    for g in groupes:
        canon = str(g.get("canonical") or "")
        membres = [str(m) for m in (g.get("members") or []) if str(m) in frame.columns]
        if canon not in frame.columns or len(membres) < 2:
            continue
        # 1re valeur non vide de gauche à droite (canon d'abord) — vectorisé.
        sous = frame[membres].replace("", pd.NA)
        frame[canon] = sous.bfill(axis=1).iloc[:, 0]
        # Libellés de valeurs : union, la base (français) est prioritaire.
        fusion: dict = {}
        for m in reversed(membres):
            for code, lab in (val_labels.get(m) or {}).items():
                fusion[code] = lab
        for code, lab in (val_labels.get(canon) or {}).items():
            fusion[code] = lab
        if fusion:
            val_labels[canon] = fusion
        a_supprimer += [m for m in membres if m != canon]

    frame = frame.drop(columns=[c for c in a_supprimer if c in frame.columns])
    for c in a_supprimer:
        var_labels.pop(c, None)
        val_labels.pop(c, None)
        var_measure.pop(c, None)

    return SurveyDataset(
        frame=frame,
        variable_labels=var_labels,
        value_labels=val_labels,
        variable_measure=var_measure,
        name=f"{ds.name} (consolidé)",
    )
