-- =============================================================================
-- contenu_pages — blocs de contenu éditables pour les pages publiques
-- =============================================================================

CREATE TABLE public.contenu_pages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key      TEXT        NOT NULL,
  section_key   TEXT        NOT NULL,
  bloc_key      TEXT        NOT NULL,
  type_contenu  TEXT        NOT NULL DEFAULT 'texte'
                CHECK (type_contenu IN ('h1','h2','h3','sous_titre','texte','badge','citation','lien')),
  valeur        TEXT        NOT NULL DEFAULT '',
  ordre         INTEGER     NOT NULL DEFAULT 0,
  actif         BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_contenu_page_bloc UNIQUE (page_key, section_key, bloc_key)
);

CREATE INDEX idx_contenu_pages_lookup ON public.contenu_pages (page_key, actif);

CREATE OR REPLACE FUNCTION public.set_contenu_pages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_contenu_pages_updated_at
  BEFORE UPDATE ON public.contenu_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_contenu_pages_updated_at();

ALTER TABLE public.contenu_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY cp_select ON public.contenu_pages FOR SELECT USING (true);
CREATE POLICY cp_insert ON public.contenu_pages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.utilisateurs
    WHERE id = auth.uid() AND role = 'super_admin' AND deleted_at IS NULL
  ));
CREATE POLICY cp_update ON public.contenu_pages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.utilisateurs
    WHERE id = auth.uid() AND role = 'super_admin' AND deleted_at IS NULL
  ));
CREATE POLICY cp_delete ON public.contenu_pages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.utilisateurs
    WHERE id = auth.uid() AND role = 'super_admin' AND deleted_at IS NULL
  ));

-- =============================================================================
-- Contenu initial — Page : accueil
-- =============================================================================

INSERT INTO public.contenu_pages (page_key, section_key, bloc_key, type_contenu, valeur, ordre) VALUES

-- ── Hero ──────────────────────────────────────────────────────────────────
('accueil','hero','badge',       'badge',      'Plateforme OIF · Emploi Jeunes Francophones', 0),
('accueil','hero','titre',       'h1',         'Suivi-évaluation des projets emploi jeunes de la Francophonie', 10),
('accueil','hero','accent',      'texte',      'emploi jeunes', 20),
('accueil','hero','sous_titre',  'sous_titre', 'Une plateforme institutionnelle dédiée au pilotage opérationnel et stratégique des programmes OIF d''insertion économique des jeunes francophones.', 30),
('accueil','hero','cta_principal','lien',      'Demander un accès', 40),
('accueil','hero','cta_secondaire','lien',     'Se connecter', 50),

-- ── Programmes ────────────────────────────────────────────────────────────
('accueil','programmes','badge',       'badge', 'Programmation 2024-2027', 0),
('accueil','programmes','titre',       'h2',    'Les trois programmes stratégiques de l''OIF', 10),
('accueil','programmes','sous_titre',  'texte', 'Trois axes complémentaires qui structurent l''action de la Francophonie.', 20),
('accueil','programmes','ps1_titre',   'h3',    'Cultures et éducation', 30),
('accueil','programmes','ps2_titre',   'h3',    'Démocratie et gouvernance', 40),
('accueil','programmes','ps3_titre',   'h3',    'Développement durable', 50),

-- ── Méthodologie ──────────────────────────────────────────────────────────
('accueil','methodologie','badge',     'badge', 'Principes directeurs', 0),
('accueil','methodologie','titre',     'h2',    'Notre méthodologie de suivi-évaluation', 10),
('accueil','methodologie','sous_titre','texte', 'Cinq principes structurants pour la mise en œuvre du Cadre Commun de mesure du rendement.', 20),
('accueil','methodologie','p1_titre',  'h3',    'Cohérence', 30),
('accueil','methodologie','p1_texte',  'texte', 'Les indicateurs sont interprétés de manière homogène d''un projet à l''autre afin de permettre des comparaisons, des agrégations et des analyses transversales.', 31),
('accueil','methodologie','p2_titre',  'h3',    'Souplesse encadrée', 40),
('accueil','methodologie','p2_texte',  'texte', 'Le cadre commun fixe une structure partagée, mais laisse à chaque projet la possibilité de mobiliser les indicateurs les plus pertinents au regard de sa logique d''intervention, sans application uniforme ni mécanique.', 41),
('accueil','methodologie','p3_titre',  'h3',    'Traçabilité', 50),
('accueil','methodologie','p3_texte',  'texte', 'Tout résultat renseigné est adossé à des données vérifiables, à des définitions explicites et à des sources identifiables.', 51),
('accueil','methodologie','p4_titre',  'h3',    'Fiabilisation progressive', 60),
('accueil','methodologie','p4_texte',  'texte', 'Respect de règles minimales d''harmonisation et de qualité des données, ainsi qu''un phasage des restitutions : première consolidation en juin, étape approfondie à l''automne, notamment pour les indicateurs C et D.', 61),
('accueil','methodologie','p5_titre',  'h3',    'Responsabilité partagée', 70),
('accueil','methodologie','p5_texte',  'texte', 'La collecte mobilise l''ensemble des parties prenantes : unités chefs de file pour les bases nominatives, partenaires de mise en œuvre, gestionnaires de plateformes de formation, et SCS pour les enquêtes d''approfondissement.', 71),

