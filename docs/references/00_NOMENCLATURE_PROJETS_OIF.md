# Nomenclature officielle des projets — Programmation OIF

> **Document de référence normatif.** Ce fichier définit les codes et libellés officiels des projets de la programmation OIF. Il fait **autorité** sur toute autre nomenclature rencontrée dans les autres documents (y compris le `Template_OIF_Emploi_Jeunes_V1.xlsx`).
>
> **Source** : fichier `Liste_de_projets_selon_la_Programmation_OIF.xlsx` transmis par le SCS.

## Architecture de la codification

La codification OIF est **hiérarchique à trois niveaux** :

1. **Programme** : `PROG 1` / `PROG 2` / `PROG 3` — regroupement thématique des projets
2. **Projet** : `PROJ_A01` à `PROJ_A20` — unité opérationnelle principale
3. **Code détaillé** : `A1111`, `A11111`, `A11112`… — sous-actions et résultats attendus

**⚠️ Point d'attention critique** : ne pas confondre cette codification de **projets** avec la classification des **indicateurs** (catégories A / B / C / D / F du cadre de mesure). Ce sont deux taxonomies **orthogonales** :

- La codification **PROJ_A01 à PROJ_A20** = nomenclature des projets OIF
- Les catégories **A / B / C / D / F** du cadre de mesure = classification des indicateurs (formation, économie, intermédiation, écosystèmes, français)

Le fait que les deux utilisent la lettre « A » dans leur codification est une coïncidence malheureuse. Dans le code, toujours préfixer explicitement :

- Projets : `projet_code` avec valeur `PROJ_A14`
- Indicateurs : `indicateur_code` avec valeur `A1`, `B2`, `C5`, etc.

## Liste officielle des 3 programmes

| Code | Libellé |
|------|---------|
| PROG 1 | La langue française au service des cultures et de l'éducation |
| PROG 2 | La langue française au service de la démocratie et de la gouvernance |
| PROG 3 | La langue française, vecteur de développement durable |

## Liste officielle des 22 projets

### Programme 1 — Langue française, cultures et éducation

| Code projet | Libellé officiel | Concerné par emploi jeunes ? |
|---|---|---|
| PROJ_A01a | La langue française, langue internationale | Non |
| PROJ_A01b | Observatoire de la langue française | Non |
| PROJ_A01c | Création culturelle, artistique et production de connaissance en français | Non |
| PROJ_A02 | La langue française, langue d'enseignement et d'apprentissage | Non |
| PROJ_A03 | Initiative francophone pour la formation à distance des maîtres (IFADEM) | Non |
| PROJ_A04 | École et langues nationales (ELAN) | Non |
| PROJ_A05 | Acquérir des savoirs, découvrir le monde | Non |
| PROJ_A06 | Industries culturelles et découvrabilité : une ambition francophone et mondiale | Non |
| PROJ_A07 | Jeux de la Francophonie | Non |
| PROJ_A08 | Radio Jeunesse Sahel | Non |

### Programme 2 — Langue française, démocratie et gouvernance

| Code projet | Libellé officiel | Concerné par emploi jeunes ? |
|---|---|---|
| PROJ_A09 | État civil | Non |
| PROJ_A10 | Renforcement de l'État de droit, des droits de l'Homme et de la justice | Non |
| PROJ_A11 | Prévention et lutte contre les désordres de l'information | Non |
| PROJ_A12 | Accompagnement des processus démocratiques | Non |
| PROJ_A13 | Soutien à la paix et à la stabilité | Non |

### Programme 3 — Langue française, vecteur de développement durable

| Code projet | Libellé officiel | Concerné par emploi jeunes ? |
|---|---|---|
| PROJ_A14 | La Francophonie avec Elles | **Oui — pivot EFH** |
| PROJ_A15 | Innovations et plaidoyers francophones | **Oui** |
| PROJ_A16a | D-CLIC : Formez-vous au numérique | **Oui — pivot formation** |
| PROJ_A16b | Gouvernance numérique | **Oui** |
| PROJ_A17 | Promotion des échanges économiques et commerciaux francophones | **Oui — pivot intermédiation** |
| PROJ_A18 | Accompagnement des transformations structurelles en matière d'environnement et de climat | **Oui** |
| PROJ_A19 | Soutien aux initiatives environnementales dans le Bassin du Congo | **Oui** |
| PROJ_A20 | Promotion du tourisme durable | **Oui** |

## Correspondance avec l'ancienne nomenclature abrégée

Pendant la phase initiale du projet, des codes abrégés (P6, P14, P15, P16, P17, P18, P19, P20, PEJ) ont été utilisés dans certains documents internes et dans la première version du template Excel. Le seed SQL de la base de données **doit utiliser exclusivement les codes officiels `PROJ_A*`**, mais la plateforme doit **accepter les anciens codes en import** via un mapping de compatibilité.

