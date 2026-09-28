"""Analyseur autonome de CMR (Cadre de Mesure du Rendement).

Ce moteur lit un classeur CMR structuré — un onglet par projet, en-têtes sur
trois lignes (Réf. | Indicateur | Unité | Référence | [Année n : Cible/Réalisé/%]
× N | Cible Total | Total réalisé | %) et hiérarchie GAR dans la colonne « Réf. »
(OG → E → P → I) — puis produit :

  * un AUDIT par projet (anomalies statistiques, contrôle des calculs, cohérence
    GAR, réalisme des cibles, qualité des données) avec scores de fiabilité et de
    cohérence ;
  * une RÉVISION tracée (valeur originale / corrigée / type / justification /
    confiance), n'appliquant d'office que l'arithmétique (les ré-estimations sont
    seulement PROPOSÉES, jamais silencieusement appliquées) ;
  * une CONSOLIDATION GLOBALE du portefeuille (KPI agrégés, classement des
    projets, matrice projets × résultats).

Le parseur est piloté par le TEXTE des en-têtes (jamais par des indices de
colonnes en dur) : les blocs annuels ne sont pas aux mêmes positions d'un onglet
à l'autre. Aucune dépendance hors pandas.
"""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Optional

import pandas as pd

# --------------------------------------------------------------------------- #
# Normalisation & parsing numérique
# --------------------------------------------------------------------------- #

# Valeurs signifiant « pas de donnée » (au-delà de NaN) rencontrées dans les CMR.
_VIDES = {"", "-", "–", "—", "nd", "n/d", "na", "n/a", "s/o", "so", "sans objet"}


def _norm(txt: Any) -> str:
    """Minuscule, sans accents ni espaces superflus (comparaison d'en-têtes)."""
    s = str(txt or "").strip().lower()
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s)


def _est_vide(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, float) and math.isnan(v):
        return True
    return _norm(v) in _VIDES


def parse_nombre(v: Any) -> Optional[float]:
    """Convertit une cellule CMR en nombre, ou None.

    Tolère : décimale à la virgule (« 83,0 »), séparateurs de milliers en espace
    (« 1 585 » / « 1 585,7 »), suffixe « % », espaces insécables. « - » → None.
    """
    if _est_vide(v):
        return None
    if isinstance(v, (int, float)):
        return None if (isinstance(v, float) and math.isnan(v)) else float(v)
    s = str(v).strip().replace(" ", " ").replace(" ", " ")
    s = s.replace("%", "").strip()
    # Retire les espaces de milliers, puis virgule décimale -> point.
    s = s.replace(" ", "")
    if s.count(",") == 1 and s.count(".") == 0:
        s = s.replace(",", ".")
    else:
        s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def _arrondi(x: Optional[float], n: int = 1) -> Optional[float]:
    if x is None:
        return None
    r = round(float(x), n)
    return int(r) if r == int(r) else r


# --------------------------------------------------------------------------- #
# Modèle
# --------------------------------------------------------------------------- #


@dataclass
class AnneeCMR:
    label: str
    cible: Optional[float] = None
    realise: Optional[float] = None
    pct: Optional[float] = None          # % tel que saisi
    pct_calc: Optional[float] = None     # % recalculé (Réalisé / Cible)


@dataclass
class IndicateurCMR:
    ref: str
    libelle: str
    unite: str = ""
    reference: Optional[float] = None    # valeur de référence (baseline)
    annees: list[AnneeCMR] = field(default_factory=list)
    cible_total: Optional[float] = None
    total_realise: Optional[float] = None
    pct_total: Optional[float] = None
    pct_total_calc: Optional[float] = None
    objectif: str = ""
    effet: str = ""
    produit: str = ""
    anomalies: list[dict] = field(default_factory=list)
    corrections: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "ref": self.ref,
            "libelle": self.libelle,
            "unite": self.unite,
            "reference": self.reference,
            "objectif": self.objectif,
            "effet": self.effet,
            "produit": self.produit,
            "annees": [
                {
                    "label": a.label,
                    "cible": a.cible,
                    "realise": a.realise,
                    "pct": _arrondi(a.pct),
                    "pct_calc": _arrondi(a.pct_calc),
                }
                for a in self.annees
            ],
            "cible_total": self.cible_total,
            "total_realise": self.total_realise,
            "pct_total": _arrondi(self.pct_total),
            "pct_total_calc": _arrondi(self.pct_total_calc),
            "anomalies": self.anomalies,
            "corrections": self.corrections,
        }