-- ── Cadre Commun ──────────────────────────────────────────────────────────
('accueil','cadre_commun','titre',      'h2',    'Architecture du Cadre Commun', 0),
('accueil','cadre_commun','sous_titre', 'texte', 'Quatre catégories d''indicateurs et un marqueur transversal, partagés par tous les projets emploi jeunes OIF.', 10),
('accueil','cadre_commun','f1_badge',   'badge', 'Marqueur transversal · F1', 20),
('accueil','cadre_commun','f1_titre',   'h3',    'Langue française et employabilité', 30),
('accueil','cadre_commun','f1_texte',   'texte', 'Améliorer l''employabilité grâce à la maîtrise du français — angle d''analyse intégrable à tous les projets.', 40),
('accueil','cadre_commun','cat_a_titre','h3',    'Formation, compétences et insertion', 50),
('accueil','cadre_commun','cat_a_texte','texte', 'Indicateurs relatifs au nombre de personnes formées, à l''achèvement des formations, à la certification, au gain de compétences et à l''insertion professionnelle à moyen terme.', 51),
('accueil','cadre_commun','cat_b_titre','h3',    'Activités économiques, entrepreneuriat et emploi', 60),
('accueil','cadre_commun','cat_b_texte','texte', 'Indicateurs relatifs aux activités économiques appuyées, à la survie des structures soutenues, aux emplois créés ou maintenus et aux emplois indirects estimés.', 61),
('accueil','cadre_commun','cat_c_titre','h3',    'Intermédiation et accès aux opportunités', 70),
('accueil','cadre_commun','cat_c_texte','texte', 'Indicateurs relatifs aux mises en relation effectives, à leur conversion en opportunités, aux emplois obtenus, au délai d''accès à l''opportunité et à l''utilité perçue de l''appui.', 71),
('accueil','cadre_commun','cat_d_titre','h3',    'Écosystèmes et conditions de l''emploi', 80),
('accueil','cadre_commun','cat_d_texte','texte', 'Indicateurs relatifs aux projets visant à améliorer ou renforcer l''environnement et les dispositifs de l''emploi, en créant des conditions favorables au-delà du seul niveau des bénéficiaires directs.', 81),

-- ── Portée (Pourquoi) ─────────────────────────────────────────────────────
('accueil','portee','titre',      'h2',    'Portée du Cadre Commun', 0),
('accueil','portee','sous_titre', 'texte', 'Référence commune pour tous les projets de l''OIF qui contribuent à l''amélioration de l''employabilité des jeunes, à leur accès à l''emploi, à l''auto-emploi, aux activités génératrices de revenus ou à l''environnement favorable à leur insertion économique.', 10),
('accueil','portee','def1_titre', 'h3',    'Jeunesse', 20),
('accueil','portee','def1_texte', 'texte', 'Le cadre s''applique conformément aux définitions adoptées par l''OIF en matière de jeunesse, dans le but d''assurer un langage commun et une cohérence d''action entre l''ensemble des projets.', 21),
('accueil','portee','def2_titre', 'h3',    'Emploi', 30),
('accueil','portee','def2_texte', 'texte', 'Toute activité exercée en contrepartie d''une rémunération ou d''un profit (monétaire ou en nature), qu''elle soit salariée ou indépendante, formelle ou informelle, incluant l''auto-emploi et l''entrepreneuriat. Les dispositifs de formation rémunérés (apprentissage, alternance, stage rémunéré) sont inclus. Les expériences non rémunérées sont reconnues comme leviers d''employabilité sans être assimilées à de l''emploi.', 31),
('accueil','portee','def3_titre', 'h3',    'Employabilité', 40),
('accueil','portee','def3_texte', 'texte', 'La capacité d''un jeune à accéder à un emploi, à s''y maintenir et à y progresser, grâce à un socle de compétences (fondamentales, techniques, numériques et transversales), d''expériences et de ressources (information, orientation, intermédiation, réseaux, accompagnement), dans un environnement favorable levant les principaux obstacles.', 41),

