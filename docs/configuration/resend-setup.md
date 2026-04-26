# Configuration Resend — Plateforme OIF Emploi Jeunes

> Procédure de mise en place de l'envoi d'emails transactionnels
> (invitations enquête, lien d'activation de compte, reset mot de
> passe). À exécuter une fois en V1, à actualiser lors de la
> migration vers le domaine OIF officiel en V1.5/V2.
>
> Version : 1.0 — 26 avril 2026

## 1. Vue d'ensemble

- **Provider** : Resend (region `eu-west-1` Ireland, conforme RGPD).
- **Plan V1** : Free (3 000 emails/mois, 100/jour). Suffisant pour
  pilote 60 partenaires.
- **Domaine V1** : `suivi-projet.org` (commande OVH N°248858607
  validée 26/04/2026 à 02:14, anonymisé Whois).
- **Sender V1** : `noreply@suivi-projet.org` (nom affiché
  « Plateforme OIF Emploi Jeunes »).
- **Reply-to** : adresse SCS opérationnelle (à confirmer).
- **Migration V1.5/V2** : bascule vers domaine OIF officiel
  (`emploi-jeunes.francophonie.org` pressenti, à valider DSI).

## 2. Pré-requis

- Domaine `suivi-projet.org` actif (activation OVH ~5-10 min après
  commande).