@dataclass
class ProjetCMR:
    code: str
    nom: str
    sheet: str
    n_annees: int
    indicateurs: list[IndicateurCMR] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# Parsing du classeur
# --------------------------------------------------------------------------- #

_RE_OG = re.compile(r"^\s*OG\b|^\s*OG\.?\d", re.IGNORECASE)
_RE_EFFET = re.compile(r"^\s*E\.?\d", re.IGNORECASE)
_RE_PRODUIT = re.compile(r"^\s*P\.?\d", re.IGNORECASE)
_RE_INDIC = re.compile(r"^\s*I\.?\d", re.IGNORECASE)


def _classer_ref(ref: str) -> Optional[str]:
    """Type de ligne d'après le préfixe de la colonne « Réf. »."""
    r = str(ref or "").strip()
    if not r:
        return None
    if _RE_OG.match(r):
        return "objectif"
    if _RE_INDIC.match(r):
        return "indicateur"
    if _RE_EFFET.match(r):
        return "effet"
    if _RE_PRODUIT.match(r):
        return "produit"
    return None


def _trouver_ligne_entete(df: pd.DataFrame) -> int:
    """Indice de la ligne d'en-tête principale (celle contenant « Réf. »)."""
    for r in range(min(8, df.shape[0])):
        for c in range(min(4, df.shape[1])):
            if _norm(df.iat[r, c]).startswith("ref"):
                return r
    return 0


@dataclass
class _Schema:
    col_ref: int
    col_libelle: int
    col_unite: Optional[int]
    col_reference: Optional[int]
    col_cible_total: Optional[int]
    col_total_realise: Optional[int]
    col_pct_total: Optional[int]
    # Blocs annuels : (label, col_cible, col_realise, col_pct|None)
    annees: list[tuple[str, int, int, Optional[int]]]
    header_row: int


def _detecter_schema(df: pd.DataFrame) -> Optional[_Schema]:
    """Localise les colonnes à partir des trois lignes d'en-tête (texte)."""
    h0 = _trouver_ligne_entete(df)
    r0 = [_norm(df.iat[h0, c]) if c < df.shape[1] else "" for c in range(df.shape[1])]
    r1 = [_norm(df.iat[h0 + 1, c]) if h0 + 1 < df.shape[0] and c < df.shape[1] else "" for c in range(df.shape[1])]
    r2 = [_norm(df.iat[h0 + 2, c]) if h0 + 2 < df.shape[0] and c < df.shape[1] else "" for c in range(df.shape[1])]

    def _find(row: list[str], *needles: str) -> Optional[int]:
        for i, txt in enumerate(row):
            if txt and all(n in txt for n in needles):
                return i
        return None

    col_ref = _find(r0, "ref") or 0
    col_libelle = _find(r0, "indicateur")
    if col_libelle is None:
        col_libelle = col_ref + 1
    col_unite = _find(r0, "unite")
    col_reference = _find(r0, "reference")
    col_cible_total = _find(r0, "cible", "total")
    col_total_realise = _find(r0, "total", "realise")

    # Blocs annuels : chaque « cible » de la 3e ligne démarre un triplet.
    annees: list[tuple[str, int, int, Optional[int]]] = []
    borne = col_cible_total if col_cible_total is not None else df.shape[1]
    for c in range(col_reference + 1 if col_reference is not None else 0, borne):
        if r2[c] == "cible":
            col_c = c
            col_r = c + 1 if c + 1 < df.shape[1] and r2[c + 1] == "realise" else None
            if col_r is None:
                continue
            col_p = c + 2 if c + 2 < df.shape[1] and r2[c + 2].startswith("%") else None
            # Libellé d'année : cellule non vide la plus proche à gauche en r1.
            label = ""
            for k in range(c, -1, -1):
                if r1[k]:
                    label = df.iat[h0 + 1, k]
                    break
            annees.append((_label_annee(label, len(annees) + 1), col_c, col_r, col_p))

    # % total : le « % » de la 1re ligne situé après « Total réalisé ».
    col_pct_total = None
    if col_total_realise is not None:
        for c in range(col_total_realise + 1, df.shape[1]):
            if r0[c].startswith("%") or r0[c] == "%":
                col_pct_total = c
                break
        if col_pct_total is None and col_total_realise + 1 < df.shape[1]:
            col_pct_total = col_total_realise + 1

    if not annees and col_cible_total is None:
        return None
    return _Schema(
        col_ref=col_ref,
        col_libelle=col_libelle,
        col_unite=col_unite,
        col_reference=col_reference,
        col_cible_total=col_cible_total,
        col_total_realise=col_total_realise,
        col_pct_total=col_pct_total,
        annees=annees,
        header_row=h0,
    )


