# Étape 4 — CRUD Bénéficiaires A1 — Document de cadrage

> Document de travail produit **avant** tout code. Validation requise avant passage à l'implémentation.

Statut : 🔵 En attente de validation produit (questions section 5).

---

## 1. Objectif fonctionnel

À la fin de l'Étape 4, un utilisateur connecté peut, selon son rôle :

| Rôle | Lister | Voir détail | Créer | Modifier | Supprimer (soft) |
|------|:------:|:-----------:|:-----:|:--------:|:----------------:|
| `admin_scs` | ✅ tous | ✅ | ✅ | ✅ | ✅ |
| `editeur_projet` | ✅ projets de son organisation | ✅ idem | ✅ dans ses projets | ✅ idem | ⚠️ soft-delete uniquement sur ses projets |
| `contributeur_partenaire` | ✅ ses propres lignes + celles de son organisation | ✅ idem | ✅ rattaché à son organisation | ✅ sur ses propres lignes + celles de son organisation | ⚠️ idem |
| `lecteur` | ✅ périmètre organisation/projets | ✅ | ❌ | ❌ | ❌ |

**La fonctionnalité est « pivot »** : le pattern validé ici sera répliqué pour les structures (B1) à l'Étape 5, puis pour les enquêtes / imports Excel aux Étapes 6-7.

**Non-objectifs explicites de cette étape** (repoussés) :
- Import Excel en masse → Étape 6
- Formulaires d'enquête dynamiques (A2, A4, A5…) → Étape 7
- Cartographie et graphiques → Étape 8

---

## 2. Architecture des écrans

### 2.1. Routes Next.js prévues

| Route | Server/Client | Rôle minimum | Description |
|-------|---------------|--------------|-------------|
| `/beneficiaires` | Server (page) + Client (filtres) | `lecteur` | Liste paginée server-side avec filtres et recherche |
| `/beneficiaires/nouveau` | Server + Client (formulaire) | `contributeur_partenaire` | Création d'un bénéficiaire |
| `/beneficiaires/[id]` | Server | `lecteur` (dans périmètre) | Vue détail lecture seule + bouton Modifier |
| `/beneficiaires/[id]/modifier` | Server + Client (formulaire) | `contributeur_partenaire` (dans périmètre) | Édition d'un bénéficiaire existant |
| `/api/beneficiaires/[id]/supprimer` | POST serveur | `contributeur_partenaire` (dans périmètre) | Soft delete via `deleted_at = NOW()`, redirection vers la liste |

> **Pas d'écran de confirmation dédié `/supprimer`** : la confirmation se fait via un `<AlertDialog>` shadcn sur la page détail, comme pour la déconnexion. Le POST `/api/beneficiaires/[id]/supprimer` fait le soft-delete puis redirige.

### 2.2. Wireframes textuels

#### `/beneficiaires` — Liste

```
┌────────────────────────────────────────────────────────────────────┐
│  Header : [← Accueil]  Bénéficiaires  [+ Nouveau] (si ≥ contributeur) │
├────────────────────────────────────────────────────────────────────┤
│  Barre de filtres (sticky)                                          │
│  [🔍 Rechercher par nom…]                                           │
│  [Projet ▾] [Pays ▾] [Année ▾] [Sexe ▾] [Domaine ▾] [Statut ▾]    │
│  [🔄 Réinitialiser]                                                 │
├────────────────────────────────────────────────────────────────────┤
│  Tableau (50 lignes/page)                                           │
│  ┌──┬────────────┬──────────┬───┬──────┬────────┬──────────┬────┐ │
│  │☐│ Nom Prénom │ Projet   │ F │Année │ Domaine│ Statut   │ ⋯  │ │
│  ├──┼────────────┼──────────┼───┼──────┼────────┼──────────┼────┤ │
│  │☐│ TRAORE Awa │ PROJ_A14 │ F │ 2024 │ Entre… │ Achevée  │ ⋯  │ │
│  │☐│ KEITA Ali  │ PROJ_A16a│ M │ 2025 │ Num.   │ Présent  │ ⋯  │ │
│  └──┴────────────┴──────────┴───┴──────┴────────┴──────────┴────┘ │
│   ⋯ = menu contextuel : Voir / Modifier / Supprimer                 │
├────────────────────────────────────────────────────────────────────┤
│  Pied : « Affichage 1–50 sur 1 234 »  [← Préc] Page 1 / 25 [Suiv →]│
└────────────────────────────────────────────────────────────────────┘
```

