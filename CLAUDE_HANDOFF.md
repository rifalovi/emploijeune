# Handoff — Plateforme OIF Emploi Jeunes

> Contexte pour reprendre le travail en session Claude Code.
> Projet Next.js 14 + Supabase + Vercel. Workspace : `/Users/CarlosH/Downloads/EMPLOIJEUNE`

---

## 🏗️ Architecture rapide

```
app/
  (auth)/           → login, mot de passe, callback
  (public)/collecte/public/[slug]/  → formulaire bénéficiaire public (sans auth)
  admin/            → back-office admin_scs
  dashboard/        → utilisateurs connectés
lib/
  supabase/         → server.ts, admin.ts, auth.ts
  utils/base-url.ts → getBaseUrl() — source de vérité pour les URLs
  email/            → envoyerEmail(), templates
  utilisateurs/mutations.ts     → creerCompteUtilisateur, toggleActif, reinitMdp
  demandes-acces/mutations.ts   → approuverDemandeAcces (CORRIGÉ)
  collecte-publique/actions.ts  → soumettreCollectePublique (server action)
```

**Rôles** : `super_admin` > `admin_scs` > `editeur_projet` > `contributeur_partenaire` > `lecteur`

---

## ✅ Ce qui a déjà été corrigé (commits poussés)

### 1. Emails avec `localhost` en production
**Problème** : `.env.local` avait `NEXT_PUBLIC_APP_URL="http://localhost:3000"`. La fonction `getBaseUrl()` dans `lib/utils/base-url.ts` checke dans l'ordre :
1. `NEXT_PUBLIC_SITE_URL`
2. `NEXT_PUBLIC_APP_URL`  ← bloquait avant d'atteindre `VERCEL_URL`
3. `VERCEL_URL`
4. `http://localhost:3000`

**Fix appliqué** : Renommé `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_SITE_URL` dans `.env.local`.

**⚠️ ACTION REQUISE SUR VERCEL** (pas encore confirmée) :
- Supprimer `NEXT_PUBLIC_APP_URL` des env vars Vercel dashboard
- S'assurer que `NEXT_PUBLIC_SITE_URL=https://emploijeune-oif-carlos-h-s-projects.vercel.app` est bien défini dans Vercel → Settings → Environment Variables
- Redéployer après ce changement pour que les env vars Vercel prennent effet

### 2. `approuverDemandeAcces` utilisait `action_link` (bug)
**Fichier** : `lib/demandes-acces/mutations.ts`

**Problème** : Supabase `generateLink()` retourne `action_link` (passe par `/auth/v1/verify` + hash fragment → jamais reçu côté serveur) ET `hashed_token` (utilisable directement dans notre callback).

**Fix appliqué** : Toutes les fonctions utilisent maintenant le pattern `hashed_token` :
```typescript
const lienActivation =
  `${origin}/api/auth/callback` +
  `?token_hash=${encodeURIComponent(hashedToken)}` +
  `&type=recovery` +
  `&redirect=${encodeURIComponent(redirectInterne)}`;
```
Fonctions concernées (toutes corrigées) :
- `creerCompteUtilisateur` (mutations.ts utilisateurs)
- `reinitialiserMotPasseUtilisateur` (mutations.ts utilisateurs)
- `approuverDemandeAcces` (mutations.ts demandes-acces)
- `lib/auth/envoyer-reset-mot-passe.ts`

### 3. Formulaire collecte publique
**Fichier** : `app/(public)/collecte/public/[slug]/collecte-form.tsx`

Corrections déjà dans le code local et déployées (commit `e4f1def`) :
- **Liste pays OIF** : 88 membres + "Autre" (était ~63, incomplet)
- **Validation Select** : utilise `Controller` de react-hook-form (pas `register()` — les shadcn/ui Select sont des composants contrôlés)
- **Champs contact** : actifs par défaut, checkbox = consentement RGPD
- **Deux boutons submit** : "Enregistrer et ajouter un autre" + "Enregistrer et terminer"

