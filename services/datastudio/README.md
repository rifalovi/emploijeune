# SCS DataStudio — moteur d'analyse en ligne

Cœur de traitement de **SCS DataStudio** extrait de l'application desktop V4.8,
sans dépendance à Tkinter, en vue de son intégration en ligne dans la plateforme
Emploi Jeune (scénario B : moteur Python appelé par le front Next.js).

DataStudio reste **fonctionnellement autonome** : il ne remplace aucun module de
la plateforme. Il absorbe les données du module Enquête (dont la capacité de
traitement est limitée), les traite (épuration, tris à plat, croisements,
multi-réponses, tests), et réinjecte les résultats. La version en ligne
conservera l'historique des traitements dans Supabase et pourra générer des
rapports structurés via l'API Claude.

## État d'avancement

**Étape 1 — moteur de calcul (ce dossier).** Extraction terminée et testée.
Les calculs sont portés à l'identique du desktop V4.8 pour garantir des
résultats strictement identiques entre le bureau et l'en ligne.

Étapes suivantes (voir la trajectoire dans la discussion projet) : couche
FastAPI / fonctions Vercel Python (Fluid Compute) + auth JWT Supabase ;
migration Supabase de l'historique ; module UI `atelier-analyse` ; pont Enquête ↔
DataStudio ; génération de rapports via l'API Claude.

## Structure

```
services/datastudio/
├── engine/                 Moteur de calcul (sans interface)
│   ├── constants.py        Codes manquants, libellés
│   ├── dataset.py          SurveyDataset + étiquetage libellé/code
│   ├── specs.py            Inférence des niveaux de mesure
│   ├── frequency.py        Tris à plat (Effectif, %, % valide, % cumulé)
│   ├── crosstab.py         Croisements (couche + sens du pourcentage)
│   ├── multi.py            Batteries multi-réponses 0/1
│   ├── stats.py            Khi² d'indépendance, t-test de Welch
│   ├── cleaning.py         Épuration (manquants, arrondis, dédoublonnage)
│   └── sav_io.py           Lecture/écriture SPSS (.sav) et chargement multi-format
└── tests/                  Suite pytest (jeu de données synthétique)
```

## Dépendances

Le cœur ne requiert que **pandas**. `scipy` (tests statistiques) et
`pyreadstat` (fichiers `.sav`) sont importés **paresseusement** : le reste du
moteur fonctionne sans eux. Import des formats Kobo/CSPro : Excel `.xlsx/.xls`,
`.csv/.tsv/.tab`, `.ods`, `.json`.

## Lancer les tests

```bash
cd services/datastudio
pip install -r requirements.txt
pytest
```

## Exemple d'utilisation

```python
from engine.sav_io import load_dataset
from engine import compute_frequency, build_cross, run_tests, cleaned_frame

ds = load_dataset("enquete.sav")           # ou .xlsx Kobo/CSPro, .csv...
base = cleaned_frame(ds)                     # base épurée
freq, synthese = compute_frequency(ds, ["Q1_sexe"], frame=base, exclure=True)
croisement = build_cross(ds, "Q1_sexe", "Q2_satisf", layer="Q3_pays", frame=base)
tests = run_tests(ds, "Q1_sexe", "Q2_satisf", frame=base)
```
