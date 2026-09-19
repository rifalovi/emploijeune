"""Tests du chargement multi-format (read_tabular / load_dataset)."""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine.sav_io import TABULAR_EXTENSIONS, load_dataset, read_tabular


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
