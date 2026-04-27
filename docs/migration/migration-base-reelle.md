# Migration de la base de sondage OIF — V1.2.0

> Sprint 2 du sprint global V1.0 → V1.5 · 27 avril 2026
>
> Source : `data/oif/import/Base_de_sondage_EmploiJeune_Global_230426_V2.xlsm`

## 1. Objectif

Importer en base les **5 618 bénéficiaires** (A1) et **341 structures** (B1)
de la base de sondage officielle OIF, en respectant le RGPD et en
préservant la traçabilité complète pour rollback.

## 2. Architecture de l'import

### 2.1. Migration BDD

**Fichier** : `supabase/migrations/20260427120001_imports_tracabilite.sql`

Ajoute 4 colonnes de traçabilité sur `beneficiaires` et `structures` :
- `import_source` — identifiant logique (`BASE_OIF_230426_V2`)
- `import_batch` — date / nom de session
- `import_index` — index ligne dans le CSV source
- `consentement_origine` — `COLLECTE_INITIALE_OIF`

Crée un **index unique partiel** `(import_source, import_index)` qui rend
les scripts d'import idempotents (ON CONFLICT DO NOTHING).

Complète `projets_codes_legacy` avec `P6 → PROJ_A06` et `P13 → PROJ_A13`
(manquants en seed initial alors que la base de sondage les utilise).

### 2.2. Scripts ESM

**Dossier** : `scripts/import-base-reelle/`

- `lib-mapping.mjs` — helpers purs (mapping pays/projet/sexe, génération
  email technique, normalisation des libellés).
- `import-beneficiaires.mjs` — pipeline 5 618 bénéficiaires, lots de 500.
- `import-structures.mjs` — pipeline 341 structures, lots de 200.
- `verify-import.mjs` — comparaison compteurs vs attendus (5 618 / 341).
- `README.md` — procédure et limitations.

Tous utilisent **service_role** (côté serveur uniquement), bypassent
RLS pour l'insertion massive, et marquent les lignes pour rollback ciblé.

## 3. Stratégie RGPD

### Couche 1 — Données réelles en base (Couche métier)

- Conservation des **prénoms, noms, pays, projets** réels.
- Accès limité aux utilisateurs authentifiés via la RLS Supabase
  (4 rôles : admin_scs / éditeur / partenaire / lecteur).
- Audit complet via `journaux_audit` (lecture admin_scs only).
- Marqueur `import_source = 'BASE_OIF_230426_V2'` permet rollback ciblé.

### Couche 2 — Vues publiques anonymisées (Sprint 3)

La page d'accueil `/` (à venir Sprint 3) n'affichera **que des agrégats** :
- Compteurs (« 5 618 bénéficiaires accompagnés »)
- Pays distincts, projets distincts
- **Aucun nom, prénom, email, téléphone** exposé publiquement.

### Couche 3 — Consentement RGPD réputé acquis

Les données proviennent de la base de sondage officielle OIF déjà
consentie. Les scripts marquent automatiquement :
- `consentement_recueilli = true`
- `consentement_date = annee_formation-01-01` (1ᵉʳ janvier de l'année
  déclarée du parcours)
- `consentement_origine = 'COLLECTE_INITIALE_OIF'`

## 4. Mapping appliqué

### 4.1. Codes projets (legacy → officiel)

| Legacy CSV | Officiel BDD | Programme |
|---|---|---|
| P6   | `PROJ_A06`  | PS1 |
| P13  | `PROJ_A13`  | PS2 |
| P14  | `PROJ_A14`  | PS3 |
| P16a | `PROJ_A16a` | PS3 |
| P18  | `PROJ_A18`  | PS3 |
| P19  | `PROJ_A19`  | PS3 |

### 4.2. Pays (libellé FR → code ISO 3 lettres)

`scripts/import-base-reelle/lib-mapping.mjs` couvre tous les pays
distincts du CSV avec **support des variantes orthographiques**
(typos, apostrophes Unicode, formes anglophones…) :

- `Madasgacar` → MDG (typo récurrente)
- `Côte d'Ivoire` (apostrophe ASCII) → CIV
- `Côte d'Ivoire` (apostrophe Unicode U+2019) → CIV
- `Cameroon` → CMR (variante anglophone)
- `Congo (RD)` / `Congo RD` / `Congo RDC` → COD
- `Cap Vert` / `Cabo Verde` → CPV