def _label_annee(brut: Any, rang: int) -> str:
    """Normalise « 1 e Année » → « Année 1 » ; défaut « Année <rang> »."""
    s = _norm(brut)
    m = re.search(r"(\d+)", s)
    if m:
        return f"Année {m.group(1)}"
    return f"Année {rang}"


def _nom_projet(sheet: str) -> tuple[str, str]:
    """« Pj3_IFADEM » → (« Pj3 », « IFADEM ») ; robuste aux variantes."""
    s = str(sheet).strip()
    m = re.match(r"^\s*(P[a-z]*\d+[a-z]?)[_\s\-]*(.*)$", s, re.IGNORECASE)
    if m:
        code = m.group(1)
        nom = m.group(2).strip() or code
        return code, nom
    return s, s


def parser_onglet(df: pd.DataFrame, sheet: str) -> Optional[ProjetCMR]:
    """Construit un ProjetCMR à partir d'une feuille brute (header=None)."""
    if df is None or df.shape[0] < 4:
        return None
    schema = _detecter_schema(df)
    if schema is None:
        return None
    code, nom = _nom_projet(sheet)
    projet = ProjetCMR(code=code, nom=nom, sheet=sheet, n_annees=len(schema.annees))

    objectif = effet = produit = ""
    start = schema.header_row + 3
    for r in range(start, df.shape[0]):
        ref = df.iat[r, schema.col_ref] if schema.col_ref < df.shape[1] else None
        typ = _classer_ref(ref)
        if typ is None:
            continue
        texte = str(ref).strip()
        if typ == "objectif":
            objectif = texte
            continue
        if typ == "effet":
            effet = texte
            continue
        if typ == "produit":
            produit = texte
            continue
        # Ligne indicateur
        def cell(col: Optional[int]) -> Any:
            return df.iat[r, col] if col is not None and col < df.shape[1] else None

        ind = IndicateurCMR(
            ref=texte,
            libelle=str(cell(schema.col_libelle) or "").strip(),
            unite=str(cell(schema.col_unite) or "").strip(),
            reference=parse_nombre(cell(schema.col_reference)),
            cible_total=parse_nombre(cell(schema.col_cible_total)),
            total_realise=parse_nombre(cell(schema.col_total_realise)),
            pct_total=parse_nombre(cell(schema.col_pct_total)),
            objectif=objectif,
            effet=effet,
            produit=produit,
        )
        for (label, cc, cr, cp) in schema.annees:
            ind.annees.append(
                AnneeCMR(
                    label=label,
                    cible=parse_nombre(cell(cc)),
                    realise=parse_nombre(cell(cr)),
                    pct=parse_nombre(cell(cp)),
                )
            )
        projet.indicateurs.append(ind)
    return projet


