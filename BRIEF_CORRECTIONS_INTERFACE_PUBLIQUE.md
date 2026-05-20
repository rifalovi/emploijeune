# Brief : Corrections interface publique — Retour équipes

> **Destinataire :** Claude Code  
> **Date :** 2026-05-20  
> **Priorité :** Corrections de forme (contenu + UI) — changement de schéma BDD requis pour le point 1.5 uniquement  
> **Branche cible :** `main` (déploiement Vercel automatique)

---

## Contexte rapide

La plateforme publique est servie par `app/page.tsx` (route `/`).  
Le header de navigation est dans `components/landing/header-public.tsx`.  
Les pages spécialisées : `app/(public)/realisations/` et `app/(public)/referentiels/`.

---

## SECTION 1 — ACCUEIL (`app/page.tsx` + `components/landing/header-public.tsx`)

### 1.1 — Réorganiser l'ordre du menu + renommer "Réalisations" → "Résultats"

**Fichier :** `components/landing/header-public.tsx`

Dans le tableau `onglets`, changer l'ordre et le libellé :

```
Avant : Accueil > Référentiels > Réalisations > Contacts
Après : Accueil > Résultats > Référentiel > Contact
```

```typescript
// Avant
const onglets = [
  { href: '/',            label: 'Accueil',       matches: (p) => p === '/' },
  { href: '/referentiels', label: 'Référentiels',  matches: (p) => p.startsWith('/referentiels') },
  { href: '/realisations', label: 'Réalisations',  matches: (p) => p.startsWith('/realisations') },
  { href: '/contact',     label: 'Contacts',       matches: (p) => p.startsWith('/contact') },
];

// Après
const onglets = [
  { href: '/',            label: 'Accueil',      matches: (p) => p === '/' },
  { href: '/realisations', label: 'Résultats',   matches: (p) => p.startsWith('/realisations') },
  { href: '/referentiels', label: 'Référentiel', matches: (p) => p.startsWith('/referentiels') },
  { href: '/contact',     label: 'Contact',      matches: (p) => p.startsWith('/contact') },
];
```

> ⚠️ Vérifier que les liens footer dans `FooterPublic()` (bas de `app/page.tsx`) sont cohérents avec ce nouvel ordre.

---

### 1.2 — Remplacer « jeunes accompagnés » par « personnes accompagnées »

**Fichier :** `app/page.tsx`

Remplacer toutes les occurrences de "jeunes accompagnés" (et variantes) par "personnes accompagnées".

Occurrences à corriger :

| Ligne approx. | Texte actuel | Texte corrigé |
|---|---|---|
| Hero section (`HeroAvecCarrousel`) | `jeunes accompagnés dans {kpis.pays_total} pays` | `personnes accompagnées dans {kpis.pays_total} pays` |
| `metadata.openGraph.description` | `5 000+ jeunes accompagnés dans 50+ pays` | `5 000+ personnes accompagnées dans 50+ pays` |

> Note : le libellé "Bénéficiaires accompagnés" dans `KpiCompteurs` est déjà neutre — ne pas changer.

---

### 1.3 — Déplacer la section "Impact de nos interventions" après les Programmes

**Fichier :** `app/page.tsx` — fonction `VitrinePubliquePage()`

La section `<KpiCompteurs>` doit descendre **après** `<Programmes>`. L'ordre cible est :

```tsx
// Avant
<HeroAvecCarrousel ... />
<KpiCompteurs kpis={kpis} />   ← ici
<Programmes />
<Methodologie />
...

// Après
<HeroAvecCarrousel ... />
<Programmes />
<KpiCompteurs kpis={kpis} />   ← déplacé après Programmes
<Methodologie />
...
```

---

### 1.4 — Renommer le titre de la section KPI

**Fichier :** `app/page.tsx` — fonction `KpiCompteurs()`

```tsx
// Avant
<h2 ...>L&apos;impact de nos interventions</h2>

// Après
<h2 ...>Données agrégées des projets emploi Jeunes OIF</h2>
```

Aussi mettre à jour le sous-titre (`<p>`) pour le rendre cohérent :

