# Étape 6.5 — Refonte authentification + Liens publics d'enquête (cadrage)

> Cadrage produit en autonomie élargie suite à l'arbitrage stratégique
> du 25/04/2026 (cf. [`docs/decisions-strategiques/v1-vs-v1-5.md`](../decisions-strategiques/v1-vs-v1-5.md)).
>
> Version : 1.0 — 26 avril 2026

## 1. Contexte et motivation

L'Étape 6 a livré la saisie d'enquêtes en **Mode 1** (saisie interne
par utilisateur authentifié). Mais le retour N+1 (André, 24/04/2026)
demande un « recensement volontaire envoyé à tous les contacts
disposant d'une adresse » → ajout du **Mode 2** (lien public email).
La réalité opérationnelle OIF impose en plus un **Mode 3 hybride** :

| Acteur | Accès | Mode de saisie |
|--------|-------|----------------|
| `admin_scs` (SCS, super-admin) | Login + mdp ou magic link | Saisie + supervision globale |
| `chef_projet` (Coordonnateurs OIF) | Login + mdp obligatoire (V1.5 : 2FA opt) | Saisie + supervision projet |
| `contributeur_partenaire` (Structures) | Login + mdp obligatoire | Saisie pour leurs bénéficiaires |
| Bénéficiaires finaux | Lien email (token UUID, 30 j) | Auto-saisie sans compte |

**Conséquence directe** : le magic link seul (Étape 3) n'est plus
viable. Les coordonnateurs et structures se connectent plusieurs
fois par semaine — exiger un lien email à chaque session est perçu
comme une charge insoutenable. Migration vers **login + mot de
passe** obligatoire pour ces deux rôles.

## 2. État de l'art à date

### Auth en place (Étape 3)

- Page [`app/(public)/connexion/page.tsx`](../../app/(public)/connexion/page.tsx)
  utilise `signInWithOtp` (magic link Supabase) pour tous les rôles.
- Pas de gestion mot de passe (Supabase Auth supporte mais non utilisé).
- Pas d'auto-inscription (création de compte via console Supabase admin
  uniquement à ce stade).

### BDD enquêtes (Étape 6)

- Table `reponses_enquetes` a déjà la colonne `lien_public_token TEXT`
  prête (ajoutée en migration 001) — non utilisée en Étape 6.
- RLS policy `reponses_insert` actuelle requiert `is_admin_scs() OR
  current_role_metier() IN ('editeur_projet', 'contributeur_partenaire')`
  — à ÉTENDRE pour autoriser un INSERT via token public (sans auth).

### Configuration email

- Pas de Resend configuré en V1 — Supabase SMTP par défaut (~2 mails/h,
  insuffisant). Cf. [`docs/backlog.md`](../backlog.md) § Infrastructure
  email — jalon 1.

## 3. Périmètre Étape 6.5 (5 sous-étapes)

### Sous-étape 6.5a — Refonte authentification login / mot de passe

**Objectif** : faire cohabiter login+mdp (par défaut) avec magic link
(option SCS) sans casser les sessions actives.

**Livrables** :

- Page [`/connexion`](../../app/(public)/connexion/page.tsx) refactorée :
  champ Email + champ Mot de passe + bouton « Se connecter ».
  Lien discret « Connexion par lien magique (admin SCS) » →
  `/connexion?mode=magic-link` qui restaure le formulaire actuel.
- Page `/motpasse-oublie` + Server Action `demanderResetMotPasse` :
  envoie un email Supabase de reset (utilisera Resend en 6.5d).
- Page `/motpasse/changer` (premier login OU après reset) : champ
  ancien mdp + nouveau + confirmation. Force le changement si
  `user.user_metadata.mdp_temporaire === true` (drapeau posé à la
  création du compte en 6.5b).
- Politique mdp basique côté Zod : 8 caractères minimum, au moins
  1 majuscule + 1 chiffre. Validation côté serveur via `superRefine`.
- Migration des comptes existants : aucun comportement actif (les
  comptes magic-link continuent de fonctionner ; le mdp est posé
  par chacun lors du prochain reset).

**Estimation** : ~3 h. **Risque** : régression de la connexion en
production si on ne soigne pas le fallback magic-link. Mitigation :
test E2E manuel avant push.

### Sous-étape 6.5b — Création de comptes par admin SCS

**Objectif** : permettre à `admin_scs` de créer des coordonnateurs et
des contributeurs partenaires depuis l'UI (sans passer par la console
Supabase).

**Livrables** :

- Page `/admin/utilisateurs` (admin_scs uniquement, garde RLS) :
  - Liste des utilisateurs existants (email, prénom, nom, rôle,
    organisation/projet, statut, dernière connexion).
  - Bouton « Créer un compte » → dialogue avec formulaire Zod.
- Formulaire création :
  - Email (validation + détection doublon).
  - Prénom, nom.
  - Rôle (Select : `chef_projet` ou `contributeur_partenaire`).
  - Si `chef_projet` → Select projet(s).
  - Si `contributeur_partenaire` → Select organisation/structure.
