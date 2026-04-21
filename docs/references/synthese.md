# Synthèse des documents de référence — Plateforme OIF Emploi Jeunes

> Document de cadrage produit à l'étape 0 (avant tout développement).
> Source : `INSTRUCTION_CLAUDE_CODE.md`, `Cadre de mesure du rendement emploi V2.docx`, `Note méthodologique V2.docx`, `Template_OIF_Emploi_Jeunes_V1.xlsx`, et document normatif `00_NOMENCLATURE_PROJETS_OIF.md`.

---

## 1. Les 18 indicateurs du cadre commun

Le cadre de mesure du rendement V2 définit **18 indicateurs** répartis en **5 catégories** (A à D + marqueur transversal F). La lettre de catégorie concerne la **nature** de l'indicateur, pas le projet (voir § 4 pour la distinction critique avec les codes projets `PROJ_A*`).

### Catégorie A — Formation, compétences et insertion

| Code | Libellé | Type |
|------|---------|------|
| A1 | Nombre de jeunes formés | **Pivot — base de sondage** |
| A2 | Taux d'achèvement de la formation | Taux calculé |
| A3 | Taux de certification / attestation | Taux calculé |
| A4 | Gain de compétences | Enquête avant/après |
| A5 | Taux d'insertion professionnelle à 6 / 12 mois | Enquête longitudinale |

### Catégorie B — Activités économiques, entrepreneuriat et emploi

| Code | Libellé | Type |
|------|---------|------|
| B1 | Activités économiques appuyées | **Pivot — base de sondage** |
| B2 | Taux de survie à 12 / 24 mois | Enquête longitudinale |
| B3 | Emplois créés ou maintenus | Enquête auprès des porteurs |
| B4 | Emplois indirects (estimés) | Estimation documentée |

### Catégorie C — Intermédiation et accès aux opportunités

| Code | Libellé | Type |
|------|---------|------|
| C1 | Mises en relation effectives | Registre / plateforme |
| C2 | Taux de conversion en opportunités | Enquête post-mise en relation |
| C3 | Emplois obtenus | Enquête auprès des bénéficiaires |
| C4 | Délai d'accès à l'opportunité | Calcul sur dates |
| C5 | Satisfaction / utilité perçue | Enquête (module transversal) |

### Catégorie D — Écosystèmes et conditions de l'emploi

| Code | Libellé | Type |
|------|---------|------|
| D1 | Cadres / dispositifs politiques emploi-jeunes appuyés | Revue documentaire |
| D2 | Capacités institutionnelles emploi-jeunes renforcées | Mini-enquête / études de cas |
| D3 | Effets observables sur l'environnement | Qualitatif / études de cas |

### Marqueur transversal F — Langue française et employabilité

| Code | Libellé | Type |
|------|---------|------|
| F1 | Apport du français à l'employabilité | Module transversal greffé aux enquêtes A/B/C |

---

## 2. Logique A1/B1-pivot (en 10 lignes)

1. Les indicateurs **A1 (jeunes formés)** et **B1 (activités économiques appuyées)** sont les deux seuls indicateurs **exhaustivement collectés** à la source, via le template Excel standardisé.
2. Ils constituent deux **bases de sondage nominatives** : A1 = univers des individus, B1 = univers des structures.
3. A1 est alimenté par les listes de présence, fiches d'inscription, extractions de plateformes de formation.
4. B1 est alimenté par les conventions, Protocoles d'Accord de Subvention (PAS), rapports financiers, fichiers de suivi des partenaires.
5. **Tous les autres indicateurs sont dérivés de ces deux bases** : A2/A3 par chaînage administratif, A4/A5 par enquêtes longitudinales auprès des bénéficiaires A1.
6. De même, B2/B3 par enquêtes de suivi auprès des structures B1 ; B4 par estimation sectorielle à partir de B1.
7. Les indicateurs C1 à C5 s'appuient sur les registres d'intermédiation **rattachés aux bénéficiaires A1** (inscrits à un dispositif de mise en relation).
8. Les indicateurs D1 à D3 relèvent d'une collecte documentaire parallèle mais **contextualisée** par rapport au périmètre A1/B1.
9. Le marqueur F1 est un **module greffé** aux questionnaires A4, A5, C5 — jamais collecté seul.
10. Conséquence plateforme : la **fiabilité des contacts** (téléphone + courriel) dans A1/B1 conditionne toute la chaîne de mesure.

---

## 3. Cinq points de vigilance méthodologique