```tsx
// Avant
<p ...>Données agrégées des projets emploi jeunes OIF : période ...</p>

// Après — inchangé (déjà cohérent), mais supprimer le badge "En chiffres" si jugé redondant
```

---

### 1.5 — Sélection dynamique des indicateurs affichés dans la section KPI (panneau admin)

**Approche choisie :** plutôt que de coder en dur la liste A1/A4/A5/B1/B3/B4, implémenter un système de configuration admin qui permet de choisir librement, à tout moment et sans déploiement, quels indicateurs apparaissent dans la section "Données agrégées" de la vitrine publique.

---

#### Étape A — Migration SQL

Créer le fichier `supabase/migrations/YYYYMMDDHHMMSS_indicateurs_vitrine_publique.sql` :

```sql
-- Table de configuration : quels indicateurs apparaissent sur la vitrine publique
CREATE TABLE public.config_vitrine_indicateurs (
  indicateur_code TEXT PRIMARY KEY,
  visible         BOOLEAN NOT NULL DEFAULT false,
  ordre           INTEGER NOT NULL DEFAULT 0,   -- ordre d'affichage (1 = premier)
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES auth.users(id)
);

-- Pré-remplir avec tous les indicateurs du Cadre Commun (visibles = false par défaut)
INSERT INTO public.config_vitrine_indicateurs (indicateur_code, visible, ordre) VALUES
  ('A1', true,  1),
  ('A2', false, 0),
  ('A3', false, 0),
  ('A4', true,  2),
  ('A5', true,  3),
  ('B1', true,  4),
  ('B2', false, 0),
  ('B3', true,  5),
  ('B4', true,  6),
  ('C1', false, 0),
  ('C2', false, 0),
  ('D1', false, 0),
  ('D2', false, 0),
  ('F1', false, 0);

-- RLS : lecture publique (anon), écriture super_admin/admin_scs seulement
ALTER TABLE public.config_vitrine_indicateurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_vitrine_lecture_publique"
  ON public.config_vitrine_indicateurs FOR SELECT
  USING (true);

CREATE POLICY "config_vitrine_ecriture_admin"
  ON public.config_vitrine_indicateurs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.utilisateurs
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin_scs')
    )
  );
```

> Appliquer via Supabase SQL Editor ou MCP.

---

#### Étape B — Nouvelle query publique

**Fichier :** `lib/landing/queries.ts`

Ajouter une fonction qui lit les indicateurs cochés + leur valeur agrégée depuis `indicateurs_annuels` :

```typescript
export type IndicateurVitrine = {
  code: string;
  intitule: string;       // vient de lib/referentiels/indicateurs.ts
  valeur: number | null;  // null = pas encore de données en BDD
  unite: string;
  ordre: number;
};

export async function getIndicateursVitrine(): Promise<IndicateurVitrine[]> {
  const supabase = await createSupabaseServerClient();

  // 1. Lire la config (indicateurs visibles, triés par ordre)
  const { data: config } = await supabase
    .from('config_vitrine_indicateurs')
    .select('indicateur_code, ordre')
    .eq('visible', true)
    .order('ordre');

  if (!config || config.length === 0) return [];

  const codes = config.map((c) => c.indicateur_code);

  // 2. Agréger les valeurs depuis indicateurs_annuels (SUM des valeurs déclarées)
  const { data: valeurs } = await supabase
    .from('indicateurs_annuels')
    .select('code_indicateur, valeur_realisee')
    .in('code_indicateur', codes);

  const sommesParCode: Record<string, number> = {};
  for (const v of valeurs ?? []) {
    if (typeof v.valeur_realisee === 'number') {
      sommesParCode[v.code_indicateur] = (sommesParCode[v.code_indicateur] ?? 0) + v.valeur_realisee;
    }
  }

  // 3. Croiser avec les métadonnées du référentiel (intitulé, unité)
  const { INDICATEURS } = await import('@/lib/referentiels/indicateurs');
  return config.map((c) => {
    const meta = INDICATEURS.find((i) => i.code === c.indicateur_code);
    return {
      code: c.indicateur_code,
      intitule: meta?.intitule ?? c.indicateur_code,
      valeur: sommesParCode[c.indicateur_code] ?? null,
      unite: meta?.unitePrincipale ?? 'personnes',
      ordre: c.ordre,
    };
  });
}
```

