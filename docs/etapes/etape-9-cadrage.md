# Étape 9 — Dashboards & indicateurs OIF (cadrage rétrospectif)

> Cadrage rétrospectif rédigé pendant la livraison (sprint nocturne
> 26→27 avril 2026). Le brouillon prospectif (v0.1) avait été
> commité avant arbitrage Carlos ; cette version (v1.0) reflète le
> code livré.
>
> Version : 1.0 — 27 avril 2026

## 1. Arbitrages Carlos appliqués

| Question | Arbitrage |
|---|---|
| Q1 — Bibliothèque graphique | **Recharts** (déjà dans `package.json` ^3.8.1) |
| Q2 — KPI prioritaires | **A1 / A4 / B1 / B4 / F1** |
| Q3 — Pie chart | **Par programme stratégique** (PS1 / PS2 / PS3) |
| Q4 — Devises | **EUR par défaut + toggle FCFA** (parité fixe BCEAO 655,957) |
| Q5 — Variantes par rôle | **3 variantes** (admin global / éditeur scope projets / autres scope org) |
| Q6 — Activité récente | **Liste verticale + filtre période** (7j / 30j / 90j / all) |

## 2. Périmètre V1 livré

### Page `/dashboard` (refondue)

Conserve l'ancienne section « Indicateurs opérationnels » (4 KPI cards par
rôle : comptes à valider, taux RGPD, alertes qualité, imports récents).

**Ajoute** une section « Indicateurs OIF stratégiques » avec :

1. **Sélecteur de période** (push `?periode=XX` URL → re-render serveur).
2. **Toggle EUR / FCFA** (persisté localStorage + événement `oif:devise-change`).
3. **Grille 5 KPI OIF** (KpiGridOif) :
   - **A1** — Jeunes formés (avec ventilation femmes/hommes).
   - **A4** — Gain de compétences → placeholder « Phase 2 — Diapo D2 ».
   - **B1** — Activités économiques appuyées.
   - **B4** — Emplois indirects estimés (mention « Estimation déclarative »).
   - **F1** — Apport du français → placeholder « Phase 2 — Diapo D3 ».
4. **Bar chart Recharts** — top 10 projets par bénéficiaires.
5. **Pie chart Recharts** — répartition par programme stratégique
   (couleurs PS1/PS2/PS3 distinctes).
6. **Activité récente** (10 max) — créations/MAJ bénéficiaires +
   structures + imports, triée chronologiquement, filtrée par période,
   liens cliquables vers les fiches.

### Fonction PostgreSQL `get_indicateurs_oif_v1(p_periode TEXT)`

Une seule fonction PL/pgSQL retourne le payload JSONB complet : 5 KPIs +
bar_projets + pie_programmes. Filtré par rôle et par période. SECURITY
DEFINER + filtre RLS reproduit en SQL pour éviter le multi-pass.

| Rôle | Scope retourné |
|---|---|
| `admin_scs` | global (toutes lignes non supprimées) |
| `editeur_projet` | bénéficiaires + structures dans `current_projets_geres()` |
| `contributeur_partenaire` | créés par lui ou son organisation |
| `lecteur` | organisation OU projets visibles |

## 3. Hors scope V1 (V1.5)

- **A4 et F1 réels** : nécessitent les questionnaires Diapo D2/D3 non
  fournis en V1. Quand alimentés, retirer le placeholder et calculer
  depuis `reponses_enquetes`.
- **Filtres dynamiques cross-cards** (cliquer sur PS1 filtre tout) → V1.5.
- **Export PDF / PNG des graphiques** pour rapports OIF → V1.5.
- **Comparaison périodes** (M-1 vs M) → V2.
- **Cartographie géographique** par pays → V1.5 si demande métier.

## 4. Patterns réutilisés

- Server Component principal + Client Components isolés pour Recharts
  (le bundle Recharts est lourd ~30kB gzipped, c'est pourquoi le
  `/dashboard` est passé de ~117kB à 273kB First Load JS).