Si un pays inattendu apparaît, la ligne est rejetée et listée en fin
d'exécution (50 premières erreurs affichées). Corriger le mapping puis
ré-exécuter — l'idempotence garantit qu'aucun doublon n'est créé.

### 4.3. Sexe / âge

| CSV | BDD | Notes |
|---|---|---|
| F (5 025) | F | — |
| H (487)   | M | — |

`age_groupe` (Adulte/Jeune) n'a pas d'équivalent BDD direct → ignoré.

### 4.4. Email

Si le CSV ne fournit pas de courriel valide (cas majoritaire), un email
**technique unique** est généré : `prenom.nom.<index>@import-oif-2025.local`.
Le format `*.local` est :
- **Reconnu** par les scripts d'envoi pour ne **pas relancer** ces
  bénéficiaires en mode automatique.
- **Filtré** côté UI pour ne pas être affiché à des tiers (V1.5).

## 5. Limitations connues V1.2.0

### Bénéficiaires

- `domaine_formation_code` : valeur défaut `AUTRE`. La colonne CSV
  `type_formation` (texte libre — souvent une liste détaillée des
  modules) est conservée dans `intitule_formation`.
- `date_naissance` : non disponible (seul `age_groupe` Adulte/Jeune).
  Laissé NULL.
- `statut_code` : forcé à `FORMATION_ACHEVEE` (toutes les personnes du
  fichier ont effectivement été formées en 2023, 2024 ou 2025).

### Structures

- `porteur_prenom` / `porteur_nom` : split heuristique du champ
  `responsable` libre. Si vide, valeurs marqueurs `Non` / `spécifié`.
- `porteur_sexe` : forcé à `Autre` (non collecté dans le CSV).
- `type_structure_code`, `secteur_activite_code`, `nature_appui_code` :
  valeur défaut `AUTRE`. Le `secteur` libre du CSV est conservé dans
  `secteur_precis`.
- **`devise_code` par défaut `EUR`** (hotfix v1.2.6.3) : la base de
  sondage OIF fournit `montant_appui` sans `devise_code`. Décision
  Carlos confirmée : les montants sont implicitement en euros
  (financement OIF, siège Paris). La fonction
  `upsert_structure_import` applique ce défaut quand un montant est
  présent sans devise. Si le montant est NULL, la devise reste NULL
  (cohérence avec `chk_structures_montant_devise`).

Ces compromis V1 permettent de respecter les contraintes NOT NULL de
la BDD sans perdre les données disponibles. Les coordonnateurs
enrichiront terrain via l'UI d'édition (champs déjà fonctionnels).

## 6. Procédure d'exécution (Carlos)

```bash
# 1. Appliquer la migration BDD
supabase db push

# 2. Lancer les imports (idempotents)
node scripts/import-base-reelle/import-beneficiaires.mjs
node scripts/import-base-reelle/import-structures.mjs

# 3. Vérifier les compteurs
node scripts/import-base-reelle/verify-import.mjs
```

Sortie attendue de `verify-import.mjs` :

```
✓ Bénéficiaires importés                    5618 (attendu : 5618)
  → pays distincts                          51
  → projets distincts                       6
✓ Structures importées                      341 (attendu : 341)
  → pays distincts                          52
  → projets distincts                       6
✅ Total : 5959 lignes importées (5618 A1 + 341 B1)
```

## 7. Rollback

```sql
-- Supprime UNIQUEMENT les lignes du batch concerné
DELETE FROM beneficiaires WHERE import_batch = '2026-04-27-migration-initiale';
DELETE FROM structures   WHERE import_batch = '2026-04-27-migration-initiale';
```

Aucune ligne saisie manuellement n'est affectée (`import_source IS NULL`
pour les saisies UI).

## 8. Validation post-pilote

Une fois le pilote 60 partenaires lancé (juin 2026), les compromis
listés en §5 pourront être enrichis terrain :
- Domaines de formation précis par bénéficiaire.
- Type/secteur/nature_appui exact par structure.
- Porteur prenom/nom/sexe par split manuel ou re-collecte.

L'index `(import_source, import_index)` permet de retrouver chaque ligne
importée pour la mise à jour ciblée.
