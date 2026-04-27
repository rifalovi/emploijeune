# V1.2.5 — Campagnes de collecte ciblées (refonte méthodologie OIF)

> 27 avril 2026 · Refonte du composant « Lancer une vague » en gestion
> complète de campagnes selon méthodologie OIF.

## 1. Pourquoi cette refonte

Avant V1.2.5, le composant `DialogueLancerVague` (Étape 6.5e) ne
proposait qu'un filtre projet unique + un plafond. Une « campagne »
n'existait pas en BDD : un envoi groupé créait N tokens dans
`tokens_enquete_publique` sans persistance du contexte (qui a lancé
quoi à qui ? avec quelle stratégie d'échantillonnage ?).

**Méthodologie OIF** : on ne lance JAMAIS une enquête à toute la base
d'un projet. On cible une **strate** précise (ex. « bénéficiaires
PROJ_A14 + Mali + 2024 + Formés D-CLIC »). C'est ce qui distingue une
campagne propre d'un envoi en masse — délivrabilité, RGPD,
exploitabilité des résultats.

V1.2.5 transforme la fonctionnalité en **vraie gestion de campagnes** :
définition de strate, persistance, audit, lancement contrôlé.

## 2. Périmètre livré

### 2.1. Migration BDD

**`supabase/migrations/20260427130001_campagnes_collecte.sql`** :

- ENUM `statut_campagne` (brouillon / programmee / envoyee / terminee).
- ENUM `mode_selection_campagne` (toutes / filtres / manuelle).
- Table `campagnes_collecte` (nom, description, questionnaire,
  type_vague, mode_selection, filtres JSONB, cibles_manuelles UUID[],
  plafond, email_test_override, date_envoi_prevue, statut, compteurs,
  audit, RLS).
- Colonne `tokens_enquete_publique.campagne_id` (FK) : retrouver depuis
  un token quelle campagne l'a généré.
- Trigger `trg_campagnes_audit` (alimenté par `tg_audit_row()`).
- 2 fonctions PostgreSQL SECURITY DEFINER :
  - `compter_strate(questionnaire, filtres)` → JSONB `{total,
    avec_email, sans_email, sans_consentement}` (compteurs UI).
  - `lister_strate(questionnaire, filtres, recherche, limit, offset)` →
    TABLE paginée pour mode manuel (50 lignes par page par défaut).

### 2.2. Schémas Zod (hors `'use server'`)

**`lib/schemas/campagne.ts`** :

- `filtresStrateASchema` (Q A : projets, pays, annees, sexe, statuts,
  consentement_acquis_seul).
- `filtresStrateBSchema` (Q B : projets, pays, annees_appui,
  types_structure, secteurs).
- `creerCampagneSchema` avec validation cross-field (mode manuel exige
  cibles_manuelles non vides).
- `MODES_SELECTION` + libellés FR.
- Helper `resumerStrate(questionnaire, filtres)` qui auto-génère un
  libellé descriptif (« Bénéficiaires + PROJ_A14 + MLI + 2024 + Femmes »).

**19 tests Vitest** dédiés aux schémas (`tests/unit/campagne-schema.spec.ts`).

### 2.3. Server Actions

**`lib/campagnes/server-actions.ts`** :

- `compterStrate(questionnaire, filtres)` → délègue à la RPC SQL.
- `listerStrate(questionnaire, filtres, recherche, limit, offset)`
  pour la pagination du mode manuel.
- `creerCampagneBrouillon(payload)` → INSERT en statut `brouillon`,
  retourne l'ID.
- `lancerCampagne(campagneId)` → charge la campagne, résout les cibles
  (manuelles ou via filtres), respecte le plafond, génère les tokens
  via `genererTokenEnquete`, lie les tokens à la campagne (`campagne_id`),
  met à jour le statut et les compteurs.

Sécurité :
- Garde rôle (admin_scs / editeur_projet / contributeur_partenaire).
- `getCurrentUtilisateur()` throw automatiquement en mode view-as
  (cf. v1.1.5) → impossible de créer ou lancer en visualisation.