- Server Action `creerCompteUtilisateur` :
  - Vérifie role appelant = `admin_scs`.
  - Appelle `supabase.auth.admin.createUser` avec mdp temporaire
    aléatoire + `user_metadata.mdp_temporaire = true`.
  - INSERT dans `public.utilisateurs` avec rôle + rattachement.
  - Génère un token d'activation (réutilise le flow Supabase
    `generateLink` type `recovery`).
  - Envoie email d'activation via Resend (template 6.5d).
- Possibilité de désactiver / réinitialiser un compte existant.

**Estimation** : ~3 h. **Risque** : la table `public.utilisateurs`
existe déjà depuis Étape 2 mais n'a peut-être pas tous les champs
nécessaires (à vérifier au démarrage 6.5b). Mitigation : ajouter
une mini-migration si besoin.

### Sous-étape 6.5c — Liens publics d'enquête

**Objectif** : permettre à un bénéficiaire de répondre à un
questionnaire SANS authentification, via une URL contenant un token
unique.

**Livrables** :

- Migration 008 : ajout colonne `token TEXT UNIQUE NOT NULL` sur
  une nouvelle table `tokens_enquete_publique` (ou réutilisation de
  `reponses_enquetes.lien_public_token` selon analyse au démarrage).
  Champs : `token`, `cible_type`, `cible_id`, `questionnaire`,
  `vague_enquete`, `expire_at`, `consommé_at`, `created_at`,
  `created_by`. Index UNIQUE sur token.
- Génération token : `crypto.randomUUID()` côté serveur (32 chars
  hexadécimaux après suppression des tirets — suffisant en entropie).
- Route publique `app/(public)/enquetes/public/[token]/page.tsx`
  (Server Component) :
  - Valide le token (existence, non expiré, non consommé).
  - Charge la cible via `service_role` (pas de RLS — accès public).
  - Affiche le formulaire de saisie (réutilise `EnqueteSaisie`
    avec mode `public`).
- Server Action publique `soumettreEnquetePublique(token, payload)` :
  - Garde-fou : revalide token, marque comme consommé en transaction
    avec l'INSERT des réponses (UPDATE consommé_at = NOW()).
  - Bypass RLS en passant par `createSupabaseAdminClient` (ou via une
    fonction SQL `SECURITY DEFINER` qui vérifie le token elle-même
    — préférable pour éviter d'exposer le service_role côté Action).
- Sécurité :
  - Token UUID (32 chars hex) — collision improbable.
  - Expiration 30 jours configurable.
  - 1 seule réponse possible (token consommé après soumission).
  - **Rate-limit** 5 requêtes/min par IP via middleware Next.js.
  - Pas de fuite d'existence de token : 404 indistinguable d'un
    token expiré (timing constant via `await sleep(50)` minimum).

**Estimation** : ~3-4 h. **Risque** : le bypass RLS pour la route
publique est sensible. Mitigation : préférer une fonction SQL
`SECURITY DEFINER` qui valide le token et écrit en transaction —
audit trail propre + pas de service_role exposé côté serveur Next.

### Sous-étape 6.5d — Configuration Resend et templates email

**Objectif** : envoi fiable d'emails (mots de passe + invitations
enquête) en remplacement de Supabase SMTP par défaut.

**Livrables** :

- Compte Resend Free (3000/mois) — configuration manuelle Carlos
  (DNS SPF/DKIM/DMARC sur `carloshounsinou.com`).
- API key dans `.env.local` (et Vercel/Supabase env si déploiement) :
  `RESEND_API_KEY`.
- Module `lib/email/resend.ts` : helper `envoyerEmail({to, subject,
  html, replyTo?})` avec gestion d'erreur typée.
- Templates email (HTML + texte brut, branding OIF léger) dans
  `lib/email/templates/` :
  - `invitation-enquete.tsx` (lien public + contexte projet)
  - `bienvenue-compte.tsx` (lien activation mdp)
  - `reset-mot-passe.tsx`
- Configuration Supabase Auth : connecter le SMTP Resend pour les
  emails Auth natifs (reset, confirmation) — section Project Settings.
- Tests : composer les templates + vérifier qu'ils ne plantent pas
  via une route admin de prévisualisation `/admin/email/preview`
  (admin_scs uniquement).

**Estimation** : ~2 h. **Risque** : configuration DNS hors plateforme
(Carlos doit avoir accès au registrar de `carloshounsinou.com`).
Mitigation : checklist détaillée dans le rapport de sous-étape.

### Sous-étape 6.5e — Envoi de masse au lancement enquête

**Objectif** : automatiser l'envoi d'invitations email aux cibles
quand un coordonnateur ou un SCS lance une vague d'enquête.

**Livrables** :

- Refacto Server Action `lancerVagueEnquete(filtres)` (nouvelle —
  complète `soumettreEnquete` qui reste pour la saisie individuelle) :
  - Sélectionne les bénéficiaires/structures correspondant au filtre
    (projet, vague, RLS appliquée).
  - Pour chaque cible :
    - Si email présent : génère token, INSERT dans
      `tokens_enquete_publique`, ajoute à la file Resend.
    - Sinon : ajoute à la liste « relance manuelle ».
  - Envoi en chunks de 100 emails / seconde (limite Resend Free).
  - Retour : `{envoyes: N, sansEmail: M, echecs: K}`.