-- ── Citations ─────────────────────────────────────────────────────────────
('accueil','citations','badge',       'badge',    'Méthodologie & vision', 0),
('accueil','citations','titre',       'h2',       'Ce qui guide notre démarche', 10),
('accueil','citations','sous_titre',  'texte',    'Trois principes méthodologiques qui structurent notre approche du suivi-évaluation.', 20),
('accueil','citations','c1_texte',    'citation', 'Le suivi-évaluation rigoureux de nos projets emploi jeunes est la condition de leur impact mesurable et de leur soutenabilité dans la durée.', 30),
('accueil','citations','c1_auteur',   'texte',    'Cadre commun de mesure du rendement', 31),
('accueil','citations','c1_fonction', 'texte',    'Document méthodologique OIF', 32),
('accueil','citations','c2_texte',    'citation', 'L''apport du français à l''employabilité reste un marqueur transversal de toutes nos interventions : c''est notre signature francophone.', 40),
('accueil','citations','c2_auteur',   'texte',    'Note méthodologique', 41),
('accueil','citations','c2_fonction', 'texte',    'Service de Conception et Suivi (SCS)', 42),
('accueil','citations','c3_texte',    'citation', 'Cibler une strate précise – un projet, un pays, une cohorte – plutôt qu''envoyer en masse : c''est ce qui distingue une collecte propre d''un envoi en masse.', 50),
('accueil','citations','c3_auteur',   'texte',    'Méthodologie OIF', 51),
('accueil','citations','c3_fonction', 'texte',    'Approche stratifiée des collectes', 52),

-- ── KPI Compteurs ─────────────────────────────────────────────────────────
('accueil','kpi_compteurs','titre',       'h2',   'Données agrégées des projets emploi Jeunes', 0),
('accueil','kpi_compteurs','label_benef', 'texte','Bénéficiaires accompagnés', 10),
('accueil','kpi_compteurs','label_struct','texte','Structures appuyées', 20),
('accueil','kpi_compteurs','label_pays',  'texte','Pays d''intervention', 30),
('accueil','kpi_compteurs','label_femmes','texte','de femmes accompagnées', 40),

-- ── CTA Final ─────────────────────────────────────────────────────────────
('accueil','cta_final','titre_anon',      'h2',    'Partenaire de mise en œuvre, bailleur ou représentant institutionnel ?', 0),
('accueil','cta_final','sous_titre_anon', 'texte', 'Demandez un accès pour piloter vos projets de mise en œuvre, ou consulter les indicateurs agrégés en lecture seule.', 10),
('accueil','cta_final','titre_auth',      'h2',    'Reprenez votre travail dans votre espace', 20),
('accueil','cta_final','sous_titre_auth', 'texte', 'Tableaux de bord, indicateurs OIF, lancement de campagnes : tout est dans votre espace de travail.', 30),
('accueil','cta_final','cta_demande',     'lien',  'Demander un accès', 40),
('accueil','cta_final','cta_connexion',   'lien',  'Se connecter', 50),
('accueil','cta_final','cta_contact',     'lien',  'Nous contacter', 60),

-- ── Footer ────────────────────────────────────────────────────────────────
('accueil','footer','description',  'texte', 'Service de Conception et Suivi (SCS) : Organisation Internationale de la Francophonie. Plateforme officielle de suivi-évaluation des projets emploi jeunes.', 0),
('accueil','footer','nav_titre',    'h3',    'Plateforme', 10),
('accueil','footer','nav_connexion','lien',  'Se connecter', 20),
('accueil','footer','nav_demande',  'lien',  'Demander un accès', 30),
('accueil','footer','nav_contact',  'lien',  'Nous contacter', 40),
('accueil','footer','nav_documents','lien',  'Documents publics', 50),
('accueil','footer','rgpd_titre',   'h3',    'Contact RGPD', 60),
('accueil','footer','rgpd_ligne1',  'texte', 'SCS : Service de Conception et Suivi des projets', 70),
('accueil','footer','rgpd_email',   'lien',  'projets@francophonie.org', 80),
('accueil','footer','rgpd_ligne2',  'texte', 'Données traitées conformément au RGPD : accès limité aux personnes habilitées.', 90),

-- =============================================================================
-- Contenu initial — Page : réalisations
-- =============================================================================
('realisations','entete','badge',      'badge', 'Réalisations · Cadre Commun OIF', 0),
('realisations','entete','titre',      'h1',    'Résultats par catégorie d''indicateurs', 10),
('realisations','entete','sous_titre', 'texte', 'Consultez les résultats consolidés par pilier et par indicateur du Cadre Commun OIF.', 20),

-- =============================================================================
-- Contenu initial — Page : référentiels
-- =============================================================================
('referentiels','entete','badge',      'badge', 'Cadre Commun OIF', 0),
('referentiels','entete','titre',      'h1',    'Référentiel des indicateurs', 10),
('referentiels','entete','sous_titre', 'texte', 'L''ensemble des indicateurs du Cadre de mesure du rendement emploi, organisés par catégorie.', 20),

-- =============================================================================
-- Contenu initial — Page : contact
-- =============================================================================
('contact','entete','titre',      'h1',    'Nous contacter', 0),
('contact','entete','sous_titre', 'texte', 'Une question sur la plateforme ? Contactez l''équipe SCS de l''OIF.', 10),
('contact','entete','email',      'lien',  'projets@francophonie.org', 20),
('contact','entete','organisation','texte','Organisation Internationale de la Francophonie — Service de Conception et Suivi', 30)

ON CONFLICT (page_key, section_key, bloc_key) DO NOTHING;
