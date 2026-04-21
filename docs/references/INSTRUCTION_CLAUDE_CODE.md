# Plateforme OIF Emploi Jeunes — Instruction de développement

## Contexte et mission

Tu vas construire une **plateforme web de gestion et de suivi des données** pour le **Service Coordination et Suivi (SCS) de l'Organisation internationale de la Francophonie (OIF)**, sur la thématique du renforcement de l'emploi des jeunes.

Cette plateforme remplacera un dispositif actuel reposant sur des fichiers Excel échangés par email entre le SCS, une quinzaine d'unités chefs de file de projets, et une soixantaine de partenaires de mise en œuvre répartis dans une soixantaine de pays de la Francophonie.

**Volumétrie actuelle à reprendre** : environ 5 300 bénéficiaires individuels et 340 structures économiques, avec une cible de croissance continue (collecte permanente à partir de juin 2026).

**Échéance critique** : une première version opérationnelle doit être livrée pour le **15 juin 2026**.

## Profil des utilisateurs — TRÈS IMPORTANT

Ce point conditionne toutes les décisions d'interface.

- **Le SCS** (équipe OIF) : 3 à 5 personnes, à l'aise avec les outils bureautiques classiques mais pas nécessairement avec les outils data avancés.
- **Les unités chefs de file** : une quinzaine, compétences hétérogènes, certaines très à l'aise avec Excel, d'autres à peine familières des tableurs.
- **Les partenaires de mise en œuvre** : une soixantaine, compétences souvent limitées à Google Forms et au courrier électronique. Plusieurs travaillent depuis des pays à faible connectivité.
- **Les bénéficiaires finaux** (pour les enquêtes de suivi à 6 et 12 mois) : jeunes de 18 à 35 ans, équipés majoritairement de smartphones Android, parfois en connectivité limitée.

**Conséquences ergonomiques non négociables** :

1. L'interface doit être **aussi simple qu'un Google Form** pour la saisie. Un partenaire qui sait utiliser Google Forms doit pouvoir utiliser la plateforme sans formation.
2. **Aucun jargon technique** visible pour l'utilisateur final : pas de « enregistrements », « requêtes », « jointures ». Uniquement des termes métier : bénéficiaires, structures, enquêtes, projets, pays.
3. **Français obligatoire partout**, y compris dans les messages d'erreur, les placeholders, les boutons.
4. **Responsive mobile impératif** : la moitié des utilisateurs consultera depuis smartphone.
5. **Mode hors-ligne partiel** pour les formulaires (enregistrement local puis synchronisation) — voir plus loin.
6. **Chargement rapide** : pas de lourds frameworks front, privilégier la sobriété.

## Documents de référence

