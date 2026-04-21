-- =============================================================================
-- Plateforme OIF Emploi Jeunes — Seed des nomenclatures officielles
-- -----------------------------------------------------------------------------
-- Charge les valeurs de référence. Les libellés sont reproduits EXACTEMENT
-- selon les sources normatives :
--   • Projets      : 00_NOMENCLATURE_PROJETS_OIF.md
--   • Indicateurs  : Cadre de mesure du rendement V2
--   • Pays/autres  : Template_OIF_Emploi_Jeunes_V1.xlsx feuille 5
-- =============================================================================

-- 1. Programmes Stratégiques ---------------------------------------------------
INSERT INTO public.programmes_strategiques(code, libelle, ordre_affichage) VALUES
  ('PS1', 'La langue française au service des cultures et de l''éducation', 1),
  ('PS2', 'La langue française au service de la démocratie et de la gouvernance', 2),
  ('PS3', 'La langue française, vecteur de développement durable', 3)
ON CONFLICT (code) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  ordre_affichage = EXCLUDED.ordre_affichage;

-- 2. Projets officiels (22 projets, 8 concernés par emploi jeunes) -------------
INSERT INTO public.projets(code, libelle, programme_strategique, concerne_emploi_jeunes, ordre_affichage) VALUES
  ('PROJ_A01a', 'La langue française, langue internationale', 'PS1', FALSE, 1),
  ('PROJ_A01b', 'Observatoire de la langue française', 'PS1', FALSE, 2),
  ('PROJ_A01c', 'Création culturelle, artistique et production de connaissance en français', 'PS1', FALSE, 3),
  ('PROJ_A02', 'La langue française, langue d''enseignement et d''apprentissage', 'PS1', FALSE, 4),
  ('PROJ_A03', 'Initiative francophone pour la formation à distance des maîtres (IFADEM)', 'PS1', FALSE, 5),
  ('PROJ_A04', 'École et langues nationales (ELAN)', 'PS1', FALSE, 6),
  ('PROJ_A05', 'Acquérir des savoirs, découvrir le monde', 'PS1', FALSE, 7),
  ('PROJ_A06', 'Industries culturelles et découvrabilité : une ambition francophone et mondiale', 'PS1', FALSE, 8),
  ('PROJ_A07', 'Jeux de la Francophonie', 'PS1', FALSE, 9),
  ('PROJ_A08', 'Radio Jeunesse Sahel', 'PS1', FALSE, 10),
  ('PROJ_A09', 'État civil', 'PS2', FALSE, 11),
  ('PROJ_A10', 'Renforcement de l''État de droit, des droits de l''Homme et de la justice', 'PS2', FALSE, 12),
  ('PROJ_A11', 'Prévention et lutte contre les désordres de l''information', 'PS2', FALSE, 13),
  ('PROJ_A12', 'Accompagnement des processus démocratiques', 'PS2', FALSE, 14),
  ('PROJ_A13', 'Soutien à la paix et à la stabilité', 'PS2', FALSE, 15),
  ('PROJ_A14', 'La Francophonie avec Elles', 'PS3', TRUE, 16),
  ('PROJ_A15', 'Innovations et plaidoyers francophones', 'PS3', TRUE, 17),
  ('PROJ_A16a', 'D-CLIC : Formez-vous au numérique', 'PS3', TRUE, 18),
  ('PROJ_A16b', 'Gouvernance numérique', 'PS3', TRUE, 19),
  ('PROJ_A17', 'Promotion des échanges économiques et commerciaux francophones', 'PS3', TRUE, 20),
  ('PROJ_A18', 'Accompagnement des transformations structurelles en matière d''environnement et de climat', 'PS3', TRUE, 21),
  ('PROJ_A19', 'Soutien aux initiatives environnementales dans le Bassin du Congo', 'PS3', TRUE, 22),
  ('PROJ_A20', 'Promotion du tourisme durable', 'PS3', TRUE, 23)
