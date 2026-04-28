/**
 * Terminologie officielle OIF — V2.5.1.
 *
 * Source : Carte officielle de la Francophonie 2025 (PDF fourni par
 * Carlos HOUNSINOU, SCS Paris).
 *
 * Distinction CRITIQUE : les États et gouvernements MEMBRES, MEMBRES
 * ASSOCIÉS et OBSERVATEURS de l'OIF NE SONT PAS des « partenaires »
 * — ils sont membres de l'organisation à des statuts différents.
 *
 * Les PARTENAIRES sont une catégorie distincte : bailleurs, agences ONU,
 * organisations multilatérales liées par accords spécifiques.
 *
 * Cette terminologie est centralisée dans ce fichier pour garantir la
 * cohérence sur toute la plateforme (vitrine, chatbot, documentation).
 */

/**
 * Statut d'un État ou gouvernement vis-à-vis de l'OIF.
 *
 * - `membre`           : 53 États et gouvernements de plein droit
 * - `membre_associe`   : 5 États avec engagements adaptés
 * - `observateur`      : 32 États avec statut d'observation
 *
 * Total : 90 États et gouvernements (chiffres 2025).
 */
export type StatutOif = 'membre' | 'membre_associe' | 'observateur';

export type EtatOif = {
  nom: string;
  /** Précision optionnelle (ex: « Nouveau-Brunswick » pour le Canada). */
  precision?: string;
  statut: StatutOif;
};

/**
 * 53 ÉTATS ET GOUVERNEMENTS MEMBRES de l'OIF (membres de plein droit).
 *
 * Ce sont les États qui adhèrent pleinement à la Charte de la Francophonie,
 * participent au Sommet et contribuent au budget de l'OIF.
 */
export const ETATS_MEMBRES: EtatOif[] = [
  { nom: 'Albanie', statut: 'membre' },
  { nom: 'Andorre', statut: 'membre' },
  { nom: 'Arménie', statut: 'membre' },
  { nom: 'Belgique', statut: 'membre' },
  { nom: 'Bénin', statut: 'membre' },
  { nom: 'Bulgarie', statut: 'membre' },
  { nom: 'Burundi', statut: 'membre' },
  { nom: 'Cabo Verde', statut: 'membre' },
  { nom: 'Cambodge', statut: 'membre' },
  { nom: 'Cameroun', statut: 'membre' },
  { nom: 'Canada', statut: 'membre' },
  { nom: 'Canada', precision: 'Nouveau-Brunswick', statut: 'membre' },
  { nom: 'Canada', precision: 'Québec', statut: 'membre' },
  { nom: 'Centrafrique', statut: 'membre' },
  { nom: 'Chypre', statut: 'membre' },
  { nom: 'Comores', statut: 'membre' },
  { nom: 'Congo', statut: 'membre' },
  { nom: 'Congo (RD)', statut: 'membre' },
  { nom: "Côte d'Ivoire", statut: 'membre' },
  { nom: 'Djibouti', statut: 'membre' },
  { nom: 'Dominique', statut: 'membre' },
  { nom: 'Égypte', statut: 'membre' },
  { nom: 'France', statut: 'membre' },
  { nom: 'Gabon', statut: 'membre' },
  { nom: 'Ghana', statut: 'membre' },
  { nom: 'Grèce', statut: 'membre' },
  { nom: 'Guinée', statut: 'membre' },
  { nom: 'Guinée-Bissau', statut: 'membre' },
  { nom: 'Guinée équatoriale', statut: 'membre' },
  { nom: 'Haïti', statut: 'membre' },
  { nom: 'Laos', statut: 'membre' },
  { nom: 'Liban', statut: 'membre' },
  { nom: 'Luxembourg', statut: 'membre' },
  { nom: 'Macédoine du Nord', statut: 'membre' },
  { nom: 'Madagascar', statut: 'membre' },
  { nom: 'Maroc', statut: 'membre' },
  { nom: 'Maurice', statut: 'membre' },
  { nom: 'Mauritanie', statut: 'membre' },
  { nom: 'Moldavie', statut: 'membre' },
  { nom: 'Monaco', statut: 'membre' },
  { nom: 'Roumanie', statut: 'membre' },
  { nom: 'Rwanda', statut: 'membre' },
  { nom: 'Sainte-Lucie', statut: 'membre' },
  { nom: 'Sao Tomé-et-Principe', statut: 'membre' },
  { nom: 'Sénégal', statut: 'membre' },
  { nom: 'Seychelles', statut: 'membre' },
  { nom: 'Suisse', statut: 'membre' },
  { nom: 'Tchad', statut: 'membre' },
  { nom: 'Togo', statut: 'membre' },
  { nom: 'Tunisie', statut: 'membre' },
  { nom: 'Vanuatu', statut: 'membre' },
  { nom: 'Vietnam', statut: 'membre' },
  { nom: 'Wallonie-Bruxelles', precision: 'Fédération', statut: 'membre' },
];

