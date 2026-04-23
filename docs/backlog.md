# Backlog — Plateforme OIF Emploi Jeunes

> Chantiers hors des « 7 Étapes » du cahier des charges qui doivent être suivis pour le succès opérationnel du projet. Rafraîchi à chaque changement majeur.

## Infrastructure email — critique pour le lancement

L'envoi d'emails (magic links d'authentification, relances d'enquêtes A5/B2/C5) est **une dépendance bloquante**. Supabase Auth par défaut envoie ~2 emails par heure — incompatible avec 60 partenaires à onboarder en mai 2026. Trois jalons.

### Jalon 1 — Cette semaine (avril 2026) : Resend free tier sur `carloshounsinou.com`

- **Provider** : Resend, région eu-west-1 (Ireland).
- **Domaine** : `carloshounsinou.com` — domaine personnel temporaire du chargé de projet Carlos Hounsinou.
- **Sender** : `oif-plateforme@carloshounsinou.com` (nom affiché : « Plateforme Emploi Jeunes OIF »).
- **Plafond** : 3 000 emails / mois, 100 / jour (free tier).
- **Périmètre couvert** : tests dev + phase pilote 5-10 partenaires.
- **Configuration estimée** : 30 minutes (DNS SPF/DKIM + API key + activation Supabase SMTP).
- **Mention de transparence** : `carloshounsinou.com` hébergera un véritable site professionnel du chargé de projet pour assurer la crédibilité des emails envoyés (éviter réputation d'emails parasites).
- **Justification** : déblocage immédiat sans attendre la DSI OIF ; domaine déjà possédé ; configuration rapide.

### Jalon 2 — Avant fin avril 2026 : démarches SMTP OIF institutionnel

- **Action** : contact formel DSI OIF pour demander un compte SMTP dédié `@francophonie.org`.
- **Objectif** : emails envoyés depuis un domaine officiel institutionnel (meilleure délivrabilité + autorité).
- **Fallback** si refus ou délai : conserver Resend payant (20 $/mois) avec domaine OIF dédié type `@oif-plateforme.org`.
- **Livrable** : décision formelle (email SCS → DSI) + planning de migration.

### Jalon 3 — Avant lancement 60 partenaires (mai 2026) : validation domaine production

- **Décision finale à prendre** : SMTP OIF officiel OU Resend avec domaine OIF.
- **Vérifications DNS obligatoires** avant bascule :
  - SPF (Sender Policy Framework) publié
  - DKIM signé par clé RSA 2048
  - DMARC policy `quarantine` minimum (`reject` si réputation maîtrisée)
- **Tests de délivrabilité** vers les 5 clients-cibles (cf. [email-templates.md](email-templates.md)) :
  - Gmail web, Gmail mobile, Outlook web, Apple Mail iPhone, Yahoo Mail
- **Validation hiérarchique** OIF : N+1 du chargé de projet + direction communication.
- **Rollback plan** : retour temporaire à Resend `carloshounsinou.com` si problème critique en production.

---

## Autres chantiers suivis

### Admin UI — validation des comptes (prévu Étape 5+)

Page `/admin/utilisateurs` permettant à `admin_scs` de :
- Voir la file d'attente (`statut_validation = 'en_attente'`).
- Attribuer organisation + rôle + passer en `valide`.
- Rejeter un compte (`rejete`).
- Marquer notifications `nouveau_compte_a_valider` comme lues.

### SMTP de production à basculer (cf. jalon 3 ci-dessus)

### Monitoring & observabilité (après déploiement Vercel)

- Sentry côté frontend/backend pour les erreurs runtime.
- Logs Supabase Auth surveillés (taux d'échec magic link).
- Alertes seuils : > 5% d'erreurs d'envoi email → alerte Slack/email.

### V1.5 — Amélioration logos OIF (EPS → SVG)

- **Contexte** : en V1, les logos OIF sont livrés en PNG (881×438 pour le quadri, 2362×1007 pour les mono) — qualité suffisante pour `size="xl"` (400 px) mais sous-optimale sur écrans retina et pour impression depuis le web.
- **Action** : confier les 4 EPS (`docs/branding/sources/Logo_OIF_*.eps`) à un designer professionnel pour conversion vectorielle propre (Illustrator → SVG optimisé via `svgo`), vérification des 6 couleurs exactes (Pantone 116/376/2603/485/Process Cyan/Cool Gray 11) et nettoyage des IDs superflus.
- **Production attendue** : 4 SVG dans `public/assets/branding/oif/` + mise à jour `components/branding/logo-oif.tsx` pour basculer sur `.svg` (avec `<Image>` Next.js qui supporte nativement SVG).
- **Estimation** : 30 min d'intervention designer + 15 min d'intégration + 15 min de test de rendu multi-résolutions.
- **Priorité** : faible (les PNG sont acceptables en V1), à planifier avant V2.

### V1.5 — Onglet « Historique » sur fiche bénéficiaire et structure

- **Contexte** : le journal d'audit (`public.journaux_audit`) est rempli dès l'Étape 2 par trigger. En V1, il n'est consultable que via `/admin/audit` (admin_scs seul, cf. Étape 5). Les partenaires de terrain demanderont rapidement à voir l'historique **de leur propre fiche** pour suivi qualité et résolution de conflits.
- **Action** : ajouter un onglet « Historique » sur les pages détail `/beneficiaires/[id]` et `/structures/[id]`. Affiche les **20 dernières modifications** avec colonnes : Qui (nom utilisateur), Quand (timestamp), Quoi (champ modifié, valeur avant / valeur après). RLS : l'utilisateur voit l'historique s'il a le droit de voir la fiche (même logique que `can_read_beneficiaire`).
- **Requête** : `SELECT * FROM journaux_audit WHERE table_affectee = 'beneficiaires' AND ligne_id = $1 ORDER BY horodatage DESC LIMIT 20` — RLS applicable via nouvelle policy.
- **Estimation** : 1-2 heures (policy RLS + composant + tests e2e).
- **Priorité** : moyenne — à sortir avec la V1.5 (juillet 2026 ?).

### V1.5 — Duplication de fiche bénéficiaire

- **Contexte** : Q2 de l'Étape 4 arbitrée V1.5. La saisie à la chaîne (Q1=B) couvre 90 % du besoin en V1. Si les retours pilotes remontent un besoin de duplication hors cohorte (ex. frère/sœur participant au même programme), ajouter le bouton.
- **Action** : bouton « Dupliquer » dans le menu ⋯ de la liste et sur la fiche détail → ouvre `/beneficiaires/nouveau?duplique_de=<id>` avec pré-remplissage de tous les champs **sauf** `prenom`, `nom`, `date_naissance`, `telephone`, `courriel`, `consentement_recueilli`, `consentement_date` (forcés vides pour éviter le faux doublon et re-demander le consentement RGPD).
- **Estimation** : 1 heure.
- **Priorité** : basse — activer uniquement si demande utilisateur.

### Audit sécurité avant lancement officiel

- Scan OWASP ZAP sur l'environnement de staging.
- Revue RLS complète : un user de chaque rôle tente de lire les données d'un autre périmètre.
- Vérification que `SUPABASE_SERVICE_ROLE_KEY` n'apparaît dans aucun log navigateur (Chrome DevTools → Network → pas de requête avec ce header).
- Revue des headers HTTP en prod (cf. `next.config.mjs`).

### Historique des versions

| Version | Date | Changement |
|---------|------|-----------|
| 1.0 | 2026-04-23 | Création du backlog ; jalons 1-3 infrastructure email ; chantiers transverses. |
