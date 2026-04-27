# Import des données réelles OIF

> Sprint 2 (V1.2.0) — migration depuis la base de sondage officielle
> `Base_de_sondage_EmploiJeune_Global_230426_V2.xlsm`.

## Volume cible

- **5 618 bénéficiaires** (jeunes formés A1) sur 6 projets et 51 pays
- **341 structures** (activités économiques B1) sur 6 projets et 52 pays

## Prérequis

1. **Migration BDD appliquée** (`supabase db push`) :
   - `20260427120001_imports_tracabilite.sql` — colonnes `import_source` /
     `import_batch` / `import_index` / `consentement_origine` + index
     d'idempotence + compléments mapping legacy P6/P13.
2. **Variables d'environnement** dans `.env.local` :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (clé service_role, pas la anon)
3. **Dépendances** : `csv-parse`, `dotenv` (déjà installées en
   `devDependencies`).

## Procédure d'exécution

```bash
# 1. Importer les bénéficiaires (~3 minutes, 5 618 lignes par lots de 500)
node scripts/import-base-reelle/import-beneficiaires.mjs

# 2. Importer les structures (~30 secondes, 341 lignes par lots de 200)
node scripts/import-base-reelle/import-structures.mjs

# 3. Vérifier les compteurs
node scripts/import-base-reelle/verify-import.mjs
```

Les scripts sont **idempotents** : les ré-exécuter ne crée aucun doublon
grâce à l'index unique `(import_source, import_index)`.

## Stratégie RGPD

- **Couche 1 — Données réelles** : prénoms, noms, pays, projets sont
  conservés tels quels. Accès limité aux utilisateurs authentifiés selon
  leur rôle (RLS) + audit complet.
- **Couche 2 — Vues publiques anonymisées** : la page d'accueil
  (Sprint 3) n'affichera que des agrégats — aucun nom ni email exposé.
- **Couche 3 — Consentement RGPD réputé acquis** : les données proviennent
  de la base de sondage officielle OIF déjà consentie. Le script marque
  `consentement_recueilli = true` + `consentement_origine =
  'COLLECTE_INITIALE_OIF'`.

## Mapping appliqué

### Codes projets

| CSV | BDD          |
| --- | ------------ |
| P6  | `PROJ_A06`   |
| P13 | `PROJ_A13`   |
| P14 | `PROJ_A14`   |
| P16a | `PROJ_A16a` |
| P18 | `PROJ_A18`   |
| P19 | `PROJ_A19`   |

### Pays (libellés FR → codes ISO 3 lettres)

`scripts/import-base-reelle/lib-mapping.mjs` couvre les 51 pays
distincts du CSV bénéficiaires + 52 du CSV structures, **y compris les
variantes orthographiques** rencontrées en pratique :

- `Madasgacar` → MDG (faute de frappe)
- `Côte d'Ivoire` (apostrophe Unicode) → CIV
- `Cameroon` → CMR (variante anglophone)
- `Congo (RD)` / `Congo RD` / `Congo RDC` → COD
- `Cap Vert` / `Cabo Verde` → CPV

Si un pays inattendu apparaît, la ligne est rejetée et listée dans le
rapport final (50 premières erreurs) — corriger le mapping puis
ré-exécuter (idempotent).

### Sexe

| CSV | BDD |
| --- | --- |
| F   | F   |
| H   | M   |

### Email

Si le CSV ne fournit pas de courriel valide, un email technique est
généré : `prenom.nom.<index>@import-oif-2025.local`. Format reconnu
côté UI pour ne **pas** être envoyé en relance ou affiché à des tiers.

## Limitations connues (V1.2.0)

### Bénéficiaires

- `domaine_formation_code` : valeur défaut `AUTRE`. La colonne CSV
  `type_formation` (libre) est conservée dans `intitule_formation`.
  À enrichir via UI ou seconde passe d'import si besoin.
- `date_naissance` : non disponible dans le CSV (seule `age_groupe`
  existe). Laissé NULL.
- `statut_code` : forcé à `FORMATION_ACHEVEE` (toutes les personnes du
  fichier ont effectivement été formées).

### Structures

- `porteur_prenom` / `porteur_nom` : split heuristique du champ
  `responsable` libre. Si vide, valeurs marqueurs `Non` / `spécifié`.
- `porteur_sexe` : forcé à `Autre` (non collecté dans le CSV).
- `type_structure_code`, `secteur_activite_code`, `nature_appui_code` :
  valeur défaut `AUTRE`. Le `secteur` libre du CSV est conservé dans
  `secteur_precis`.

Ces compromis V1 permettent de respecter les contraintes NOT NULL de
la BDD sans perdre les données disponibles. Les coordonnateurs pourront
enrichir terrain via l'UI d'édition.

## Rollback

En cas de problème post-import :

```sql
-- Supprime UNIQUEMENT les lignes du batch concerné
DELETE FROM beneficiaires WHERE import_batch = '2026-04-27-migration-initiale';
DELETE FROM structures   WHERE import_batch = '2026-04-27-migration-initiale';
```

Aucune ligne saisie manuellement n'est affectée (elles ont
`import_source IS NULL`).
