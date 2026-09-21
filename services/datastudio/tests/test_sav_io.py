"""Tests du chargement multi-format (read_tabular / load_dataset)."""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine.sav_io import (
    TABULAR_EXTENSIONS,
    _detect_header_row,
    list_sheets,
    load_dataset,
    read_tabular,
)


def test_csv(tmp_path):
    p = tmp_path / "enquete.csv"
    p.write_text("sexe,age\nHomme,30\nFemme,25\n", encoding="utf-8")
    ds = read_tabular(str(p))
    assert list(ds.frame.columns) == ["sexe", "age"]
    assert len(ds.frame) == 2


def test_tab(tmp_path):
    p = tmp_path / "kobo.tab"
    p.write_text("q1\tq2\nA\tB\n", encoding="utf-8")
    ds = read_tabular(str(p))
    assert list(ds.frame.columns) == ["q1", "q2"]


def test_json(tmp_path):
    p = tmp_path / "data.json"
    p.write_text('[{"a":1,"b":2},{"a":3,"b":4}]', encoding="utf-8")
    ds = read_tabular(str(p))
    assert len(ds.frame) == 2


def test_pbix_rejete_avec_message(tmp_path):
    p = tmp_path / "rapport.pbix"
    p.write_bytes(b"PK\x03\x04binaire")
    with pytest.raises(ValueError, match="Power BI"):
        read_tabular(str(p))


def test_doc_rejete_avec_message(tmp_path):
    p = tmp_path / "vieux.doc"
    p.write_bytes(b"\xd0\xcf\x11\xe0")
    with pytest.raises(ValueError, match=r"\.docx"):
        read_tabular(str(p))


def test_format_inconnu(tmp_path):
    p = tmp_path / "truc.zip"
    p.write_bytes(b"PK")
    with pytest.raises(ValueError, match="Format non pris en charge"):
        read_tabular(str(p))


def test_extensions_documentees():
    for ext in (".xlsx", ".xls", ".ods", ".csv", ".tsv", ".tab", ".json", ".docx"):
        assert ext in TABULAR_EXTENSIONS


def test_docx_table(tmp_path):
    docx = pytest.importorskip("docx")
    doc = docx.Document()
    table = doc.add_table(rows=3, cols=2)
    data = [["sexe", "note"], ["Homme", "12"], ["Femme", "15"]]
    for r, row in enumerate(data):
        for c, val in enumerate(row):
            table.rows[r].cells[c].text = val
    p = tmp_path / "enquete.docx"
    doc.save(str(p))
    ds = load_dataset(str(p))
    assert list(ds.frame.columns) == ["sexe", "note"]
    assert len(ds.frame) == 2


def test_xlsx(tmp_path):
    pytest.importorskip("openpyxl")
    p = tmp_path / "kobo.xlsx"
    pd.DataFrame({"q1": [1, 2], "q2": ["a", "b"]}).to_excel(p, index=False)
    ds = read_tabular(str(p))
    assert list(ds.frame.columns) == ["q1", "q2"]
    assert len(ds.frame) == 2


# --- v4.9 : préparation de la base brute (multi-feuilles + en-tête auto) ------


def _classeur_multi(path):
    """Écrit un classeur 2 feuilles ; la 1re a un préambule Kobo avant l'en-tête."""
    openpyxl = pytest.importorskip("openpyxl")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Réponses"
    ws.append(["Export Kobo — projet 14"])  # préambule (1 cellule)
    ws.append([])  # ligne vide
    ws.append(["Sexe", "Âge", "Statut", "Domaine"])  # en-tête réel (ligne 2)
    ws.append(["Homme", 30, "Actif", "Couture"])
    ws.append(["Femme", 25, "Actif", "Élevage"])
    autre = wb.create_sheet("Métadonnées")
    autre.append(["clé", "valeur"])
    autre.append(["version", "4.9"])
    wb.save(str(path))


def test_list_sheets(tmp_path):
    p = tmp_path / "classeur.xlsx"
    _classeur_multi(p)
    assert list_sheets(str(p)) == ["Réponses", "Métadonnées"]


def test_list_sheets_non_classeur(tmp_path):
    p = tmp_path / "enquete.csv"
    p.write_text("a,b\n1,2\n", encoding="utf-8")
    assert list_sheets(str(p)) == []


def test_xlsx_entete_auto_ignore_preambule(tmp_path):
    """La 1re feuille : l'en-tête réel (ligne 2) est détecté, préambule ignoré."""
    p = tmp_path / "classeur.xlsx"
    _classeur_multi(p)
    ds = read_tabular(str(p))
    assert list(ds.frame.columns) == ["Sexe", "Âge", "Statut", "Domaine"]
    assert len(ds.frame) == 2
    assert ds.name == "Réponses"


def test_xlsx_choix_feuille(tmp_path):
    p = tmp_path / "classeur.xlsx"
    _classeur_multi(p)
    ds = read_tabular(str(p), sheet="Métadonnées")
    assert list(ds.frame.columns) == ["clé", "valeur"]
    assert ds.name == "Métadonnées"


def test_header_row_explicite(tmp_path):
    """header_row explicite force la ligne d'en-tête (0-indexée)."""
    p = tmp_path / "classeur.xlsx"
    _classeur_multi(p)
    ds = read_tabular(str(p), header_row=0)
    # Ligne 0 = préambule à cellule unique → 1re colonne nommée, reste Colonne_k.
    assert ds.frame.columns[0] == "Export Kobo — projet 14"


def test_detect_header_row_prend_ligne_remplie():
    raw = pd.DataFrame(
        [
            ["Titre", None, None, None],
            [None, None, None, None],
            ["a", "b", "c", "d"],
            ["1", "2", "3", "4"],
        ]
    )
    assert _detect_header_row(raw) == 2


def test_csv_entete_auto_ignore_preambule(tmp_path):
    p = tmp_path / "kobo.csv"
    p.write_text(
        "Rapport CSPro\n,,,\nnom,sexe,age,statut\nAli,H,30,Actif\nBia,F,25,Actif\n",
        encoding="utf-8",
    )
    ds = read_tabular(str(p))
    assert list(ds.frame.columns) == ["nom", "sexe", "age", "statut"]
    assert len(ds.frame) == 2