# --------------------------------------------------------------------------- #
# Recalcul & détection d'anomalies
# --------------------------------------------------------------------------- #

_TOL_PCT = 1.0          # écart toléré entre % saisi et % recalculé (points)
_SEUIL_SURVEILLER = 110  # % d'atteinte au-delà duquel on surveille
_SEUIL_DEPASSEMENT = 150  # dépassement anormal
_SEUIL_IMPOSSIBLE = 1000  # réalisation quasi impossible


def _pct(realise: Optional[float], cible: Optional[float]) -> Optional[float]:
    if realise is None or cible is None or cible == 0:
        return None
    return realise / cible * 100.0


def _sev(niveau: str) -> int:
    return {"Critique": 3, "Élevé": 2, "Moyen": 1, "Faible": 0}.get(niveau, 0)


def auditer_indicateur(ind: IndicateurCMR) -> None:
    """Recalcule les %, réconcilie les totaux et remplit ind.anomalies."""
    ano = ind.anomalies

    if ind.reference is None:
        ano.append(_a("Qualité", "Faible", ind.ref,
                      "Valeur de référence (baseline) absente."))

    realises = []
    for a in ind.annees:
        a.pct_calc = _pct(a.realise, a.cible)
        # Valeurs négatives inexpliquées
        for nom, val in (("cible", a.cible), ("réalisé", a.realise)):
            if val is not None and val < 0:
                ano.append(_a("Valeur négative", "Critique", ind.ref,
                              f"{a.label} : {nom} négatif ({val})."))
        # % saisi vs recalculé
        if a.pct is not None and a.pct_calc is not None and abs(a.pct - a.pct_calc) > _TOL_PCT:
            ano.append(_a("Calcul %", "Moyen", ind.ref,
                          f"{a.label} : % saisi {_arrondi(a.pct)} ≠ recalculé {_arrondi(a.pct_calc)}."))
        # % non calculé alors que calculable
        if a.pct is None and a.pct_calc is not None:
            ano.append(_a("Calcul %", "Faible", ind.ref,
                          f"{a.label} : % manquant, calculable ({_arrondi(a.pct_calc)})."))
        # Dépassements / réalisations impossibles
        p = a.pct_calc if a.pct_calc is not None else a.pct
        if p is not None:
            if p >= _SEUIL_IMPOSSIBLE:
                ano.append(_a("Réalisation impossible", "Critique", ind.ref,
                              f"{a.label} : taux d'atteinte {_arrondi(p)} % — vraisemblable erreur de saisie."))
            elif p >= _SEUIL_DEPASSEMENT:
                ano.append(_a("Dépassement anormal", "Élevé", ind.ref,
                              f"{a.label} : taux d'atteinte {_arrondi(p)} %."))
        # Réalisé sans cible
        if a.realise is not None and (a.cible is None or a.cible == 0):
            ano.append(_a("Cible manquante", "Moyen", ind.ref,
                          f"{a.label} : réalisé saisi sans cible — taux non calculable."))
        if a.realise is not None:
            realises.append(a.realise)

    # % total recalculé
    ind.pct_total_calc = _pct(ind.total_realise, ind.cible_total)
    if ind.pct_total is not None and ind.pct_total_calc is not None and abs(ind.pct_total - ind.pct_total_calc) > _TOL_PCT:
        ano.append(_a("Calcul %", "Moyen", ind.ref,
                      f"Total : % saisi {_arrondi(ind.pct_total)} ≠ recalculé {_arrondi(ind.pct_total_calc)}."))

    # Cumul : Total réalisé vs somme des réalisés annuels (indicateur de flux)
    if ind.total_realise is not None and len(realises) >= 2:
        somme = sum(realises)
        dernier = realises[-1]
        # Flux si ≈ somme ; stock si ≈ dernier. Sinon incohérence.
        if not _proche(ind.total_realise, somme) and not _proche(ind.total_realise, dernier):
            ano.append(_a("Cumul incohérent", "Moyen", ind.ref,
                          f"Total réalisé {ind.total_realise} ≠ somme des annuels ({_arrondi(somme)}) "
                          f"ni dernière valeur ({_arrondi(dernier)})."))


