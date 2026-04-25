# Étape 6 — Collecte des enquêtes (cadrage)

> Cadrage rédigé en autonomie élargie (cf. GO Carlos 25/04/2026). Identifie
> un point bloquant à arbitrer **avant** de lancer 6a (cf. § Questions
> stratégiques).
>
> Version : 1.0 — 25 avril 2026

## 1. État de l'art à date

### 1.1 BDD déjà en place (migration `001_initial_schema`)

La table `public.reponses_enquetes` existe **depuis l'Étape 2** avec
exactement le bon design :

```sql
CREATE TABLE public.reponses_enquetes (
  id UUID PRIMARY KEY,
  indicateur_code TEXT NOT NULL REFERENCES public.indicateurs(code),
  beneficiaire_id UUID REFERENCES public.beneficiaires(id),
  structure_id UUID REFERENCES public.structures(id),
  projet_code TEXT REFERENCES public.projets(code),
  donnees JSONB NOT NULL DEFAULT '{}'::jsonb,   -- payload validé Zod
  date_collecte DATE NOT NULL DEFAULT CURRENT_DATE,
  vague_enquete vague_enquete NOT NULL,         -- 6_mois|12_mois|24_mois|...
  canal_collecte canal_collecte NOT NULL,       -- formulaire_web|email|sms|...
  agent_collecte UUID REFERENCES auth.users(id),
  lien_public_token TEXT,                       -- pour formulaires publics
  created_at, updated_at, created_by, deleted_at
)
```

- **RLS déjà posée** (migration 002) : SELECT/INSERT/UPDATE/DELETE_admin
  avec helpers `can_read_beneficiaire` / `can_read_structure`.
- **Triggers** `tg_set_updated_at` + audit sur INSERT/UPDATE/DELETE déjà actifs.
- **Index GIN** sur `donnees` JSONB pour requêtes filtrées par champ.
- **Contrainte CHECK** : une réponse cible *soit* un bénéficiaire, *soit*
  une structure, *soit* un projet (pour D1/D2/D3).

### 1.2 Catalogue d'indicateurs (seed.sql)

18 indicateurs déjà seedés dans `public.indicateurs` :

| Code | Catégorie | Libellé | Statut V1 |
|------|-----------|---------|-----------|
| A1 | A | Nb jeunes formés | ✅ Étape 4 (pivot) |
| A2 | A | Taux d'achèvement | 🔜 Étape 6 (Q A206) |
| A3 | A | Certification | 🔜 Étape 6 (Q A208) |
| A4 | A | Gain compétences | 🔜 Étape 6 (Q A301-303) |
| A5 | A | Insertion 6/12 mois | 🔜 Étape 6 (Q A401-409) |
| B1 | B | Activités économiques | ✅ Étape 5 (pivot) |
| B2 | B | Survie 12/24 mois | 🔜 Étape 6 (Q B204) |
| B3 | B | Emplois créés/maintenus | 🔜 Étape 6 (Q B208-213) |
| B4 | B | Emplois indirects | 🔜 Étape 6 (Q B301-302) |
| C1 | C | Mises en relation effectives | ⚠ Pas de questionnaire |
| C2 | C | Conversion en opportunités | ⚠ Pas de questionnaire |
| C3 | C | Emplois obtenus | ⚠ Pas de questionnaire |
| C4 | C | Délai d'accès | ⚠ Pas de questionnaire |
| C5 | C | Satisfaction / utilité | ⚠ Pas de questionnaire dédié |
| D1 | D | Cadres politiques appuyés | ❌ Hors scope V1 (revue documentaire) |
| D2 | D | Capacités institutionnelles | ❌ Hors scope V1 |
| D3 | D | Effets environnement | ❌ Hors scope V1 |
| F1 | F | Apport du français | 🔜 Module transversal (Q A407) |

### 1.3 Questionnaires officiels disponibles

Seuls **2 documents** sont archivés dans `docs/specifications/questionnaires/` :

- **Questionnaire A** (35 questions, 4 sections) — couvre A2, A3, A4, A5,
  F1 partiel (Q407)
- **Questionnaire B** (22 questions, 3 sections) — couvre B2, B3, B4

**Aucun questionnaire C** ni F autonome n'existe à ce jour.

## 2. Questions stratégiques (BLOQUANTES — STOP avant 6a)

