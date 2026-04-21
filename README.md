# Plateforme OIF — Suivi Emploi Jeunes

Plateforme de gestion et de suivi des données pour le **Service de Conception et Suivi de projet (SCS)** de l'**Organisation Internationale de la Francophonie (OIF)**, sur la thématique du renforcement de l'emploi des jeunes.

Remplace le dispositif historique reposant sur des échanges de fichiers Excel entre le SCS, les unités chefs de file et les partenaires de mise en œuvre (≈ 60 pays de la Francophonie).

## Échéance

Première version opérationnelle : **15 juin 2026**.

## Stack

Next.js 14 (App Router, TS strict) · Supabase (PostgreSQL + Auth magic-link) · Tailwind + shadcn/ui · Zod · React Query · Recharts · React Leaflet · ExcelJS · Playwright.

Voir [`docs/architecture.md`](docs/architecture.md) pour le détail et [`docs/references/synthese.md`](docs/references/synthese.md) pour la synthèse des documents de cadrage.

## Prérequis

- Node.js **≥ 20**
- npm **≥ 10**
- Un compte Supabase (hébergement Europe recommandé)

## Installation locale

```bash
# 1. Cloner et installer
npm install

# 2. Configurer l'environnement
cp .env.example .env.local
# Renseigner NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 3. Lancer la base Supabase locale (optionnel en dev)
npx supabase start

# 4. Appliquer les migrations et seed
npx supabase db reset

# 5. Générer les types TypeScript depuis le schéma
npm run types:supabase

# 6. Démarrer l'application
npm run dev
# → http://localhost:3000
```

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Démarrage production |
| `npm run lint` | Vérification ESLint |
| `npm run format` | Formatage Prettier |
| `npm run typecheck` | Vérification TypeScript (strict) |
| `npm run test` | Tests unitaires Vitest |
| `npm run test:e2e` | Tests Playwright |
| `npm run seed:demo` | Charge 50 bénéficiaires et 10 structures fictives (noms « DEMO ») |

## Documents de référence

- Cadre de mesure du rendement Emploi V2 (18 indicateurs)
- Note méthodologique V2 (logique A1/B1-pivot)
- Template Excel V1 (format de dépôt standardisé)
- Nomenclature officielle des projets OIF (codification `PROJ_A*`)

Tous disponibles dans [`docs/references/`](docs/references/).

## Licence

Propriété Organisation Internationale de la Francophonie.
