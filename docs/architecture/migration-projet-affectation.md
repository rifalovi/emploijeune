# Architecture — Migration du modèle d'affectation projet

> Hotfix 8h-bis · Refactor V1 · 27 avril 2026
>
> Version : 1.0

## 1. Pourquoi ce refactor

Avant cette migration, les projets accessibles à un utilisateur dérivaient
**indirectement** via son `organisation_id` :

```
utilisateur → organisations.projets_geres TEXT[] → ARRAY['PROJ_A14', 'PROJ_B12']
```

Conséquences problématiques :

- **Impossible de tracer l'historique** : si un projet bascule d'un
  coordonnateur à un autre, aucune trace BDD ne le dit.
- **Pas de granularité utilisateur** : tous les utilisateurs d'une même
  organisation héritaient du même périmètre, alors qu'en pratique OIF gère
  des coordonnateurs avec des portefeuilles personnels.
- **Pas de transferts pilotés** : l'opération « Marie part, Carlos
  reprend PROJ_A14 » n'avait aucune procédure outillée — il fallait
  éditer `organisations.projets_geres` à la main, sans audit.

La V1 cible (modèle requis pour le pilote 60 partenaires) impose une
**vraie liaison `utilisateur ↔ projet` avec historique RGPD-compatible**.

## 2. Modèle cible (3 nouvelles tables)

### 2.1. `affectation_projet_courante`

Une ligne = un coordonnateur gère un projet aujourd'hui.

| Colonne | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID FK auth.users | ON DELETE CASCADE |
| `projet_code` | TEXT FK projets(code) | |
| `role_dans_projet` | TEXT | `gestionnaire_principal` ou `co_gestionnaire` |
| `date_debut` | TIMESTAMPTZ | DEFAULT NOW() |
| `attribue_par` | UUID FK auth.users | admin ayant attribué |
| `raison_debut` | TEXT | optionnel |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

Contraintes :
- `UNIQUE (user_id, projet_code)` — empêche les doublons.
- Indexes sur `user_id` et `projet_code`.

### 2.2. `affectation_projet_historique`

Journal **immuable** (sauf clôture via `date_fin`) de tous les flux passés
et actifs. Une ligne avec `date_fin IS NULL` = miroir d'une affectation
courante. Renseignée à la clôture quand le projet est retiré ou transféré.

| Colonne | Type | Notes |
|---|---|---|
| `id`, `user_id`, `projet_code`, `role_dans_projet` | | idem courante |
| `date_debut` | TIMESTAMPTZ | obligatoire |
| `date_fin` | TIMESTAMPTZ NULL | NULL = ligne active |
| `attribue_par` | UUID FK | |
| `transfere_par` | UUID FK | rempli si l'attribution vient d'un transfert |
| `transfere_a` | UUID FK | rempli à la clôture si transfert sortant |
| `raison_debut`, `raison_fin` | TEXT | |

Indexes : `user_id`, `projet_code`, `date_debut DESC`, partial sur lignes actives.

### 2.3. `structure_projet_historique`

Historique des projets de financement d'une structure (B1).
`structures.projet_code` reste la **valeur courante** ; ce journal trace
les changements.

| Colonne | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `structure_id` | UUID FK structures | ON DELETE CASCADE |
| `projet_code` | TEXT FK projets(code) | |
| `date_debut_financement` | TIMESTAMPTZ | |
| `date_fin_financement` | TIMESTAMPTZ NULL | |
| `motif_changement` | TEXT | |
| `enregistre_par` | UUID FK auth.users | |

## 3. Fonction refactorée — `current_projets_geres()`

**Insight clé** : en gardant la signature `RETURNS TEXT[]`, les **20 RLS
policies + 4 fonctions KPI restent inchangées**. La migration est
transparente pour le reste du système.

Nouveau comportement par rôle :

| Rôle | Source des projets |
|---|---|
| `admin_scs` | tous les codes du référentiel `public.projets` |
| `editeur_projet` | `affectation_projet_courante` filtré sur `user_id = auth.uid()` |
| `contributeur_partenaire` | DISTINCT `projet_code` des `structures` de l'organisation de l'utilisateur |
| `lecteur` | DISTINCT `projet_code` des affectations courantes des coordonnateurs de la même organisation |

## 4. Server Actions disponibles

Toutes en `lib/utilisateurs/affectation-projet.ts`, garde admin_scs,
discriminated union de résultats (`succes` / `erreur_*`), audit
automatique via triggers BDD :

1. **`ajouterProjetAUtilisateur`** — INSERT courante + miroir historique.
   Refuse si rôle ≠ `editeur_projet` ou doublon.
2. **`retirerProjetAUtilisateur`** — UPDATE historique (`date_fin`) puis
   DELETE courante.
3. **`transfererProjet`** — séquence atomique best-effort :
   - clôt la ligne historique source (`date_fin`, `transfere_a`, `raison_fin`)
   - DELETE courante source
   - INSERT courante destination
   - INSERT historique destination (`transfere_par`)
   - Refuse self-transfert et destination déjà gestionnaire.
