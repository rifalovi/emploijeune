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

## Authentification

### Mode d'authentification : magic link email

Aucun mot de passe. Les utilisateurs reçoivent un lien magique unique par email, consommé à l'usage.

- **Fournisseur** : Supabase Auth (`signInWithOtp` type `email`).
- **Rate limiting** :
  - **3 demandes par email par heure** (imposé via `max_frequency = "1s"` combiné à la détection doublons Supabase).
  - **10 demandes par adresse IP par heure** (configuré via `sign_in_sign_ups = 30` sur fenêtre 5 min dans `supabase/config.toml`).
- **Transport email** : par défaut Supabase SMTP interne (limite ~2 emails/h). Pour la V1 en production, prévoir un provider SMTP (SendGrid / Mailgun / OVH) via `[auth.email.smtp]`.

### Durée de session et magic link

| Paramètre | Valeur V1 | Palier prévu | Point de modification |
|-----------|-----------|--------------|----------------------|
| `otp_expiry` (durée de validité du lien) | **3600 s (1 h)** | 1800 s (30 min) ~ sept 2026 puis 900 s (15 min) en V2 | `supabase/config.toml` section `[auth.email]` |

Choix validé Étape 3 Q2 : équilibre sécurité / accessibilité pour les partenaires dans des pays à connectivité dégradée. Les magic links sont **à usage unique** côté Supabase — la durée ne gouverne que la fenêtre d'opportunité d'interception, pas la fenêtre de réutilisation.

**Impact utilisateur en cas de durcissement** : un lien expiré oblige à re-demander un magic link (email renvoyé dans les 30 s). Aucun impact sur la session déjà ouverte.

**Durée de session active** : par défaut Supabase Auth rafraîchit le JWT toutes les heures et la refresh token vit ~1 semaine. Ces valeurs sont acceptables pour V1 et non re-configurées ici.

### Bootstrap utilisateur au premier login

Décision Étape 3 Q1 : **Option A (création auto) + renforcements**. Voir migration 004.

1. Au premier passage dans `/api/auth/callback` après consommation du magic link, si l'email de l'utilisateur n'a pas encore de ligne dans `public.utilisateurs`, la route crée automatiquement une ligne avec :
   - `role = 'lecteur'` (par défaut, corrigé par l'admin_scs à la validation)
   - `organisation_id = NULL`
   - `statut_validation = 'en_attente'`
   - `nom_complet = split_part(email, '@', 1)`
2. Les helpers RLS (`current_role_metier`, `current_organisation_id`, `current_projets_geres`) **filtrent sur `statut_validation = 'valide'`**. Un compte en attente ne voit strictement rien, même avec un rôle posé.
3. L'utilisateur est redirigé vers `/en-attente-de-validation` tant que son statut reste `en_attente`.
4. Un trigger `AFTER INSERT ON utilisateurs` insère une ligne dans `notifications_admin` de type `nouveau_compte_a_valider`, comptée par `notifications_admin_non_lues_count()` et affichée comme badge dans la sidebar admin.
5. L'admin_scs valide via l'UI d'admin — passage `en_attente → valide` (ou `rejete`), attribution de l'organisation et du rôle définitif.

### KPI cards d'accueil

Quatre fonctions PostgreSQL SECURITY DEFINER retournant du JSONB (migration 005) :
- `get_kpis_dashboard_admin_scs()`
- `get_kpis_dashboard_editeur_projet()`
- `get_kpis_dashboard_contributeur_partenaire()`
- `get_kpis_dashboard_lecteur()`

Plus un router `get_kpis_dashboard()` qui appelle la bonne fonction selon le rôle courant. SLA < 500 ms sur 10 000 bénéficiaires, index existants uniquement.

## Prochaines étapes

- **Étape 2** : migration `001_initial_schema.sql`, seed nomenclatures officielles (23 projets `PROJ_A*`, 18 indicateurs, 61 pays, 16 domaines, 17 secteurs, 7 types structure, 7 natures d'appui, 15 devises). ✅ **Livrée** (commits `507ba6e`, `4f09705`).
- **Étape 3** : auth magic link + shell (layout sidebar admin_scs / layout simplifié partenaires). ⏳ En cours.
- **Étape 4** : CRUD bénéficiaires (fonctionnalité pivot).