| Ancien code abrégé | Code officiel à utiliser |
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
| PEJ (« nouveau projet emploi jeunesse ») | À clarifier avec le SCS — probablement un nouveau projet non encore codifié |
| P6, P9, P13 | À clarifier avec le SCS — projets hors périmètre emploi jeunes ou codes anciens |

## Projets prioritaires pour la plateforme emploi jeunes

D'après le cadre de mesure V2, les projets directement concernés par les 18 indicateurs emploi jeunes sont, par ordre de priorité :

1. **PROJ_A16a — D-CLIC : Formez-vous au numérique** : pivot de la catégorie A (formation) ; cible directe : *« améliorer l'insertion professionnelle des femmes et des jeunes francophones, augmenter leurs chances d'accéder à des emplois décents »*.
2. **PROJ_A14 — La Francophonie avec Elles** : pivot de la catégorie B (AGR, micro-entreprises portées par des femmes).
3. **PROJ_A17 — Promotion des échanges économiques et commerciaux francophones** : pivot de la catégorie C (intermédiation, mises en relation B2B).
4. **PROJ_A18 — Accompagnement des transformations environnement/climat** : pivot de la catégorie D (écosystèmes, politiques publiques).
5. **PROJ_A15, PROJ_A16b, PROJ_A19, PROJ_A20** : projets à composante secondaire emploi jeunes selon contexte.
6. **Tous les projets de PROG 1 et PROG 2** : concernés uniquement au titre du marqueur transversal **F1 (apport du français à l'employabilité)**, dans la mesure où une activité d'employabilité y est greffée.

## Règles d'implémentation pour la plateforme

1. **Table `projets` dans Supabase** : doit contenir les 22 projets listés ci-dessus, avec les colonnes `code` (PRIMARY KEY, valeur `PROJ_A14` etc.), `libelle` (texte complet), `programme` (`PROG 1` / `PROG 2` / `PROG 3`), `concerne_emploi_jeunes` (BOOLEAN), `ordre_affichage` (INT pour l'UI), `actif` (BOOLEAN, DEFAULT TRUE).

2. **Seed SQL** : fournir les 22 projets d'un coup, ne pas en oublier. Les libellés doivent être reproduits **exactement** comme ci-dessus (respect des majuscules officielles, des accents, des apostrophes typographiques `'` et non droites `'`).

3. **Filtrage par défaut dans l'UI** : afficher par défaut uniquement les projets où `concerne_emploi_jeunes = TRUE` dans les listes déroulantes des formulaires bénéficiaires et structures. Un toggle admin permet d'afficher tous les projets.

4. **Import Excel tolérant** : le parser d'import doit accepter les anciens codes (`P14`, `P16`, `P16a`, `PEJ`…) et les remapper automatiquement vers les codes officiels selon la table de correspondance ci-dessus. Émettre un avertissement (pas une erreur) lors du remapping, pour traçabilité.

5. **Export Excel** : toujours exporter avec les codes officiels `PROJ_A*`. Ne plus propager les codes abrégés.

6. **API** : le champ `projet_code` dans toutes les entités (bénéficiaires, structures, enquêtes) doit respecter la contrainte FK vers `projets.code`. Validation Zod : `/^PROJ_A\d{2}[a-z]?$/` ou `z.enum([...liste_codes])`.

7. **Affichage UI** : ne jamais afficher le code seul (`PROJ_A14`) sans le libellé. Toujours utiliser le format « PROJ_A14 — La Francophonie avec Elles » dans les listes déroulantes, ou afficher uniquement le libellé avec le code en tooltip/badge discret.

## Structure des codes détaillés (pour référence future)

Les codes à 5-6 chiffres (ex : `A11111`, `A11171`, `A11331`) correspondent aux **résultats attendus** des projets, selon une structure hiérarchique :

- `A` = Axe stratégique
- `1` = 1er chiffre du niveau programme
- `1` = 2e chiffre du programme (1, 2 ou 3)
- `1` = 3e chiffre du niveau projet (0 à 9 puis lettre)
- Puis numéros séquentiels du résultat

Exemple : `A11331` = Axe A, Programme 1, Sous-programme 1, Projet 33 (= PROJ_A16a), Résultat 1. **Cette granularité n'est pas nécessaire pour la V1 de la plateforme** — on se limite au niveau projet (`PROJ_A*`). À prévoir éventuellement en V2 si le SCS souhaite tracer les indicateurs au niveau des résultats attendus.

## Règle absolue anti-erreur

**Ne jamais inventer un code projet.** Si, lors de l'import ou de la saisie, un code apparaît qui n'est pas dans cette liste ni dans la table de correspondance :

1. **Arrêter l'import de la ligne concernée**
2. **Émettre une erreur explicite** dans le rapport d'import : `"Code projet '{valeur}' inconnu — voir /docs/references/nomenclature-projets.md pour la liste officielle"`
3. **Ne pas tenter de deviner** la correspondance

Les 22 projets listés ici sont la référence. Si un partenaire introduit un code inconnu, c'est une erreur de saisie à corriger en amont, pas une tolérance à accorder en aval.