4. **`changerProjetStructure`** — UPDATE `structures.projet_code` +
   clôture historique ancienne ligne + INSERT nouvelle ligne.

## 5. UI livrée

### Page édition utilisateur `/admin/utilisateurs/[id]/modifier`

Nouvelle Card `Projets gérés` (insérée entre le formulaire et la card
d'audit) :

- **Pour `admin_scs`** : note « accès à tous les projets ».
- **Pour `contributeur_partenaire` / `lecteur`** : note héritage via org.
- **Pour `editeur_projet`** :
  - Liste des affectations actives (badge code + libellé + rôle dans projet
    + date début + bouton « retirer »).
  - Bouton « Ajouter » → modal multi-select avec checkboxes des projets
    disponibles (grille 2 colonnes), choix du rôle, raison optionnelle.
  - Bouton « Transférer » → modal source projet + destination utilisateur
    + raison obligatoire (≥3 chars).
  - Bouton « Historique » → page `/admin/utilisateurs/[id]/historique`.

### Pages historique

- **`/admin/utilisateurs/[id]/historique`** : timeline des projets gérés
  par cet utilisateur (passés + actifs).
- **`/admin/projets/[code]/historique`** : timeline des coordonnateurs
  qui ont géré ce projet.

Les deux : badge « Actif » sur lignes ouvertes, raisons début/fin
affichées, infos de transfert visibles.

## 6. Migration des données existantes

Phase intégrée à la migration SQL `20260427000001_affectation_projet.sql` :

1. **Pour chaque `editeur_projet` actif** dont l'organisation a des
   `projets_geres` : INSERT dans `affectation_projet_courante` (1 ligne par
   projet), avec `attribue_par = premier admin_scs`,
   `raison_debut = "Migration initiale depuis modèle organisations.projets_geres"`.
2. **Miroir** dans `affectation_projet_historique` (date_fin NULL).
3. **Pour chaque `structures` non supprimée** : INSERT dans
   `structure_projet_historique` avec `date_debut_financement = created_at`,
   `motif_changement = "Migration initiale depuis V1"`.
4. **`organisations.projets_geres`** : conservé pour info, sera droppé en
   V1.5 une fois que la stabilité est confirmée.

## 7. Plan de rollback

Si retour terrain négatif dans les 7 premiers jours :

1. Restaurer la fonction `current_projets_geres()` dans son ancienne forme
   (SELECT depuis `organisations.projets_geres`) — git revert sur la
   migration suffit, les anciennes lignes existent toujours.
2. Garder les 3 nouvelles tables en place (no-op pour l'app si la
   fonction ne les lit plus).
3. Pas de perte de données : `organisations.projets_geres` n'a pas été
   touché en écriture par cette migration.

## 8. Tests livrés

- **`tests/unit/affectation-projet-schema.spec.ts`** (16 tests) :
  payloads valides, UUID, code projet, rôle dans projet, raison min/max,
  motif obligatoire pour transfert/changement structure.
- **Tests d'intégration BDD** : à exécuter manuellement par Carlos après
  application de la migration sur Supabase (snippet SQL dans la doc V1.5).

Vérifs CI à date : `tsc --noEmit` OK, `vitest run` 430/430, `next lint`
OK, `next build` OK.

## 9. Hors scope (V1.5)

- **UI changement de projet d'une structure** : Server Action
  `changerProjetStructure` est livrée mais pas encore wired dans
  `/structures/[id]`. Sera ajoutée dans la même page que la modification
  des champs structure.
- **Suppression de `organisations.projets_geres`** : laissée en place
  cette V1 pour rollback rapide. À dropper en V1.5.
- **Vraie transaction Postgres** sur `transfererProjet` : actuellement
  best-effort en plusieurs requêtes service_role. Si retour terrain de
  divergence, créer un RPC SQL `fn_transferer_projet(...)` atomique.
- **Visibilité étendue** : actuellement, un coordonnateur voit ses propres
  affectations + celles de son organisation (pour la coordination
  d'équipe). Si Carlos demande, étendre.

## 10. Décisions techniques notables

- **Identifiers SQL en ASCII** (`attribue_par`, `transfere_par`) — cohérence
  avec l'existant (`consentement_recueilli`, `nom_complet`).
- **`projet_code`** (et non `code_projet`) — alignement avec les colonnes
  existantes dans `beneficiaires`, `structures`, `reponses_enquetes`.
- **Pas de refactor des 20 RLS policies** — la signature de
  `current_projets_geres()` est stable, le contrat est respecté.
- **Audit déclenché par triggers** sur les 3 nouvelles tables — pas besoin
  d'écriture audit explicite dans les Server Actions, le trigger
  `tg_audit_row()` (existant depuis migration 001) gère tout.

## Changelog

| Version | Date | Changement |
|---|---|---|
| 1.0 | 2026-04-27 | Migration initiale livrée (hotfix 8h-bis sprint nocturne). |