> Adapter selon le schéma réel de `indicateurs_annuels` (nom exact de la colonne de valeur et du code indicateur).

---

#### Étape C — Mettre à jour `KpiCompteurs()` dans `app/page.tsx`

Remplacer les 4 cartes statiques par un rendu dynamique à partir de `getIndicateursVitrine()` :

```typescript
// Dans VitrinePubliquePage() — ajouter l'appel
const [kpis, indicateursVitrine, user] = await Promise.all([
  getKpisPublics(),
  getIndicateursVitrine(),
  getAuthUser(),
]);

// Passer au composant
<KpiCompteurs kpis={kpis} indicateurs={indicateursVitrine} />
```

```tsx
function KpiCompteurs({
  kpis,
  indicateurs,
}: {
  kpis: KpisPublics | null;
  indicateurs: IndicateurVitrine[];
}) {
  // Si aucun indicateur configuré → fallback sur les compteurs kpis existants
  const afficherIndicateurs = indicateurs.length > 0;

  return (
    <section ...>
      ...
      <div className={`mt-12 grid grid-cols-2 gap-6 ${indicateurs.length > 4 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
        {afficherIndicateurs
          ? indicateurs.map((ind) => (
              <CompteurCarte
                key={ind.code}
                valeur={ind.valeur !== null ? ind.valeur.toLocaleString('fr-FR') : '—'}
                libelle={ind.intitule}
                code={ind.code}
              />
            ))
          : /* fallback : afficher les 4 compteurs kpis habituels */
            <CompteurCarteKpi kpis={kpis} />
        }
      </div>
    </section>
  );
}
```

---

#### Étape D — Panneau de gestion admin

**Fichier à créer :** `app/(dashboard)/super-admin/affichage-public/page.tsx`  
**Composant client :** `app/(dashboard)/super-admin/affichage-public/affichage-client.tsx`  
**Server actions :** `lib/config-vitrine/server-actions.ts`

**UI cible :**

```
┌─────────────────────────────────────────────────────┐
│  ⚙️  Configuration de la vitrine publique           │
│  Sélectionnez les indicateurs à afficher dans la    │
│  section "Données agrégées" de la page d'accueil.   │
│                                                     │
│  ☑ A1  Nombre de personnes formées       ordre: 1  │
│  ☐ A2  Pourcentage de femmes             ordre: —  │
│  ☐ A3  …                                           │
│  ☑ A4  Gain de compétences               ordre: 2  │
│  ☑ A5  Taux d'insertion                  ordre: 3  │
│  ☑ B1  Activités économiques appuyées    ordre: 4  │
│  ☐ B2  …                                           │
│  ☑ B3  Emplois créés ou maintenus        ordre: 5  │
│  ☑ B4  Emplois indirects (estimés)       ordre: 6  │
│  ☐ C1  …                                           │
│  ☐ F1  …                                           │
│                                                     │
│  [Enregistrer les modifications]                    │
└─────────────────────────────────────────────────────┘
```

**Server action** (`lib/config-vitrine/server-actions.ts`) :

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';

export type SaveConfigVitrineResult =
  | { status: 'succes' }
  | { status: 'erreur_rls'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export async function saveConfigVitrine(
  selections: Array<{ code: string; visible: boolean; ordre: number }>
): Promise<SaveConfigVitrineResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs'].includes(utilisateur.role)) {
    return { status: 'erreur_rls', message: 'Réservé aux administrateurs.' };
  }

  const supabase = await createSupabaseServerClient();

  for (const s of selections) {
    const { error } = await supabase
      .from('config_vitrine_indicateurs')
      .update({
        visible: s.visible,
        ordre: s.visible ? s.ordre : 0,
        updated_at: new Date().toISOString(),
        updated_by: utilisateur.user_id,
      })
      .eq('indicateur_code', s.code);

    if (error) return { status: 'erreur_inconnue', message: error.message };
  }

  revalidatePath('/');            // invalide le cache de la vitrine publique
  revalidatePath('/super-admin/affichage-public');
  return { status: 'succes' };
}
```