Colonnes affichées par défaut (à décider Q4.list) : Nom Prénom, Projet, Sexe, Année, Domaine, Statut, menu. Les autres colonnes (date naissance, pays, contacts, consentement) sont visibles dans la vue détail.

Clic sur une ligne → `/beneficiaires/[id]` (vue détail).

#### `/beneficiaires/nouveau` et `/beneficiaires/[id]/modifier`

```
┌────────────────────────────────────────────────────────────────────┐
│  Header : [← Retour]  Nouveau bénéficiaire (ou : Modifier · Awa TRAORE) │
├────────────────────────────────────────────────────────────────────┤
│  Formulaire en 5 sections (accordéon ou onglets — voir Q4.form) :  │
│                                                                      │
│  ▸ 1. Identité                                                      │
│      [Prénom *] [Nom *] [Sexe *] [Date de naissance]               │
│      → Tranche d'âge calculée automatiquement (affiché RO)          │
│                                                                      │
│  ▸ 2. Rattachement                                                  │
│      [Projet *] [Pays *] [Partenaire d'accompagnement]              │
│                                                                      │
│  ▸ 3. Formation                                                     │
│      [Domaine *] [Intitulé précis] [Modalité]                       │
│      [Année *] [Date début] [Date fin] [Statut *] [Fonction actuelle]│
│                                                                      │
│  ▸ 4. RGPD et contacts                                              │
│      [Consentement recueilli *] [Date du consentement]              │
│      [Téléphone] [Courriel] [Localité de résidence]                 │
│      ⚠ Si consentement = Oui, au moins un contact est obligatoire   │
│                                                                      │
│  ▸ 5. Notes                                                         │
│      [Commentaire libre]                                             │
│                                                                      │
│  [Annuler] [Enregistrer]                                             │
└────────────────────────────────────────────────────────────────────┘
```

