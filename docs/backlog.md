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

### Étape 6 — Formulaires d'enquête (questionnaires officiels OIF)

Les 2 questionnaires officiels de collecte ont été reçus et archivés dans [`docs/specifications/questionnaires/`](specifications/questionnaires/). Ce sont les documents de **référence** pour la conception de l'Étape 6.

- **Source** :
  - Questionnaire A (indicateurs bénéficiaires, 35 questions) — A2, A3, A4, A5, F1 partiel.
  - Questionnaire B (indicateurs structures, 22 questions) — B2, B3, B4.
- **Points clés à traiter à l'Étape 6** :
  - **Design des formulaires React** : fidélité au questionnaire terrain pour garantir la cohérence avec les supports papier / téléphoniques des enquêteurs SCS.
  - **Mapping questions → colonnes JSONB** dans `public.reponses_enquetes.donnees` — un schéma Zod par indicateur (a2Schema, a3Schema, a4Schema, a5Schema, b2Schema, b3Schema, b4Schema) à poser dans `lib/schemas/enquetes/`.
  - **Validation Zod des réponses structurées** appliquée côté client ET côté Server Action à l'insertion dans `reponses_enquetes`.
  - **Logique de filtres « ALLER À »** (sauts conditionnels) : implémenter un moteur de règles déclaratif plutôt que du `if/else` câblé, afin de pouvoir modifier le questionnaire en V1.5 sans toucher au code (paramétrage côté admin).
  - **Module F1 transversal** : composant `<BlocF1 />` à greffer sur les questionnaires A4, A5 et C5 (Note méthodologique V2 § 5.5). 3-5 questions courtes sur l'usage du français comme facteur d'employabilité.
- **Volumétrie cible V2 (avril 2026)** : **5 623 bénéficiaires** (base A1) et **347 structures** (base B1) d'après [`docs/specifications/Base de sondage_EmploiJeune_Global_230426_V2.xlsm`](specifications/Base%20de%20sondage_EmploiJeune_Global_230426_V2.xlsm) — volume à valider lors de l'import Excel de l'Étape 7.
- **Priorité** : critique — dépend de l'Étape 4 et 5 (CRUD A1 et B1).

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

## Étape 9 — Dashboards analytics (spécifications André)

### Contexte

Retour N+1 du 24 avril 2026. Voir : [docs/retours-hierarchie/andre-24-avril-2026.md](retours-hierarchie/andre-24-avril-2026.md)

### Exigences

1. **Dashboard public épuré** (utilisateurs non-admin)
   - Indicateurs agrégés uniquement
   - Pas d'accès aux données brutes

2. **Dashboard admin complet** (admin_scs)
   - Vision transversale tous projets
   - Drill-down sur données détaillées
   - Exports facilités

3. **Structure visuelle : 4 piliers + 1 marqueur transversal**
   - Formation et Compétences (A)
   - Activités Économiques (B)
   - Intermédiation (F)
   - Écosystèmes d'Emploi (C)
   - Transversal : Langue française (F1)

4. **Exigences visuelles**
   - Design aligné charte graphique OIF
   - Typographie Inter
   - Couleurs PS1/PS2/PS3
   - Esthétique moderne et épurée

5. **Maquette blanche pour démo N+1**
   - Extraire du produit réel après livraison Étape 9
   - Mode « données fictives » activable
   - Délai production : 2-3 h après Étape 9 livrée

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

### V1.5 — Réactiver React Strict Mode (suivi régression Base-UI)

- **Contexte** : hotfix 5h (25/04/2026) a désactivé `reactStrictMode` dans `next.config.mjs` pour contourner un bug du composant `Select` de Base-UI 1.4.1. En Strict Mode, React double-execute les init de `useState` et `useCompositeListItem` consume `nextIndexRef.current` deux fois par item, ce qui empêche les ref callbacks de s'attacher au DOM. Conséquence : les Selects du formulaire et des filtres ne propagent pas la sélection (clic ignoré, popup ferme via `useDismiss` sans commit).
- **Action** : surveiller le repo Base-UI ([github.com/mui/base-ui](https://github.com/mui/base-ui)) pour un correctif de `useCompositeListItem`. Une fois corrigé (probablement 1.5.0+), réactiver `reactStrictMode: true` et vérifier visuellement tous les Selects (formulaire bénéficiaires, formulaire structures, filtres liste).
- **Coût accepté en V1** : perte des détections debug Strict Mode (effects non idempotents, subscribe/unsubscribe asymétriques, pure render warnings). Acceptable pour la phase pilote car on a déjà couvert les patterns risqués via tests unitaires + revue de code.
- **Estimation correction** : 5 minutes (rebascule du flag + tests visuels).
- **Priorité** : moyenne — à activer dès qu'une version corrigée de Base-UI sort.

### V1.5 — Champ « partenaire d'accompagnement » sur structures

- **Contexte** : Q4 de l'Étape 5 arbitrée SKIP en V1. Pour une structure, le rôle de « partenaire d'accompagnement » est déjà couvert par `projet_code` + `organisation_id` (le projet OIF ou son opérateur accompagne directement la structure).
- **Action** : si les retours pilotes remontent un besoin de distinguer un tiers accompagnateur (ex. ONG locale distincte du projet OIF), ajouter une colonne `partenaire_accompagnement TEXT` sur `public.structures` + champ libre dans le formulaire (section « Rattachement »).
- **Estimation** : 30 min (migration + form + filtre liste).
- **Priorité** : basse — activer uniquement si demande explicite.

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
| 1.1 | 2026-04-24 | Ajout section Étape 6 — questionnaires officiels OIF (A et B) reçus, mapping JSONB, logique « ALLER À », module F1 transversal ; volumétrie V2 (5 623 bénéficiaires, 347 structures). |
| 1.2 | 2026-04-25 | Ajout section Étape 9 — exigences dashboards (retour André 24/04) : 4 piliers Cadre Commun + transversal F1, dashboard public épuré, maquette blanche extraite du produit. Ticket V1.5 partenaire structures. |