def _proche(a: float, b: float, tol: float = 0.02) -> bool:
    """Égalité relative (2 %) ou à ±1 unité (petits entiers)."""
    if a == b:
        return True
    if abs(a - b) <= 1:
        return True
    denom = max(abs(a), abs(b), 1.0)
    return abs(a - b) / denom <= tol


def _a(type_: str, severite: str, ref: str, message: str) -> dict:
    """Fabrique une anomalie, avec priorité/risque déduits de la sévérité."""
    return {
        "type": type_,
        "severite": severite,
        "ref": ref,
        "message": message,
        "risque": {"Critique": "🔴 Critique", "Élevé": "🔴 Critique",
                   "Moyen": "🟡 À surveiller", "Faible": "🟢 Conforme"}.get(severite, "🟢 Conforme"),
    }


# --------------------------------------------------------------------------- #
# Scores
# --------------------------------------------------------------------------- #


def _score_projet(projet: ProjetCMR) -> dict:
    """Scores /100 : qualité, cohérence arithmétique, cohérence GAR, réalisme."""
    inds = projet.indicateurs
    n = len(inds)
    if n == 0:
        return {"fiabilite": 0, "qualite_donnees": 0, "coherence_arith": 0,
                "coherence_gar": 0, "realisme_cibles": 0}

    # Qualité des données : cellules attendues renseignées.
    attendu = rempli = 0
    for ind in inds:
        champs = [ind.libelle, ind.unite, ind.reference]
        for a in ind.annees:
            champs.extend([a.cible, a.realise])
        for v in champs:
            attendu += 1
            if not _est_vide(v):
                rempli += 1
    qualite = (rempli / attendu * 100) if attendu else 0

    # Cohérence arithmétique : indicateurs sans anomalie de calcul/valeur.
    types_arith = {"Calcul %", "Cumul incohérent", "Valeur négative", "Réalisation impossible"}
    ok_arith = sum(1 for ind in inds if not any(x["type"] in types_arith for x in ind.anomalies))
    coherence_arith = ok_arith / n * 100

    # Cohérence GAR : indicateur rattaché à une chaîne Effet → Produit complète.
    ok_gar = sum(1 for ind in inds if ind.effet and ind.produit)
    coherence_gar = ok_gar / n * 100

    # Réalisme des cibles : proportion de mesures dont le taux reste plausible.
    mesures = plausibles = 0
    for ind in inds:
        for a in ind.annees:
            p = a.pct_calc if a.pct_calc is not None else a.pct
            if p is None:
                continue
            mesures += 1
            if 25 <= p <= _SEUIL_DEPASSEMENT:
                plausibles += 1
    realisme = (plausibles / mesures * 100) if mesures else 100

    fiabilite = round(
        qualite * 0.40 + coherence_arith * 0.30 + coherence_gar * 0.20 + realisme * 0.10
    )
    return {
        "fiabilite": int(fiabilite),
        "qualite_donnees": round(qualite),
        "coherence_arith": round(coherence_arith),
        "coherence_gar": round(coherence_gar),
        "realisme_cibles": round(realisme),
    }


def _mention_qualite(score: int) -> str:
    if score >= 85:
        return "Excellente"
    if score >= 70:
        return "Bonne avec réserves"
    if score >= 50:
        return "Moyenne — à consolider"
    return "Faible — fiabilité limitée"