/**
 * 5 ÉTATS ET GOUVERNEMENTS MEMBRES ASSOCIÉS — statut intermédiaire avec
 * engagements adaptés.
 */
export const ETATS_MEMBRES_ASSOCIES: EtatOif[] = [
  { nom: 'Émirats arabes unis', statut: 'membre_associe' },
  { nom: 'Kosovo', statut: 'membre_associe' },
  { nom: 'France', precision: 'Nouvelle-Calédonie', statut: 'membre_associe' },
  { nom: 'Qatar', statut: 'membre_associe' },
  { nom: 'Serbie', statut: 'membre_associe' },
];

/**
 * 32 ÉTATS ET GOUVERNEMENTS OBSERVATEURS — statut d'observation sans
 * engagement plein.
 */
export const ETATS_OBSERVATEURS: EtatOif[] = [
  { nom: 'Angola', statut: 'observateur' },
  { nom: 'Argentine', statut: 'observateur' },
  { nom: 'Autriche', statut: 'observateur' },
  { nom: 'Bosnie-Herzégovine', statut: 'observateur' },
  { nom: 'Canada', precision: 'Nouvelle-Écosse', statut: 'observateur' },
  { nom: 'Canada', precision: 'Ontario', statut: 'observateur' },
  { nom: 'Chili', statut: 'observateur' },
  { nom: 'Corée du Sud', statut: 'observateur' },
  { nom: 'Costa Rica', statut: 'observateur' },
  { nom: 'Croatie', statut: 'observateur' },
  { nom: 'Dominicaine', precision: 'République', statut: 'observateur' },
  { nom: 'Estonie', statut: 'observateur' },
  { nom: 'France', precision: 'Polynésie française', statut: 'observateur' },
  { nom: 'Gambie', statut: 'observateur' },
  { nom: 'Géorgie', statut: 'observateur' },
  { nom: 'Hongrie', statut: 'observateur' },
  { nom: 'Irlande', statut: 'observateur' },
  { nom: 'Lettonie', statut: 'observateur' },
  { nom: 'Lituanie', statut: 'observateur' },
  { nom: 'Louisiane', statut: 'observateur' },
  { nom: 'Malte', statut: 'observateur' },
  { nom: 'Mexique', statut: 'observateur' },
  { nom: 'Monténégro', statut: 'observateur' },
  { nom: 'Mozambique', statut: 'observateur' },
  { nom: 'Pologne', statut: 'observateur' },
  { nom: 'Sarre', precision: 'Land de', statut: 'observateur' },
  { nom: 'Slovaquie', statut: 'observateur' },
  { nom: 'Slovénie', statut: 'observateur' },
  { nom: 'Tchèque', precision: 'République', statut: 'observateur' },
  { nom: 'Thaïlande', statut: 'observateur' },
  { nom: 'Ukraine', statut: 'observateur' },
  { nom: 'Uruguay', statut: 'observateur' },
];

/** Tous les États (90 entrées). */
export const TOUS_ETATS_OIF: EtatOif[] = [
  ...ETATS_MEMBRES,
  ...ETATS_MEMBRES_ASSOCIES,
  ...ETATS_OBSERVATEURS,
];

/** Compteurs — sources d'autorité pour les communications publiques. */
export const COMPTEURS_OIF = {
  membres: ETATS_MEMBRES.length, // 53
  membres_associes: ETATS_MEMBRES_ASSOCIES.length, // 5
  observateurs: ETATS_OBSERVATEURS.length, // 32
  total: TOUS_ETATS_OIF.length, // 90
} as const;

/**
 * 15 REPRÉSENTATIONS EXTÉRIEURES de l'OIF (siège + représentations
 * régionales et auprès des organisations internationales).
 */
export type RepresentationOif = {
  nom: string;
  ville: string;
  pays: string;
  /** Acronyme officiel (REPAO, RPNY, etc.) si applicable. */
  code?: string;
  /** Notes complémentaires (ex: opérateur associé hébergé). */
  note?: string;
};