> Ces 3 questions impliquent un choix de périmètre et de roadmap qui
> dépasse les arbitrages techniques d'autonomie. À arbitrer par Carlos
> avant lancement de 6a.

### Q1 — Indicateurs C1-C5 : que faire en V1 ?

Le brief utilisateur mentionne « Questionnaire C (satisfaction, effets
systémiques) ». Mais :

- **Aucun questionnaire C** dans `docs/specifications/questionnaires/`.
- **C1-C4** (mises en relation, conversion, emplois obtenus, délai d'accès)
  sont des indicateurs d'**intermédiation** qui ne se collectent pas
  auprès du bénéficiaire/structure mais auprès de la **plateforme
  d'intermédiation** elle-même (un opérateur tiers). Données différentes,
  rythme différent, source différente.
- **C5** (satisfaction) est techniquement déjà collecté **dans les
  questionnaires A et B existants** :
  - Q A209 « Êtes-vous satisfait de la formation suivie ? »
  - Q B304 « Êtes-vous satisfait de l'appui de l'OIF ? »

**Trois options** :

- **Option 1 (recommandée)** — Scope V1 = A + B uniquement. C5 est dérivé
  automatiquement à partir de Q A209 et Q B304 (création de 2 lignes
  `reponses_enquetes` à chaque soumission : une pour A2/A3/A4/A5 et une
  pour C5 satisfaction). C1-C4 reportés en Étape 6.5 ou V1.5 quand un
  questionnaire C sera fourni.
- **Option 2** — On invente un mini-questionnaire C ad hoc en V1
  (3-4 questions inspirées du seed `definition`). Risque : non aligné
  avec le futur questionnaire officiel → reprise de données pénible.
- **Option 3** — On scope V1 = A + B uniquement, on ne touche PAS à C
  jusqu'à réception du questionnaire officiel.

### Q2 — Indicateurs F1 : module transversal vs questionnaire dédié ?

Le brief mentionne « Questionnaire F (usage langue française,
intermédiation) ». Mais :

- F1 « Apport du français à l'employabilité » est conçu comme **module
  transversal** (cf. `docs/backlog.md` § Étape 6 et Note méthodologique
  V2 § 5.5).
- Q A407 « Pensez-vous que votre usage du français a facilité l'accès ou
  l'amélioration de l'emploi » est l'unique question F1 dans les
  questionnaires existants.

**Recommandation** : F1 = champ `donnees.francais_facilite_emploi` (boolean)
extrait de Q A407 du questionnaire A. Pas de questionnaire F dédié en V1.
Si la Note méthodologique V2 § 5.5 prévoit 3-5 questions courtes
(comme indiqué dans le backlog), elles seront ajoutées en Étape 6.5
**après lecture du document** (à fournir si disponible).

### Q3 — Indicateurs D1-D3 : confirmation hors scope V1 ?

D1-D3 (cadres politiques, capacités institutionnelles, effets environnement)
relèvent de la **revue documentaire** par les chefs de projet OIF, pas
d'enquête de terrain. Pas de questionnaire = pas de formulaire React.

**Recommandation** : confirmer hors scope V1 (page d'admin manuelle
ad hoc reportée à V1.5).

## 3. Périmètre V1 proposé (sous réserve d'arbitrage Q1-Q3)

### 3.1 Scope retenu

**2 questionnaires officiels** + module F1 transversal + dérivation C5 :

- **Questionnaire A** (35Q, 4 sections) → 4 indicateurs (A2, A3, A4, A5)
  + F1 (Q407) + C5 (Q209)
- **Questionnaire B** (22Q, 3 sections) → 3 indicateurs (B2, B3, B4)
  + C5 (Q304)

### 3.2 Modèle de stockage (par soumission de questionnaire A complet)

Une soumission de questionnaire A produit **plusieurs lignes**
`reponses_enquetes` (une par indicateur calculé) :

```jsonc
// Ligne 1 — Indicateur A2 (achèvement)
{
  "indicateur_code": "A2",
  "beneficiaire_id": "uuid",
  "vague_enquete": "12_mois",
  "donnees": {
    "a_participe": true,        // Q201
    "nb_formations": 1,         // Q202
    "type_formation": "FP_TECH", // Q203
    "duree_formation": "1_3_MOIS", // Q205
    "achevement": "100",        // Q206 (100|70|moins70)
    "raison_non_achevement": null, // Q207 (si applicable)
    "_questions_brutes": { "201": 1, "202": 1, ... } // archive intégrale
  }
}

// Ligne 2 — Indicateur A3 (certification)
{ "indicateur_code": "A3", ... "donnees": { "certifie": true, ... } }

// Ligne 3 — Indicateur A4 (gain compétences)
{ "indicateur_code": "A4", ... "donnees": { "niveau_avant": 2, "niveau_apres": 4, ... } }

// Ligne 4 — Indicateur A5 (insertion)
{ "indicateur_code": "A5", ... "donnees": { "situation_avant": "...", "annee_acces": 2025, ... } }

// Ligne 5 — Indicateur F1 (usage français)
{ "indicateur_code": "F1", ... "donnees": { "francais_facilite_emploi": true } }

// Ligne 6 — Indicateur C5 (satisfaction)
{ "indicateur_code": "C5", ... "donnees": { "satisfaction": 3, "raison_insatisfaction": null } }
```

**Avantages** :

- Agrégations Étape 9 par `indicateur_code` (pas de parsing JSONB transversal).
- Vague de sondage différenciée par indicateur (A4 = `avant_formation`/
  `fin_formation`, A5 = `12_mois`, etc.).
- Chaque soumission = transaction atomique (`INSERT INTO reponses_enquetes
  ... RETURNING id` × N dans un Server Action).

### 3.3 Concept de "session d'enquête" (groupe technique)

Pour relier les N lignes d'une soumission unique, on ajoute :

```sql
ALTER TABLE public.reponses_enquetes
  ADD COLUMN session_enquete_id UUID;
CREATE INDEX idx_reponses_session ON public.reponses_enquetes(session_enquete_id);
```

Une "session" = un UUID partagé par toutes les lignes issues d'**une**
soumission de questionnaire. Permet :

- Affichage groupé dans `/enquetes/[id]` (toutes les réponses d'une session)
- Réouverture pour modification (admin_scs : retire toutes les lignes
  de la session, ré-insère)
- Soft-delete groupé (chaque ligne a son `deleted_at`, mais le filtre
  liste regroupe par session)

### 3.4 Brouillon (anti-perte)

Sauvegarde locale `localStorage` (pas de table BDD) avec clé
`enquete:draft:{questionnaire}:{cible_id}` mise à jour à chaque
`onChange` debouncé (300 ms). Vidée à soumission réussie.

**Pas de "session de brouillon serveur"** en V1 — le coût (table
dédiée + sync + nettoyage) dépasse le bénéfice pour 60 partenaires
sur formulaire de 5-15 minutes.

## 4. Découpage en sous-étapes (à confirmer après arbitrage Q1-Q3)

| Sous-étape | Portée | Est. lignes |
|------------|--------|-------------|
| **6a** | Migration `session_enquete_id` + RPC search + nomenclatures (libellés codés Q A203/A205/A405/A408 etc.) + RLS si manque | ~250 |
| **6b** | Schémas Zod par indicateur (`a2Schema`, `a3Schema`, `a4Schema`, `a5Schema`, `b2Schema`, `b3Schema`, `b4Schema`, `f1Schema`, `c5Schema`) + composants purs (RadioGroup, Likert, conditionnels) | ~600 |
| **6c** | Page liste `/enquetes` + filtres (questionnaire, cible, projet, vague, statut) + recherche + pagination | ~500 |
| **6d** | Page saisie `/enquetes/nouvelle` (sélection cible + questionnaire) + multi-sections + sauvegarde brouillon localStorage + logique « ALLER À » | ~800 |
| **6e** | Server Action `soumettreEnquete` (multi-INSERT atomique) + calcul indicateurs dérivés + détail `/enquetes/[id]` + soft-delete admin_scs | ~500 |
| **6f** | Export Excel (1 feuille par indicateur ou 1 feuille par questionnaire — à arbitrer) + tests d'acceptance | ~600 |

**Total estimé** : ~3250 lignes (vs ~3000 pour Étape 5 — un peu plus
volumineux car logique de filtres « ALLER À » non triviale et 9 schémas
Zod distincts).

**Estimation temps** : 4-6 h en autonomie max si Q1-Q3 sont
clarifiées rapidement. Si Carlos veut C complet → 8-10 h (mais sans
base documentaire = risque de reprise).

## 5. Patterns Étapes 4-5 réutilisés

- Architecture multi-sous-étapes avec commits atomiques + tests verts
- `lib/enquetes/queries.ts` + `mutations.ts` + `export.ts` + `export-helpers.ts`
- `components/enquetes/` (formulaires + table + filtres + bouton-exporter)
- Routes `app/(dashboard)/enquetes/{,nouvelle,[id]}`
- RLS 4 rôles (déjà en place côté `reponses_enquetes`)
- Design system OIF + bordure PS colorée + toasts Sonner
- Pattern d'export 3 feuilles (data + metadata + nomenclatures cachées)
- Pattern fix React Strict Mode 5h conservé (`reactStrictMode: false`)

## 6. Risques techniques identifiés

### R1 — Logique « ALLER À » (filtres conditionnels)

Implémentation déclarative requise (pas de `if/else` câblé) pour permettre
la mise à jour des questionnaires sans toucher au code. Pattern envisagé :

```ts
type Question = {
  id: string;
  type: 'choix_unique' | 'choix_multiple' | 'texte_court' | 'nombre' | 'echelle';
  libelle: string;
  options?: Array<{ valeur: string | number; libelle: string }>;
  obligatoire?: boolean;
  saute_si?: { question_id: string; valeur_egale: unknown; aller_a: string };
};
```

Risque : la complexité de Q207 → Q208 (« Si Non → 207, sinon → 208 ») peut
masquer des cas-limites. Mitigation : tests unitaires sur le moteur de
règles avec snapshots des questionnaires V2.

### R2 — Cible bénéficiaire : visibilité limitée par RLS

Un `contributeur_partenaire` ne voit que ses propres bénéficiaires.
La page `/enquetes/nouvelle` doit présenter un Select de cibles **filtré
par RLS** automatiquement. Réutilise les helpers existants
`can_read_beneficiaire` / `can_read_structure`.

### R3 — Volumétrie (pas un risque V1)

5 623 bénéficiaires × 4 indicateurs × 2 vagues = ~45 000 lignes max.
Avec index GIN sur `donnees`, requêtes liste paginées ≤ 100 ms.
**Aucun travail d'optim spécifique V1**.

### R4 — Liens publics (formulaire ouvert sans authentification)

`lien_public_token` existe en BDD mais nécessite :

- Génération token unique avec expiration
- Route Handler API publique (sans auth) qui valide le token
- Anti-spam (captcha ? rate limit IP ?)

**Recommandation** : reporter en sous-étape 6.5 ou V1.5. En V1, les
formulaires sont saisis par les `contributeur_partenaire` authentifiés
(modèle « partenaire = enquêteur » du brief utilisateur original).

### R5 — Calculs d'indicateurs dérivés (pour dashboard Étape 9)

A2 = (nb achèvement = 100% / nb total) × 100 — calculé par RPC
PostgreSQL côté Étape 9, pas Étape 6. **Hors scope cette étape** :
on stocke les réponses brutes, l'agrégation est faite à la consultation.

## 7. Pattern autonomie élevée (post-arbitrage)

Conformément à `docs/collaboration-ia.md` § 3 :

- Décisions techniques (noms fichiers, structure tests, helpers, optims SQL,
  format de l'export) tranchées sans demander.
- Pattern de rapport groupé toutes les 2-3 sous-étapes.
- Seules les remontées sur règles métier nouvelles ou impact roadmap
  → Carlos.
- Push après chaque commit.
- Build + tests verts AVANT chaque commit.

## 8. STOP & VALIDATE

Le présent cadrage est commité **sans démarrer 6a**. J'attends arbitrage
Carlos sur :

- **Q1** : C1-C5 — Option 1 (A209/B304 → C5 auto, C1-C4 reportés) ?
- **Q2** : F1 — module Q407 uniquement, suffisant pour V1 ?
- **Q3** : D1-D3 — confirmé hors scope V1 ?

Une fois validé (1 message court suffit, ex. « Q1=Opt1, Q2=OK, Q3=hors V1,
GO 6a »), je démarre la série 6a → 6f en autonomie sans nouvelle pause.

## Changelog

| Version | Date       | Changement                                                                          |
| ------- | ---------- | ----------------------------------------------------------------------------------- |
| 1.0     | 2026-04-25 | Cadrage initial post-lecture questionnaires A/B + identification 3 questions strats |
