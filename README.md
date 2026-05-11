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

## Architecture des rôles

La plateforme distingue **5 rôles utilisateur** (enum `role_utilisateur` en BDD), du plus large périmètre au plus restreint :

| Rôle | Périmètre | Description |
|------|-----------|-------------|
| `super_admin` | Global + administration plateforme | Carlos uniquement. Tracking étendu, suspension / archivage de comptes, activation des modules optionnels (IA), gestion des partenaires institutionnels. Supérieur à `admin_scs`. |
| `admin_scs` | Global (lecture / écriture toutes données) | Équipe SCS Paris. Vue agrégée sur tous les projets, tous les pays. Validation des demandes d'accès. Mode « view-as » pour déboguer une vue partenaire. |
| `editeur_projet` | Projet(s) d'affectation | Coordonnateurs projet (chefs de file). Lecture / écriture sur les données des projets auxquels ils sont affectés via la table `affectation_projet_courante` (associe `user_id` ↔ `projet_code`). |
| `contributeur_partenaire` | Projet(s) d'affectation | Partenaires de mise en œuvre sur le terrain. Saisie de bénéficiaires, structures, enquêtes pour les projets auxquels ils sont affectés. |
| `lecteur` | Lecture seule, projets d'affectation | Bailleurs et représentants d'États. Aucune écriture, pas d'accès aux exports administratifs. |

Les affectations utilisateur ↔ projet sont **historisées** dans deux tables (`affectation_projet_courante` pour l'état actif, `affectation_projet_historique` pour l'audit). L'isolation des données est appliquée par les **politiques RLS** Supabase, pas seulement au niveau applicatif.

Voir [`docs/architecture.md`](docs/architecture.md) pour la matrice complète des permissions et le détail du mode « view-as ».

## Flow d'authentification magic-link

L'authentification repose entièrement sur **Supabase Auth** en mode **magic-link** (aucun mot de passe stocké côté plateforme). Le flux complet :

1. **Demande d'accès** : un partenaire saisit son email + projet sur `/demande-acces` (page publique, rate-limitée 5 req/h/IP). La demande atterrit dans la table `demandes_acces`.
2. **Validation par admin_scs** : depuis `/admin/demandes-acces`, un admin valide ou rejette. À la validation, un utilisateur est créé avec le rôle et les affectations adéquates, et un email magic-link est envoyé via **Resend**.
3. **Email magic-link** : le lien pointe vers `/api/auth/callback?token_hash=xxx&type=invite` (et non vers `/auth/v1/verify` de Supabase). Cela évite la perte de hash fragment au passage serveur.
4. **Callback** ([app/api/auth/callback/route.ts](app/api/auth/callback/route.ts)) :
   - **HEAD** → 200 immédiat pour les scanners anti-phishing (Microsoft SafeLinks, ATP, Gmail) qui pré-cliquent les liens et grilleraient sinon le token à usage unique.
   - **GET** → `verifyOtp({ token_hash, type })` (ou `exchangeCodeForSession` en PKCE), puis `bootstrapUtilisateurIfNeeded` pour créer la ligne `utilisateurs` si elle n'existe pas encore.
   - Redirection selon `statut_validation` : `valide` → `/dashboard`, `en_attente` → `/en-attente-de-validation`, `rejete` → logout + `/connexion?message=compte_refuse`.
   - **Idempotence** : si la vérification échoue mais qu'une session existe déjà pour ce navigateur (double-clic, navigation arrière), le flux est poursuivi normalement.
5. **Sessions** : cookie HTTP-only Supabase, refresh automatique via le middleware (`middleware.ts` → `updateSupabaseSession`).
6. **Re-connexions ultérieures** : `/connexion` → email → magic-link → callback (mêmes étapes 3-4).

Les routes protégées (`/dashboard`, `/admin`, `/super-admin`, `/beneficiaires`, `/structures`, `/enquetes`, `/imports`, `/assistant-ia`) sont gardées par `middleware.ts`. Les routes publiques (`/`, `/connexion`, `/demande-acces`, `/contact`, `/realisations`, `/referentiels`, `/enquetes/public/*`) sont accessibles sans session.