export const REPRESENTATIONS_OIF: RepresentationOif[] = [
  { nom: 'Siège de l\u2019OIF', ville: 'Paris', pays: 'France' },
  {
    nom: 'Représentation auprès des Nations unies',
    ville: 'New York',
    pays: 'États-Unis',
    code: 'RPNY',
  },
  { nom: 'Représentation auprès des Nations unies', ville: 'Genève', pays: 'Suisse', code: 'RPGV' },
  {
    nom: 'Représentation auprès de l\u2019Union européenne',
    ville: 'Bruxelles',
    pays: 'Belgique',
    code: 'RPUE',
  },
  {
    nom: 'Représentation auprès de l\u2019Union africaine',
    ville: 'Addis-Abeba',
    pays: 'Éthiopie',
    code: 'RPUA',
  },
  {
    nom: 'Représentation pour l\u2019Europe centrale et orientale',
    ville: 'Bucarest',
    pays: 'Roumanie',
    code: 'REPECO',
  },
  {
    nom: 'Représentation pour l\u2019Afrique du Nord',
    ville: 'Tunis',
    pays: 'Tunisie',
    code: 'REPAN',
  },
  { nom: 'Représentation pour le Moyen-Orient', ville: 'Beyrouth', pays: 'Liban', code: 'REPMO' },
  {
    nom: 'Représentation pour l\u2019Afrique de l\u2019Ouest',
    ville: 'Lomé',
    pays: 'Togo',
    code: 'REPAO',
  },
  {
    nom: 'Représentation pour l\u2019Afrique centrale',
    ville: 'Libreville',
    pays: 'Gabon',
    code: 'REPAC',
  },
  {
    nom: 'Représentation pour l\u2019Océan Indien',
    ville: 'Antananarivo',
    pays: 'Madagascar',
    code: 'REPOI',
  },
  {
    nom: 'Représentation pour les Caraïbes et l\u2019Amérique latine',
    ville: 'Port-au-Prince',
    pays: 'Haïti',
    code: 'REPCAL',
  },
  {
    nom: 'Représentation pour l\u2019Amérique',
    ville: 'Québec',
    pays: 'Canada',
    code: 'REPAM',
    note: 'Hébergée avec l\u2019IFDD',
  },
  {
    nom: 'Représentation pour l\u2019Asie-Pacifique',
    ville: 'Hanoï',
    pays: 'Vietnam',
    code: 'REPAP',
  },
  {
    nom: 'Institut de la Francophonie pour l\u2019Éducation et la Formation',
    ville: 'Dakar',
    pays: 'Sénégal',
    code: 'IFEF',
  },
];

/**
 * 7 ORGANES ET OPÉRATEURS ASSOCIÉS de la Francophonie.
 *
 * Ce ne sont PAS des partenaires : ce sont des entités constitutives
 * de l'écosystème institutionnel francophone, définies par la Charte.
 */
export type OperateurOif = {
  acronyme: string;
  nom: string;
  ville: string;
  pays: string;
};

export const OPERATEURS_FRANCOPHONIE: OperateurOif[] = [
  {
    acronyme: 'APF',
    nom: 'Assemblée parlementaire de la Francophonie',
    ville: 'Paris',
    pays: 'France',
  },
  {
    acronyme: 'AUF',
    nom: 'Agence universitaire de la Francophonie',
    ville: 'Montréal / Paris',
    pays: 'Canada / France',
  },
  {
    acronyme: 'TV5MONDE',
    nom: 'Chaîne francophone internationale',
    ville: 'Paris / Québec',
    pays: 'France / Canada',
  },
  {
    acronyme: 'Université Senghor',
    nom: 'Université internationale de langue française au service du développement africain',
    ville: 'Alexandrie',
    pays: 'Égypte',
  },
  {
    acronyme: 'AIMF',
    nom: 'Association internationale des maires francophones',
    ville: 'Paris',
    pays: 'France',
  },
  {
    acronyme: 'CONFEMEN',
    nom: 'Conférence des ministres de l\u2019Éducation des États et gouvernements de la Francophonie',
    ville: 'Dakar',
    pays: 'Sénégal',
  },
  {
    acronyme: 'CONFEJES',
    nom: 'Conférence des ministres de la Jeunesse et des Sports de la Francophonie',
    ville: 'Dakar',
    pays: 'Sénégal',
  },
];

/**
 * Glossaire institutionnel — formules officielles à utiliser dans les
 * communications publiques (chatbot, vitrine, documentation).
 */
export const GLOSSAIRE_OIF = {
  /** Formule recommandée pour citer le total des États OIF. */
  total: `${COMPTEURS_OIF.total} États et gouvernements (${COMPTEURS_OIF.membres} membres, ${COMPTEURS_OIF.membres_associes} membres associés, ${COMPTEURS_OIF.observateurs} observateurs)`,

  /** Distinction officielle États OIF / Partenaires. */
  distinction: [
    "États et gouvernements MEMBRES de l'OIF (53) — adhèrent à la Charte de la Francophonie, participent au Sommet, contribuent au budget.",
    'États et gouvernements MEMBRES ASSOCIÉS (5) — statut intermédiaire avec engagements adaptés.',
    'États et gouvernements OBSERVATEURS (32) — statut d\u2019observation sans engagement plein.',
    'PARTENAIRES institutionnels — catégorie DISTINCTE des États : bailleurs (Union européenne, AFD, Banque mondiale), agences ONU (ONU Femmes, PNUD, UNESCO), organisations multilatérales. Liés par accords ou conventions de financement.',
  ],

  /** Distinction Pays d'intervention / États membres OIF. */
  pays_intervention_vs_membres: [
    '« Pays d\u2019intervention » : pays où des projets emploi-jeunes OIF sont mis en œuvre (53 pays sur la plateforme actuellement).',
    '« États et gouvernements MEMBRES de l\u2019OIF » : appartenance institutionnelle (53 + 5 + 32 = 90 entités).',
    'Le chiffre 53 est une coïncidence — ce ne sont pas les mêmes ensembles. Toujours préciser le périmètre.',
  ],
} as const;