**Accès au panneau :** ajouter un lien "Affichage public" dans le menu de navigation super-admin (probablement dans `app/(dashboard)/super-admin/` côté layout ou sidebar).

---

#### Résumé des fichiers pour ce point 1.5

| Fichier | Action |
|---|---|
| `supabase/migrations/…_indicateurs_vitrine_publique.sql` | Créer |
| `lib/landing/queries.ts` | Ajouter `getIndicateursVitrine()` |
| `app/page.tsx` | Appeler `getIndicateursVitrine()`, passer aux `KpiCompteurs` |
| `lib/config-vitrine/server-actions.ts` | Créer |
| `app/(dashboard)/super-admin/affichage-public/page.tsx` | Créer |
| `app/(dashboard)/super-admin/affichage-public/affichage-client.tsx` | Créer |

---

### 1.6 — Section "Notre méthodologie de suivi-évaluation" → Principes directeurs

**Fichier :** `app/page.tsx` — fonction `Methodologie()`

**Action :** Remplacer le contenu de la section par les **Principes directeurs** (partie 4 du cadre méthodologique OIF).

> ⚠️ **Contenu à fournir par l'équipe.** Le texte exact des Principes directeurs doit être extrait de la "Note méthodologique OIF" (document fourni séparément). En attendant, utiliser des placeholders avec le titre correct.

Structure suggérée (à valider avec le contenu réel) :

```tsx
const principesDirecteurs = [
  {
    titre: 'Principe 1 — [à compléter depuis le cadre méthodologique]',
    description: '[texte exact du principe 1]',
    icone: Shield,
  },
  {
    titre: 'Principe 2 — [à compléter]',
    description: '[texte exact du principe 2]',
    icone: Target,
  },
  // ... autres principes
];
```

Changer aussi le badge et le sous-titre :

```tsx
// Badge
<Badge>Principes directeurs</Badge>

// H2
<h2>Notre méthodologie de suivi-évaluation</h2>
// (conserver le titre h2, seul le CONTENU des cartes change)
```

---

### 1.7 — Section "Les 4 piliers du Cadre Commun" → reprendre le schéma exact + pilier transversal

**Fichier :** `app/page.tsx` — fonction `CadreCommun()`

**Action :** Remplacer les 4 piliers actuels par ceux du **schéma du Cadre Commun** OIF, en incluant le **pilier transversal** (actuellement manquant).

> ⚠️ **Contenu à fournir par l'équipe.** Les intitulés exacts et descriptions doivent venir du schéma du Cadre Commun (document de référence OIF).

Piliers actuels (à remplacer) :
```
01 Insertion professionnelle
02 Entrepreneuriat
03 Égalité femmes-hommes
04 Apport du français (F1)
```

Structure attendue (les 4 piliers thématiques + le pilier transversal) :
```
Pilier A — [intitulé exact du schéma]
Pilier B — [intitulé exact du schéma]
Pilier C — [intitulé exact du schéma]
Pilier D — [intitulé exact du schéma]
Pilier transversal — [intitulé exact du schéma]
```

Adapter le grid de `grid-cols-4` à `grid-cols-2 lg:grid-cols-3` ou similaire pour accueillir 5 éléments harmonieusement.

---

### 1.8 — Section "Pourquoi cette plateforme" → Portée du Cadre Commun

**Fichier :** `app/page.tsx` — fonction `Pourquoi()`

**Action :** Remplacer l'intégralité du contenu (4 cartes : RGPD, Traçabilité, Pilotage, Cohérence) par le texte de la **portée du Cadre Commun** issu du cadre méthodologique. Insister sur la **définition de l'emploi et de l'employabilité**.

> ⚠️ **Contenu à fournir par l'équipe.** Extraire la section "portée du cadre commun" du document méthodologique.