ON CONFLICT (code) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  programme_strategique = EXCLUDED.programme_strategique,
  concerne_emploi_jeunes = EXCLUDED.concerne_emploi_jeunes,
  ordre_affichage = EXCLUDED.ordre_affichage;

-- 2.bis. Mapping rétro-compatibilité des anciens codes projet ----------------
-- Utilisé par le parser d'import Excel pour remapper P14 → PROJ_A14, etc.
-- avec avertissement de traçabilité, sans erreur bloquante.
INSERT INTO public.projets_codes_legacy(code_legacy, code_officiel) VALUES
  ('P14',  'PROJ_A14'),
  ('P15',  'PROJ_A15'),
  ('P16',  'PROJ_A16a'),
  ('P16a', 'PROJ_A16a'),
  ('P16b', 'PROJ_A16b'),
  ('P17',  'PROJ_A17'),
  ('P18',  'PROJ_A18'),
  ('P19',  'PROJ_A19'),
  ('P20',  'PROJ_A20')
ON CONFLICT (code_legacy) DO UPDATE SET
  code_officiel = EXCLUDED.code_officiel;

-- 3. Pays (61 codes ISO-3 du template V1 feuille 5) ----------------------------
INSERT INTO public.pays(code_iso, libelle_fr, ordre_affichage) VALUES
  ('ALB', 'Albanie', 1),
  ('AND', 'Andorre', 2),
  ('ARG', 'Argentine', 3),
  ('ARM', 'Arménie', 4),
  ('BRB', 'Barbade', 5),
  ('BEL', 'Belgique', 6),
  ('BEN', 'Bénin', 7),
  ('BRA', 'Brésil', 8),
  ('BGR', 'Bulgarie', 9),
  ('BFA', 'Burkina Faso', 10),
  ('BDI', 'Burundi', 11),
  ('CPV', 'Cabo Verde', 12),
  ('KHM', 'Cambodge', 13),
  ('CMR', 'Cameroun', 14),
  ('CAN', 'Canada', 15),
  ('CAF', 'Centrafrique (République centrafricaine)', 16),
  ('COM', 'Comores', 17),
  ('COG', 'Congo', 18),
  ('COD', 'Congo (République démocratique)', 19),
  ('CIV', 'Côte d''Ivoire', 20),
  ('DJI', 'Djibouti', 21),
  ('DOM', 'Dominique', 22),
  ('EGY', 'Égypte', 23),
  ('FRA', 'France', 24),
  ('GAB', 'Gabon', 25),
  ('GHA', 'Ghana', 26),
  ('GRC', 'Grèce', 27),
  ('GIN', 'Guinée', 28),
  ('GNB', 'Guinée-Bissau', 29),
  ('GNQ', 'Guinée équatoriale', 30),
  ('HTI', 'Haïti', 31),
  ('ITA', 'Italie', 32),
  ('KEN', 'Kenya', 33),
  ('LAO', 'Laos', 34),
  ('LBN', 'Liban', 35),
  ('LUX', 'Luxembourg', 36),
  ('MKD', 'Macédoine du Nord', 37),
  ('MDG', 'Madagascar', 38),
  ('MLI', 'Mali', 39),
  ('MLT', 'Malte', 40),
  ('MAR', 'Maroc', 41),
  ('MUS', 'Maurice', 42),
  ('MRT', 'Mauritanie', 43),
  ('MDA', 'Moldavie', 44),
  ('MCO', 'Monaco', 45),
  ('NER', 'Niger', 46),
  ('ROU', 'Roumanie', 47),
  ('RWA', 'Rwanda', 48),
  ('LCA', 'Sainte-Lucie', 49),
  ('STP', 'São Tomé-et-Príncipe', 50),
  ('SEN', 'Sénégal', 51),
  ('SRB', 'Serbie', 52),
  ('SYC', 'Seychelles', 53),
  ('CHE', 'Suisse', 54),
  ('TCD', 'Tchad', 55),
  ('TGO', 'Togo', 56),
  ('TUN', 'Tunisie', 57),
  ('UKR', 'Ukraine', 58),
  ('VUT', 'Vanuatu', 59),
  ('VNM', 'Viêt Nam', 60),
  ('USA', 'États-Unis', 61)
