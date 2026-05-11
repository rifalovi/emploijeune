# 🚀 SPRINT GLOBAL — Migration Données Réelles + Vitrine Publique + Charte OIF

> **Document de référence pour Claude Code — sprint complet en autonomie maximale**
> 
> Date : 27 avril 2026
> Auteur : Carlos HOUNSINOU (Service de Conception et Suivi - SCS)
> Périmètre : V1.5 enrichie post-V1.0.0
> Estimation : 14-18 heures (sprint long sur 1-2 jours)

---

## 📋 Table des matières

1. [Contexte et objectifs](#1-contexte-et-objectifs)
2. [Ressources OIF disponibles](#2-ressources-oif-disponibles)
3. [Sprint 1 — Charte graphique officielle OIF](#3-sprint-1--charte-graphique-officielle-oif)
4. [Sprint 2 — Migration des données réelles](#4-sprint-2--migration-des-données-réelles)
5. [Sprint 3 — Vitrine publique institutionnelle](#5-sprint-3--vitrine-publique-institutionnelle)
6. [Sprint 4 — Adaptation des questionnaires officiels](#6-sprint-4--adaptation-des-questionnaires-officiels)
7. [Sprint 5 — Seed utilisateurs de démo](#7-sprint-5--seed-utilisateurs-de-démo)
8. [Procédure et arbitrages](#8-procédure-et-arbitrages)
9. [Annexes techniques](#9-annexes-techniques)

---

## 1. Contexte et objectifs

### 1.1 État de la plateforme

V1.0.0 publiée le 27 avril 2026. Tags :
- `v0.6.0`, `v0.6.5`, `v0.7.0`, `v0.8.0`, `v0.8.5`, `v1.0.0-V1-COMPLETE`
- 443 tests Vitest verts
- 9 modules livrés
- Architecture stable, traçabilité RGPD complète

### 1.2 Objectifs du sprint global

Transformer la plateforme outil en **plateforme institutionnelle vitrine** prête pour le pilote de juin 2026 (60 partenaires) en :

1. **Adoptant la charte graphique officielle OIF** (logo, couleurs, typographie)
2. **Migrant 5 618 bénéficiaires + 341 structures réelles** depuis la base de sondage OIF
3. **Créant une page d'accueil publique** institutionnelle avec KPI agrégés anonymisés
4. **Adaptant les questionnaires** A et B aux versions officielles V2
5. **Ajoutant 4 utilisateurs de démonstration** pour les tests parcours

### 1.3 Principes directeurs

- ✅ **Conformité RGPD absolue** : aucune donnée nominative en accès libre
- ✅ **Anonymisation hybride** : données réelles en base, agrégats anonymisés en public
- ✅ **Cohérence visuelle** : charte officielle OIF strictement respectée
- ✅ **Crédibilité institutionnelle** : vitrine adaptée aux bailleurs, États, partenaires
- ✅ **Pérennité technique** : pas de régression sur la V1.0.0 stable

---

## 2. Ressources OIF disponibles

Toutes les ressources sont à disposition dans le dossier projet. Voici l'inventaire structuré.

### 2.1 Charte graphique officielle

| Fichier | Localisation | Usage |
|---------|--------------|-------|
| `OIF_mini_charte.pdf` | docs/charte/ | Charte officielle (10 pages) |
| `Logo_OIF_couleur__2_.png` | public/assets/logo/ | Logo principal couleur (fond clair) |
| `Logo_OIF_blanc.eps` | public/assets/logo/ | Logo blanc (fond foncé) |
| `Logo_OIF_noir.eps` | public/assets/logo/ | Logo noir monochrome |
| `Logo_OIF_quadri.eps` | public/assets/logo/ | Logo quadri (print) |

### 2.2 Couleurs officielles des programmes stratégiques

**Source** : `Code_couleur_programmation_OIF.pdf`

| Programme | Thème | Couleur Pantone | HEX | RGB |
|-----------|-------|-----------------|-----|-----|
| **PS1** | La langue française au service des cultures et de l'éducation | Pantone Process Cyan C | `#0198E9` | rgb(1, 152, 233) |
| **PS2** | La langue française au service de la démocratie et de la gouvernance | Pantone 2603 C | `#5D0073` | rgb(93, 0, 115) |
| **PS3** | La langue française, vecteur de développement durable | Pantone 376 C | `#7EB301` | rgb(126, 179, 1) |

### 2.3 Référentiel des projets OIF

**Source** : `Liste_de_projets_selon_la_Programmation_OIF.xlsx` (65 projets)

Extraction structurée disponible dans `projets-oif-referentiel.csv` avec 23 projets utilisés.

### 2.4 Base de données réelles OIF

**Source** : `Base_de_sondage_EmploiJeune_Global_230426_V2.xlsm`

#### Volume

- **5 618 bénéficiaires** sur 6 projets et 51 pays
- **341 structures** sur 6 projets et 52 pays
- **3 années** : 2023, 2024, 2025

#### Statistiques bénéficiaires

| Métrique | Valeur |
|----------|--------|
| Total | 5 618 |
| Femmes | 5 025 (89,4%) |
| Hommes | 487 (8,7%) |
| Pays | 51 |
| Top pays | Mali (754), Bénin (593), Burkina Faso (486), Cameroun (439), Togo (348) |
| Top projets | P14 (4 626), P19 (427), P16a (339), P18 (118) |

#### Statistiques structures

| Métrique | Valeur |
|----------|--------|
| Total | 341 |
| Pays | 52 |
| Top pays | France (28), Bénin (24), Haïti (22), Togo (21) |
| Top secteurs | Agriculture/sylviculture/pêche (36) |

### 2.5 Mapping codes projets

La base de sondage utilise des codes courts (P14, P19...) qui doivent être mappés aux codes officiels (PROJ_Axx).

| Code court | Code officiel |
|------------|---------------|
| P6 | PROJ_A06 |
| P13 | PROJ_A13 |
| P14 | PROJ_A14 |
| P15 | PROJ_A15 |
| P16a | PROJ_A16a |
| P17 | PROJ_A17 |
| P18 | PROJ_A18 |
| P19 | PROJ_A19 |
| P20 | PROJ_A20 |

### 2.6 Questionnaires officiels V2

| Fichier | Description |
|---------|-------------|
| `Questionnaire_EmploiJeunes_Indicateurs_A_V2.docx` | Questionnaire A — 30 questions, 5 sections |
| `Questionnaire_EmploiJeunes_Indicateurs_B_V2.docx` | Questionnaire B — 13+ questions, 4 sections |

### 2.7 Documents méthodologiques

| Fichier | Description |
|---------|-------------|
| `Cadre_de_mesure_du_rendement_emploi_V2.docx` | Cadre Commun officiel |
| `Note_méthodologique_V2.docx` | Méthode de collecte |

---

## 3. Sprint 1 — Charte graphique officielle OIF

**Estimation** : 2-3 heures
**Priorité** : Haute (impact visuel immédiat)

### 3.1 Objectifs

1. Intégrer le logo OIF officiel dans tous les écrans
2. Adapter la palette de couleurs aux couleurs officielles PS1/PS2/PS3
3. Conserver le bleu marine actuel comme couleur institutionnelle générale
4. Conformité totale avec la charte graphique OIF

### 3.2 Périmètre technique

#### 3.2.1 Intégration du logo

```
public/assets/logo/
├── oif-logo-couleur.png       (principal - fond clair)
├── oif-logo-blanc.svg          (fond foncé)  
├── oif-logo-noir.svg           (monochrome noir)
└── oif-logo-favicon.ico        (favicon navigateur)
```

**Composant React** :
```typescript
// components/branding/OifLogo.tsx
export function OifLogo({ variant = 'couleur', size = 'md' }: {
  variant?: 'couleur' | 'blanc' | 'noir';
  size?: 'sm' | 'md' | 'lg';
}) {
  // Utilise next/image avec optimisation
  // Tailles : sm=40px, md=60px, lg=80px de hauteur
}
```

**Emplacements** :
- Sidebar (en haut, pour les utilisateurs authentifiés)
- Page connexion `/connexion`
- Page accueil publique `/`
- Header dashboards
- Templates emails (signature)
- Page de garde des exports PDF

#### 3.2.2 Couleurs Tailwind

**Étendre** la configuration `tailwind.config.ts` :

```typescript
const colors = {
  // Couleur institutionnelle OIF (déjà en place, à conserver)
  'oif-blue': '#0E4F88',
  
  // NOUVELLES — couleurs officielles des programmes stratégiques
  'oif-ps1': {
    DEFAULT: '#0198E9',  // Bleu cyan - PS1
    light: '#33B0EE',
    lighter: '#66C8F3',
    bg: '#E5F4FE',       // Fond très léger
  },
  'oif-ps2': {
    DEFAULT: '#5D0073',  // Violet - PS2
    light: '#7D2393',
    lighter: '#9D55B3',
    bg: '#F3E5F8',       // Fond très léger
  },
  'oif-ps3': {
    DEFAULT: '#7EB301',  // Vert - PS3
    light: '#A2C535',
    lighter: '#C0D770',
    bg: '#F2F9E0',       // Fond très léger
  },
};
```

#### 3.2.3 Adaptation des composants existants

**badge-projet.tsx** : utiliser les nouvelles couleurs PS

```typescript
const PS_COLORS = {
  PS1: { bg: 'bg-oif-ps1-bg', text: 'text-oif-ps1', border: 'border-oif-ps1' },
  PS2: { bg: 'bg-oif-ps2-bg', text: 'text-oif-ps2', border: 'border-oif-ps2' },
  PS3: { bg: 'bg-oif-ps3-bg', text: 'text-oif-ps3', border: 'border-oif-ps3' },
};
```

**Pie chart Programmes stratégiques** (`/dashboard`) :
- PS1 → `#0198E9`
- PS2 → `#5D0073`
- PS3 → `#7EB301`

**Bordure colorée des fiches bénéficiaires/structures** dans les listes : couleur PS de leur programme.

#### 3.2.4 Typographie

**Recommandation** : conserver Inter (système actuel) qui reste neutre et professionnel. La charte OIF n'impose pas une typographie spécifique pour le digital.

#### 3.2.5 Templates emails

Mettre à jour les 7 templates existants :
- En-tête : logo OIF couleur sur fond blanc
- Couleur titres : `#0E4F88` (oif-blue institutionnel)
- Boutons CTA : `#0E4F88` 
- Footer RGPD : conserver

### 3.3 Livrables Sprint 1

- ✅ Logos OIF placés dans `public/assets/logo/`
- ✅ Composant `OifLogo.tsx` réutilisable
- ✅ Configuration Tailwind enrichie avec couleurs PS officielles
- ✅ Sidebar et écrans authentifiés intègrent le logo
- ✅ Pie chart utilise les couleurs officielles
- ✅ Badges projet adaptés
- ✅ Templates emails actualisés
- ✅ Tests visuels documentés
- ✅ Commit + push

---

## 4. Sprint 2 — Migration des données réelles

**Estimation** : 4-5 heures
**Priorité** : Haute (alimente toute la plateforme)

### 4.1 Objectifs

1. Importer 5 618 bénéficiaires réels en respectant le RGPD
2. Importer 341 structures réelles
3. Mapper les codes courts (P14) vers les codes officiels (PROJ_A14)
4. Génér des emails techniques cohérents (les bénéficiaires n'ont pas tous d'email)
5. Marquer la nature "données importées" pour traçabilité

### 4.2 Approche RGPD

#### Stratégie : "Données réelles + Anonymisation publique"

**Couche 1 — Données réelles en base** :
- Conservation des prénoms, noms, pays réels
- Accès limité aux utilisateurs authentifiés selon leur rôle (RLS)
- Audit complet des consultations
- Marqueur `import_source = 'BASE_OIF_2025'` sur toutes les lignes

**Couche 2 — Vues publiques anonymisées** :
- Page d'accueil `/` n'affiche que des **agrégats** :
  - "X bénéficiaires accompagnés"
  - "X structures appuyées"
  - "X pays d'intervention"
- AUCUN nom, prénom, email, téléphone affiché publiquement

**Couche 3 — Consentement RGPD réputé acquis pour cette migration** :

Comme les données proviennent de la base de sondage officielle OIF déjà consentie, marquer :
- `consentement_rgpd = true`
- `consentement_date = date_de_la_formation` (ou 2025-01-01 par défaut)
- `consentement_origine = 'COLLECTE_INITIALE_OIF'`

### 4.3 Périmètre technique

#### 4.3.1 Migration de référence projets

Avant l'import, créer/vérifier la migration BDD pour les **23 projets** du référentiel OIF (voir `projets-oif-referentiel.csv`).

```sql
-- Migration : 20260427100001_referentiel_projets_oif.sql

INSERT INTO projets (code, libelle, description, programme_strategique) VALUES
('PROJ_A01a', 'LA LANGUE FRANÇAISE, LANGUE INTERNATIONALE', '...', 'PS1'),
('PROJ_A01b', 'OBSERVATOIRE DE LA LANGUE FRANÇAISE', '...', 'PS1'),
-- ... etc pour les 23 projets
ON CONFLICT (code) DO UPDATE SET 
  libelle = EXCLUDED.libelle,
  description = EXCLUDED.description,
  programme_strategique = EXCLUDED.programme_strategique;
```

**Mapping PS** (à compléter selon référentiel officiel) :
- PROJ_A01x à PROJ_A12 → PS1 (Cultures et éducation)
- PROJ_A13 à PROJ_A20 → PS2 ou PS3 selon thématique

#### 4.3.2 Script d'import des bénéficiaires

**Fichier** : `scripts/import-base-reelle/import-beneficiaires.mjs`

```javascript
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';

// Lecture du CSV
const records = parse(readFileSync('beneficiaires-reels.csv'), {
  columns: true,
  skip_empty_lines: true
});

// Mapping codes projets
const PROJET_MAPPING = {
  'P6': 'PROJ_A06',
  'P13': 'PROJ_A13',
  'P14': 'PROJ_A14',
  'P15': 'PROJ_A15',
  'P16a': 'PROJ_A16a',
  'P17': 'PROJ_A17',
  'P18': 'PROJ_A18',
  'P19': 'PROJ_A19',
  'P20': 'PROJ_A20'
};

// Mapping sexe
const SEXE_MAPPING = { 'F': 'feminin', 'H': 'masculin' };

// Mapping age groupe
const AGE_MAPPING = {
  'Jeune': '18-34',
  'Adulte': '35-60'
};

// Génération email technique si manquant
function generateEmailTechnique(prenom, nom, projet, n) {
  const slug = (prenom + '.' + nom)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  return `${slug || 'beneficiaire'}.${n}@import-oif-2025.local`;
}

// Construction de la date de début (1er jour de l'année déclarée)
function buildDateDebut(annee) {
  return `${annee || '2024'}-01-01`;
}

// Boucle d'import
const beneficiaires = records
  .filter(r => r.projet && PROJET_MAPPING[r.projet])  // projet valide
  .map((r, idx) => ({
    email: r.courriel?.trim() && r.courriel.includes('@') 
      ? r.courriel.trim().toLowerCase() 
      : generateEmailTechnique(r.prenom, r.nom, r.projet, r.n),
    prenom: r.prenom?.trim() || 'Prénom inconnu',
    nom: r.nom?.trim() || 'Nom inconnu',
    sexe: SEXE_MAPPING[r.sexe] || 'feminin',
    age_groupe: AGE_MAPPING[r.age_groupe] || '18-34',
    pays: r.pays?.trim() || 'Non spécifié',
    code_projet: PROJET_MAPPING[r.projet],
    programme_strategique: 'PS1',  // À déterminer selon mapping projet→PS
    date_debut_formation: buildDateDebut(r.annee),
    consentement_rgpd: true,
    consentement_date: buildDateDebut(r.annee),
    consentement_origine: 'COLLECTE_INITIALE_OIF',
    statut: 'forme',  // Toutes ces personnes ont déjà été formées
    type_formation: r.type_formation?.trim() || '',
    organisation_accompagnement: r.organisation_accompagnement?.trim() || '',
    import_source: 'BASE_OIF_230426_V2',
    import_batch: '2026-04-27-migration-initiale',
    import_index: parseInt(r.n)
  }));

// Insertion par lots de 500
const BATCH_SIZE = 500;
for (let i = 0; i < beneficiaires.length; i += BATCH_SIZE) {
  const batch = beneficiaires.slice(i, i + BATCH_SIZE);
  const { error } = await supabase
    .from('beneficiaires')
    .insert(batch);
  if (error) {
    console.error(`Erreur lot ${i}-${i+BATCH_SIZE}:`, error);
  } else {
    console.log(`✓ Lot ${i+1}-${Math.min(i+BATCH_SIZE, beneficiaires.length)} inséré`);
  }
}

console.log(`Total importé : ${beneficiaires.length} bénéficiaires`);
```

#### 4.3.3 Script d'import des structures

Même approche pour les 341 structures, fichier `scripts/import-base-reelle/import-structures.mjs`.

#### 4.3.4 Migrations BDD requises

**Ajouter** des colonnes de traçabilité aux tables `beneficiaires` et `structures` :

```sql
-- Migration : 20260427100002_colonnes_import_traçabilite.sql

ALTER TABLE beneficiaires
ADD COLUMN IF NOT EXISTS import_source TEXT,
ADD COLUMN IF NOT EXISTS import_batch TEXT,
ADD COLUMN IF NOT EXISTS import_index INTEGER,
ADD COLUMN IF NOT EXISTS consentement_origine TEXT;

CREATE INDEX IF NOT EXISTS idx_beneficiaires_import_source 
  ON beneficiaires(import_source);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS import_source TEXT,
ADD COLUMN IF NOT EXISTS import_batch TEXT,
ADD COLUMN IF NOT EXISTS import_index INTEGER,
ADD COLUMN IF NOT EXISTS consentement_origine TEXT;

CREATE INDEX IF NOT EXISTS idx_structures_import_source 
  ON structures(import_source);
```

#### 4.3.5 Procédure d'exécution

```bash
# 1. Préparer les CSV (extraction depuis l'Excel)
node scripts/import-base-reelle/extract-from-xlsm.mjs

# 2. Appliquer la migration
npx supabase db push

# 3. Lancer les imports
node scripts/import-base-reelle/import-projets-referentiel.mjs
node scripts/import-base-reelle/import-beneficiaires.mjs
node scripts/import-base-reelle/import-structures.mjs

# 4. Vérification
node scripts/import-base-reelle/verify-import.mjs
```

### 4.4 Livrables Sprint 2

- ✅ 23 projets référentiel OIF en base
- ✅ Migration colonnes traçabilité import
- ✅ Scripts d'import idempotents
- ✅ 5 618 bénéficiaires en base avec données réelles
- ✅ 341 structures en base avec données réelles
- ✅ Marqueur `import_source` permettant rollback
- ✅ Documentation `docs/migration/migration-base-reelle.md`
- ✅ Tests de cohérence (compteurs avant/après)
- ✅ Commit + push

### 4.5 Sécurité et rollback

**Script de rollback** prêt :
```sql
-- En cas de problème, rollback ciblé
DELETE FROM beneficiaires WHERE import_batch = '2026-04-27-migration-initiale';
DELETE FROM structures WHERE import_batch = '2026-04-27-migration-initiale';
```

---

## 5. Sprint 3 — Vitrine publique institutionnelle

**Estimation** : 5-6 heures
**Priorité** : Critique pour pilote juin 2026

### 5.1 Objectifs

1. Créer une page d'accueil publique attractive sur `/`
2. Afficher les vrais KPI agrégés OIF (anonymisés)
3. Présenter la mission, les piliers, les partenaires
4. Bouton clair vers `/connexion` pour le backend
5. Conformité RGPD totale (aucune donnée nominative)

### 5.2 Architecture de la page

```
┌─────────────────────────────────────────┐
│ HEADER                                  │
│ [Logo OIF] [Menu navigation] [Connexion]│
├─────────────────────────────────────────┤
│ SECTION 1 — HERO                        │
│ Titre + sous-titre + CTA                │
│ [Image de fond ou pattern OIF]          │
├─────────────────────────────────────────┤
│ SECTION 2 — KPI EN COMPTEURS            │
│ 5 618 bénéficiaires │ 51 pays │         │
│ 341 structures │ 89% femmes             │
├─────────────────────────────────────────┤
│ SECTION 3 — LA PROGRAMMATION OIF        │
│ 3 cartes des programmes stratégiques    │
│ avec leurs couleurs officielles         │
├─────────────────────────────────────────┤
│ SECTION 4 — LE CADRE COMMUN             │
│ 4 piliers + marqueur F1                 │
├─────────────────────────────────────────┤
│ SECTION 5 — POURQUOI CETTE PLATEFORME   │
│ 4 valeurs clés                          │
├─────────────────────────────────────────┤
│ SECTION 6 — À QUI S'ADRESSE-T-ELLE      │
│ Coordonnateurs / Partenaires / États    │
├─────────────────────────────────────────┤
│ SECTION 7 — CARTE D'INTERVENTION        │
│ Carte des 51 pays (visuelle simple)     │
├─────────────────────────────────────────┤
│ SECTION 8 — APPEL À L'ACTION            │
│ "Vous êtes partenaire ?"                │
│ [Demander un accès] [Se connecter]      │
├─────────────────────────────────────────┤
│ FOOTER                                  │
│ Contact / RGPD / Mentions légales       │
└─────────────────────────────────────────┘
```

### 5.3 Composants à créer

#### Structure
```
app/(public)/page.tsx                    ← Page racine /
components/landing/
├── HeaderPublic.tsx
├── HeroSection.tsx
├── KpisCompteursSection.tsx
├── ProgrammesStrategiques.tsx
├── CadreCommunSection.tsx
├── PourquoiSection.tsx
├── PublicCibleSection.tsx
├── CarteInterventionSection.tsx
├── CtaConnexionSection.tsx
└── FooterPublic.tsx
```

#### 5.3.1 Hero Section

```typescript
// components/landing/HeroSection.tsx
export function HeroSection() {
  return (
    <section className="bg-gradient-to-br from-white via-oif-ps1-bg to-white py-20 px-4">
      <div className="max-w-6xl mx-auto text-center">
        <OifLogo size="lg" className="mx-auto mb-8" />
        
        <h1 className="text-4xl md:text-6xl font-bold text-oif-blue mb-6">
          Plateforme OIF Emploi Jeunes
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-700 mb-4 max-w-3xl mx-auto">
          Suivi-évaluation des projets emploi jeunes 
          de la Francophonie
        </p>
        
        <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
          Plateforme officielle du Service de Conception et Suivi 
          (SCS) de l'Organisation internationale de la Francophonie
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/connexion" className="btn-primary">
            Espace partenaire
          </Link>
          <Link href="/demande-acces" className="btn-secondary">
            Demander un accès
          </Link>
        </div>
      </div>
    </section>
  );
}
```

#### 5.3.2 Section KPI compteurs

**Fonction PostgreSQL** à créer :

```sql
-- Migration : 20260427100003_function_kpis_publics.sql

CREATE OR REPLACE FUNCTION get_kpis_publics_v1()
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN json_build_object(
    'beneficiaires_total', (SELECT COUNT(*) FROM beneficiaires WHERE deleted_at IS NULL),
    'beneficiaires_femmes_pct', (
      SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE sexe = 'feminin') / NULLIF(COUNT(*), 0), 0)
      FROM beneficiaires WHERE deleted_at IS NULL
    ),
    'structures_total', (SELECT COUNT(*) FROM structures WHERE deleted_at IS NULL),
    'pays_total', (
      SELECT COUNT(DISTINCT pays) 
      FROM (
        SELECT pays FROM beneficiaires WHERE deleted_at IS NULL AND pays IS NOT NULL
        UNION 
        SELECT pays FROM structures WHERE deleted_at IS NULL AND pays IS NOT NULL
      ) t
    ),
    'projets_actifs', (
      SELECT COUNT(DISTINCT code_projet) 
      FROM beneficiaires WHERE deleted_at IS NULL
    ),
    'annee_couverture_min', (
      SELECT MIN(EXTRACT(YEAR FROM date_debut_formation)) 
      FROM beneficiaires WHERE deleted_at IS NULL
    ),
    'annee_couverture_max', (
      SELECT MAX(EXTRACT(YEAR FROM date_debut_formation)) 
      FROM beneficiaires WHERE deleted_at IS NULL
    )
  );
END;
$$;

-- Permission lecture publique
GRANT EXECUTE ON FUNCTION get_kpis_publics_v1() TO anon, authenticated;
```

**Composant** (avec animation de comptage) :

```typescript
// components/landing/KpisCompteursSection.tsx
export async function KpisCompteursSection() {
  const supabase = createSupabaseAnonClient();
  const { data: kpis } = await supabase.rpc('get_kpis_publics_v1');

  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-oif-blue mb-12">
          L'impact de nos interventions en chiffres
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <KpiCard
            valeur={kpis.beneficiaires_total}
            label="Bénéficiaires accompagnés"
            color="oif-ps1"
            icon={<Users />}
          />
          <KpiCard
            valeur={kpis.structures_total}
            label="Structures appuyées"
            color="oif-ps3"
            icon={<Building />}
          />
          <KpiCard
            valeur={kpis.pays_total}
            label="Pays d'intervention"
            color="oif-ps2"
            icon={<Globe />}
          />
          <KpiCard
            valeur={kpis.beneficiaires_femmes_pct}
            label="% de femmes"
            suffixe="%"
            color="oif-blue"
            icon={<Heart />}
          />
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-8">
          Données agrégées des projets emploi jeunes OIF, 
          période {kpis.annee_couverture_min}–{kpis.annee_couverture_max}
        </p>
      </div>
    </section>
  );
}
```

#### 5.3.3 Section Programmes stratégiques

```typescript
// components/landing/ProgrammesStrategiques.tsx
export function ProgrammesStrategiques() {
  const programmes = [
    {
      code: 'PS1',
      titre: 'Cultures et éducation',
      description: 'La langue française au service des cultures et de l\'éducation',
      couleur: 'oif-ps1',
      icone: <BookOpen />
    },
    {
      code: 'PS2',
      titre: 'Démocratie et gouvernance',
      description: 'La langue française au service de la démocratie et de la gouvernance',
      couleur: 'oif-ps2',
      icone: <Vote />
    },
    {
      code: 'PS3',
      titre: 'Développement durable',
      description: 'La langue française, vecteur de développement durable',
      couleur: 'oif-ps3',
      icone: <Leaf />
    }
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-oif-blue mb-4">
          Les trois programmes stratégiques de l'OIF
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          La programmation 2024-2027 articule trois axes complémentaires
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {programmes.map(p => (
            <div key={p.code} className={`bg-white rounded-2xl p-8 shadow-md border-t-4 border-${p.couleur}`}>
              <div className={`w-16 h-16 rounded-full bg-${p.couleur}-bg text-${p.couleur} flex items-center justify-center mb-4`}>
                {p.icone}
              </div>
              <span className={`text-sm font-bold text-${p.couleur} uppercase`}>
                Programme {p.code}
              </span>
              <h3 className="text-2xl font-bold text-gray-900 mt-2 mb-4">
                {p.titre}
              </h3>
              <p className="text-gray-600">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

#### 5.3.4 Section Cadre Commun

Présentation des 4 piliers + marqueur F1 (référence à la documentation OIF).

#### 5.3.5 Section Carte d'intervention

Carte simple des 51 pays d'intervention. Pour V1.5 : version interactive avec drill-down.

```typescript
// V1 : liste des pays groupés par région
// V2 : carte interactive (react-simple-maps ou similaire)
```

#### 5.3.6 CTA et Footer

Boutons "Espace partenaire" / "Demander un accès".

Footer institutionnel avec :
- Mentions légales
- Politique RGPD
- Contact : carlos.hounsinou@francophonie.org
- Crédits SCS - OIF

### 5.4 Routing et architecture

```
app/
├── (public)/                  ← Group routes publiques
│   ├── layout.tsx              ← Layout public (header/footer)
│   ├── page.tsx                ← / page d'accueil
│   ├── demande-acces/
│   │   └── page.tsx
│   ├── mentions-legales/
│   │   └── page.tsx
│   └── politique-confidentialite/
│       └── page.tsx
├── (auth)/
│   ├── connexion/
│   ├── motpasse-oublie/
│   └── motpasse/
├── (dashboard)/                 ← Layout authentifié
│   ├── dashboard/
│   ├── beneficiaires/
│   └── ...
└── enquetes/public/[token]/    ← Lien public enquête
```

### 5.5 SEO et performance

```typescript
// app/(public)/page.tsx
export const metadata: Metadata = {
  title: 'Plateforme OIF Emploi Jeunes — Suivi-évaluation des projets de la Francophonie',
  description: '5 618 jeunes accompagnés dans 51 pays. Plateforme officielle de suivi-évaluation des projets emploi jeunes de l\'Organisation internationale de la Francophonie.',
  openGraph: {
    title: 'Plateforme OIF Emploi Jeunes',
    description: 'Suivi-évaluation des projets emploi jeunes de la Francophonie',
    images: ['/assets/og-image.png'],
    locale: 'fr_FR',
    type: 'website'
  }
};
```

### 5.6 Livrables Sprint 3

- ✅ Page `/` accessible sans authentification
- ✅ 8 sections complètes
- ✅ Fonction `get_kpis_publics_v1()` avec permissions
- ✅ Header public avec logo + menu + bouton connexion
- ✅ Footer institutionnel complet
- ✅ Pages mentions légales + politique de confidentialité
- ✅ Responsive (mobile, tablette, desktop)
- ✅ SEO optimisé
- ✅ Accessibilité de base (WCAG AA)
- ✅ Tests visuels documentés
- ✅ Commit + push

---

## 6. Sprint 4 — Adaptation des questionnaires officiels

**Estimation** : 2-3 heures
**Priorité** : Moyenne (peut attendre selon volume de réponses attendues au pilote)

### 6.1 Objectifs

Aligner les questionnaires A et B implémentés dans la V1 sur les versions officielles V2 OIF.

### 6.2 Différences à analyser

**Questionnaire A officiel** :
- Section 1 : Informations générales (Q101-106)
- Section 2 : Participation à la formation (Q201-210)
- Section 3 : Gains de compétences (Q301-303)
- Section 4 : Insertion professionnelle (Q401-412)
- ~30 questions au total

**Questionnaire B officiel** :
- Section 1 : Informations générales (Q101-102)
- Section 2 : Survie des activités (Q201-213)
- Section 3 : Création d'emplois et revenus
- ~13+ questions

### 6.3 Procédure

1. Lire `docs/etapes/etape-6-cadrage.md` pour comparer avec l'implémentation actuelle
2. Identifier les questions manquantes ou différentes
3. Proposer un plan de migration (quelles questions ajouter/modifier)
4. Si différences mineures : ajustements directs
5. Si différences majeures : reporter en V1.5 avec ticket dédié

### 6.4 Livrables Sprint 4

- ✅ Document d'analyse différences `docs/etapes/comparaison-questionnaires-v1-vs-officiel.md`
- ✅ Ajustements légers si possibles
- ✅ Tickets V1.5 si refonte importante
- ✅ Commit + push

---

## 7. Sprint 5 — Seed utilisateurs de démo

**Estimation** : 1-2 heures
**Priorité** : Basse (pour les tests parcours)

### 7.1 Comptes à créer

| Compte | Email | Mot de passe | Rôle | Affectations |
|--------|-------|--------------|------|--------------|
| Carlos HOUNSINOU | carlos.hounsinou@francophonie.org | (existant) | admin_scs | — |
| Marie KOUASSI | marie.kouassi@francophonie.org | DemoOIF2026 | chef_projet | PROJ_A14, PROJ_A19 |
| Jean DUPONT | jean.dupont@francophonie.org | DemoOIF2026 | chef_projet | PROJ_A06, PROJ_A18 |
| Aminata DIALLO | aminata.diallo@francophonie.org | DemoOIF2026 | chef_projet | PROJ_A14 (co-coord) |
| Direction CLAC Béoumi | direction@clac-beoumi.ci | DemoOIF2026 | contributeur_partenaire | Structure CLAC Béoumi |

### 7.2 Affectations de projets avec historique

Pour Marie KOUASSI :
- PROJ_A14 : ajouté il y a 18 mois
- PROJ_A19 : ajouté il y a 12 mois (cumulatif sur projets différents)

Pour Jean DUPONT :
- PROJ_A06 : ajouté il y a 9 mois
- PROJ_A18 : ajouté il y a 4 mois

Pour Aminata DIALLO :
- PROJ_A14 : ajoutée il y a 3 mois en co-coordination

### 7.3 Procédure

```javascript
// scripts/seed-utilisateurs-demo.mjs
const utilisateurs = [
  {
    email: 'marie.kouassi@francophonie.org',
    password: 'DemoOIF2026',
    profil: {
      prenom: 'Marie',
      nom: 'KOUASSI',
      role: 'chef_projet'
    },
    affectations: [
      { code_projet: 'PROJ_A14', date_debut: '...', raison_debut: 'Coordination Afrique de l\'Ouest' },
      { code_projet: 'PROJ_A19', date_debut: '...', raison_debut: 'Extension portfolio' }
    ]
  },
  // ... etc
];

// Créer les comptes via supabase.auth.admin.createUser
// Insérer les profils dans profils_utilisateur
// Insérer les affectations dans affectation_projet_courante + historique
```

### 7.4 Livrables Sprint 5

- ✅ Script `scripts/seed-utilisateurs-demo.mjs`
- ✅ 4 nouveaux comptes créés et opérationnels
- ✅ Affectations avec historique
- ✅ Commit + push

---

## 8. Procédure et arbitrages

### 8.1 Ordre d'exécution recommandé

```
1. Sprint 1 — Charte (2-3h)        ← Impact visuel immédiat
2. Sprint 2 — Données (4-5h)        ← Alimente le reste
3. Sprint 5 — Utilisateurs (1-2h)   ← Petit, à faire vite
4. Sprint 3 — Vitrine (5-6h)        ← Le gros morceau
5. Sprint 4 — Questionnaires (2-3h) ← Optionnel, peut attendre
```

**Estimation totale** : 14-18 heures.

### 8.2 Découpage en livraisons atomiques

**Tag par Sprint** :
- `v1.1.0-charte-oif-officielle` après Sprint 1
- `v1.2.0-donnees-reelles-importees` après Sprint 2
- `v1.3.0-utilisateurs-demo` après Sprint 5
- `v1.4.0-vitrine-publique` après Sprint 3
- `v1.5.0-questionnaires-officiels` après Sprint 4

**Releases GitHub** pour chaque tag.

### 8.3 Validation utilisateur

À la fin de chaque sprint, **STOP** et rapport au format `docs/collaboration-ia.md`.

Carlos validera visuellement avant de débloquer le sprint suivant.

### 8.4 Gestion des erreurs

Si erreur sur un sprint :
- **Erreur mineure** : hotfix immédiat, continuer
- **Erreur majeure** : STOP, documenter, demander arbitrage

Si rate-limit API :
- Pause de 2-5 min
- Reprise automatique

Si question stratégique :
- STOP, documenter dans le rapport
- Carlos arbitre

### 8.5 Tests obligatoires

Avant chaque commit :
- ✅ `tsc --noEmit` (TypeScript propre)
- ✅ `vitest run` (tests verts)
- ✅ `next lint` (lint propre)
- ✅ `next build` (build OK)
- ✅ Test visuel local (dev server)

### 8.6 Documentation à produire

Pour chaque sprint :
- `docs/etapes/sprint-N-cadrage.md` : cadrage initial
- `docs/etapes/sprint-N-realisation.md` : ce qui a été livré
- Schémas et diagrammes si pertinents

---

## 9. Annexes techniques

### 9.1 Variables d'environnement supplémentaires

À ajouter à `.env.local` :

```
# Aucune nouvelle variable requise pour ce sprint
# Les imports utilisent les variables Supabase existantes
```

### 9.2 Dépendances NPM à ajouter

```json
{
  "csv-parse": "^5.5.0"  // Pour parser les CSV d'import
}
```

### 9.3 Fichiers de référence à ajouter au projet

```
public/assets/logo/
├── oif-logo-couleur.png
├── oif-logo-blanc.svg
└── oif-logo-noir.svg

docs/charte/
├── OIF_mini_charte.pdf
├── Code_couleur_programmation_OIF.pdf
└── Cadre_de_mesure_du_rendement_emploi_V2.docx

scripts/import-base-reelle/
├── extract-from-xlsm.mjs
├── import-projets-referentiel.mjs
├── import-beneficiaires.mjs
├── import-structures.mjs
└── verify-import.mjs

scripts/seed-utilisateurs-demo.mjs

docs/migration/
└── migration-base-reelle.md
```

### 9.4 Mapping des PS aux projets

À déterminer précisément à partir du référentiel OIF :

```typescript
// lib/projets/mapping-ps.ts
export const PS_PAR_PROJET: Record<string, 'PS1' | 'PS2' | 'PS3'> = {
  'PROJ_A01a': 'PS1',  // Langue française internationale
  'PROJ_A01b': 'PS1',  // Observatoire LF
  'PROJ_A01c': 'PS1',  // Création culturelle
  'PROJ_A02': 'PS1',   // LF langue d'enseignement
  'PROJ_A03': 'PS1',   // IFADEM
  'PROJ_A04': 'PS1',   // ELAN
  'PROJ_A05': 'PS1',   // CLAC
  'PROJ_A06': 'PS1',   // Industries culturelles
  'PROJ_A07': 'PS1',   // Jeux Francophonie
  // ... à compléter selon référentiel pour A08 à A20
};
```

### 9.5 Tests de cohérence post-import

```sql
-- Vérification des compteurs après import
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE sexe = 'feminin') as femmes,
  COUNT(*) FILTER (WHERE sexe = 'masculin') as hommes,
  COUNT(DISTINCT pays) as pays_distincts,
  COUNT(DISTINCT code_projet) as projets_distincts
FROM beneficiaires
WHERE import_source = 'BASE_OIF_230426_V2';

-- Devrait retourner : 5618, 5025, 487, 51, 6
```

### 9.6 Accessibilité

Page d'accueil publique : niveau **WCAG 2.1 AA** :
- Contraste de couleur ≥ 4.5:1
- Navigation au clavier
- Attributs ARIA appropriés
- Images avec `alt`
- Hiérarchie sémantique des titres

---

## 🎯 Prochaines étapes après ce sprint global

1. **Tests visuels exhaustifs** par Carlos (parcours utilisateur intégral)
2. **Rapport de pilote** auprès des 60 partenaires (juin 2026)
3. **Sprint V1.5 post-pilote** :
   - Cartographie interactive
   - Module rappel/relance enquêtes
   - Amélioration A4/F1 réels
   - Templates email multi-langues

---

## 📞 Contact

Pour toute question stratégique pendant le sprint :
- **Chef de projet** : Carlos HOUNSINOU
- **Email** : carlos.hounsinou@francophonie.org
- **Service** : Service de Conception et Suivi (SCS) — OIF

---

**Bon sprint, Claude Code. Tu as toutes les ressources nécessaires.** 🚀