- Schéma Zod partagé (`indicateursOifSchema`) entre serveur et client.
- Fonction SQL SECURITY DEFINER + filtre rôle reproduit pour éviter
  les passes RLS coûteuses (déjà le pattern des KPI dashboards
  opérationnels).
- Pas de migration de données : la fonction lit l'existant
  (`beneficiaires`, `structures`, `projets`, `programmes_strategiques`).

## 5. Risques & mitigations

### R1 — Performance bar_projets sur volume

`SELECT projet_code, COUNT(*) GROUP BY` peut être lent si
`beneficiaires` dépasse 50 000 lignes. **Mitigation V1** : LIMIT 10
côté SQL + ORDER BY DESC. **V1.5** : index partiel `(projet_code)
WHERE deleted_at IS NULL` si timing > 500ms.

### R2 — Toggle FCFA sans montant à convertir

V1 affiche les KPI **en nombres**, pas en montants. Le toggle EUR/FCFA
est exposé pour l'usage futur (V1.5 ajoutera un KPI « Montant total
des appuis structures » qui exploitera réellement la conversion).
Documenté dans le composant.

### R3 — Couleurs pie chart incompatibles dark mode

Les 3 couleurs PS sont en HSL absolu (217 91% 60%, 142 71% 45%) et non
des tokens du design system. Si un dark mode est ajouté plus tard,
ajuster. La couleur PS1 utilise `hsl(var(--primary))` et suit le mode.

### R4 — Filtre période côté SQL vs côté UI

Le sélecteur de période agit serveur (re-render Next.js), pas client.
Conséquence : changement de période → loading spinner standard de
Next + nouvelle requête RPC. Acceptable V1 (RPC <500ms attendu).

## 6. Tests d'acceptance

`tests/unit/indicateurs-oif-schema.spec.ts` (13 tests) :
- Payload complet valide
- A4 et F1 nullables (proxies Phase 2)
- Période hors enum rejetée
- Rôle / scope hors enum rejetés
- bar_projets et pie_programmes vides acceptés
- 4 périodes (`7j`, `30j`, `90j`, `all`) avec libellés
- Conversion EUR ↔ FCFA (parité 655,957)
- Format monétaire fr-FR

Vérifs CI : tsc OK, vitest 443/443, lint OK, build OK.

## 7. Procédure utilisateur

1. Connexion → atterrit sur `/dashboard`.
2. Voit immédiatement la section « Indicateurs opérationnels »
   (existant, par rôle).
3. Voit la section « Indicateurs OIF stratégiques » avec :
   - Sélecteur période en haut à droite (défaut 30j).
   - Toggle EUR/FCFA à côté.
   - 5 KPI cards (A1, A4, B1, B4, F1) — A4 et F1 affichent
     « À venir / Phase 2 ».
   - 2 graphiques côte à côte (bar projets + pie programmes).
   - Liste activité récente cliquable.
4. Change la période → URL devient `?periode=7j` et tout se met à jour.

## 8. Décisions techniques notables

- **Activité récente n'utilise PAS `journaux_audit`** car la RLS de
  cette table est admin-only. À la place, on fusionne les `updated_at`
  les plus récents de `beneficiaires` + `structures` + `imports_excel`
  filtrés par RLS standard. Effet : non-admin voit son activité, admin
  voit tout.
- **`get_indicateurs_oif_v1` est SECURITY DEFINER** (comme les fonctions
  KPI existantes) avec filtre rôle SQL explicite. Pas de fuite de
  données entre rôles.
- **Format FCFA via `Intl.NumberFormat('fr-FR', { currency: 'XOF' })`** :
  XOF est le code ISO du Franc CFA Ouest (zone BCEAO). XAF (zone BEAC)
  formaterait à l'identique en français — choix XOF par défaut Sahel.
- **Recharts v3** introduit des breaking changes sur les types de
  Tooltip/Pie label : casts via `unknown` documentés dans les
  Client Components.

## Changelog

| Version | Date | Changement |
|---|---|---|
| 0.1 | 2026-04-27 | Brouillon prospectif (avant arbitrage Carlos). |
| 1.0 | 2026-04-27 | Cadrage rétrospectif post-livraison (arbitrages appliqués). |