ON CONFLICT (code_iso) DO UPDATE SET
  libelle_fr = EXCLUDED.libelle_fr,
  ordre_affichage = EXCLUDED.ordre_affichage;

-- 4. Domaines de formation (16 valeurs) ----------------------------------------
INSERT INTO public.domaines_formation(code, libelle, ordre_affichage) VALUES
  ('AGR_ELV_PCH', 'Agriculture, élevage, pêche', 1),
  ('AGROALIM', 'Agroalimentaire et transformation', 2),
  ('ARTISANAT', 'Artisanat et métiers manuels', 3),
  ('COMMERCE', 'Commerce et marketing', 4),
  ('DEV_PERS', 'Développement personnel et soft skills', 5),
  ('ENTREPR_GEST', 'Entrepreneuriat et gestion', 6),
  ('ENV_ECO_VERTE', 'Environnement et économie verte', 7),
  ('FP_TECH', 'Formation professionnelle technique', 8),
  ('GEST_FIN_COMPTA', 'Gestion financière et comptabilité', 9),
  ('LANGUES_COM', 'Langues et communication', 10),
  ('NUM_INFO', 'Numérique et informatique', 11),
  ('SANTE_SERV_PERS', 'Santé et services à la personne', 12),
  ('TOURISME', 'Tourisme, hôtellerie, restauration', 13),
  ('TRANSPORT', 'Transport et logistique', 14),
  ('AUTRE', 'Autre', 99)
ON CONFLICT (code) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  ordre_affichage = EXCLUDED.ordre_affichage;

-- 5. Secteurs d'activité (17 valeurs) ------------------------------------------
INSERT INTO public.secteurs_activite(code, libelle, ordre_affichage) VALUES
  ('AGR_SYL_PCH', 'Agriculture, sylviculture et pêche', 1),
  ('AGROALIM', 'Agroalimentaire', 2),
  ('ARTISANAT', 'Artisanat', 3),
  ('COMMERCE', 'Commerce', 4),
  ('BTP', 'Construction et BTP', 5),
  ('CULTURE', 'Culture, arts et audiovisuel', 6),
  ('EDUC', 'Éducation et formation', 7),
  ('ENERGIE_ENV', 'Énergie et environnement', 8),
  ('TOURISME', 'Hôtellerie, tourisme et restauration', 9),
  ('INDUSTRIE', 'Industrie manufacturière', 10),
  ('SANTE_SOCIAL', 'Santé et action sociale', 11),
  ('SERV_ENTR', 'Services aux entreprises', 12),
  ('SERV_FIN', 'Services financiers', 13),
  ('SPORT_LOISIRS', 'Sport et loisirs', 14),
  ('TIC', 'TIC et numérique', 15),
  ('TRANSPORT', 'Transport et logistique', 16),
  ('AUTRE', 'Autre', 99)
ON CONFLICT (code) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  ordre_affichage = EXCLUDED.ordre_affichage;

-- 6. Types de structure (9 valeurs) --------------------------------------------
INSERT INTO public.types_structure(code, libelle, ordre_affichage) VALUES
  ('AGR', 'AGR (Activité génératrice de revenus)', 1),
  ('MICRO_ENTR', 'Micro-entreprise', 2),
  ('PETITE_ENTR', 'Petite entreprise', 3),
  ('COOP', 'Coopérative', 4),
  ('ASSOC', 'Association', 5),
  ('GIE', 'Groupement d''intérêt économique', 6),
  ('AUTRE', 'Autre', 99)
ON CONFLICT (code) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  ordre_affichage = EXCLUDED.ordre_affichage;