# --------------------------------------------------------------------------- #
# Révision tracée (arithmétique appliquée ; ré-estimations proposées)
# --------------------------------------------------------------------------- #


def reviser_indicateur(ind: IndicateurCMR) -> dict:
    """Statut + corrections tracées. N'applique QUE l'arithmétique."""
    corrections = ind.corrections
    statut = "Conforme"

    for a in ind.annees:
        if a.pct_calc is not None and (a.pct is None or abs((a.pct or 0) - a.pct_calc) > _TOL_PCT):
            corrections.append({
                "champ": f"{a.label} · %",
                "valeur_originale": _arrondi(a.pct) if a.pct is not None else "—",
                "valeur_corrigee": _arrondi(a.pct_calc),
                "type": "Recalcul arithmétique",
                "justification": "Pourcentage recalculé automatiquement (Réalisé / Cible × 100).",
                "confiance": "Élevée",
                "applique": True,
            })
            statut = "Corrigé"

    if ind.pct_total_calc is not None and (
        ind.pct_total is None or abs((ind.pct_total or 0) - ind.pct_total_calc) > _TOL_PCT
    ):
        corrections.append({
            "champ": "Total · %",
            "valeur_originale": _arrondi(ind.pct_total) if ind.pct_total is not None else "—",
            "valeur_corrigee": _arrondi(ind.pct_total_calc),
            "type": "Recalcul arithmétique",
            "justification": "Taux d'atteinte total recalculé (Total réalisé / Cible Total × 100).",
            "confiance": "Élevée",
            "applique": True,
        })
        statut = "Corrigé"

    # Éléments nécessitant une validation humaine (proposés, non appliqués).
    for x in ind.anomalies:
        if x["type"] in ("Réalisation impossible", "Dépassement anormal"):
            statut = "Critique" if x["severite"] == "Critique" else (statut if statut == "Corrigé" else "À vérifier")
            corrections.append({
                "champ": "Réalisé",
                "valeur_originale": "voir donnée",
                "valeur_corrigee": "— (à valider)",
                "type": "Vérification requise",
                "justification": x["message"] + " Cible sous-estimée ou erreur de saisie : à confirmer par la source.",
                "confiance": "Faible",
                "applique": False,
            })
        elif x["type"] == "Cible manquante":
            statut = statut if statut in ("Corrigé", "Critique") else "À vérifier"
        elif x["type"] == "Cumul incohérent":
            statut = statut if statut in ("Critique",) else "À vérifier"

    return {"statut": statut}


# --------------------------------------------------------------------------- #
# Point d'entrée
# --------------------------------------------------------------------------- #


def analyser_cmr(sheets: dict[str, pd.DataFrame]) -> dict:
    """Analyse complète d'un classeur CMR (dict feuille -> DataFrame header=None).

    Renvoie un dictionnaire JSON-able : un bloc par projet (audit + révision) et
    un bloc « global » de consolidation du portefeuille.
    """
    projets_out: list[dict] = []
    ignores: list[str] = []

    for sheet, df in sheets.items():
        projet = parser_onglet(df, sheet)
        if projet is None or not projet.indicateurs:
            ignores.append(sheet)
            continue

        for ind in projet.indicateurs:
            auditer_indicateur(ind)
            rev = reviser_indicateur(ind)
            ind_dict = ind.to_dict()
            ind_dict["statut"] = rev["statut"]
            ind._statut = rev["statut"]  # type: ignore[attr-defined]

        scores = _score_projet(projet)
        anomalies = [x for ind in projet.indicateurs for x in ind.anomalies]
        anomalies_tri = sorted(anomalies, key=lambda x: -_sev(x["severite"]))
        statuts = _compter_statuts(projet.indicateurs)

        projets_out.append({
            "code": projet.code,
            "nom": projet.nom,
            "sheet": projet.sheet,
            "n_annees": projet.n_annees,
            "n_indicateurs": len(projet.indicateurs),
            "scores": scores,
            "mention_qualite": _mention_qualite(scores["qualite_donnees"]),
            "n_anomalies": len(anomalies),
            "anomalies": anomalies_tri,
            "statuts": statuts,
            "taux_atteinte_moyen": _taux_moyen(projet.indicateurs),
            "indicateurs": [ind.to_dict() | {"statut": getattr(ind, "_statut", "Conforme")}
                            for ind in projet.indicateurs],
        })

    global_ = _consolider(projets_out)
    return {
        "n_projets": len(projets_out),
        "n_indicateurs": sum(p["n_indicateurs"] for p in projets_out),
        "n_anomalies": sum(p["n_anomalies"] for p in projets_out),
        "onglets_ignores": ignores,
        "projets": projets_out,
        "global": global_,
        "version": CMR_VERSION,
    }