1. **Logique de contribution, pas d'attribution** — Sauf intervention directe tracée, aucun résultat (insertion A5, emplois B3/C3, survie B2, effets D3) ne peut être attribué mécaniquement à l'OIF. La plateforme doit permettre de documenter la contribution (lien plausible, faisceau d'indices), pas de revendiquer la causalité.

2. **Dédoublonnage et identifiants uniques** — Un même bénéficiaire peut suivre plusieurs formations (un seul ID personne, plusieurs inscriptions) ; une même structure peut recevoir plusieurs appuis (un seul ID structure, plusieurs interventions). Éviter les doubles comptes est explicitement cité dans A1, A3, B1, B3. La plateforme doit implémenter une détection doublon (prénom+nom+date_naissance ou nom_structure+pays).

3. **Définitions et seuils fixés AVANT la collecte** — Le seuil d'achèvement (A2), les mêmes outils T0 et T1 (A4, T0 impérativement avant tout apprentissage), la définition d'une « structure active » (B2), la qualification d'une « mise en relation aboutie » (C1), la notion d'« emploi » vs stage vs mission ponctuelle (A5, C3) : ces définitions doivent être paramétrables mais verrouillées par le SCS avant tout usage en production.

4. **Qualité des coordonnées de contact** — A5, B2, B3, C2, C3, C5, F1 reposent tous sur un contact à 6 / 12 / 24 mois. La note méthodologique insiste : « la qualité des informations de contact fiables conditionne l'efficacité du dispositif de relance ». Règle plateforme : au moins un canal (tel OU courriel) par bénéficiaire consentant ; bloquer l'enregistrement du contact sans consentement RGPD explicite.

5. **Phasage de la consolidation** — Première restitution juin 2026 centrée sur A1/B1 et indicateurs directement calculables (A2, A3). Approfondissement à l'automne pour C (nécessite plateformes d'intermédiation matures) et D (nécessite études de cas qualitatives). La plateforme doit donc distinguer dès la V1 **indicateurs « rapides »** (calcul automatique au fil de l'eau) et **indicateurs « enquête »** (cycle long, relances programmées).

---

## 4. Nomenclature officielle des projets

### 4.1. Codification officielle `PROG` / `PROJ_A*`

La nomenclature normative des projets est **hiérarchique à trois niveaux** (source : `00_NOMENCLATURE_PROJETS_OIF.md`) :

1. **Programme Stratégique** : `PS1`, `PS2`, `PS3` — regroupements thématiques.
2. **Projet** : `PROJ_A01a` à `PROJ_A20` — unité opérationnelle. **22 projets au total.**
3. **Résultat attendu** : `A11111`, `A11331`, etc. — granularité réservée à une V2 ultérieure.

Les trois Programmes Stratégiques officiels :

| Code | Libellé |
|------|---------|
| PS1 | La langue française au service des cultures et de l'éducation |
| PS2 | La langue française au service de la démocratie et de la gouvernance |
| PS3 | La langue française, vecteur de développement durable |

### 4.2. Conflit de codification A — indicateurs vs projets

**Point critique.** Deux taxonomies indépendantes utilisent la lettre « A » :

- **Indicateurs** : `A1`, `A2`, `A3`, `A4`, `A5` → catégorie « Formation-compétences ».
- **Projets** : `PROJ_A14`, `PROJ_A15`, … → préfixe de la codification OIF (axe stratégique A, indépendant du cadre de mesure).

**Règle de nommage impérative dans le code** :

- `projet_code` (TEXT) contient des valeurs `PROJ_A14`, `PROJ_A16a`, … — contrainte Zod `/^PROJ_A\d{2}[a-z]?$/` ou `z.enum([...22 codes])`.
- `indicateur_code` (TEXT) contient des valeurs `A1`, `B2`, `C5`, `D1`, `F1` — contrainte Zod `/^[ABCDF]\d$/`.

Ne jamais utiliser de champ commun ou de type alias qui confondrait les deux. Les messages d'erreur et libellés UI doivent parler de « projet » ou « indicateur », jamais de « code A » seul.

### 4.3. Périmètre des 8 projets emploi jeunes

Sur les 22 projets de la programmation, **8 sont directement concernés** par la plateforme emploi jeunes (tous rattachés à `PS3`) :

| Code | Libellé officiel | Rôle emploi jeunes |
|------|-----------------|-------------------|
| PROJ_A14 | La Francophonie avec Elles | **Pivot EFH — catégorie B** |
| PROJ_A15 | Innovations et plaidoyers francophones | Secondaire A / B / D |
| PROJ_A16a | D-CLIC : Formez-vous au numérique | **Pivot formation — catégorie A** |
| PROJ_A16b | Gouvernance numérique | Secondaire |
| PROJ_A17 | Promotion des échanges économiques et commerciaux francophones | **Pivot intermédiation — catégorie C** |
| PROJ_A18 | Accompagnement des transformations structurelles en matière d'environnement et de climat | **Pivot écosystèmes — catégorie D** |
| PROJ_A19 | Soutien aux initiatives environnementales dans le Bassin du Congo | Secondaire |
| PROJ_A20 | Promotion du tourisme durable | Secondaire |

Les 14 autres projets (PROJ_A01a à PROJ_A13) figurent dans la table `projets` mais avec `concerne_emploi_jeunes = FALSE` ; ils sont filtrés par défaut dans les listes déroulantes. Seul le marqueur F1 (langue française) peut leur être rattaché lorsqu'une activité d'employabilité y est greffée.

Règles dérivées :

- Seed SQL : **les 22 projets** avec libellés reproduits **exactement** (apostrophes typographiques `'`, majuscules officielles, accents), colonnes `code`, `libelle`, `programme_strategique` (valeurs `PS1` / `PS2` / `PS3`), `concerne_emploi_jeunes`, `ordre_affichage`, `actif`.
- UI : toujours afficher « `PROJ_A14` — La Francophonie avec Elles » (code + libellé), jamais le code nu.
- Filtrage par défaut sur `concerne_emploi_jeunes = TRUE`, toggle admin pour voir les 22.

### 4.4. Mapping de rétro-compatibilité avec l'ancienne nomenclature

**⚠️ Avertissement template V1.** Le fichier `Template_OIF_Emploi_Jeunes_V1.xlsx` utilise une **nomenclature abrégée obsolète** (`P14`, `P16`, `P17`, `PEJ`, etc., visible feuille 5 colonnes D-E). Cette nomenclature sera corrigée en V2 du template. En attendant :

- **Base de données et seed SQL** : utiliser **exclusivement** les codes officiels `PROJ_A*`.
- **Parser Excel d'import** : accepter les anciens codes et **remapper automatiquement** selon la table ci-dessous, avec émission d'un **avertissement de traçabilité** (jamais une erreur bloquante).
- **Export Excel** : toujours sortir avec les codes officiels `PROJ_A*`, ne plus jamais propager les codes abrégés.

| Ancien code (template V1) | Code officiel cible |
|---|---|
| P14 | PROJ_A14 |
| P15 | PROJ_A15 |
| P16 | PROJ_A16a |
| P16a | PROJ_A16a |
| P16b | PROJ_A16b |
| P17 | PROJ_A17 |
| P18 | PROJ_A18 |
| P19 | PROJ_A19 |
| P20 | PROJ_A20 |
| PEJ | À clarifier avec le SCS (probablement nouveau projet non codifié) |
| P6, P9, P13 | À clarifier — hors périmètre emploi jeunes ou codes historiques |

**Règle absolue anti-erreur** : un code inconnu (hors liste officielle et hors table de mapping) **bloque la ligne d'import** avec le message : `"Code projet '{valeur}' inconnu — voir /docs/references/00_NOMENCLATURE_PROJETS_OIF.md"`. Ne jamais deviner ni inventer un mapping.

---

## 5. Alerte sur les nomenclatures du Template Excel V1

Au-delà des codes projets, la feuille 5 du template contient d'autres nomenclatures à reprendre **exactement** dans le seed SQL (`/supabase/seed.sql`) : 61 codes pays ISO-3, 16 domaines de formation, 17 secteurs d'activité, 9 types de structure, 8 natures d'appui, 14 devises, 3 modalités de formation, 5 statuts bénéficiaire.

**Divergence connue** : la colonne `D` (Code projet) de la feuille 5 utilise les codes abrégés obsolètes — à ignorer au profit de la nomenclature `PROJ_A*` officielle documentée § 4.

Toute valeur en nomenclature fermée doit être une clé étrangère vers la table de référentiel correspondante, jamais du texte libre (évite le problème historique « Cameroun » vs « Cameroon »).

---

## 6. Conséquences pour l'architecture V1

- Table `projets` : 22 lignes seedées, PK = `code` (ex. `PROJ_A14`).
- Table `indicateurs` : 18 lignes seedées, PK = `code` (ex. `A1`).
- Colonnes `projet_code` et `indicateur_code` sur les tables métier, contraintes FK séparées.
- Validation Zod : deux regex / enums distincts, jamais de type commun.
- Import Excel tolérant : mapping `P*` → `PROJ_A*` avec warning dans `imports_excel.rapport_erreurs`.
- Export Excel : codes officiels uniquement.
- UI : libellés complets affichés, codes en badges discrets.

---

## 7. Glossaire des acronymes

| Sigle | Signification |
|-------|---------------|
| OIF | Organisation Internationale de la Francophonie |
| SCS | Service de Conception et Suivi de projet (maître d'ouvrage de la plateforme) |
| PAS | Protocole d'Accord de Subvention (document contractuel de financement, alimente la base B1) |
| PS1 / PS2 / PS3 | Programmes Stratégiques de la programmation OIF |
| PROJ_A* | Codification hiérarchique officielle des 22 projets OIF |
| EFH | Égalité Femmes–Hommes (marqueur du projet PROJ_A14) |
| AGR | Activité Génératrice de Revenus |
| RGPD | Règlement Général sur la Protection des Données |
| RLS | Row Level Security (sécurité au niveau des lignes, Supabase/PostgreSQL) |

---

**⏸ Stop étape 0 — attente validation humaine avant initialisation du projet Next.js (étape 1).**