-- 7. Natures d'appui (8 valeurs) -----------------------------------------------
INSERT INTO public.natures_appui(code, libelle, ordre_affichage) VALUES
  ('SUBVENTION', 'Subvention financière', 1),
  ('MATERIEL', 'Matériel et équipement', 2),
  ('FORMATION', 'Formation et renforcement de capacités', 3),
  ('MENTORAT', 'Accompagnement et mentorat', 4),
  ('MISE_RELATION', 'Mise en relation / intermédiation', 5),
  ('APPUI_MIXTE', 'Appui mixte', 6),
  ('AUTRE', 'Autre', 99)
ON CONFLICT (code) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  ordre_affichage = EXCLUDED.ordre_affichage;

-- 8. Modalités de formation (3 valeurs) ----------------------------------------
INSERT INTO public.modalites_formation(code, libelle, ordre_affichage) VALUES
  ('PRESENTIEL', 'Présentiel', 1),
  ('EN_LIGNE', 'En ligne (à distance)', 2),
  ('HYBRIDE', 'Hybride (mixte)', 3)
ON CONFLICT (code) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  ordre_affichage = EXCLUDED.ordre_affichage;

-- 9. Statuts bénéficiaire (5 valeurs) ------------------------------------------
INSERT INTO public.statuts_beneficiaire(code, libelle, ordre_affichage) VALUES
  ('INSCRIT', 'Inscrit', 1),
  ('PRESENT_EFFECTIF', 'Présent effectif', 2),
  ('FORMATION_ACHEVEE', 'Formation achevée', 3),
  ('ABANDON', 'Abandon', 4),
  ('NON_PRECISE', 'Non précisé', 99)
ON CONFLICT (code) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  ordre_affichage = EXCLUDED.ordre_affichage;

-- 10. Devises (14 valeurs) -----------------------------------------------------
INSERT INTO public.devises(code, libelle, ordre_affichage) VALUES
  ('EUR', 'Euro', 1),
  ('USD', 'Dollar US', 2),
  ('XOF', 'Franc CFA (BCEAO)', 3),
  ('XAF', 'Franc CFA (BEAC)', 4),
  ('MAD', 'Dirham marocain', 5),
  ('DZD', 'Dinar algérien', 6),
  ('TND', 'Dinar tunisien', 7),
  ('MGA', 'Ariary malgache', 8),
  ('MRU', 'Ouguiya mauritanienne', 9),
  ('CDF', 'Franc congolais', 10),
  ('RWF', 'Franc rwandais', 11),
  ('DJF', 'Franc djiboutien', 12),
  ('LBP', 'Livre libanaise', 13),
  ('HTG', 'Gourde haïtienne', 14),
  ('Autre', 'Autre', 99)
ON CONFLICT (code) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  ordre_affichage = EXCLUDED.ordre_affichage;

-- 11. Valeurs de consentement RGPD (3 valeurs) ---------------------------------
INSERT INTO public.valeurs_consentement(code, libelle, recueilli, ordre_affichage) VALUES
  ('OUI', 'Oui — consentement recueilli', TRUE, 1),
  ('NON', 'Non — pas de consentement', FALSE, 2),
  ('NON_PRECISE', 'Non précisé', FALSE, 99);