Changer le titre de la section :

```tsx
// Avant
<h2>Pourquoi cette plateforme</h2>

// Après
<h2>Portée du Cadre Commun</h2>
```

---

### 1.9 — Supprimer les sections "À qui s'adresse cette plateforme" et "Top N pays"

**Fichier :** `app/page.tsx`

Supprimer les deux composants du rendu `VitrinePubliquePage()` :

```tsx
// Supprimer ces deux lignes dans VitrinePubliquePage() :
<Audiences />
<PaysIntervention kpis={kpis} />
```

Supprimer aussi les fonctions `Audiences()` et `PaysIntervention()` du fichier (et l'import `Briefcase` si devenu inutilisé).

> Vérifier avec `eslint` / TypeScript qu'aucun import ne reste orphelin.

---

## SECTION 2 — RÉFÉRENTIEL (`app/(public)/referentiels/`)

### 2.1 — Ajouter "Observation de rattachement" aux définitions

**Fichiers :** `app/(public)/referentiels/[code]/page.tsx` (et éventuellement `lib/referentiels/indicateurs.ts`)

**Action :** Pour chaque variable/indicateur, rajouter les éléments de l'**"Observation de rattachement"** issus du Cadre Commun, en plus du contenu existant.

> ⚠️ **Contenu à fournir par l'équipe.** Le texte de chaque "Observation de rattachement" doit être extrait du cadre méthodologique et ajouté dans `lib/referentiels/indicateurs.ts` comme nouvelle propriété `observationRattachement?: string` sur chaque indicateur.

Étapes :
1. Ajouter le champ `observationRattachement?: string` dans le type `Indicateur` de `lib/referentiels/indicateurs.ts`
2. Renseigner la valeur pour chaque indicateur concerné
3. Dans la page `referentiels/[code]/page.tsx`, afficher ce champ si présent (section "Observation de rattachement" avec même mise en forme que les autres champs)

---

### 2.2 — Bouton de téléchargement PDF de la note de cadrage

**Fichier :** `app/(public)/referentiels/page.tsx` (liste) et/ou `app/(public)/referentiels/[code]/page.tsx` (détail)

**Action :** Ajouter un bouton/lien "Télécharger la note de cadrage (PDF)" bien visible.

Étapes :
1. Déposer le fichier PDF de la note de cadrage dans `public/documents/note-de-cadrage-oif.pdf`
2. Ajouter un bouton dans la page référentiels :

```tsx
import { Download } from 'lucide-react';

<a
  href="/documents/note-de-cadrage-oif.pdf"
  download
  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
>
  <Download className="size-4" aria-hidden />
  Télécharger la note de cadrage (PDF)
</a>
```

> Positionner ce bouton de façon visible dans l'en-tête de la page `/referentiels` (avant la liste des indicateurs).

---

## SECTION 3 — RÉALISATIONS (`app/(public)/realisations/`)

### 3.1 — Supprimer le bloc d'analyse IA dans la vue publique

**Fichier :** `app/(public)/realisations/[pilier]/[indicateur]/page.tsx`

**Action :** Retirer le composant `BlocAnalytiqueIA` de la vue publique.

Supprimer :
- L'import de `getAnalysePubliee` (ligne ~30)
- La constante `analyseIA` et son appel (ligne ~360-361)
- Le rendu `<BlocAnalytiqueIA analyse={analyseIA} ... />` (ligne ~523)
- L'import du composant `BlocAnalytiqueIA` si c'est le seul endroit où il est utilisé dans cette page

> Vérifier que la page compile proprement après suppression (TypeScript + ESLint no-unused-vars). Lancer `npx prettier --write` sur le fichier modifié avant commit.

---

### 3.2 — Remplacer "nombre de jeunes formés" par "Nombre de personnes formées"

**Fichiers :** `app/(public)/realisations/[pilier]/[indicateur]/page.tsx` + tout fichier de composant de réalisation affichant ce texte

**Action :** Rechercher et remplacer toutes les occurrences :

```
"jeunes formés"      → "personnes formées"
"Jeunes formés"      → "Personnes formées"
"nombre de jeunes"   → "nombre de personnes"  (dans les libellés d'indicateurs)
```

> Aussi mettre à jour l'`intitule` de l'indicateur A1 dans `lib/referentiels/indicateurs.ts` :
> ```typescript
> // Avant
> intitule: 'Nombre de jeunes formés',
> // Après
> intitule: 'Nombre de personnes formées',
> ```
> ⚠️ Ce changement impacte toutes les pages qui affichent `indicateur.intitule` pour A1 — vérifier la cohérence dans le dashboard et les exports.

---

### 3.3 — Désagrégation des données : par sexe et tranche d'âge

**Fichiers :** `app/(public)/realisations/[pilier]/[indicateur]/page.tsx` + `lib/landing/queries.ts`

**Action :** Afficher la ventilation par **sexe** (Homme / Femme) et **tranche d'âge** (Jeune / Adulte) dans les réalisations publiques.

La désagrégation par tranche d'âge existe déjà dans `lib/landing/queries.ts` → `getRepartitionTrancheAge()`. La désagrégation par sexe est disponible via `beneficiaires_femmes` et `beneficiaires_hommes` dans `get_kpis_publics_v1()`.

Étapes :
1. Appeler `getRepartitionTrancheAge()` dans la page `/realisations/[pilier]/[indicateur]` (ou dans une nouvelle fonction query pour les réalisations)
2. Ajouter un bloc visuel "Répartition" sous les chiffres principaux :

```
Sexe :     Femmes XX%  |  Hommes XX%
Tranche :  Jeunes XX%  |  Adultes XX%
```

3. Utiliser des barres de progression simples ou des badges (`Badge` shadcn) pour la mise en forme — rester cohérent avec le design existant de la page.

> Ce bloc ne doit apparaître que pour les indicateurs du **pilier A** (formation, bénéficiaires individuels). Ne pas l'afficher pour B1, B3, B4 (structures, emplois).

---

## Checklist avant commit

- [ ] `npx tsc --noEmit` passe sans erreur
- [ ] `npx eslint . --max-warnings 0` passe (ou corriger les warnings Prettier)
- [ ] Vérifier visuellement : route `/`, `/realisations`, `/referentiels` sur `localhost:3000`
- [ ] Les items **1.6, 1.7, 1.8, 2.1** nécessitent du **contenu fourni par l'équipe** avant d'être finalisés — mettre des placeholders `[TODO: contenu cadre méthodologique]` visibles
- [ ] L'item **2.2** nécessite que le fichier PDF soit fourni et déposé dans `public/documents/`

---

## Résumé des fichiers à modifier

| Fichier | Changements |
|---|---|
| `components/landing/header-public.tsx` | 1.1 — Menu réordonnée + renommage |
| `app/page.tsx` | 1.2, 1.3, 1.4, 1.7, 1.8, 1.9 — Textes + ordre sections + suppressions |
| `lib/landing/queries.ts` | 1.5 — Ajouter `getIndicateursVitrine()` |
| `supabase/migrations/…_indicateurs_vitrine_publique.sql` | 1.5 — Table `config_vitrine_indicateurs` + RLS |
| `lib/config-vitrine/server-actions.ts` | 1.5 — `saveConfigVitrine()` |
| `app/(dashboard)/super-admin/affichage-public/page.tsx` | 1.5 — Panneau de gestion admin |
| `app/(dashboard)/super-admin/affichage-public/affichage-client.tsx` | 1.5 — UI checkboxes + enregistrement |
| `lib/referentiels/indicateurs.ts` | 2.1 (nouveau champ), 3.2 (intitulé A1) |
| `app/(public)/referentiels/page.tsx` | 2.2 — Bouton PDF |
| `app/(public)/referentiels/[code]/page.tsx` | 2.1 — Observation de rattachement |
| `app/(public)/realisations/[pilier]/[indicateur]/page.tsx` | 3.1 — Supprimer BlocAnalytiqueIA, 3.2 — textes, 3.3 — désagrégation |