Trois documents cadrent le projet (fournis à Claude par l'utilisateur au démarrage) :

1. **Cadre de mesure du rendement Emploi V2** — définit les **18 indicateurs** du dispositif, regroupés en 5 catégories (A Formation-compétences, B Activités économiques, C Intermédiation, D Écosystèmes, F Marqueur transversal Langue française). Pour chaque indicateur : définition, variables, méthode de collecte, formule de calcul, sources, fréquence, précautions.
2. **Note méthodologique V2** — définit la logique : **A1 (bénéficiaires formés) et B1 (structures économiques appuyées) sont les indicateurs-pivots** qui servent à constituer les bases de sondage pour renseigner tous les autres indicateurs (A2 à A5, B2 à B4, C1 à C5, D1 à D3, F1).
3. **Template Excel standardisé V1** (`Template_OIF_Emploi_Jeunes_V1.xlsx`) — le template que les partenaires utilisent pour déposer leurs données A1 et B1. La plateforme doit **importer ce format sans modification**, c'est la colonne vertébrale de l'intégration.

Ces trois documents doivent être placés dans `/docs/references/` dans le repo. **Avant d'écrire la moindre ligne de code**, lis-les attentivement et produis un résumé structuré dans `/docs/references/synthese.md` confirmant ta compréhension des 18 indicateurs et de la logique A1/B1-pivot.

## Architecture technique imposée

- **Framework** : Next.js 14+ (App Router) avec TypeScript strict
- **UI** : Tailwind CSS + shadcn/ui (composants accessibles, design sobre)
- **Base de données** : Supabase (PostgreSQL managé, hébergement Europe, authentification incluse)
- **Authentification** : Supabase Auth avec magic-link par email (pas de mot de passe à retenir pour les partenaires)
- **Gestion d'état client** : Zustand (léger) — React Query pour la couche données
- **Validation** : Zod pour tous les formulaires et tous les schémas d'API
- **Graphiques** : Recharts
- **Cartographie** : React Leaflet + OpenStreetMap (pas Google Maps — souveraineté et coût)
- **Export** : `exceljs` pour Excel, `@react-pdf/renderer` pour PDF
- **Import Excel** : `exceljs` côté serveur avec stricte validation via Zod
- **Dates** : date-fns avec locale `fr`
- **Formulaires** : react-hook-form + zodResolver
- **i18n** : hard-codé en français pour la V1. Prévoir l'architecture pour anglais/arabe plus tard mais ne pas implémenter.
- **Déploiement** : Vercel pour le front, Supabase pour la base
- **Tests** : Vitest pour unitaires, Playwright pour e2e sur les parcours critiques

**Ne pas utiliser** : Redux, Material UI, Chakra UI, Prisma (utiliser directement le client Supabase TypeScript qui est excellent), TRPC.

## Modèle de données — tables principales

Crée les tables Supabase suivantes. Toutes les tables portent `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`, `created_by UUID REFERENCES auth.users`, `deleted_at TIMESTAMPTZ` (soft delete).

### Tables de référentiel (nomenclatures)

- `projets` : `code TEXT UNIQUE`, `libelle TEXT`, `description TEXT`, `actif BOOLEAN DEFAULT TRUE`
- `pays` : `code_iso TEXT UNIQUE` (3 lettres), `libelle_fr TEXT`, `region TEXT`, `actif BOOLEAN`
- `secteurs_activite` : `code TEXT UNIQUE`, `libelle TEXT`
- `domaines_formation` : `code TEXT UNIQUE`, `libelle TEXT`
- `types_structure` : `code TEXT`, `libelle TEXT`
- `natures_appui` : `code TEXT`, `libelle TEXT`
- `indicateurs` : `code TEXT UNIQUE` (A1, A2, B1, etc.), `categorie TEXT` (A/B/C/D/F), `libelle TEXT`, `definition TEXT`, `formule_calcul TEXT`, `variables TEXT[]`, `sources TEXT`, `frequence TEXT`, `precautions TEXT`, `projets_concernes TEXT[]`

### Tables métier centrales

- `organisations` : entités OIF et partenaires. `nom TEXT`, `type TEXT` (SCS, unite_chef_file, partenaire_mise_en_oeuvre), `pays_code TEXT REFERENCES pays(code_iso)`, `email_contact TEXT`, `projets_geres TEXT[]`
- `utilisateurs` : lien avec `auth.users`. `user_id UUID UNIQUE REFERENCES auth.users`, `nom_complet TEXT`, `organisation_id UUID REFERENCES organisations`, `role TEXT` (admin_scs, editeur_projet, contributeur_partenaire, lecteur), `actif BOOLEAN`
- `beneficiaires` (indicateur A1) : toutes les colonnes du template Excel V1 feuille 2. Ajouter `source_import TEXT` (manuelle, excel_v1, formulaire_web), `import_batch_id UUID`, `consentement_date DATE`
- `structures` (indicateur B1) : toutes les colonnes du template Excel V1 feuille 3
- `reponses_enquetes` : une réponse à une enquête. `indicateur_code TEXT REFERENCES indicateurs(code)`, `beneficiaire_id UUID REFERENCES beneficiaires` (nullable), `structure_id UUID REFERENCES structures` (nullable), `donnees JSONB` (flexible selon l'indicateur), `date_collecte DATE`, `vague_enquete TEXT` (6_mois, 12_mois, 24_mois, ponctuelle), `canal_collecte TEXT` (formulaire_web, entretien, import, telephone)
- `imports_excel` : traçabilité des imports. `fichier_nom TEXT`, `organisation_id UUID`, `projet_code TEXT`, `nb_lignes_a1 INT`, `nb_lignes_b1 INT`, `nb_erreurs INT`, `rapport_erreurs JSONB`, `statut TEXT` (en_cours, succes, echec_partiel, echec_total)
- `journaux_audit` : `table_affectee TEXT`, `ligne_id UUID`, `action TEXT` (INSERT, UPDATE, DELETE), `diff JSONB`, `user_id UUID`, `horodatage TIMESTAMPTZ`

### Vues matérialisées pour le dashboard

- `v_indicateurs_calcules` : une ligne par indicateur × projet × pays × année, avec la valeur calculée selon la formule du cadre de mesure. Rafraîchie toutes les heures.
- `v_cohortes_formation` : suivi longitudinal par cohorte (année de formation), avec taux d'achèvement (A2), certification (A3), insertion 6 mois (A5), insertion 12 mois (A5).

### Row Level Security (RLS)

**Obligatoire sur toutes les tables métier.** Règles :
- `admin_scs` voit tout
- `editeur_projet` voit et modifie uniquement les lignes des projets de son organisation
- `contributeur_partenaire` voit et modifie uniquement les lignes qu'il a créées ou celles de son organisation
- `lecteur` voit sans modifier, limité à son périmètre

## Fonctionnalités à livrer — par ordre de priorité

### Phase 1 — MVP (à livrer en priorité, semaine 1)

**Écrans et parcours minimum viable pour le 15 juin 2026 :**

1. **Page de connexion** : email + magic link. Pas de mot de passe. Design sobre, logo OIF en placeholder.
2. **Tableau de bord d'accueil** : pour chaque rôle, cards avec chiffres clés (nombre de bénéficiaires de mon périmètre, nombre de structures, taux de complétude moyen, dernières activités).
3. **CRUD bénéficiaires (A1)** : liste paginée (server-side, max 50 lignes par page) avec filtres (projet, pays, année, sexe, domaine, statut), recherche textuelle, tri. Formulaire de création/édition identique à la structure du template Excel. Validation Zod complète côté client et serveur.
4. **CRUD structures (B1)** : idem pour les structures économiques.
5. **Import Excel** : page permettant d'uploader un fichier au format `Template_OIF_Emploi_Jeunes_V1.xlsx`. Le serveur valide chaque ligne, affiche un rapport (lignes OK, lignes en erreur avec raison précise), permet d'importer sélectivement les lignes valides. Stocke l'import dans `imports_excel` pour traçabilité.
6. **Export Excel** : bouton sur les listes pour télécharger le résultat filtré au format du template V1.
7. **Gestion des utilisateurs** (admin_scs uniquement) : invitation par email, attribution de rôle, association à une organisation.

### Phase 2 — Collecte élargie (semaine 2)

8. **Générateur de formulaires dynamiques** : pour chaque indicateur du référentiel, la plateforme génère automatiquement un formulaire web à partir des variables définies. Le SCS peut activer/désactiver un formulaire.
9. **Formulaires publics par lien** : pour les enquêtes bénéficiaires (A4 gain de compétences, A5 insertion, B2 survie, B3 emplois, C2-C5 intermédiation, F1 langue française). Lien unique par bénéficiaire avec pré-remplissage automatique (projet, pays, formation suivie). Fonctionne comme Google Forms : pas besoin de compte pour répondre. Sauvegarde locale dans `localStorage` si perte de connexion, avec bouton de reprise.
10. **Suivi des taux de réponse** : tableau de bord par enquête (envoyés, répondus, en cours, taux).

### Phase 3 — Analyse et pilotage (semaine 3)

11. **Dashboard indicateurs** : les 18 indicateurs calculés automatiquement selon les formules du cadre de mesure, filtrables par projet, pays, année, sexe. Visualisations : cards pour les valeurs clés, graphiques barres pour les comparaisons, lignes pour les évolutions, choroplèthe pour la dimension pays.
12. **Suivi longitudinal cohortes** : graphique entonnoir par cohorte (année de formation) : nombre formés → achevés → certifiés → insérés à 6 mois → insérés à 12 mois. Avec taux à chaque étape.
13. **Cartographie** : carte de la Francophonie, points par pays avec popup détaillant les chiffres.
14. **Export PDF** : une note de synthèse automatique (titre, périmètre, chiffres clés, graphiques, méthodologie). Format A4, charte sobre.

### Phase 4 — Qualité et automatisation (semaine 4)

15. **Moteur de règles de qualité** : détection automatique doublons (même prénom+nom+date_naissance ou même nom_structure+pays), valeurs aberrantes (montants, taux), champs obligatoires manquants. Tableau des alertes avec actions possibles (fusionner, ignorer, corriger).
16. **Relances automatiques** : pour les bénéficiaires à enquêter à 6 ou 12 mois, envoi email automatique avec lien personnalisé. Configuration via Supabase Edge Functions + cron.
17. **Portail partenaires simplifié** : page dédiée aux contributeurs externes avec UI allégée : uniquement « Déposer mon fichier Excel », « Voir mes dépôts », « Remplir un formulaire pour un bénéficiaire ».
18. **Journal d'audit consultable** (admin_scs) : qui a fait quoi quand, avec diff des modifications.

## Contraintes transverses non négociables

- **Accessibilité WCAG 2.1 AA minimum** : contrastes, clavier, lecteurs d'écran. Les utilisateurs institutionnels en ont besoin.
- **RGPD** : chaque bénéficiaire a une colonne `consentement_recueilli` bool et `consentement_date`. Sans consentement, le téléphone et l'email ne peuvent pas être sauvegardés (validation Zod). Bouton « exercer mes droits RGPD » en pied de page.
- **Journalisation** : toute modification sur `beneficiaires`, `structures`, `reponses_enquetes` est tracée dans `journaux_audit` via trigger PostgreSQL.
- **Pas de données réelles en clair dans les repos** : toutes les variables d'environnement dans `.env.local` (gitignored), un `.env.example` commité avec des placeholders.
- **Seed de démo** : fournir un script `npm run seed:demo` qui charge 50 bénéficiaires fictifs et 10 structures fictives (**données inventées uniquement, aucune donnée réelle**) pour permettre la démo. Les données doivent être clairement identifiables comme fictives (prénoms évidents type « Jeanne DEMO », « Paul TEST »).
- **Tests** : au minimum, tests e2e Playwright sur les parcours « créer un bénéficiaire », « importer un fichier Excel », « exporter un fichier Excel », « se connecter ».

## Structure du repo attendue

```
/app
  /(public)          # pages sans auth (login, formulaires d'enquête publics)
  /(dashboard)       # pages protégées
    /beneficiaires
    /structures
    /enquetes
    /imports
    /dashboard
    /admin
  /api               # routes API Next.js
/components
  /ui                # shadcn/ui généré
  /forms             # composants de formulaires métier
  /charts            # composants de visualisation
  /layout            # header, sidebar, footer
/lib
  /supabase          # client Supabase, types générés
  /validation        # schémas Zod
  /excel             # import/export Excel
  /calculs           # calcul des 18 indicateurs
/docs
  /references        # les 3 documents de cadrage
  /architecture.md   # diagrammes et décisions
/supabase
  /migrations        # fichiers SQL versionnés
  /seed.sql          # données de référentiel (pays, projets, indicateurs)
/tests
  /e2e
  /unit
```

## Méthode de travail — ordre d'exécution IMPÉRATIF

**Ne pas tout coder d'un coup. Procède par étapes courtes et vérifiées.**

### Étape 0 — Compréhension (avant tout code)
1. Lis les 3 documents de référence dans `/docs/references/`
2. Produis `/docs/references/synthese.md` avec : liste des 18 indicateurs et leur catégorie, logique A1/B1-pivot résumée en 10 lignes, 5 points de vigilance méthodologique extraits de la note.
3. **Stoppe et présente ce document à l'utilisateur avant de continuer.**

### Étape 1 — Initialisation du projet
1. Initialise Next.js 14 avec TypeScript strict, Tailwind, shadcn/ui.
2. Configure ESLint + Prettier avec règles strictes.
3. Installe les dépendances listées dans l'architecture technique.
4. Crée la structure de dossiers imposée.
5. Configure `.env.example` avec toutes les variables nécessaires.
6. **Stoppe et demande à l'utilisateur les credentials Supabase.**

### Étape 2 — Modèle de données
1. Écris les migrations SQL dans `/supabase/migrations/001_initial_schema.sql`.
2. Écris le seed des nomenclatures dans `/supabase/seed.sql` (pays, projets, indicateurs — reprendre exactement les valeurs du template Excel V1 feuille 5).
3. Active RLS et écris les policies dans `002_rls_policies.sql`.
4. Génère les types TypeScript via `supabase gen types typescript`.
5. **Stoppe et fais valider le modèle.**

### Étape 3 — Authentification et shell de l'application
1. Page de connexion magic link.
2. Layout global avec sidebar (admin_scs) ou layout simplifié (contributeur_partenaire).
3. Middleware Next.js pour protéger les routes.
4. Page d'accueil dashboard avec 4 cards de KPI.

### Étape 4 — CRUD Bénéficiaires (A1) — fonctionnalité pivot
Construire ce CRUD de bout en bout, parfaitement, avant d'attaquer les structures. Il servira de modèle pour toutes les autres tables. Couvrir : liste avec filtres, création, édition, suppression douce, validation stricte, tests e2e.

### Étape 5 — CRUD Structures (B1)
Répliquer le pattern de l'étape 4.

### Étape 6 — Import Excel
Critique pour l'adoption. Doit être tolérant aux petites variations mais strict sur les champs clés. Produire un rapport d'erreurs lisible et actionnable.

### Étape 7 et suivantes
Continuer selon l'ordre des fonctionnalités définies.

**À chaque étape** :
- Un commit atomique par fonctionnalité terminée
- Message de commit en français, clair, métier
- Pas de TODO laissé dans le code
- Pas de `any` TypeScript non justifié

## Points de stop obligatoires

Tu t'arrêtes et attends validation humaine aux moments suivants :
- Après la synthèse des documents de référence
- Après l'initialisation du projet (besoin credentials)
- Après le modèle de données
- Après le CRUD bénéficiaires (validation du pattern UX)
- Avant le déploiement en production

## Pièges à éviter

1. **Ne pas réinventer le template Excel** : il a été conçu avec 61 pays ISO-3, 12 projets, 16 domaines de formation, 17 secteurs. Les valeurs du seed SQL doivent correspondre **exactement** à celles de la feuille 5 du template. Toute divergence casse l'import.
2. **Ne pas mettre de données réelles en dur dans le code** : même pour les tests, uniquement des données fictives évidentes.
3. **Ne pas utiliser du texte libre là où il y a une nomenclature** : sinon le problème « Cameroun vs Cameroon » se reproduit. Tous les champs à valeurs fermées doivent être des `SELECT` liés aux tables de nomenclature.
4. **Ne pas multiplier les dépendances** : chaque `npm install` doit être justifié.
5. **Ne pas faire du frontend avant le backend** : pas de composant qui consomme une API qui n'existe pas.
6. **Ne pas négliger l'accessibilité** : pas de `<div onClick>` à la place d'un `<button>`, pas de formulaire sans `<label>`.
7. **Ne pas coder en anglais** : tous les libellés UI, messages d'erreur, commentaires JSDoc métier en français. Le code lui-même reste en anglais (noms de variables, fonctions), c'est la convention du langage.

## Livrables finaux attendus

- Application web déployée sur une URL Vercel de preview
- Base de données Supabase configurée, migrée, seedée
- Repo GitHub avec historique de commits propre
- `README.md` avec : description, prérequis, installation locale, déploiement, licence
- `/docs/architecture.md` avec diagrammes et décisions
- `/docs/guide_utilisateur_scs.md` (tutoriel pour les équipes OIF)
- `/docs/guide_utilisateur_partenaire.md` (tutoriel simplifié pour les partenaires)
- Tests e2e verts sur les parcours critiques
- Script de seed démo fonctionnel

## Critères de succès

Un utilisateur qui n'a jamais vu la plateforme doit pouvoir, en moins de 10 minutes :
- Se connecter sans mot de passe
- Créer un bénéficiaire
- Importer un fichier Excel au format standard
- Voir les bénéficiaires importés dans la liste
- Exporter un Excel au même format
- Comprendre son score de complétude

Si ce parcours n'est pas fluide, c'est que la plateforme n'est pas prête.

---

**Commence par l'Étape 0 : lis les documents de référence et produis ta synthèse.**
