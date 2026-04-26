# Étape 7 — Imports Excel (cadrage)

> Cadrage rétrospectif rédigé pendant la livraison (sprint nocturne
> du 26→27 avril 2026, en autonomie max).
>
> Version : 1.0 — 27 avril 2026

## 1. Objectif

Permettre l'import en masse de bénéficiaires (A1) et structures (B1)
depuis un fichier Excel `.xlsx` au format Template V1, avec rapport
d'erreurs ligne par ligne pour correction et ré-import.

## 2. Périmètre V1

### Page `/admin/imports`

- Accessible aux rôles `admin_scs` et `editeur_projet`.
- 2 cartes en grille responsive : Bénéficiaires (A1) + Structures (B1).
- Chaque carte expose une zone drag & drop avec validation client
  (extension `.xlsx`, taille max 5 MB) et un bouton « Lancer l'import ».

### Pipeline d'import (par fichier)

1. **Upload multipart/form-data** vers `/api/imports/{beneficiaires|structures}`.
2. **Parser ExcelJS** (`lib/imports/parser-excel.ts`) :
   - Lit la 1re feuille du classeur.
   - Vérifie la présence des en-têtes obligatoires (10 colonnes A1, 11 colonnes B1).
   - Plafond 5 000 lignes par import (au-delà : refus).
   - Ignore les lignes 100% vides.
3. **Mapping libellé/code → champs métier** (`mapping-beneficiaires.ts` et
   `mapping-structures.ts`) :
   - Tolérant : accepte le code (PROJ_A14, NUM_INFO) OU le libellé
     humain (« Numérique et informatique »).
   - Reverse-map des nomenclatures via `inverser()` helper.
   - Parse dates ISO ou jj/mm/aaaa.
   - Parse nombres avec séparateur français (virgule, espace milliers).
4. **Validation Zod** (`beneficiaireInsertSchema` / `structureInsertSchema`) :
   - Toutes les règles RGPD et cross-field s'appliquent comme en saisie
     manuelle.
   - Erreurs accumulées par chemin de champ.
5. **INSERT individuel** via service_role (RLS bypass — admin seul peut
   importer).
6. **Audit** dans `public.imports_excel` avec compteurs + rapport JSONB.

### Stratégie « tolérante »

Un échec sur la ligne N **N'INTERROMPT PAS** les autres. Le rapport
final liste tout (succès + erreurs) pour permettre le ré-import après
correction.

### Rapport d'import

- **Modal en fin d'import** avec :
  - Compteurs (lues / insérées / ignorées)
  - Tableau d'erreurs paginé (50 affichées max + lien rapport complet)
  - Bouton « Télécharger le rapport Excel »
- **Rapport Excel téléchargeable** (`/api/imports/rapport-erreurs`) :
  - Feuille « Récapitulatif » (6 lignes méta)
  - Feuille « Erreurs » (4 colonnes : Ligne, Colonne, Valeur fautive, Message)
  - Format réutilisable pour annoter le fichier source et ré-importer.

### Sécurité

- `requireUtilisateurValide` sur les Routes Handlers POST.
- Garde rôle `admin_scs | editeur_projet` côté Server Action.
- Limite 5 MB par fichier (validation client + serveur).
- Limite 5 000 lignes (anti-DoS naïf).
- Service_role utilisé serveur uniquement pour bypass RLS.

## 3. Hors scope V1 (reportés V1.5/V2)

- **Mode update** : V1 fait UNIQUEMENT de l'INSERT. Pas de mise à jour
  de fiches existantes via Excel (UPSERT). Si une ligne existe déjà
  (clé doublon), elle est rejetée par les contraintes BDD comme en
  saisie manuelle.
- **Pré-visualisation avant insertion** : V1 importe directement, le
  rapport montre les erreurs après. V1.5 pourrait ajouter un mode
  « dry-run » qui parse + valide sans insérer.
- **Pagination du rapport modal** : V1 affiche 50 erreurs visuellement,
  l'export Excel contient tout. V1.5 si besoin d'UX paginée.