Les sections sont **expansées par défaut au premier chargement** (pas d'accordéon replié) pour que rien ne soit caché au saisissant.

#### `/beneficiaires/[id]` — Détail

```
┌────────────────────────────────────────────────────────────────────┐
│  Header : [← Liste]  Awa TRAORE — PROJ_A14           [⋯ actions]   │
│  Sous-titre : Formée en 2024 · Mali · Entrepreneuriat               │
├────────────────────────────────────────────────────────────────────┤
│  5 cards de lecture, en 2 colonnes :                                │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                  │
│  │ 1. Identité         │  │ 2. Rattachement     │                  │
│  │ Prénom : Awa        │  │ Projet : PROJ_A14   │                  │
│  │ Nom : TRAORE        │  │ Pays : Mali (MLI)   │                  │
│  │ Sexe : F            │  │ Organisation : ASSO.│                  │
│  │ Né.e le : 1998-03-15│  │ Partenaire : ADFD   │                  │
│  │ Tranche : 18-29 ans │  │                     │                  │
│  └─────────────────────┘  └─────────────────────┘                  │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                  │
│  │ 3. Formation        │  │ 4. RGPD & Contacts  │                  │
│  │ Domaine : Entrepr.  │  │ Consentement : Oui  │                  │
│  │ Intitulé : Gestion… │  │ Recueilli le : …    │                  │
│  │ Année : 2024        │  │ Téléphone : +223…   │                  │
│  │ 15/03 → 15/08/2024  │  │ Courriel : awa@…    │                  │
│  │ Statut : Achevée    │  │ Localité : Bamako   │                  │
│  │ Modalité : Présentiel│ │                     │                  │
│  └─────────────────────┘  └─────────────────────┘                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ 5. Notes                                                  │      │
│  │ Commentaire libre si présent                              │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                      │
│  Menu actions (header ⋯) : [Modifier] [Dupliquer] [Supprimer]       │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Modèle de données — colonnes A1

La table `public.beneficiaires` a été créée en migration 001 avec **22 colonnes métier + 5 techniques**. Rappel détaillé de chaque colonne avec son comportement UI.

| # | Colonne DB | Libellé UI | Obligatoire | Contrôle UI | Contrainte Zod | Source (si select) | Défaut |
|---|-----------|-----------|:----:|---|---|---|---|
| 1 | `prenom` | Prénom | ✅ | Input text | `z.string().trim().min(1).max(100)` | — | — |
| 2 | `nom` | Nom | ✅ | Input text | `z.string().trim().min(1).max(100)` (uppercase via `transform()`) | — | — |
| 3 | `sexe` | Sexe | ✅ | Select | `z.enum(['F', 'M', 'Autre'])` | enum BDD | — |
| 4 | `date_naissance` | Date de naissance | ❌ | Input `type=date` | `z.coerce.date().max(today).min('1900-01-01').optional()` | — | — |
| — | *(tranche d'âge auto)* | Tranche d'âge | calc | Badge RO | — | calc `date_naissance` vs année courante | — |
| 5 | `projet_code` | Projet | ✅ | Select | `z.enum([22 codes PROJ_A*])` + **filtre périmètre rôle** | `projets` where `concerne_emploi_jeunes=TRUE` par défaut, toggle admin | pré-sélectionné si une seule option |
| 6 | `pays_code` | Pays | ✅ | Select avec recherche | `z.string().regex(/^[A-Z]{3}$/)` | `pays` (61 lignes) | — |
| 7 | `organisation_id` | Organisation | auto | Caché | `z.string().uuid().nullable()` | `current_organisation_id()` pour contributeur | auto-rempli |
| 8 | `partenaire_accompagnement` | Partenaire d'accompagnement | ❌ | Input text | `z.string().max(200).optional()` | — | — |
| 9 | `domaine_formation_code` | Domaine de formation | ✅ | Select | `z.enum([16 codes])` | `domaines_formation` | — |
| 10 | `intitule_formation` | Intitulé précis de la formation | ❌ | Input text | `z.string().max(300).optional()` | — | — |
| 11 | `modalite_formation_code` | Modalité | ❌ | Select | `z.enum(['PRESENTIEL','EN_LIGNE','HYBRIDE']).nullable()` | `modalites_formation` | — |
| 12 | `annee_formation` | Année de la formation | ✅ | Input `type=number` | `z.coerce.number().int().min(2020).max(thisYear+1)` | — | année courante |
| 13 | `date_debut_formation` | Date de début | ❌ | Input `type=date` | `z.coerce.date().optional()` | — | — |
| 14 | `date_fin_formation` | Date de fin | ❌ | Input `type=date` | `z.coerce.date().optional()` + `refine(fin >= debut)` | — | — |
| 15 | `statut_code` | Statut | ✅ | Select | `z.enum([5 codes])` | `statuts_beneficiaire` | `INSCRIT` |
| 16 | `fonction_actuelle` | Fonction / Statut actuel | ❌ | Input text | `z.string().max(200).optional()` | — | — |
| 17 | `consentement_recueilli` | Consentement recueilli | ✅ | Select/Radio (Oui/Non) | `z.boolean()` | — | `false` |
| 18 | `consentement_date` | Date du consentement | conditionnel | Input `type=date` | obligatoire si `consentement_recueilli=true` | — | `today` auto-rempli à la 1ère coche |
| 19 | `telephone` | Téléphone (avec indicatif) | conditionnel | Input `type=tel` | `z.string().regex(/^\+\d{6,20}$/).optional()` | — | — |
| 20 | `courriel` | Courriel | conditionnel | Input `type=email` | `z.string().email().optional()` | — | — |
| 21 | `localite_residence` | Localité de résidence | ❌ | Input text | `z.string().max(200).optional()` | — | — |
| 22 | `commentaire` | Commentaire | ❌ | Textarea | `z.string().max(2000).optional()` | — | — |

### Contrainte Zod cross-field (super-refinement)

```ts
.superRefine((data, ctx) => {
  if (data.consentement_recueilli) {
    if (!data.consentement_date) ctx.addIssue({ path: ['consentement_date'], message: 'Date obligatoire' });
    if (!data.telephone && !data.courriel) ctx.addIssue({ path: ['telephone'], message: 'Au moins un contact (téléphone ou courriel)' });
  } else {
    if (data.telephone || data.courriel) ctx.addIssue({ path: ['consentement_recueilli'], message: 'Contact sans consentement interdit' });
  }
  if (data.date_debut_formation && data.date_fin_formation && data.date_fin_formation < data.date_debut_formation) {
    ctx.addIssue({ path: ['date_fin_formation'], message: 'La date de fin doit être postérieure à la date de début' });
  }
});
```

Les mêmes règles existent déjà en CHECK BDD — double validation client+serveur.

---

## 4. Règles métier critiques

### 4.1. RGPD — triple verrou

- **DB** : `CHECK (consentement_recueilli OR (telephone IS NULL AND courriel IS NULL))` + CHECK dual. Déjà en place depuis migration 001.
- **Zod** : superRefine ci-dessus.
- **UI** : les champs téléphone/courriel sont **grisés et désactivés** tant que `consentement_recueilli` n'est pas coché à `Oui`. Un toggle de consentement révèle les champs contacts et rend obligatoire au moins un des deux.

### 4.2. Dédoublonnage

**Index DB** : `UNIQUE (lower(unaccent(prenom)), lower(unaccent(nom)), date_naissance, projet_code)` avec `WHERE date_naissance IS NOT NULL`.

**Comportement UI** (à décider Q7) :
- Option **bloquant** : l'INSERT échoue côté Supabase avec contrainte unique, on affiche un message d'erreur pointant vers la fiche existante.
- Option **avertissement + forcer** : on détecte le doublon en amont via SELECT, on propose « Une fiche existe déjà pour *Awa TRAORE (1998-03-15)* dans PROJ_A14 — [Voir la fiche] [Créer quand même] ».

**Cas des bénéficiaires sans date de naissance** : l'index unique ne s'applique pas (partial index). Pas de dédoublonnage automatique. Une alerte qualité (A5 du dashboard admin) compte déjà ces lignes.

### 4.3. Cohorte

Une cohorte = **(projet_code, annee_formation, domaine_formation_code)** implicite. Les enquêtes longitudinales A5 à 6/12 mois exploiteront `date_fin_formation` pour calculer la date d'échéance d'enquête.

Conséquence UI : la date de fin de formation doit être **saisie aussi tôt que possible**, idéalement au moment du statut « Formation achevée ». Un nudge visuel : si `statut = FORMATION_ACHEVEE` et `date_fin_formation IS NULL`, afficher un warning visible.

### 4.4. Rattachement projet selon rôle

Le select « Projet » est filtré **côté serveur** :
- `admin_scs` : voit les 23 projets (toggle « Afficher tous les projets » activé par défaut en V1, revisitable en UI admin).
- `editeur_projet` : voit uniquement `current_projets_geres()` (les projets de son organisation).
- `contributeur_partenaire` : idem, voit `current_projets_geres()` via l'organisation.
- Si un seul projet possible → pré-sélectionné et grisé.
- Si zéro projet géré → message bloquant « Votre organisation n'a aucun projet assigné. Contactez le SCS. »

---

## 5. Questions produit — à arbitrer avant code

> Ces 7 questions conditionnent le découpage. J'attends une réponse par question avant d'écrire quoi que ce soit.

### Q1 — Saisie unitaire vs saisie en batch en V1

**Contexte** : un partenaire peut avoir formé 30 jeunes d'un coup. Saisir 30 fiches une par une est fastidieux.

**Options** :
- **A (V1 unitaire seulement)** : formulaire une fiche à la fois. La saisie en batch passe par l'**import Excel** (Étape 6). Recommandé : l'import Excel couvre déjà le cas « j'ai une liste », et l'UX batch dédié est coûteuse à développer proprement.
- **B (formulaire « à la chaîne »)** : après enregistrement, une modale « Saisir un autre bénéficiaire du même projet ? » avec pré-remplissage des champs communs (projet, pays, domaine, année). Léger à développer, très productif sur le terrain.
- **C (tableau de saisie multi-lignes en UI)** : grille éditable façon Excel. Très lourd à développer proprement.

**Ma recommandation** : **Option B**. L'Excel import gère le batch massif ; le mode « à la chaîne » fluidifie la saisie du partenaire au téléphone / sur le terrain, à coût faible.

### Q2 — Duplication d'une fiche existante en V1 ou V1.5 ?

**Option V1** : bouton « Dupliquer » sur la fiche détail → pré-remplit la page `/beneficiaires/nouveau` avec tous les champs **sauf** prénom, nom, date de naissance, téléphone, courriel (pour éviter la création accidentelle d'un faux doublon).

**Option V1.5** : reporté.

**Ma recommandation** : **V1** si et seulement si Q1 est Option A (pas de « à la chaîne »). Sinon, Q1-Option B couvre déjà 90% du besoin et Dupliquer devient redondant. Donc : si Q1=A alors Q2=V1 ; si Q1=B alors Q2=V1.5.

### Q3 — Édition inline sur la liste ou écran dédié uniquement ?

**Option A (écran dédié)** : clic sur ligne ou action « Modifier » → route `/beneficiaires/[id]/modifier`. Formulaire complet. Pattern classique.

**Option B (inline dans la liste)** : double-clic sur une cellule → champ éditable sur place. Productif pour corrections rapides (ex. mettre à jour tous les « statut » en fin de session), mais risque d'erreurs et complexe à gérer avec les validations Zod cross-field.

**Ma recommandation** : **A en V1**. L'inline est un gain marginal qui complique beaucoup la validation métier (ex: comment gérer un changement de statut qui exigerait une date de fin formation ?). À revoir en V2 si le besoin remonte.

### Q4 — Recherche textuelle sur la liste

**Champs couverts** : proposé `prenom + nom` (via `unaccent_immutable` + `pg_trgm` déjà indexés). Ajouter : `intitule_formation`, `localite_residence`, `commentaire` ?

**Ma recommandation** : V1 = **`prenom + nom` uniquement** (l'index trigram existe). Les autres champs ajouteraient de la confusion (« pourquoi cette fiche ressort-elle ? ») et nécessiteraient de nouveaux index. V1.5 : recherche étendue opt-in via un toggle « Recherche avancée ».

### Q5 — Export CSV/Excel depuis la liste filtrée — V1 ou V1.5 ?

**Contexte** : ExcelJS est déjà installé. L'export respecte la RLS (on n'exporte que ce qu'on peut voir).

**Options** :
- **V1** : bouton « Exporter » sur la liste, format Excel aligné avec la structure du template V1.
- **V1.5** : reporté, priorité à l'import.

**Ma recommandation** : **V1**. Coût faible (ExcelJS déjà prêt), utilité immédiate pour les unités chefs de file qui veulent retraiter en local. À condition de bien respecter la RLS.

### Q6 — Historique des modifications visible où ?

Le journal d'audit (table `journaux_audit`) est rempli par le trigger depuis la migration 001. Question : où le voir ?

**Options** :
- **A** : Onglet « Historique » sur la fiche détail, visible par tous les rôles qui voient la fiche.
- **B** : Onglet « Historique » uniquement dans l'UI d'administration (route `/admin/audit`), visible par `admin_scs` seul.
- **C** : les deux (A pour la fiche courante, B pour la vue globale admin).

**Ma recommandation** : **B en V1** (admin seul, couplé aux règles RLS déjà posées). L'historique par fiche est utile mais demande du design soigné et n'est pas bloquant pour juin 2026. V1.5 pour A.

### Q7 — Doublon détecté à la saisie : bloquant ou avertissement ?

**Options** :
- **A (bloquant)** : le serveur refuse, message « Un bénéficiaire Awa TRAORE né le 1998-03-15 existe déjà dans PROJ_A14 (fiche #xxx). Modifiez ces éléments ou voyez la fiche existante. » avec lien vers la fiche.
- **B (avertissement + forcer)** : le serveur détecte en amont, propose « Doublon suspect — [Voir la fiche existante] [Créer quand même] ». Le « Créer quand même » contourne l'index unique (qui exige `date_naissance IS NOT NULL`) en laissant la date vide.
- **C (bloquant + correction guidée)** : comme A, mais le serveur propose la modification directe de la fiche existante au lieu d'en créer une nouvelle (« Mettre à jour cette fiche avec vos données ? »).

**Ma recommandation** : **A en V1**. Bloquant simple, message actionnable. Le cas « c'est un autre Awa TRAORE du même âge » est tellement rare qu'il ne mérite pas l'Option B complexe. Option C est séduisante mais casse le modèle mental « une saisie = une création ». Réservable en V1.5.

### Q8 — Menu contextuel sur chaque ligne : quelles actions ?

**Options proposées** :
- Voir (toujours)
- Modifier (si droits écriture)
- Dupliquer (conditionnelle à Q2)
- Supprimer / Restaurer (admin_scs seul, restaurer si `deleted_at` non null)
- Voir l'historique (conditionnelle à Q6)

**Ma recommandation** : **4 entrées max** : Voir, Modifier, Dupliquer (si Q2=V1), Supprimer (si admin_scs). Restaurer et Historique via l'admin UI dédiée.

---

## 6. Composants UI prévus

### 6.1. shadcn/ui — réutilisés (déjà installés)

Button, Input, Label, Select, Textarea, Form, Card, Badge, Table, Tabs, DropdownMenu, Dialog, AlertDialog, Separator, Avatar, Sheet, Skeleton, Sonner.

### 6.2. shadcn à ajouter

- `checkbox` (sélection multiple dans la liste, pour futurs batch actions)
- `popover` (si on ajoute un date picker riche — sinon `<input type="date">` natif, **recommandé**)
- `toggle` (filtres projet on/off sur admin)

### 6.3. Composants métier à créer dans `components/beneficiaires/`

| Fichier | Type | Rôle |
|---------|------|------|
| `beneficiaire-form.tsx` | Client | Formulaire création + édition (sections 1-5) |
| `beneficiaire-table.tsx` | Server | Tableau de la liste |
| `beneficiaire-row-actions.tsx` | Client | Menu contextuel ⋯ par ligne |
| `beneficiaire-filters.tsx` | Client | Barre de filtres + recherche |
| `beneficiaire-pagination.tsx` | Client | Contrôles pagination |
| `beneficiaire-detail-cards.tsx` | Server | 5 cards de la vue détail |
| `consentement-badge.tsx` | Pur | Badge visuel « Consentement Oui/Non/Non précisé » |
| `statut-badge.tsx` | Pur | Badge coloré selon statut (INSCRIT/PRESENT/ACHEVEE/ABANDON) |
| `tranche-age.ts` | util | Calcul de la tranche depuis `date_naissance` |

### 6.4. Schémas Zod dans `lib/schemas/beneficiaire.ts`

Un fichier contenant :
- `beneficiaireInsertSchema` : création (tous champs métier)
- `beneficiaireUpdateSchema` : édition (idem mais `.partial()` pour les champs optionnels, id obligatoire)
- `beneficiaireFiltersSchema` : querystring validation pour la liste
- types dérivés exportés

### 6.5. Helpers serveur dans `lib/beneficiaires/`

| Fichier | Rôle |
|---------|------|
| `queries.ts` | Toutes les fonctions `async` qui parlent à Supabase : `listBeneficiaires(filters, page)`, `getBeneficiaireById(id)`, `createBeneficiaire(data)`, `updateBeneficiaire(id, data)`, `softDeleteBeneficiaire(id)`, `checkDoublon(prenom, nom, dateNaissance, projet)` |
| `actions.ts` | Server Actions Next.js qui wrappent les queries, avec vérif auth et revalidation |
| `export-excel.ts` | Génération du fichier Excel au format template V1 (si Q5=V1) |

---

## 7. Gestion des erreurs et permissions

### 7.1. Matrice d'erreurs

| Scénario | Détection | Affichage utilisateur |
|----------|-----------|----------------------|
| Champ requis vide | Zod client | Message inline sous le champ (`FormMessage`) |
| Format invalide (email, téléphone) | Zod client | Inline idem |
| Violation CHECK BDD (RGPD, dates) | Supabase `postgrest_error.code = '23514'` | Toast rouge + retour formulaire avec erreur globale |
| Tentative d'accès hors périmètre (RLS) | Supabase renvoie 0 row ou PostgrestError | Page 404 « Fiche introuvable ou accès refusé » (ne révèle pas l'existence) |
| Doublon détecté (Q7=A) | Unique index violation `23505` | Toast rouge + message avec lien vers la fiche existante |
| Réseau / Supabase down | fetch error / timeout | Toast « Problème de connexion. Réessayer » + bouton retry |
| Session expirée au submit | 401 Auth | Redirection vers `/connexion?redirect=…` avec toast |

### 7.2. Principe général

- **Erreurs de formulaire → inline** (FormMessage shadcn).
- **Erreurs globales → toast sonner** + message dans un bandeau haut du formulaire.
- **Erreurs bloquantes (RLS, 404) → page d'erreur complète** avec bouton retour.

### 7.3. Feedback positif

- Création réussie → toast vert « Bénéficiaire créé » + redirection `/beneficiaires/[id]`.
- Édition réussie → toast + rester sur `/beneficiaires/[id]` avec valeurs rafraîchies.
- Soft-delete → toast vert « Fiche archivée » + retour à la liste avec option « Restaurer » dans le toast pendant 10 s.

---

## 8. Tests e2e prévus

| # | Scénario | Rôle | Attendu |
|---|----------|------|---------|
| 1 | Créer un bénéficiaire minimum (8 champs obligatoires) | `admin_scs` | Redirection vers détail, toast vert, ligne visible dans la liste |
| 2 | Tentative de création avec contact mais sans consentement | `admin_scs` | Erreur Zod inline bloque le submit |
| 3 | Créer un doublon (même prenom+nom+date+projet) | `admin_scs` | Message d'erreur + lien vers la fiche existante |
| 4 | Contributeur tente de créer dans un projet hors organisation | `contributeur_partenaire` | Le projet n'apparaît pas dans le select → bloquant UI |
| 5 | Contributeur tente d'accéder via URL directe à une fiche hors périmètre | `contributeur_partenaire` | 404 « Fiche introuvable ou accès refusé » |
| 6 | Recherche textuelle retourne des résultats accent-insensibles | `lecteur` | Tape « Awa TRAORE » → trouve aussi « Awa Traoré » |
| 7 | Filtre projet + pays + année, combinés | `editeur_projet` | Résultats cohérents, compteur mis à jour |
| 8 | Pagination page 2, conservation des filtres | `editeur_projet` | URL `?page=2&projet=PROJ_A14`, 50 lignes suivantes |
| 9 | Soft-delete + vérification `deleted_at` rempli | `admin_scs` | Ligne disparaît de la liste, restaurable en SQL (ou via UI admin V1.5) |
| 10 | Export Excel de la liste filtrée (si Q5=V1) | `admin_scs` | Fichier `.xlsx` téléchargé, format template V1 |

---

## 9. Estimation

### 9.1. Fichiers à créer / modifier

| Domaine | Nouveaux fichiers | Lignes estimées |
|---------|:----:|:---:|
| Schémas Zod (`lib/schemas/beneficiaire.ts`) | 1 | ~250 |
| Queries & actions serveur (`lib/beneficiaires/*.ts`) | 3 | ~500 |
| Composants métier (`components/beneficiaires/*.tsx`) | 9 | ~1 200 |
| Pages Next.js (`app/(dashboard)/beneficiaires/**`) | 4 | ~400 |
| Route API suppression | 1 | ~40 |
| Tests e2e Playwright | 2 | ~400 |
| Fixtures / seed démo | 1 | ~100 |
| **Total** | **~21 fichiers** | **~2 900 lignes** |

### 9.2. Temps

- Cadrage validé : 0,5 h (cette étape)
- 4a Zod + types : 1 h
- 4b Liste + filtres + pagination : 3 h
- 4c Création (formulaire complet) : 2,5 h
- 4d Édition + soft-delete + détail : 2 h
- 4e Tests e2e + polish : 1,5 h
- 4f Export Excel (si Q5=V1) : 1,5 h
- **Total : ~12 h sur 3-4 sessions**

### 9.3. Dépendances npm nouvelles (si Q5=V1)

Aucune — `exceljs` déjà installé. Potentiellement `@tanstack/react-table` si on veut le tri côté client, mais je recommande **pas** : le tri serveur suffit et c'est 30 KB de bundle évités.

---

## 10. Découpage proposé — 5 sous-étapes

Chaque sous-étape = un commit atomique avec build + typecheck verts.

### 4a — Fondations types

- `lib/schemas/beneficiaire.ts` : schémas Zod + types dérivés
- `lib/beneficiaires/queries.ts` : squelette des fonctions
- `components/beneficiaires/statut-badge.tsx`, `consentement-badge.tsx`, `tranche-age.ts`
- Tests unitaires Vitest sur les schémas Zod et le calcul tranche d'âge
- **Stop 4a** : validation des types

### 4b — Liste + filtres + pagination

- `app/(dashboard)/beneficiaires/page.tsx` (server)
- `components/beneficiaires/beneficiaire-table.tsx`
- `components/beneficiaires/beneficiaire-filters.tsx` + `pagination.tsx`
- `components/beneficiaires/beneficiaire-row-actions.tsx` (menu ⋯)
- Query `listBeneficiaires(filters, page)` avec `count: 'exact'`
- Test e2e : liste vide, filtre non-match, pagination
- **Stop 4b** : validation UX liste

### 4c — Création

- `app/(dashboard)/beneficiaires/nouveau/page.tsx`
- `components/beneficiaires/beneficiaire-form.tsx` (5 sections)
- Server Action `createBeneficiaireAction` avec revalidation
- Gestion RGPD dynamique (contacts désactivés sans consentement)
- Détection doublon selon Q7
- Mode « à la chaîne » selon Q1
- Test e2e : création simple + création avec erreurs + doublon
- **Stop 4c** : validation parcours création

### 4d — Détail + édition + soft-delete

- `app/(dashboard)/beneficiaires/[id]/page.tsx` (détail server)
- `app/(dashboard)/beneficiaires/[id]/modifier/page.tsx`
- `components/beneficiaires/beneficiaire-detail-cards.tsx`
- Server Action `updateBeneficiaireAction`
- Route API `POST /api/beneficiaires/[id]/supprimer`
- Menu ⋯ fonctionnel (dupliquer conditionnel Q2)
- Test e2e : édition + soft-delete + accès refusé
- **Stop 4d** : validation parcours complet CRUD

### 4e — Export Excel (si Q5=V1) + polish

- `lib/beneficiaires/export-excel.ts`
- Route API `GET /api/beneficiaires/export` avec query string filtres
- Bouton Export sur la liste
- Polish : skeletons, toasts, messages vides
- Test e2e : export contient les bonnes colonnes
- **Stop 4e** : validation finale avant merge

Si Q5=V1.5, l'étape 4e se limite au polish (~1 h).

---

## Changelog

| Version | Date | Changement |
|---------|------|-----------|
| 0.1 | 2026-04-23 | Version initiale — en attente de réponses Q1-Q8 |
