# Architecture — Plateforme OIF Emploi Jeunes

> Document vivant. À enrichir au fil des étapes.

## Stack technique (imposée)

| Couche | Choix |
|--------|-------|
| Framework | Next.js 14 (App Router) + TypeScript strict |
| UI | Tailwind CSS + shadcn/ui (style `base-nova`, neutral) |
| Base de données | Supabase (PostgreSQL, hébergement Europe) |
| Auth | Supabase Auth — magic link email |
| État client | Zustand (léger) + React Query (couche données) |
| Validation | Zod (formulaires + schémas d'API) |
| Graphiques | Recharts |
| Cartographie | React Leaflet + OpenStreetMap |
| Export | ExcelJS (Excel) + @react-pdf/renderer (PDF) |
| Dates | date-fns (locale `fr`) |
| Formulaires | react-hook-form + @hookform/resolvers/zod |
| Tests | Vitest (unitaires) + Playwright (e2e) |
| Déploiement | Vercel (front) + Supabase (DB) |

Règles `next/typescript` strictes : `noUncheckedIndexedAccess`, `noImplicitOverride`, `forceConsistentCasingInFileNames`, `noFallthroughCasesInSwitch`.

## Structure du repo

```
/app
  /(public)          # pages publiques (connexion, formulaires enquêtes)
  /(dashboard)       # pages protégées (middleware auth)
    /beneficiaires   # CRUD A1
    /structures      # CRUD B1
    /enquetes        # formulaires dynamiques A2..F1
    /imports         # dépôt et validation Excel V1
    /dashboard       # KPI + graphiques + cartographie
    /admin           # gestion utilisateurs, audit
  /api               # routes API (import, export, webhooks)
/components
  /ui                # shadcn/ui (généré)
  /forms             # composants formulaires métier
  /charts            # visualisations
  /layout            # header, sidebar, footer
/lib
  /supabase          # client (server, browser, admin) + types générés
  /validation        # schémas Zod (bénéficiaires, structures, enquêtes)
  /excel             # import/export V1
  /calculs           # formules des 18 indicateurs
/docs
  /references        # documents de cadrage OIF + synthese.md
/supabase
  /migrations        # fichiers SQL versionnés
  /seed.sql          # nomenclatures officielles
/scripts             # seed démo, utilitaires
/tests
  /e2e               # Playwright (parcours critiques)
  /unit              # Vitest (calculs, validation, import)
```

## Conventions de nommage

- Libellés UI, messages d'erreur, commentaires métier : **français**.
- Variables, fonctions, types TS : **anglais** (convention langage).
- `projet_code` (ex. `PROJ_A14`) vs `indicateur_code` (ex. `A1`) — **ne jamais confondre** (voir `/docs/references/synthese.md` § 4.2).

## Décisions architecturales (à compléter aux étapes suivantes)

- **A-001** : client Supabase direct (pas de Prisma / tRPC) — le SDK TypeScript fournit l'inférence de types à partir des migrations.
- **A-002** : RLS activé **obligatoirement** sur toutes les tables métier (policies en étape 2).
- **A-003** : import Excel tolérant aux anciens codes projet (`P14` → `PROJ_A14`) avec warning de traçabilité, jamais erreur bloquante.
- **A-004** : RGPD — pas de téléphone ni courriel sans `consentement_recueilli = true` (contrainte BDD + Zod).

## Prochaines étapes

- **Étape 2** : migration `001_initial_schema.sql`, seed nomenclatures officielles (23 projets `PROJ_A*`, 18 indicateurs, 61 pays, 16 domaines, 17 secteurs, 7 types structure, 7 natures d'appui, 15 devises).
- **Étape 3** : auth magic link + shell (layout sidebar admin_scs / layout simplifié partenaires).
- **Étape 4** : CRUD bénéficiaires (fonctionnalité pivot).