- **Imports parallèles concurrent** : V1 traite séquentiellement. Si
  plusieurs admins importent en même temps, pas de file d'attente
  (Supabase gère les conflits naturellement via les contraintes).
- **Imports D1-D3** : pas de questionnaire fourni en V1, donc pas
  d'import (cf. backlog § Étape 6 V1.5).

## 4. Patterns réutilisés des étapes précédentes

- Schémas Zod hors `'use server'` (cf. hotfix 6.5h-quater).
- Server Actions avec discriminated union de résultats (`ResultatImport`).
- Templates Excel partagés avec l'export 4e/5e (cycle export-import
  garanti par les colonnes `COLONNES_A1` / `COLONNES_B1`).
- Audit dans `public.imports_excel` (table déjà créée en migration 001).

## 5. Risques techniques identifiés

### R1 — Cohérence libellé/code dans les nomenclatures

L'export 4e/5e écrit le LIBELLÉ humain dans certaines colonnes (Domaine,
Statut, Modalité, etc.). Notre mapping accepte les deux pour ne pas
casser le cycle. **Mitigation** : tests Vitest couvrent les cas code et
libellé pour chaque enum (cf. `tests/unit/imports-mapping.spec.ts`).

### R2 — Contraintes RGPD bloquantes

La règle « consentement_recueilli=true → date obligatoire » fait
échouer beaucoup de lignes si le template est mal rempli.
**Mitigation** : message d'erreur explicite + tableau des erreurs avec
colonne fautive dans le rapport téléchargeable.

### R3 — Conflits de doublons

Les contraintes uniques `(prenom, nom, date_naissance, projet_code)`
pour A1 et `(nom_structure, pays_code, projet_code)` pour B1 vont
rejeter les doublons. **Comportement V1** : message d'erreur SQL brut
relayé dans le rapport. V1.5 pourrait afficher un message « Doublon
avec la fiche existante ID:xxx — utilisez l'édition manuelle ».

### R4 — Performance sur gros fichiers

5 000 lignes × INSERT individuel = ~50 secondes sur Supabase Free
(timeout requête HTTP Vercel : 60 s). **Mitigation V1** : plafond
explicite à 5 000 lignes. **V1.5** : passer à `insert([...])` en
chunks de 100 pour parallélisation BDD.

## 6. Tests d'acceptance

`tests/unit/imports-parser.spec.ts` (6 tests) :
- Fichier valide avec en-têtes attendus
- En-tête obligatoire manquant → erreur structurelle
- Lignes 100% vides ignorées
- Fichier corrompu → erreur explicite
- Fichier vide (0 ligne données) → 0 lignes parsées
- Numérotation lignes à partir de 2

`tests/unit/imports-mapping.spec.ts` (12 tests) :
- Bénéficiaire ligne 100% valide
- Libellé Sexe (Femme/Homme) accepté
- Libellé consentement long format accepté
- Code projet inconnu rejeté
- Année texte rejetée
- Date FR convertie en ISO
- Plusieurs erreurs cumulées sur la même ligne
- Structure ligne 100% valide
- Libellé statut français accepté
- Libellé devise (Euro (€)) accepté
- Nom de structure manquant rejeté
- Type non reconnu rejeté
- Montant avec virgule décimale française

## 7. Procédure utilisateur

1. SCS / chef de projet va sur `/admin/imports`.
2. Récupère le template Excel via la page liste correspondante (bouton
   « Exporter vers Excel » qui produit le format de référence).
3. Remplit le template (peut utiliser code OU libellé pour les enums).
4. Glisse le fichier dans la zone d'upload + clique « Lancer l'import ».
5. Le rapport modal s'affiche : si erreurs, télécharge le rapport
   Excel pour analyse + correction du fichier source.
6. Re-importe le fichier corrigé. Les lignes déjà insérées ne seront
   PAS dédoublonnées (à supprimer manuellement avant ré-import si la
   re-tentative inclut les mêmes lignes).

## Changelog

| Version | Date | Changement |
|---------|------|------------|
| 1.0 | 2026-04-27 | Cadrage initial post-livraison sprint nocturne. |
