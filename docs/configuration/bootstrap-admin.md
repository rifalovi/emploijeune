# Bootstrap du premier admin SCS

> Procédure à exécuter UNE SEULE FOIS, au démarrage du projet, pour créer
> le premier compte `admin_scs` sans lequel personne ne peut accéder à la
> page `/admin/utilisateurs` qui sert à créer les autres comptes
> (problème classique de l'œuf et de la poule).
>
> Version : 1.0 — 26 avril 2026 (Hotfix 6.5h)

## Pourquoi ?

En V1, la création de comptes est restreinte à `admin_scs` via
[`/admin/utilisateurs`](../../app/(dashboard)/admin/utilisateurs/page.tsx)
(décision stratégique V1, cf.
[v1-vs-v1-5.md](../decisions-strategiques/v1-vs-v1-5.md)). Le mode
magic-link sur `/connexion?mode=magic-link` est configuré avec
`shouldCreateUser: false` — il n'autorise donc PAS la création
automatique d'un compte au premier login.

Conséquence : à l'installation du projet, aucun compte n'existe. Personne
ne peut se connecter pour créer le premier admin. **Ce script bootstrap
résout ce problème** en utilisant la clé `service_role` Supabase pour
créer le premier admin SCS depuis la ligne de commande.

## Pré-requis

### Variables d'environnement (`.env.local`)

Vérifier que ces deux variables sont renseignées :

```bash
NEXT_PUBLIC_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."  # Récupérable depuis Supabase Dashboard
                                     # → Project Settings → API → service_role
```

> ⚠️ **Sécurité** : `SUPABASE_SERVICE_ROLE_KEY` contourne la RLS. Ne
> jamais commiter cette valeur. Le fichier `.env.local` est gitignoré.

### Node.js 20+

Le script utilise `node --env-file=.env.local` qui requiert Node 20+
(disponible sans dépendance `dotenv`).

```bash
node --version  # doit afficher v20.x ou supérieur
```

### Migrations appliquées

La table `public.utilisateurs` doit exister :

```bash
npx supabase db push  # applique toutes les migrations
```

## Procédure

### 1. Exécuter le script

Depuis la racine du projet :

```bash
node --env-file=.env.local scripts/bootstrap-admin-scs.mjs \
  carlos.hounsinou@francophonie.org Carlos HOUNSINOU
```

Arguments : `<email> <prenom> <nom>` (le nom peut contenir des espaces).

### 2. Sortie attendue

```
🚀 Bootstrap admin SCS pour carlos.hounsinou@francophonie.org

📧 Création de l'utilisateur Auth...
✓ Auth user créé : 11111111-1111-4111-8111-111111111111
💾 Insertion dans public.utilisateurs...
✓ Profil utilisateur inséré (Carlos HOUNSINOU)
🔗 Génération du lien d'activation...

✅ Bootstrap réussi !

──────────────────────────────────────────────────────────────────────
Lien d'activation (valable 1 h, à coller dans le navigateur) :

https://xxxxx.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=...
──────────────────────────────────────────────────────────────────────

Étapes suivantes :
  1. Ouvrez le lien ci-dessus dans votre navigateur.
  2. Définissez votre mot de passe (≥8 chars, 1 maj, 1 chiffre).
  3. Connectez-vous sur http://localhost:3000/connexion avec votre email.
  4. Vous pourrez ensuite créer d'autres comptes via /admin/utilisateurs.
```

### 3. Activer le compte

- Copier-coller le lien dans le navigateur.
- Le redirect ramène sur `/motpasse/changer?premier_login=1`.
- Définir un mot de passe conforme à la politique V1 (8 chars min,
  1 majuscule, 1 chiffre).
- Le redirect ramène sur `/dashboard` — vous êtes connecté en
  `admin_scs`.

### 4. Tester la création d'autres comptes

Aller sur [`/admin/utilisateurs`](http://localhost:3000/admin/utilisateurs),
cliquer « Créer un compte », créer un coordonnateur de test
(par exemple destinataire `rifalovi@yahoo.fr`).

L'email d'activation doit arriver via Resend
(cf. [resend-setup.md](resend-setup.md)).

## Comportements de sécurité

- **Idempotent** : si un `admin_scs` existe déjà, le script refuse
  l'exécution avec un message d'erreur explicite. Pour repartir de
  zéro, supprimer la ligne via la console Supabase puis relancer.
- **Rollback** : si l'INSERT dans `public.utilisateurs` échoue, le
  compte Auth créé en amont est supprimé (best-effort) pour éviter
  les comptes orphelins.
- **Lien d'activation à usage unique** : valable 1 heure. Après
  consommation ou expiration, utiliser
  [`/motpasse-oublie`](http://localhost:3000/motpasse-oublie) pour
  obtenir un nouveau lien.

## Cas d'erreurs typiques

### « Variables manquantes »

`.env.local` ne contient pas `NEXT_PUBLIC_SUPABASE_URL` ou
`SUPABASE_SERVICE_ROLE_KEY`. Récupérer la `service_role` depuis Supabase
Dashboard → Project Settings → API → **service_role secret** (pas la
`anon` !).

### « Un admin SCS existe déjà »

Vérifier dans Supabase Console (`SELECT * FROM utilisateurs WHERE
role = 'admin_scs'`). Soit utiliser l'admin existant, soit le supprimer
manuellement avant relance.

### « Création Auth échouée : User already registered »

L'email existe déjà dans `auth.users` mais sans entrée dans
`public.utilisateurs`. Supprimer le compte via Supabase Dashboard →
Authentication → Users → ⋯ → Delete user, puis relancer.

## Migration vers V1.5/V2

Quand le SSO Office 365 OIF sera en place (V1.5), ce script restera
valide pour le bootstrap initial avant la bascule SSO. Aucune action
spécifique requise.

## Changelog

| Version | Date | Changement |
|---------|------|------------|
| 1.0 | 2026-04-26 | Création — Hotfix 6.5h post-erreur « signups not allowed for otp ». |