- Accès à la console DNS OVH (registrar).
- Compte Resend (création gratuite sur [resend.com](https://resend.com)).
- Variables d'environnement vides côté Vercel/local (cf. `.env.example`).

## 3. Procédure pas à pas

### 3.1 Créer le compte Resend

1. Aller sur [resend.com/signup](https://resend.com/signup), créer un
   compte avec l'adresse SCS opérationnelle (pas l'adresse perso).
2. Confirmer l'adresse via email Resend.
3. Plan par défaut = Free → conserver.

### 3.2 Ajouter le domaine `suivi-projet.org`

1. Resend Dashboard → **Domains** → **Add Domain**.
2. Saisir `suivi-projet.org`. Région : `eu-west-1` (Ireland).
3. Resend affiche 3 ou 4 enregistrements DNS à créer :
   - **SPF** (TXT) : `v=spf1 include:_spf.resend.com ~all` (ou similaire)
   - **DKIM** (TXT × 2 ou CNAME) : valeurs spécifiques au compte
   - **MX** (optionnel, pour réception) : `feedback-smtp.eu-west-1.amazonses.com`
   - **DMARC** (TXT) : `v=DMARC1; p=quarantine; rua=mailto:dmarc@suivi-projet.org`
     (recommandé en V1 ; passer à `p=reject` en V1.5 quand réputation
     consolidée).

### 3.3 Configurer les DNS chez OVH

1. Espace client OVH → **Web Cloud** → **Noms de domaine** →
   `suivi-projet.org` → onglet **Zone DNS**.
2. **Ajouter une entrée** pour chaque enregistrement Resend :
   - Type : `TXT` ou `CNAME` selon Resend.
   - Sous-domaine : laisser vide pour la racine, ou `_dmarc`,
     `resend._domainkey`, etc. selon ce qu'indique Resend.
   - TTL : `3600` (par défaut).
   - Cible : valeur exacte fournie par Resend (attention aux
     guillemets autour des TXT).
3. Sauvegarder. La propagation DNS prend 5-30 min côté OVH (plus
   long si le résolveur DNS local cache).
4. Vérification : dans Resend Dashboard, cliquer **Verify DNS Records**
   sur chaque entrée. Statut doit passer de `Pending` à `Verified`
   (point vert).

### 3.4 Récupérer l'API key

1. Resend Dashboard → **API Keys** → **Create API Key**.
2. Nom : `oif-emploi-jeunes-prod` (ou `staging` si environnement
   distinct).
3. Permission : `Sending access` (suffisant ; pas besoin de
   `Full access`).
4. Domaine : restreindre à `suivi-projet.org` uniquement.
5. **Copier la clé immédiatement** (Resend ne la ré-affiche pas).

### 3.5 Renseigner les variables d'environnement

Dans `.env.local` (dev) puis Vercel/Supabase env (staging/prod) :

```bash
RESEND_API_KEY="re_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
RESEND_DOMAIN="suivi-projet.org"
RESEND_FROM_EMAIL="noreply@suivi-projet.org"
RESEND_FROM_NAME="Plateforme OIF Emploi Jeunes"
```

### 3.6 Connecter Resend à Supabase Auth (recommandé)

Pour que les emails Auth natifs (reset mot de passe, magic link)
sortent aussi via Resend (au lieu du SMTP par défaut limité à ~2/h) :

1. Supabase Dashboard → **Project Settings** → **Authentication** →
   **SMTP Settings**.
2. Activer **Custom SMTP**.
3. Renseigner :
   - Sender email : `noreply@suivi-projet.org`
   - Sender name : `Plateforme OIF Emploi Jeunes`
   - Host : `smtp.resend.com`
   - Port : `465` (TLS) ou `587` (STARTTLS)
   - Username : `resend`
   - Password : la même API key que `RESEND_API_KEY`
4. Sauvegarder. Tester via **Send test email** (bouton Supabase).

## 4. Tests de validation

### 4.1 Tests de délivrabilité (avant onboarding 60 partenaires)

Envoyer un email de test à chacun des 5 clients-cibles :

- [ ] Gmail web (`@gmail.com`)
- [ ] Gmail mobile (Android + iOS)
- [ ] Outlook web (`@outlook.com` / `@hotmail.com`)
- [ ] Apple Mail iPhone (`@icloud.com` ou `@me.com`)
- [ ] Yahoo Mail (`@yahoo.com` / `@yahoo.fr`)

Pour chacun : vérifier que l'email **arrive en boîte de réception**
(pas en spam ni en promotions). Si fail → revoir la config DMARC
ou l'adresse de réplyto.

### 4.2 Tests fonctionnels plateforme

Une fois les variables d'env renseignées :

- [ ] `/motpasse-oublie` → email de reset reçu en moins de 30 s
- [ ] `/admin/utilisateurs` création de compte → email
      d'invitation reçu avec lien d'activation valide 24 h
- [ ] Lancement vague enquête (Étape 6.5e) → 1 email de test sur
      compte SCS, vérifier rendu HTML + texte brut + lien public
      cliquable

### 4.3 Tests de bornes

- Taux d'envoi : Resend Free limite à 100 emails/jour. Au-delà,
  les requêtes retournent `429 Too Many Requests`. Surveiller le
  Resend Dashboard quotidiennement pendant le pilote.
- Bounces : suivre dans Resend Dashboard → **Logs**. Si > 5 % de
  bounces, alerter SCS pour nettoyer la base d'adresses.

## 5. Plan de migration vers domaine OIF officiel (V1.5/V2)

### Pré-requis

- DSI OIF a créé un sous-domaine pressenti
  `emploi-jeunes.francophonie.org` (ou variante validée).
- DSI OIF accepte de configurer les DNS MX/TXT pour Resend.

### Étapes

1. **Ajouter le nouveau domaine** dans Resend (Dashboard → Domains).
2. **Configurer les DNS** côté OIF (envoyer la liste des
   enregistrements à la DSI).
3. **Vérifier** dans Resend (Verify DNS Records).
4. **Créer une nouvelle API key** restreinte au nouveau domaine.
5. **Mettre à jour les variables d'env** sur Vercel/Supabase.
6. **Bascule progressive** :
   - J0 : production passe au nouveau domaine.
   - J0+7 : monitoring de la délivrabilité (les FAI méfient des
     domaines neufs sans réputation).
   - Si tout va bien, **conserver `suivi-projet.org`** comme domaine
     de repli pour les environnements de staging.
7. **Rollback** : si délivrabilité catastrophique, repasser sur
   `suivi-projet.org` pendant que la DSI ajuste les DNS.

## 6. Variables d'environnement — récapitulatif

| Variable | Valeur V1 | Source |
|----------|-----------|--------|
| `RESEND_API_KEY` | `re_XXXX...` | Resend Dashboard → API Keys |
| `RESEND_DOMAIN` | `suivi-projet.org` | Constant |
| `RESEND_FROM_EMAIL` | `noreply@suivi-projet.org` | Constant |
| `RESEND_FROM_NAME` | `Plateforme OIF Emploi Jeunes` | Constant |

## 7. Sécurité

- **Ne jamais commiter** la valeur de `RESEND_API_KEY`.
- En cas de fuite : révoquer immédiatement dans Resend Dashboard
  + créer une nouvelle clé + redéployer.
- Restreindre la clé au domaine `suivi-projet.org` uniquement (pas
  `Full access`).
- Activer les **webhooks Resend** en V1.5 pour suivre les bounces
  et les ouvertures (cf. ticket V1.5-E).

## 8. Suivi opérationnel

| Action | Fréquence | Responsable |
|--------|-----------|-------------|
| Vérifier délivrabilité (Logs Resend) | Hebdo | Carlos / SCS |
| Vérifier compteur emails restants (Free 3000/mois) | Hebdo | Carlos |
| Renouvellement domaine OVH `suivi-projet.org` | Annuel | Carlos |
| Migration domaine OIF | V1.5 (juillet-août 2026) | Carlos + DSI OIF |

## Changelog

| Version | Date | Changement |
|---------|------|------------|
| 1.0 | 2026-04-26 | Procédure initiale `suivi-projet.org` (post-bascule du `carloshounsinou.com` initial évoqué dans le cadrage 6.5 v1.0). |
