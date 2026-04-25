# Stratégie V1 / V1.5 — Plateforme OIF Emploi Jeunes

## Date de la décision

25 avril 2026

## Contexte

Suite à analyse métier approfondie sur le mode de collecte des
enquêtes (saisie interne vs envoi email), arbitrage nécessaire
entre :

- V1 minimale et stable pour pilote 60 partenaires (juin 2026)
- V1.5 enrichie après retours terrain (juillet-août 2026)

## Décisions actées

### Authentification

**V1 (juin 2026)** :

- Login + mot de passe Supabase pour Coordonnateurs et
  Structures (OBLIGATOIRE — métier exige connexions répétées)
- Magic link conservé comme alternative pour `admin_scs`
  uniquement
- Premier mot de passe via lien d'activation envoyé par email
  (24 h validité, plus sécurisé que mot de passe en clair)
- Création de compte EXCLUSIVEMENT par `admin_scs` (pas
  d'auto-inscription)

**V1.5** :

- Politique de mot de passe avancée (rotation, complexité)
- 2FA optionnel pour `admin_scs`
- SSO via Office 365 OIF si DSI met en place

### Mode de collecte des enquêtes

**V1 (Mode 3 hybride basique)** :

- Saisie directe par utilisateur authentifié (déjà livrée
  Étape 6)
- Lien public d'enquête `/enquetes/public/[token]` accessible
  SANS authentification (pour bénéficiaires)
- Envoi automatique simple par email au lancement enquête
  (Resend + carloshounsinou.com en V1, domaine OIF en V1.5)
- Token : unique, 30 jours de validité, 1 seule réponse
  possible

**V1.5 (juillet-août 2026)** :

- Module rappel/relance complet (ticket V1.5-A)
- Espace Coordonnateur enrichi avec dashboard taux de
  réponse, listes non-répondants, outils de contact
  (ticket V1.5-B)
- Espace Structure enrichi avec saisie facilitée pour
  bénéficiaires (ticket V1.5-C)
- Templates email avancés multi-langues (ticket V1.5-D)
- Suivi historique des relances envoyées (ticket V1.5-E)

### Configuration email

**V1** :

- Resend (plan Free 3000/mois suffisant pour pilote 60
  partenaires)
- Domaine d'envoi : `carloshounsinou.com` (transitoire)
- Templates simples : invitation enquête, rappel, identifiants
  de connexion

**V1.5** :

- Migration vers domaine OIF officiel (avec DSI)
- Resend Plan Pro (50 000/mois) si volume justifie
- Templates richement formatés avec branding OIF

### Justification stratégique

L'approche progressive V1 → V1.5 permet :

1. Livrer la V1 utilisable pour le pilote 60 partenaires
   à temps (juin 2026)
2. Recueillir les retours terrain réels avant d'enrichir
3. Éviter de bâcler des modules complexes par contrainte
   de temps
4. Présenter à André une roadmap cohérente avec progression
   visible
5. Garder de la marge pour imprévus

### Engagement opérationnel

L'équipe (Carlos chef de projet + Claude.ai supervision +
Claude Code exécution) s'engage à livrer la V1.5 enrichie
en juillet-août 2026, après retours terrain pilote.

Les tickets V1.5 sont documentés dans
[docs/backlog.md](../backlog.md) section
« V1.5 — Roadmap post-pilote ».