def _compter_statuts(inds: list[IndicateurCMR]) -> dict:
    out = {"Conforme": 0, "Corrigé": 0, "À vérifier": 0, "Critique": 0}
    for ind in inds:
        out[getattr(ind, "_statut", "Conforme")] = out.get(getattr(ind, "_statut", "Conforme"), 0) + 1
    return out


def _mediane(vals: list[float]) -> Optional[float]:
    xs = sorted(v for v in vals if v is not None)
    if not xs:
        return None
    m = len(xs) // 2
    return xs[m] if len(xs) % 2 else (xs[m - 1] + xs[m]) / 2


def _taux_moyen(inds: list[IndicateurCMR]) -> Optional[float]:
    """Taux d'atteinte total MÉDIAN (robuste aux dépassements extrêmes)."""
    vals = [ind.pct_total_calc for ind in inds if ind.pct_total_calc is not None]
    return _arrondi(_mediane(vals))


def _consolider(projets: list[dict]) -> dict:
    """Tableau de bord Global : KPI agrégés, classements, matrice."""
    if not projets:
        return {"kpi": {}, "classement": [], "repartition_risques": {}, "repartition_statuts": {}}

    n_ind = sum(p["n_indicateurs"] for p in projets)
    n_ano = sum(p["n_anomalies"] for p in projets)
    fiab = round(sum(p["scores"]["fiabilite"] for p in projets) / len(projets))
    coher = round(sum(p["scores"]["coherence_gar"] for p in projets) / len(projets))
    qual = round(sum(p["scores"]["qualite_donnees"] for p in projets) / len(projets))
    taux = [p["taux_atteinte_moyen"] for p in projets if p["taux_atteinte_moyen"] is not None]
    taux_global = _arrondi(_mediane(taux))

    statuts = {"Conforme": 0, "Corrigé": 0, "À vérifier": 0, "Critique": 0}
    risques = {"🔴 Critique": 0, "🟡 À surveiller": 0, "🟢 Conforme": 0}
    for p in projets:
        for k, v in p["statuts"].items():
            statuts[k] = statuts.get(k, 0) + v
        for a in p["anomalies"]:
            risques[a["risque"]] = risques.get(a["risque"], 0) + 1

    classement = sorted(
        (
            {
                "code": p["code"],
                "nom": p["nom"],
                "fiabilite": p["scores"]["fiabilite"],
                "taux_atteinte_moyen": p["taux_atteinte_moyen"],
                "n_anomalies": p["n_anomalies"],
                "n_critiques": p["statuts"].get("Critique", 0),
                "feu": _feu(p["scores"]["fiabilite"], p["statuts"].get("Critique", 0)),
            }
            for p in projets
        ),
        key=lambda x: (-x["fiabilite"], x["n_anomalies"]),
    )

    return {
        "kpi": {
            "n_projets": len(projets),
            "n_indicateurs": n_ind,
            "n_anomalies": n_ano,
            "taux_atteinte_global": taux_global,
            "score_fiabilite": fiab,
            "score_coherence": coher,
            "score_qualite": qual,
        },
        "repartition_statuts": statuts,
        "repartition_risques": risques,
        "classement": classement,
        "messages_cles": _messages_cles(projets, classement, statuts),
    }