---

## 🔴 Problèmes en suspens

### P1 — Emails localhost toujours présents (priorité haute)

Les emails envoyés en production contiennent encore `http://localhost:3000` dans les liens.

**Diagnostic** : Malgré le fix dans `.env.local`, les env vars de Vercel en production ont probablement encore `NEXT_PUBLIC_APP_URL=http://localhost:3000` (ou équivalent). Les env vars Vercel **prennent le dessus** sur `.env.local` (qui n'est pas déployé).

**Vérification à faire** :
```bash
# Dans le dashboard Vercel → Settings → Environment Variables
# Chercher : NEXT_PUBLIC_APP_URL  → doit être ABSENT ou vide
# Chercher : NEXT_PUBLIC_SITE_URL → doit valoir https://emploijeune-oif-carlos-h-s-projects.vercel.app
```

Si la correction Vercel n'a pas encore été faite, aller sur :
https://vercel.com/carlos-h-s-projects/emploijeune-oif/settings/environment-variables

### P2 — Vérifier le formulaire après déploiement

Le déploiement `dpl_HQUMWpVLhGQBbsoDGNx8CmvUkfwD` est **READY** en production.
Tester sur : `https://emploijeune-oif-carlos-h-s-projects.vercel.app/collecte/public/dckcfrg0q7`

Checklist de vérification :
- [ ] Les pays s'affichent avec noms complets (ex: "Bénin" pas "BEN")
- [ ] La validation ne bloque pas les champs correctement remplis
- [ ] Les champs téléphone/email contact sont actifs dès le départ
- [ ] Les deux boutons sont visibles et fonctionnels

---

## 📋 Contexte Supabase

- **Projet** : `gflragycnsaeqppgnfna` (région Europe)
- **URL** : `https://gflragycnsaeqppgnfna.supabase.co`
- Les types TypeScript sont générables avec : `supabase gen types typescript --project-id gflragycnsaeqppgnfna`

### Tables principales
```
utilisateurs         → profils avec rôle, organisation_id, actif, statut_validation
organisations        → entités partenaires
projets              → projets de la plateforme
demandes_acces       → file d'approbation (statut: en_attente / valide / rejete)
collecte_publique    → formulaires bénéficiaires (lien public via slug)
beneficiaires        → données collectées
```

### Pattern auth Supabase (important)
```typescript
// ✅ Correct — utiliser hashed_token
const { data: linkData } = await adminClient.auth.admin.generateLink({
  type: 'recovery',
  email,
  options: { redirectTo: `${origin}/api/auth/callback?redirect=${encodeURIComponent(redirectInterne)}` }
});
const lienActivation = `${origin}/api/auth/callback?token_hash=${hashedToken}&type=recovery&redirect=...`;

// ❌ Ne JAMAIS utiliser action_link directement
// linkData.properties.action_link → passe par /auth/v1/verify → hash fragment → perdu
```

---

## 🚀 Commandes utiles

```bash
# Développement local
npm run dev

# Build production (vérifier les erreurs TypeScript)
npm run build

# Vérifier les types Supabase
npx supabase gen types typescript --project-id gflragycnsaeqppgnfna > lib/supabase/types.ts

# Push vers production
git add -A && git commit -m "fix: ..." && git push
```

---

## 📁 Fichiers les plus importants à connaître

| Fichier | Rôle |
|---------|------|
| `lib/utils/base-url.ts` | Source de vérité pour l'URL de l'app |
| `lib/supabase/auth.ts` | `getCurrentUtilisateur()` |
| `lib/supabase/server.ts` | Client Supabase SSR |
| `lib/supabase/admin.ts` | Client service_role |
| `app/api/auth/callback/route.ts` | Callback Supabase (gère token_hash) |
| `middleware.ts` | Protection des routes par rôle |
| `lib/schemas/utilisateur.ts` | Zod schemas + `rolesCreablesPar()` |

---

*Généré le 2026-05-13 — Session Cowork*