- Filtres reproduits côté SQL via SECURITY DEFINER + check rôle —
  RLS respectée.

### 2.4. UI — Page `/enquetes/lancer`

**`app/(dashboard)/enquetes/lancer/page.tsx`** : Server Component qui
charge le référentiel projets + pays et passe au wizard.

**`components/campagnes/wizard-campagne.tsx`** : wizard 3 sections sur
une seule page (pas de navigation) :

1. **Type de campagne** : questionnaire A/B, type vague, nom (≥3 chars
   obligatoire), description optionnelle.
2. **Définition de la strate** :
   - Radio 3 modes : toutes / filtres / manuelle.
   - **Mode filtres** : multi-checkboxes projets, pays, années, sexe (Q A),
     consentement RGPD acquis. Chaque toggle actualise les compteurs en
     temps réel (debounce 250ms).
   - **Mode manuel** : recherche full-text + tableau paginé (50 lignes),
     toggle « tout sélectionner cette page », sélection persistée entre
     pages, compteur sticky « X sélectionnés sur Y éligibles ».
   - **Aperçu strate** dynamique avec compteurs + résumé auto-généré +
     état viable / dépassement plafond / vide.
3. **Paramètres d'envoi** : plafond (1-200), email test override.

Footer actions : « Sauvegarder en brouillon » + « Lancer la campagne ».

### 2.5. Wiring

- Bouton « Lancer une campagne » sur `/enquetes` pointe désormais vers
  `/enquetes/lancer` (au lieu d'ouvrir la modal).
- L'ancienne modal `DialogueLancerVague` est **supprimée**
  (`components/enquetes/dialogue-lancer-vague.tsx` retiré, plus aucun
  import).

## 3. Hors scope V1.2.5 (V1.5+)

- **Filtres en cascade dynamiques** : actuellement, les pays affichés
  ne se restreignent pas automatiquement aux pays présents dans les
  projets sélectionnés. La requête SQL applique bien la contrainte
  croisée (les compteurs sont justes), mais l'UI affiche tous les pays.
- **Programmation date d'envoi** : le champ `date_envoi_prevue` est
  persisté en BDD mais aucun cron Supabase ne le déclenche en V1.2.5.
  Implémentation V1.5 si besoin (Edge Function + pg_cron).
- **Liste des campagnes en historique** : pas de page dédiée
  `/enquetes/campagnes` listant les brouillons / envoyées / terminées.
  Une campagne créée en brouillon est visible en BDD mais non
  visualisable depuis l'UI. V1.5.
- **Filtres Q B affinés** : `types_structure` et `secteurs` sont en
  champ libre (pas de Select dédié à partir des nomenclatures actives).
  V1.5.

## 4. Hotfix UX inclus dans v1.2.5

L'ancienne modal de lancement débordait sur écrans 13" (libellés projets
longs sortaient à droite). Hotfix immédiat livré dans le commit
précédent (élargissement `max-w-2xl` + truncate + tooltip). Maintenant
caduc puisque la modal est remplacée par la page wizard.

## 5. Vérifs CI

- **TypeScript** : `tsc --noEmit` ✓
- **Vitest** : **462/462** verts (+19 nouveaux tests campagne)
- **Lint** : `next lint` ✓
- **Build** : `next build` ✓ (route `/enquetes/lancer` 8.82 kB / 210 kB
  First Load JS).

## 6. À faire côté Carlos

```bash
# 1. Appliquer la migration BDD
supabase db push

# 2. Tester visuellement
#    - /enquetes → bouton « Lancer une campagne » → /enquetes/lancer
#    - Mode filtres : cocher projets + pays → compteurs temps réel
#    - Mode manuel : recherche + pagination + sélection multi-pages
#    - Sauvegarder brouillon (puis vérifier table campagnes_collecte)
#    - Lancer (avec email test override pour ne pas spammer)
```