## Déploiement production (Vercel + Supabase)

### Pré-requis OIF

- **Projet Supabase** hébergé en Europe (RGPD), plan Pro recommandé pour V1 (RLS systématique, sauvegardes quotidiennes).
- **Compte Resend** avec domaine email vérifié (V1 : `suivi-projet.org` transitoire — à migrer vers domaine OIF officiel quand la DSI met à disposition).
- **Projet Vercel** lié au repo GitHub, branche `main` en production.
- **Domaine production** pointé vers Vercel (CNAME).

### Variables d'environnement (production)

À renseigner dans le panneau Vercel (Settings → Environment Variables) :

```bash
# Supabase (projet prod)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # secret, jamais exposé côté navigateur

# Application
NEXT_PUBLIC_APP_URL=https://emploijeune.francophonie.org  # ou domaine retenu
APP_MAIL_FROM=scs@oif.example.org

# Resend
RESEND_API_KEY=re_xxxxxxx
RESEND_DOMAIN=suivi-projet.org
RESEND_FROM_EMAIL=noreply@suivi-projet.org
RESEND_FROM_NAME=Plateforme OIF Emploi Jeunes

# Anthropic (chatbot SCS + module IA)
ANTHROPIC_API_KEY=sk-ant-xxx

# Sécurité
APP_LINK_SIGNING_SECRET=<openssl rand -hex 32>

# Observabilité (facultatif V1)
SENTRY_DSN=https://...
```

Voir [`.env.example`](.env.example) pour la liste complète et commentée.

### Procédure de déploiement initial

1. **Provisionner Supabase prod** : créer le projet, noter l'URL et les clés.
2. **Appliquer les migrations** :
   ```bash
   npx supabase link --project-ref <ref-prod>
   npx supabase db push
   ```
3. **Générer les types TypeScript** depuis le schéma prod et committer :
   ```bash
   SUPABASE_PROJECT_ID=<ref-prod> npm run types:supabase
   ```
4. **Configurer Supabase Auth** (dashboard) :
   - Redirect URLs autorisées : `https://<domaine-prod>/api/auth/callback`
   - Email templates personnalisés (français, branding OIF) — cf. [`docs/email-templates.md`](docs/email-templates.md)
   - Désactiver le sign-up public (`Disable new user signups`) — toutes les créations passent par le flow `demande-acces` validé manuellement.
5. **Configurer Resend** : domaine vérifié (DNS SPF + DKIM + DMARC), template d'envoi par défaut, API key.
6. **Déployer sur Vercel** : push sur `main` ou `vercel --prod`. Le workflow `.github/workflows/ci.yml` valide typecheck + lint + tests + build avant merge.
7. **Bootstrapper le super_admin** : se connecter avec l'email Carlos, puis appliquer manuellement la promotion :
   ```sql
   UPDATE utilisateurs SET role = 'super_admin' WHERE email = '<carlos>';
   ```
8. **Smoke test post-déploiement** : connexion magic-link, création d'une demande d'accès, validation, import Excel test, génération d'un rapport KPI.

### CI/CD

Le pipeline GitHub Actions (`.github/workflows/ci.yml`) tourne sur chaque push et PR vers `main`. Il valide :

- `npm run typecheck` (TypeScript strict)
- `npm run lint` (ESLint)
- `npm test` (Vitest — 479 tests unitaires)
- `npm run build` (build Next.js complet)

Le déploiement Vercel est déclenché automatiquement sur push `main` une fois la CI verte.

## Documents de référence

- Cadre de mesure du rendement Emploi V2 (18 indicateurs)
- Note méthodologique V2 (logique A1/B1-pivot)
- Template Excel V1 (format de dépôt standardisé)
- Nomenclature officielle des projets OIF (codification `PROJ_A*`) — [`docs/references/00_NOMENCLATURE_PROJETS_OIF.md`](docs/references/00_NOMENCLATURE_PROJETS_OIF.md) (**source de vérité normative**)

Tous disponibles dans [`docs/references/`](docs/references/).

## Licence

Propriété exclusive de l'Organisation Internationale de la Francophonie. Voir [`LICENSE`](LICENSE) pour les conditions d'usage.