def _messages_cles(projets: list[dict], classement: list[dict], statuts: dict) -> dict:
    """Forces / faiblesses / recommandations (déterministe, fondé sur les données)."""
    forces: list[str] = []
    faiblesses: list[str] = []
    recommandations: list[str] = []

    # Forces : meilleurs projets, complétude, cohérence GAR.
    for row in classement[:3]:
        if row["fiabilite"] >= 75 and row["n_critiques"] == 0:
            forces.append(
                f"{row['code']} · {row['nom']} : fiabilité {row['fiabilite']}/100, aucun indicateur critique."
            )
    bonne_qualite = [p for p in projets if p["scores"]["qualite_donnees"] >= 85]
    if bonne_qualite:
        forces.append(f"{len(bonne_qualite)} projet(s) à données quasi complètes (qualité ≥ 85/100).")
    bonne_gar = [p for p in projets if p["scores"]["coherence_gar"] >= 90]
    if bonne_gar:
        forces.append(f"Chaîne de résultats GAR bien structurée sur {len(bonne_gar)} projet(s) (Effet → Produit → Indicateur).")

    # Faiblesses : projets critiques, dépassements, données manquantes.
    for row in classement[::-1][:3]:
        if row["n_critiques"] > 0 or row["fiabilite"] < 50:
            faiblesses.append(
                f"{row['code']} · {row['nom']} : {row['n_critiques']} indicateur(s) critique(s), fiabilité {row['fiabilite']}/100."
            )
    types = {}
    for p in projets:
        for a in p["anomalies"]:
            types[a["type"]] = types.get(a["type"], 0) + 1
    if types.get("Réalisation impossible"):
        faiblesses.append(f"{types['Réalisation impossible']} valeur(s) de réalisation invraisemblable(s) (taux extrêmes) — erreurs de saisie probables.")
    if types.get("Cible manquante"):
        faiblesses.append(f"{types['Cible manquante']} indicateur(s) sans cible : taux d'atteinte non calculable.")
    if statuts.get("À vérifier"):
        faiblesses.append(f"{statuts['À vérifier']} indicateur(s) nécessitent une validation humaine.")

    # Recommandations : priorisées d'après les anomalies dominantes.
    if types.get("Réalisation impossible") or types.get("Dépassement anormal"):
        recommandations.append("Vérifier auprès des sources les cibles largement dépassées : cible sous-estimée ou erreur d'unité/saisie.")
    if types.get("Calcul %"):
        recommandations.append("Adopter les taux d'atteinte recalculés (colonne corrigée) : plusieurs pourcentages saisis sont erronés.")
    if types.get("Cible manquante") or types.get("Qualité"):
        recommandations.append("Compléter les cibles et valeurs de référence manquantes pour fiabiliser le suivi.")
    if types.get("Cumul incohérent"):
        recommandations.append("Clarifier la nature (flux vs stock) des indicateurs dont le total ne réconcilie pas avec les valeurs annuelles.")
    recommandations.append("Prioriser le traitement des projets en bas de classement (feu 🔴) avant la consolidation du reporting.")

    return {
        "forces": forces[:5],
        "faiblesses": faiblesses[:5],
        "recommandations": recommandations[:5],
    }


def _feu(fiabilite: int, n_critiques: int) -> str:
    if n_critiques > 0 or fiabilite < 50:
        return "🔴"
    if fiabilite < 75:
        return "🟡"
    return "🟢"


CMR_VERSION = "1.0.0"

__all__ = [
    "analyser_cmr",
    "parser_onglet",
    "auditer_indicateur",
    "reviser_indicateur",
    "parse_nombre",
    "IndicateurCMR",
    "ProjetCMR",
    "AnneeCMR",
    "CMR_VERSION",
]
