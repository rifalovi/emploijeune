# Étape 9 — Dashboards & indicateurs (cadrage prospectif)

> Cadrage rédigé en avance de phase pendant le sprint nocturne
> 26→27 avril 2026 (autonomie max). **Pas de code livré dans cette
> étape : ce document sert d'arbitrage pour le sprint suivant.**
>
> Version : 0.1 (brouillon en attente d'arbitrage Carlos) — 27 avril 2026

## 1. Objectif

Donner aux 4 rôles une vue agrégée et visuelle de l'activité de la
plateforme via des dashboards adaptés à leur périmètre RLS, en se
limitant aux indicateurs déjà calculables sur les données déjà
présentes (A1, B1) et sans introduire de pipeline de calcul lourd.

## 2. Hypothèses & contraintes

### Données disponibles (post Étapes 4-7)

- `beneficiaires` (A1) — 22 colonnes utiles, dont projet_code, pays_code,
  domaine_formation_code, sexe, statut_beneficiaire, age, date_inscription.
- `structures` (B1) — 37 colonnes, dont type_structure, secteur_activite,
  statut_creation, annee_appui, montant_appui, devise.
- `enquetes` + `reponses_enquetes` — D1/D2/D3 vides en V1 (pas de
  questionnaire fourni). À ignorer en Étape 9 V1.
- `imports_excel` — historique des imports avec compteurs.
- `journaux_audit` — historique des actions BDD.

### Contraintes techniques

- Pas de moteur d'analytics (pas de Metabase / Superset déployé).
- Recharts est déjà dans `package.json` (utilisé page liste 4e/5e ?
  vérifier — sinon installer).
- Calculs effectués en PostgreSQL via vues SQL ou requêtes server-side.
- RLS doit s'appliquer : un coordonnateur ne voit QUE les données de
  ses projets, un contributeur QUE les fiches qu'il a saisies.

### Contraintes métier

- 4 rôles avec périmètres distincts → 4 variantes de dashboard
  (ou 1 dashboard avec sections conditionnelles).
- Indicateurs OIF normalisés : volumétrie + ventilation par sexe + par
  pays + par projet (ce sont les axes d'analyse récurrents dans les
  rapports OIF).

## 3. Périmètre V1 proposé

### Page `/dashboard` (déjà existante en placeholder)

Refondre la page `/dashboard` avec :

#### Section A — KPI cards (4-6 chiffres clés)

- Nombre total de bénéficiaires (filtré RLS)
- Nombre total de structures (filtré RLS)
- Nombre de projets actifs (selon rôle)
- % de bénéficiaires femmes / hommes
- Total montant d'appui aux structures (somme MGA/EUR convertie ?)
- Nombre d'imports réalisés ces 30 derniers jours

#### Section B — 2 graphiques Recharts

- **Bar chart** : bénéficiaires par projet (ou par pays selon rôle)
- **Pie chart** : répartition par sexe / par tranche d'âge / par
  domaine de formation (au choix Carlos)

#### Section C — Activité récente

- 5 dernières créations bénéficiaires (avec nom_complet + projet)
- 5 dernières créations structures (avec nom + pays)
- 5 derniers imports (avec compteurs lues/insérées/erreurs)

### Variantes par rôle (RLS-driven)

| Rôle | Périmètre | KPI affichés |
|------|-----------|---|
| `admin_scs` | Toute la plateforme | Tous les KPI + onglet « Plateforme » avec compteurs globaux + audit récent |
| `editeur_projet` | Ses projets gérés | KPI filtrés sur projets gérés + comparatif inter-projets |
| `contributeur_partenaire` | Ses fiches | KPI sur sa contribution personnelle (combien j'ai saisi) |
| `lecteur` | Lecture des projets autorisés | KPI agrégés sans détail nominatif |

## 4. Hors scope V1 (V1.5 / V2)

- **Filtres dynamiques cross-cards** (ex. cliquer sur un projet filtre
  tous les graphiques) → V1.5 si Carlos demande.
- **Export PDF du dashboard** pour rapports OIF → V2.
- **Indicateurs longitudinaux D1/D2/D3** (taux d'insertion, durée
  moyenne d'accompagnement) → V2 quand les questionnaires Diapo seront
  fournis et alimentés.
- **Comparaison périodes** (M-1 vs M, A-1 vs A) → V2.
- **Cartographie géographique** (carte des bénéficiaires par pays /
  ville) → V1.5 si valeur métier confirmée.
- **Alertes / seuils** (ex. « Projet X en sous-réalisation ») → V2.

## 5. Patterns à réutiliser

- Server Components Next 14 pour les KPI cards (lecture serveur, pas
  de hydration JS).
- Recharts en Client Components isolés pour les graphiques.
- Vues SQL `dashboard_kpi_v1` matérialisées ou non selon performance
  (à benchmarker — si Supabase Free tient, pas besoin de
  matérialisation).
- Service_role uniquement côté serveur si on a besoin de bypasser RLS
  pour les KPI globaux admin_scs. Sinon RLS standard.

## 6. Risques techniques identifiés

### R1 — Complexité RLS sur les agrégats

`COUNT(*)` filtré par RLS peut être lent sur grosses tables sans
index. **Mitigation** : tester sur jeu de données réaliste (1 000+
bénéficiaires), ajouter index `(projet_code, sexe)` si besoin.

### R2 — Conversion devises pour montants d'appui

Les structures peuvent être en MGA, EUR, USD, XOF. Afficher une somme
brute n'a pas de sens. **Mitigation V1** : afficher 1 KPI par devise
(« 1 200 000 MGA + 12 500 EUR ») ou n'afficher que le compte du
nombre de structures appuyées. **V2** : table de taux + conversion.

### R3 — Performance dashboard sur premier accès

Si on calcule 6 KPI + 2 charts + 3 listes au render, on peut dépasser
2s côté serveur. **Mitigation** : `Promise.all` pour paralléliser les
requêtes. Si insuffisant, vue matérialisée rafraîchie toutes les 5 min.

### R4 — Variantes par rôle = code conditionnel lourd

Risque : 4 versions du même composant qui divergent. **Mitigation** :
1 seul `DashboardPage` qui orchestre, et helpers `getKpiPourRole(role,
user)` qui encapsulent la variation.

## 7. Estimation effort

- KPI cards (queries + UI) : 2-3h
- 2 graphiques Recharts : 1-2h
- Section activité récente : 1h
- Variantes par rôle : 1-2h
- Tests unitaires (queries KPI) : 1h
- **Total estimé : 6-9h** sur une journée ou en 2 demi-journées.

## 8. Décisions à arbitrer (Carlos)

1. **Recharts ou alternative** ? (déjà dans deps ou à installer)
2. **Quels 4-6 KPI prioritaires** parmi la liste section 3-A ?
3. **Pie chart : sexe, âge ou domaine de formation** comme axe défaut ?
4. **Conversion devises** : V1 multi-lignes par devise OK, ou besoin
   d'une vraie agrégation EUR ?
5. **Variantes par rôle** : 1 page conditionnelle ou 4 pages distinctes ?
6. **Activité récente** : 5 lignes par catégorie OK, ou besoin d'un
   feed unifié chronologique ?

## 9. Procédure utilisateur cible

1. L'utilisateur (n'importe quel rôle) se connecte → atterrit sur
   `/dashboard` (déjà le cas en V1).
2. Voit immédiatement les chiffres clés de son périmètre.
3. Survole / clique sur un graphique pour voir le détail (V1.5).
4. Clique sur une ligne « activité récente » pour ouvrir la fiche
   correspondante.

## Changelog

| Version | Date | Changement |
|---------|------|------------|
| 0.1 | 2026-04-27 | Brouillon prospectif post sprint nocturne (en attente arbitrage). |
