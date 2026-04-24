# Étape 5 — CRUD structures B1 (cadrage léger)

> Ce cadrage est volontairement CONCIS. Les patterns architecturaux
> d'Étape 4 (bénéficiaires A1) sont réutilisés tels quels sauf
> spécification explicite — cf. `docs/collaboration-ia.md` §
> « Arbitrages par défaut ».
>
> Version : 1.0 — 25 avril 2026

## 1. Périmètre B1

**Indicateur B1** : structures appuyées par les projets OIF
(micro-entreprises, coopératives, associations, GIE, etc.) avec
un porteur/responsable désigné. L'entité est la **structure**,
la personne physique est secondaire.

### Source de vérité

- **Table SQL** : `public.structures` créée en migration
  `20260422000001_initial_schema.sql` — 26 colonnes métier + 5
  techniques (déjà en place).
- **Template V1** : `docs/references/Template_OIF_Emploi_Jeunes_V1.xlsx`
  feuille 3 « B1 Structures » — 22 colonnes affichées.
- **RLS** : `20260422000002_rls_policies.sql` — déjà écrite sur
  `structures` (4 rôles, même logique qu'A1).

### Colonnes exposées dans la V1

On expose **les 26 colonnes métier de la table** (un CRUD est
exhaustif par définition). Le brief initial mentionnait 13
colonnes ; l'écart s'explique par les champs dérivés (porteur
détaillé, géolocalisation, devise) ajoutés en modélisation.

Groupées en 5 sections pour le formulaire (analogue au pattern
5 cards d'A1) :

1. **Identité structure** : `nom_structure`, `type_structure_code`,
   `secteur_activite_code`, `secteur_precis`, `intitule_initiative`,
   `date_creation`, `statut_creation` (création / renforcement / relance)
2. **Rattachement** : `projet_code`, `pays_code`, `organisation_id`
3. **Porteur** : `porteur_prenom`, `porteur_nom`, `porteur_sexe`,
   `porteur_date_naissance`
4. **Appui** : `annee_appui`, `nature_appui_code`, `montant_appui`,
   `devise_code`
5. **RGPD & contacts** : `consentement_recueilli`,
   `consentement_date`, `telephone_porteur`, `courriel_porteur`,
   `localite`, `latitude`, `longitude`, `commentaire`

## 2. Différences avec l'Étape 4 bénéficiaires

| Champ / règle         | A1 bénéficiaires                | B1 structures                                     |
| --------------------- | ------------------------------- | ------------------------------------------------- |
| Entité principale     | Personne physique               | Structure (avec un porteur)                       |
| Tranche d'âge calculée | OUI (sur `date_naissance`)      | NON                                               |
| RGPD                  | Sur le bénéficiaire lui-même    | Sur le **porteur** (personne physique)            |
| Détection doublon     | `prenom + nom + date_naissance + projet` | `nom_structure + pays + projet`      |
| Champ monétaire       | Aucun                           | `montant_appui` + `devise_code`                   |
| Géolocalisation       | Aucune                          | `latitude`, `longitude` (NUMERIC 9,6)             |
| Warning qualité       | `qualite_a_verifier` (colonne générée) | Non requis en V1                           |

Les règles RGPD (consentement préalable, contacts uniquement
si consenti, date consentement ≤ date début) **s'appliquent à
l'identique** sur le porteur (la table `structures` a les mêmes
colonnes `consentement_*` et contacts).

Pas de date début/fin formation pour B1 → la règle RGPD « date
consentement ≤ date début formation » d'A1 devient ici « date
consentement ≤ date création structure » (analogue logique).

## 3. Patterns Étape 4 réutilisés tels quels

- Architecture 5 sous-étapes (5a → 5e)
- `lib/schemas/structure.ts` (analogue `beneficiaire.ts`)
- `lib/structures/queries.ts` + `mutations.ts` + `export.ts` +
  `export-helpers.ts` + `nomenclatures-cache.ts`
- `components/structures/` (20 fichiers analogues)
- Routes `app/(dashboard)/structures/{,nouveau,[id],[id]/modifier}`
- Pattern « saisie à la chaîne » Q1=B (pré-remplissage URL params)
- Export Excel Template V1 (feuille B1 au lieu d'A1)
- RLS 4 rôles (déjà en place)
- Design system OIF + bordure PS colorée + toasts Sonner

### Réutilisation de composants A1 partageables

Les composants suivants d'A1 sont **déjà génériques** et seront
partagés tels quels (pas de duplication) :

- `components/beneficiaires/badge-projet.tsx` → renommer en
  `components/shared/badge-projet.tsx` (première sous-étape 5a).
- `components/beneficiaires/consentement-badge.tsx` → idem.
- `components/beneficiaires/reprise-apres-enregistrement.tsx` →
  idem (saisie à la chaîne).

Les composants UI de bas niveau (`Select`, `Form`, etc.) sont
déjà dans `components/ui/`.

## 4. Arbitrages nouveaux (5 Q discriminantes)

> Claude Code propose une recommandation pour chaque. Carlos
> valide en 1 mot ou précise.

### Q1 — Recherche textuelle : nom_structure seulement, ou étendu au porteur ?

**Reco** : `nom_structure` UNIQUEMENT en V1. Rationnel : pour
une structure, on cherche l'entité (ex. « COOPAGRO »), pas la
personne. Le porteur peut être consulté via le filtre « Pays »
ou « Projet » si besoin. Étendre plus tard si retour utilisateur.
Implémentation : index GIN trigram déjà en place sur
`structures.nom_structure`.

### Q2 — Montant appui : format monétaire

**Reco** : stockage `NUMERIC(14,2)` (déjà en BDD), devise
configurable via `devise_code` (15 valeurs : XOF, EUR, USD, XAF,
MAD, CAD, GNF, etc. — déjà dans `DEVISES_CODES`). Affichage
formaté via `Intl.NumberFormat('fr-FR', { style: 'currency', currency: deviseCode })`.
Devise obligatoire si montant renseigné (contrainte BDD déjà
posée). Pas de conversion automatique inter-devises en V1.

### Q3 — Détection doublon B1

**Reco** : clé `(lower(unaccent(nom_structure)), pays_code, projet_code)`.
C'est l'index unique déjà posé sur la table en migration 001.
Créer une fonction SQL dédiée `find_structure_doublon(p_nom, p_pays, p_projet, p_exclude_id?)`
sur le modèle exact de `find_beneficiaire_doublon` (SECURITY
INVOKER, respect RLS, param d'exclusion pour l'édition).

### Q4 — Partenaire d'accompagnement (champ texte libre d'A1)

**Reco** : **SKIP en V1 sur B1**. Pour une structure, la
« structure d'accompagnement » est souvent le projet lui-même
(ou son opérateur). Ajouter un champ libre dans la table
reviendrait à dupliquer de l'information déjà captée par
`projet_code` + `organisation_id`. Remonter en V1.5 si retour
terrain justifie. **0 impact code** — la table n'a pas de
colonne `partenaire_accompagnement` pour B1.

### Q5 — Bonus couleurs PS sur badge projet

**Reco** : **OUI réutiliser**. Déplacer
`components/beneficiaires/badge-projet.tsx` → `components/shared/badge-projet.tsx`
dans la sous-étape 5a, et l'appeler depuis A1 et B1. Bordure
gauche colorée PS1/PS2/PS3 identique sur les deux indicateurs.

## 5. Spécificités à arbitrer pendant l'exécution

Ces points ne bloquent pas le cadrage, Claude Code les tranche
selon le pattern d'autonomie §3 de `collaboration-ia.md` et
remonte dans le rapport de sous-étape :

- **Latitude/longitude** : champs texte décimaux en V1 (ex.
  `12.6392`, `-8.0029`). Picker carte → ticket V1.5.
- **`statut_creation`** : Select à 3 valeurs (création /
  renforcement / relance). Affecte le KPI B1 (nouvelles
  structures vs structures renforcées) → valeur par défaut
  `création`, obligatoire.
- **`porteur_date_naissance`** : facultatif (même comportement
  qu'A1). Tranche d'âge du porteur non calculée en V1 (inutile
  pour B1).

## 6. Sous-étapes proposées

| Sous-étape | Portée                                                            | Est. lignes |
| ---------- | ----------------------------------------------------------------- | ----------- |
| **5a**     | Schémas Zod `structure.ts` + déplacement composants partagés + tests | ~200     |
| **5b**     | Liste + filtres (nom, projet, pays, type, secteur, année) + pagination + recherche trigram | ~450 |
| **5c**     | Formulaire création 5 sections + saisie à la chaîne + détection doublon + fonction SQL `find_structure_doublon` | ~350 |
| **5d**     | Détail (5 cards) + édition + soft-delete admin_scs                | ~350        |
| **5e**     | Export Excel Template V1 (feuille B1, 22 colonnes) + tests d'acceptance cycliques | ~400 |

**Total estimé** : ~1750 lignes (cohérent avec le brief ~1700).
Volume ~4× plus petit qu'A1 car :

- Pas de tranche d'âge calculée
- Pas de `qualite_a_verifier` généré
- Pas de `partenaire_accompagnement`
- Moins de règles cross-field (pas de date début/fin formation)
- Mais on garde la même complexité pour l'export Excel

## 7. Pattern autonomie élevée

Conformément à `docs/collaboration-ia.md` :

- Les décisions techniques (noms de fichiers, structure des tests,
  extraction de helpers, optimisations SQL) sont tranchées par
  Claude Code sans demander.
- Le pattern de rapport de sous-étape (8 sections) est
  systématiquement suivi.
- Seules les remontées sur règles métier nouvelles, UX non
  triviale ou impact roadmap montent à Carlos.

## Changelog

| Version | Date       | Changement                                       |
| ------- | ---------- | ------------------------------------------------ |
| 0.1     | 2026-04-25 | Cadrage léger initial (patterns Étape 4 réutilisés) |