- Toast SCS post-lancement : « 47 invitations envoyées · 13 sans
  email à relancer manuellement ».
- Vue `/admin/enquetes/lancements` (admin_scs) : historique des vagues
  lancées avec compteurs.

**Estimation** : ~2 h. **Risque** : volumétrie pilote = 60
partenaires × ~50 bénéficiaires = 3 000 emails par vague trimestrielle
= compatible avec le free tier (3 000/mois). Mitigation : alertes si
proche du quota (rapport SCS).

## 4. Estimation totale et planning

- **Total dev** : ~13-14 h (vs 10-12 h estimé initialement —
  l'analyse fine ajoute du temps sur la migration auth et la sécurité
  du token public).
- **Étalement** : faisable sur les heures restantes du 26/04
  + journée du 27/04 si besoin.
- **Dépendance externe critique** : configuration DNS de
  `carloshounsinou.com` (Carlos, ~30 min). Sans cela, 6.5d ne peut
  pas être validée fonctionnellement (les emails ne partiront pas).

## 5. Risques techniques identifiés

### R1 — Régression de l'auth en production

Refonte de la page connexion + cohabitation mdp / magic link =
risque de casser les sessions actives.

**Mitigation** : conserver intégralement le formulaire magic-link
existant comme variante `?mode=magic-link`. Test E2E manuel des deux
modes avant push de 6.5a.

### R2 — Bypass RLS sur la route publique d'enquête

L'INSERT publique doit contourner la RLS (qui exige
`authenticated`). Risque : si on utilise `service_role` côté Server
Action, fuite potentielle si la clé est mal protégée.

**Mitigation** : préférer une fonction SQL `SECURITY DEFINER`
`soumettre_enquete_via_token(token, payload)` qui valide le token
et écrit en transaction. La fonction est appelée via `supabase.rpc`
côté serveur Next, pas besoin de service_role.

### R3 — Rate-limit absent en production

Les routes publiques sans authentification sont des cibles évidentes
pour scraping ou DoS.

**Mitigation V1** : middleware Next.js (`app/middleware.ts`) avec
limite par IP (5 req/min sur `/enquetes/public/*`). En V1.5 : Cloudflare
ou Upstash si trafic le justifie.

### R4 — Configuration DNS hors notre contrôle

`carloshounsinou.com` est le domaine personnel de Carlos. Si ses DNS
ne sont pas correctement configurés (SPF/DKIM/DMARC), les emails
arrivent en spam → pilote planté.

**Mitigation** : Carlos teste la délivrabilité vers Gmail / Outlook /
Yahoo / Apple Mail avant onboarding des 60 partenaires. Checklist
dans le rapport de 6.5d.

### R5 — Migration de la table `utilisateurs`

La table `public.utilisateurs` existe depuis Étape 2 mais peut ne pas
avoir tous les champs nécessaires (ex. `nom`, `prenom`, `mdp_temporaire`).

**Mitigation** : inspecter au démarrage de 6.5b et ajouter une
mini-migration si besoin.

## 6. Patterns Étapes 4-6 réutilisés

- Architecture multi-sous-étapes avec commits atomiques + tests verts
- Server Actions avec discriminated union
- Composants HTML purs (pas de Base-UI) sur les formulaires
- Toast Sonner pour les feedbacks
- Smoke tests sur toute nouvelle migration SQL (cf. hotfix 6h)
- RLS Supabase systématique + helpers `can_read_*`

## 7. Pattern autonomie élevée

Conformément à [`docs/collaboration-ia.md`](../collaboration-ia.md) :

- Décisions techniques tranchées sans demander (noms fichiers, structure
  tests, helpers, optims SQL, format des templates email).
- Pattern de rapport groupé toutes les 2-3 sous-étapes (ou en fin de
  série si tout va vite).
- Seules remontées pour : règles métier nouvelles, choix de sécurité
  majeur, ou risque sur configuration externe (DNS).
- Push après chaque commit. Build + tests verts AVANT chaque commit.

## 8. STOP & VALIDATE (questions stratégiques pré-démarrage)

À ma lecture le périmètre est clair et la décomposition fait sens. Pas
de question bloquante. **Je peux démarrer 6.5a immédiatement après le
commit de ce cadrage**.

Une seule micro-clarification que je trancherai en autonomie sauf
contre-instruction :

- **Politique mdp V1** : 8 chars + 1 majuscule + 1 chiffre. Pas de
  caractère spécial obligatoire (ergonomie partenaires terrain) ni de
  rotation. Tout cela arrive en V1.5 (cf. décisions stratégiques).

## Changelog

| Version | Date       | Changement |
| ------- | ---------- | ---------- |
| 1.0     | 2026-04-26 | Cadrage initial post-arbitrage stratégique V1/V1.5 |