-- 12. Indicateurs du cadre de mesure (18 indicateurs) --------------------------
INSERT INTO public.indicateurs(
  code, categorie, libelle, definition, variables, methode_collecte,
  formule_calcul, sources, frequence, precautions, projets_concernes,
  est_pivot, ordre_affichage
) VALUES
  ('A1', 'A', 'Nombre de jeunes formés',
   'Nombre total de jeunes femmes et hommes ayant effectivement participé à une formation soutenue par l''OIF.',
   ARRAY['identifiant_beneficiaire', 'sexe', 'age', 'type_formation', 'date_debut', 'date_fin', 'presence_effective'],
   'Enregistrement à l''entrée de la formation et suivi de présence pendant toute l''activité.',
   'Somme des bénéficiaires ayant effectivement pris part à la formation selon les critères retenus.',
   'Fiches d''inscription ; listes de présence ; plateformes de formation.',
   'En continu, puis consolidation à la fin de chaque session.',
   'Éviter les doubles comptes ; distinguer inscrits et présents ; utiliser un identifiant unique ; définir ce qu''on entend par « effectivement participé ».',
   ARRAY['PROJ_A16a', 'PROJ_A20', 'PROJ_A19', 'PROJ_A15'],
   TRUE, 1),
  ('A2', 'A', 'Taux d''achèvement de la formation',
   'Proportion de jeunes ayant complété au moins un seuil minimal du parcours prévu.',
   ARRAY['nb_sessions_prevues', 'nb_sessions_suivies', 'statut_achevement', 'motif_non_achevement'],
   'Suivi continu à partir des présences ou de l''activité enregistrée sur la plateforme.',
   '(Nombre de jeunes ayant atteint le seuil d''achèvement / Nombre total de jeunes inscrits) × 100.',
   'Listes de présence ; plateforme d''apprentissage ; rapports des opérateurs.',
   'À la fin de chaque cycle de formation.',
   'Fixer le seuil d''achèvement avant le démarrage ; appliquer la même règle à tous ; distinguer abandon, absence et non-validation.',
   ARRAY['PROJ_A16a', 'PROJ_A20', 'PROJ_A19', 'PROJ_A15'],
   FALSE, 2),
  ('A3', 'A', 'Taux de certification / attestation',
   'Pourcentage de jeunes formés ayant obtenu une certification ou une attestation reconnue.',
   ARRAY['identifiant_beneficiaire', 'type_certification', 'statut_obtention', 'organisme_certificateur', 'date_delivrance'],
   'Vérification post-formation sur la base des documents délivrés.',
   '(Nombre de jeunes certifiés ou attestés / Nombre total de jeunes formés) × 100.',
   'Certificats ; attestations ; rapports partenaires.',
   'À la fin de la formation ou après la session de certification.',
   'Distinguer certification officielle et attestation de participation ; vérifier l''existence de la preuve ; ne pas compter les jeunes seulement présentés à l''examen.',
   ARRAY['PROJ_A16a', 'PROJ_A20', 'PROJ_A19', 'PROJ_A15'],
   FALSE, 3),
  ('A4', 'A', 'Gain de compétences',
   'Pourcentage de jeunes déclarant une amélioration significative des compétences ciblées.',
   ARRAY['score_avant', 'score_apres', 'domaine_competence', 'appreciation_beneficiaire'],
   'Questionnaire standardisé avant/après, éventuellement complété par un test court.',
   'Soit variation moyenne entre T0 et T1, soit proportion de bénéficiaires ayant progressé au-delà d''un seuil défini.',
   'Questionnaires bénéficiaires ; tests ; fiches d''évaluation.',
   'Au début et à la fin de la formation.',
   'Utiliser les mêmes outils à T0 et T1 ; distinguer progression déclarée et progression objectivée ; administrer T0 avant tout apprentissage.',
   ARRAY['PROJ_A16a', 'PROJ_A20', 'PROJ_A19', 'PROJ_A15', 'PROJ_A14'],
   FALSE, 4),
  ('A5', 'A', 'Taux d''insertion professionnelle à 6/12 mois',
   'Pourcentage de jeunes ayant un emploi ou une activité génératrice de revenu liée aux compétences acquises.',
   ARRAY['statut_emploi', 'type_activite', 'secteur', 'lien_avec_formation', 'tranche_revenu', 'date_acces_emploi'],
   'Enquête de suivi à 6 mois ou 12 mois, avec vérification légère sur échantillon si possible.',
   '(Nombre de jeunes en emploi ou AGR liée à la formation / Nombre total de jeunes suivis) × 100.',
   'Enquêtes post-formation ; contrats ; attestations ; registres.',
   'À 6 mois et/ou à 12 mois.',
   'Préciser le moment exact du suivi ; distinguer emploi durable, stage, mission ponctuelle et AGR ; ne pas attribuer automatiquement l''insertion à la formation.',
   ARRAY['PROJ_A16a', 'PROJ_A20', 'PROJ_A19', 'PROJ_A15'],
   FALSE, 5),

  ('B1', 'B', 'Activités économiques appuyées',
   'Nombre de micro-entreprises ou AGR portées par des jeunes et soutenues par l''OIF.',
   ARRAY['identifiant_structure', 'type_structure', 'date_creation', 'secteur_activite', 'montant_appui', 'nature_appui'],
   'Enregistrement au moment de l''octroi de l''appui.',
   'Décompte des structures ayant effectivement bénéficié d''un appui.',
   'Protocoles ou conventions ; rapports financiers ; bases de suivi.',
   'À chaque nouvel appui, puis consolidation périodique.',
   'Définir ce qui est considéré comme un appui ; distinguer création, renforcement et relance ; éviter de compter plusieurs fois une même structure.',
   ARRAY['PROJ_A14', 'PROJ_A15', 'PROJ_A19', 'PROJ_A20', 'PROJ_A17'],
   TRUE, 6),
  ('B2', 'B', 'Taux de survie à 12/24 mois',
   'Pourcentage de structures appuyées encore actives après 12 ou 24 mois.',
   ARRAY['statut_actif_inactif', 'revenu_ou_ca', 'duree_activite', 'cause_arret'],
   'Enquête de suivi, complétée si possible par des visites de terrain ou vérifications ciblées.',
   '(Nombre de structures encore actives / Nombre total de structures appuyées) × 100.',
   'Enquêtes bénéficiaires ; visites terrain ; registres simplifiés.',
   'À 12 mois et/ou à 24 mois.',
   'Définir précisément ce qu''est une structure active ; distinguer activité ralentie, activité saisonnière et arrêt complet ; vérifier les déclarations si possible.',
   ARRAY['PROJ_A14', 'PROJ_A15', 'PROJ_A19', 'PROJ_A20', 'PROJ_A17'],
   FALSE, 7),
  ('B3', 'B', 'Emplois créés ou maintenus',
   'Nombre d''emplois occupés par des jeunes dans les structures appuyées.',
   ARRAY['nb_emplois_depart', 'nb_emplois_suivi', 'sexe_ages_employes', 'type_emploi', 'statut_formel_informel'],
   'Déclaration des bénéficiaires, complétée par des vérifications légères.',
   'Emplois créés = emplois au suivi – emplois au départ ; emplois maintenus = emplois initiaux encore présents au suivi.',
   'Enquêtes bénéficiaires ; visites terrain ; documents internes de gestion.',
   'À la situation initiale et lors des suivis.',
   'Distinguer clairement emplois créés et emplois maintenus ; éviter de compter des appuis ponctuels comme des emplois ; documenter la durée des postes.',
   ARRAY['PROJ_A14', 'PROJ_A15', 'PROJ_A19', 'PROJ_A20', 'PROJ_A17'],
   FALSE, 8),
  ('B4', 'B', 'Emplois indirects (estimés)',
   'Estimation des emplois générés indirectement dans la chaîne de valeur.',
   ARRAY['type_partenaires', 'hypothese_calcul', 'nb_emplois_estimes'],
   'Estimation documentée séparément à partir d''études de cas ou d''analyses sectorielles.',
   'Calcul estimatif fondé sur des hypothèses explicites.',
   'Études de cas ; analyses sectorielles ; entretiens avec les acteurs économiques.',
   'Ponctuelle, selon les besoins d''analyse.',
   'Toujours préciser qu''il s''agit d''une estimation ; expliciter la méthode utilisée ; ne pas agréger sans distinction aux emplois directs.',
   ARRAY['PROJ_A17', 'PROJ_A20', 'PROJ_A19', 'PROJ_A15'],
   FALSE, 9),

  ('C1', 'C', 'Mises en relation effectives',
   'Nombre de mises en relation documentées facilitées par l''OIF.',
   ARRAY['type_mise_en_relation', 'date', 'acteurs_impliques', 'suite_donnee'],
   'Traçabilité obligatoire via une plateforme, un registre d''événement ou une base dédiée.',
   'Décompte des mises en relation documentées.',
   'Plateformes ; bases de données ; rapports d''événement.',
   'En continu.',
   'Ne compter que les mises en relation réelles et traçables ; distinguer contact, orientation et mise en relation aboutie ; harmoniser les catégories.',
   ARRAY['PROJ_A17', 'PROJ_A16a', 'PROJ_A15'],
   FALSE, 10),
  ('C2', 'C', 'Taux de conversion en opportunités',
   'Pourcentage de mises en relation ayant abouti à une opportunité rémunérée.',
   ARRAY['type_opportunite', 'date_obtention', 'remunere_ou_non', 'lien_avec_mise_en_relation'],
   'Enquête de suivi post-mise en relation.',
   '(Nombre de mises en relation aboutissant à une opportunité rémunérée / Nombre total de mises en relation) × 100.',
   'Enquêtes ciblées ; témoignages documentés ; registres de suivi.',
   'À intervalles réguliers après les mises en relation.',
   'Définir le délai d''observation ; distinguer opportunité proposée, acceptée et effectivement commencée ; clarifier la notion de rémunération.',
   ARRAY['PROJ_A17', 'PROJ_A16a', 'PROJ_A15'],
   FALSE, 11),
  ('C3', 'C', 'Emplois obtenus',
   'Nombre d''emplois ou de stages obtenus grâce à l''intermédiation OIF.',
   ARRAY['type_opportunite', 'duree', 'remuneration', 'date_debut', 'lien_avec_intermediation'],
   'Déclaration du bénéficiaire, complétée si possible par des données de plateforme ou des preuves légères.',
   'Décompte du nombre d''emplois ou stages attribués au dispositif d''intermédiation.',
   'Enquêtes bénéficiaires ; plateforme ; pièces simples de confirmation.',
   'Périodique.',
   'Distinguer emploi, stage et autre opportunité ; éviter les attributions abusives ; préciser la durée de l''emploi ou du stage.',
   ARRAY['PROJ_A16a', 'PROJ_A17', 'PROJ_A15'],
   FALSE, 12),
  ('C4', 'C', 'Délai d''accès à l''opportunité',
   'Temps moyen entre inscription et obtention d''une opportunité.',
   ARRAY['date_inscription', 'date_obtention_opportunite'],
   'Collecte automatique ou semi-automatique à partir de la plateforme.',
   'Somme des délais individuels divisée par le nombre de cas complets.',
   'Plateforme ; base de données de suivi.',
   'En continu, avec consolidation périodique.',
   'Vérifier la qualité des dates ; exclure les cas incomplets ; envisager aussi la médiane si les écarts sont très importants.',
   ARRAY['PROJ_A16a', 'PROJ_A17'],
   FALSE, 13),
  ('C5', 'C', 'Satisfaction / utilité',
   'Pourcentage de jeunes déclarant que l''appui de l''OIF a été déterminant.',
   ARRAY['niveau_satisfaction', 'utilite_percue', 'role_attribue_oif', 'suggestions'],
   'Enquête de satisfaction standardisée.',
   '(Nombre de jeunes jugeant l''appui déterminant / Nombre total de répondants) × 100.',
   'Enquêtes bénéficiaires.',
   'À la fin de l''activité et/ou lors du suivi.',
   'Utiliser des échelles simples ; distinguer satisfaction générale et utilité effective ; éviter les questions orientées.',
   ARRAY['PROJ_A16a', 'PROJ_A17', 'PROJ_A20', 'PROJ_A15', 'PROJ_A19'],
   FALSE, 14),

  ('D1', 'D', 'Cadres / dispositifs politiques emploi-jeunes appuyés',
   'Nombre de politiques, stratégies ou dispositifs bénéficiant de l''appui OIF.',
   ARRAY['intitule_document', 'type', 'nature_contribution', 'niveau_adoption', 'date'],
   'Revue documentaire et veille institutionnelle.',
   'Décompte des documents ou dispositifs ayant effectivement bénéficié d''un appui identifié.',
   'Textes officiels ; rapports ; notes techniques.',
   'Selon l''évolution des dispositifs.',
   'Distinguer appui à l''élaboration, appui à la validation et adoption effective ; conserver des traces formelles de la contribution OIF.',
   ARRAY['PROJ_A15', 'PROJ_A17', 'PROJ_A18', 'PROJ_A20'],
   FALSE, 15),
  ('D2', 'D', 'Capacités institutionnelles emploi-jeunes renforcées',
   'Pourcentage d''acteurs publics formés déclarant une amélioration de leurs pratiques.',
   ARRAY['type_acteur', 'competences_renforcees', 'pratique_modifiee', 'usage_effectif'],
   'Enquête avant/après, complétée si besoin par des études de cas.',
   '(Nombre d''acteurs déclarant une amélioration / Nombre total d''acteurs formés interrogés) × 100.',
   'Enquêtes ; évaluations ; études de cas.',
   'Après formation et lors de suivis.',
   'Illustrer les changements par des exemples concrets ; ne pas se limiter à l''auto-déclaration ; distinguer amélioration perçue et changement effectif.',
   ARRAY['PROJ_A15', 'PROJ_A17', 'PROJ_A18', 'PROJ_A20'],
   FALSE, 16),
  ('D3', 'D', 'Effets observables sur l''environnement',
   'Changements observables plausiblement liés aux appuis OIF.',
   ARRAY['type_changement', 'niveau_observation', 'lien_plausible', 'elements_preuve'],
   'Analyse qualitative fondée sur des études de cas, observations et entretiens.',
   'Pas de calcul standard ; documentation qualitative structurée.',
   'Études de cas ; rapports projets ; entretiens ; observations.',
   'Périodique, selon l''avancement des projets.',
   'Distinguer contribution et attribution ; ne pas généraliser abusivement ; privilégier des changements concrets, vérifiables et bien décrits.',
   ARRAY['PROJ_A15', 'PROJ_A17', 'PROJ_A18', 'PROJ_A19', 'PROJ_A20'],
   FALSE, 17),

  ('F1', 'F', 'Apport du français à l''employabilité',
   'Appréciation, lorsque cela est pertinent, de la contribution du français à l''accès à l''emploi, à l''exercice d''une activité ou à la valorisation professionnelle des bénéficiaires.',
   ARRAY['usage_francais_professionnel', 'role_francais_insertion', 'niveau_maitrise'],
   'Module transversal greffé aux questionnaires A4, A5, C5.',
   'Analyse qualitative et/ou proportions de bénéficiaires signalant une contribution du français.',
   'Enquêtes bénéficiaires ; études de cas.',
   'Selon les vagues A4/A5/C5.',
   'Ne pas déduire l''apport du français d''un simple usage ; rester sur une logique de contribution.',
   ARRAY['PROJ_A16a', 'PROJ_A17', 'PROJ_A20'],
   FALSE, 18)
ON CONFLICT (code) DO UPDATE SET
  categorie = EXCLUDED.categorie,
  libelle = EXCLUDED.libelle,
  definition = EXCLUDED.definition,
  variables = EXCLUDED.variables,
  methode_collecte = EXCLUDED.methode_collecte,
  formule_calcul = EXCLUDED.formule_calcul,
  sources = EXCLUDED.sources,
  frequence = EXCLUDED.frequence,
  precautions = EXCLUDED.precautions,
  projets_concernes = EXCLUDED.projets_concernes,
  est_pivot = EXCLUDED.est_pivot,
  ordre_affichage = EXCLUDED.ordre_affichage;
