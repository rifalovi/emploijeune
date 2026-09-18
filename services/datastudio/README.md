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

**Étape 2 (couche API)** et **étape 3 (historique Supabase)** sont désormais en
place. Étapes suivantes : module UI `atelier-analyse` ; pont Enquête ↔
DataStudio ; endpoints d'import `.sav` / export fichiers sur Storage ;
génération de rapports via l'API Claude.

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
├── api/                    Couche API FastAPI (étape 2)
│   ├── app.py              Application + routes /api/datastudio/*
│   ├── auth.py             Vérification JWT Supabase (HS256, stdlib pure)
│   ├── schemas.py          Modèles pydantic (entrée/sortie)
│   └── serialize.py        DataFrame -> JSON
└── tests/                  Suite pytest (moteur + API)
```

## API (étape 2)

Déployable en **fonction Python Vercel** (Fluid Compute ; entrypoint
`api/datastudio/index.py` + `vercel.json` à la racine) ou en **service FastAPI
autonome** (plan B). Toutes les routes de calcul exigent un **JWT Supabase**
valide (`Authorization: Bearer`, vérifié en HS256 avec `SUPABASE_JWT_SECRET`) ;
`/health` est publique.

| Route (préfixe `/api/datastudio`) | Rôle |
|---|---|
| `GET /health` | sonde de disponibilité |
| `POST /analyze` | ingestion : variables, niveaux de mesure, batteries multi |
| `POST /frequency` | tris à plat |
| `POST /crosstab` | croisements (couche + sens du %) |
| `POST /stat-test` | Khi² / t-test de Welch |
| `POST /multi` | questions à réponses multiples |
| `POST /clean` | épuration (aperçu + caractéristiques) |

Les données sont transmises en JSON (`dataset.rows` + libellés SPSS optionnels),
ce qui correspond au flux depuis le module Enquête (JSONB). L'import `.sav`
depuis Storage sera ajouté ensuite.

Service autonome :

```bash
cd services/datastudio
pip install -r requirements.txt
SUPABASE_JWT_SECRET=... uvicorn api.app:app --reload
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
