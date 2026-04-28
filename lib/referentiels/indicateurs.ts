/**
 * Référentiel des indicateurs OIF — V2.4.0.
 *
 * Source : `docs/methodologie/Cadre_de_mesure_du_rendement_emploi_V2.docx`
 * (Note méthodologique + tableau consolidé des indicateurs).
 *
 * Aucun contenu inventé — chaque champ est issu directement du tableau
 * « Catégorie A/B/C/D + Marqueur transversal » du Cadre Commun V2.
 *
 * Décision technique V2.4 : hardcodage TypeScript plutôt que table BDD.
 * Justification : les 18 indicateurs sont stables, validés par André
 * (Chef SCS), et leur évolution suit le rythme des révisions du Cadre
 * Commun (Note méthodologique V2 → V3). Une migration BDD n'apporterait
 * de la valeur que si Carlos voulait permettre l'édition CRUD via
 * l'admin, ce qui n'est pas demandé en V2.4.
 */

export type CodePilier = 'A' | 'B' | 'C' | 'D' | 'F';

export type Pilier = {
  code: CodePilier;
  titre: string;
  sousTitre: string;
  description: string;
  couleur: string; // hex
};

export const PILIERS: Record<CodePilier, Pilier> = {
  A: {
    code: 'A',
    titre: 'Catégorie A',
    sousTitre: 'Compétences et employabilité',
    description:
      "Les indicateurs de cette catégorie suivent les jeunes formés et leur progression — depuis l'inscription en formation jusqu'à l'insertion professionnelle 6 ou 12 mois après. Ils permettent de mesurer la qualité et l'efficacité des dispositifs de formation soutenus par l'OIF.",
    couleur: '#0E4F88', // bleu institutionnel
  },
  B: {
    code: 'B',
    titre: 'Catégorie B',
    sousTitre: "Création / maintien d'emplois",
    description:
      "Cette catégorie suit les activités économiques portées par les jeunes (micro-entreprises, AGR) soutenues par l'OIF, leur survie dans le temps, et les emplois créés ou maintenus dans ces structures.",
    couleur: '#7EB301', // vert PS3
  },
  C: {
    code: 'C',
    titre: 'Catégorie C',
    sousTitre: 'Intermédiation et accès aux opportunités',
    description:
      "Les indicateurs de cette catégorie mesurent l'efficacité des dispositifs de mise en relation entre jeunes et opportunités professionnelles : événements B2B, mentorat, plateformes d'orientation.",
    couleur: '#5D0073', // violet PS2
  },
  D: {
    code: 'D',
    titre: 'Catégorie D',
    sousTitre: "Écosystèmes et conditions de l'emploi",
    description:
      "Cette catégorie mesure les effets systémiques des projets sur les politiques publiques, les capacités institutionnelles et l'environnement de l'emploi des jeunes dans les pays francophones.",
    couleur: '#0198E9', // cyan PS1
  },
  F: {
    code: 'F',
    titre: 'Marqueur transversal',
    sousTitre: 'Langue française et employabilité',
    description:
      "Marqueur transversal applicable à tous les projets OIF emploi-jeunes. Mesure la contribution du français à l'accès à l'emploi, à l'entrepreneuriat et à la valorisation professionnelle des bénéficiaires.",
    couleur: '#F5A623', // doré accent OIF
  },
} as const;

export type Indicateur = {
  code: string; // A1, A2, …, F1
  pilier: CodePilier;
  intitule: string;
  definition: string;
  variables: string[];
  collecte: string;
  calcul: string;
  sources: string[];
  frequence: string;
  precautions: string[];
  /** Codes projets concernés (P14, P15, P16 D-CLIC, …). */
  projetsConcernes: string[];
  /** Donnée live disponible dans la plateforme V1, sinon null. */
  donneeLiveCle?: 'A1' | 'B1' | null;
};

export const INDICATEURS: Indicateur[] = [
  // ─────────────────────────── CATÉGORIE A ───────────────────────────
  {
    code: 'A1',
    pilier: 'A',
    intitule: 'Nombre de jeunes formés',
    definition:
      "Nombre total de jeunes femmes et hommes ayant effectivement participé à une formation soutenue par l'OIF.",
    variables: [
      'Identifiant du bénéficiaire',
      'Sexe',
      'Âge',
      'Type de formation',
      'Date de début',
      'Date de fin',
      'Présence effective',
    ],
    collecte:
      "Enregistrement à l'entrée de la formation et suivi de présence pendant toute l'activité.",
    calcul:
      'Somme des bénéficiaires ayant effectivement pris part à la formation selon les critères retenus.',
    sources: ['Fiches d’inscription', 'Listes de présence', 'Plateformes de formation'],
    frequence: 'En continu, puis consolidation à la fin de chaque session.',
    precautions: [
      'Éviter les doubles comptes',
      'Distinguer inscrits et présents',
      'Utiliser un identifiant unique',
      'Définir ce qu’on entend par « effectivement participé »',
    ],
    projetsConcernes: ['P16 D-CLIC', 'P20', 'P19', 'P15'],
    donneeLiveCle: 'A1',
  },
  {
    code: 'A2',
    pilier: 'A',
    intitule: 'Taux d’achèvement de la formation',
    definition: 'Proportion de jeunes ayant complété au moins un seuil minimal du parcours prévu.',
    variables: [
      'Nombre total de sessions prévues',
      'Nombre de sessions suivies',
      'Statut d’achèvement',
      'Motif de non-achèvement',
    ],
    collecte:
      "Suivi continu à partir des présences ou de l'activité enregistrée sur la plateforme.",
    calcul:
      '(Nombre de jeunes ayant atteint le seuil d’achèvement / Nombre total de jeunes inscrits) × 100.',
    sources: ['Listes de présence', 'Plateforme d’apprentissage', 'Rapports des opérateurs'],
    frequence: 'À la fin de chaque cycle de formation.',
    precautions: [
      'Fixer le seuil d’achèvement avant le démarrage',
      'Appliquer la même règle à tous',
      'Distinguer abandon, absence et non-validation',
    ],
    projetsConcernes: ['P16', 'P20', 'P19', 'P15'],
  },
  {
    code: 'A3',
    pilier: 'A',
    intitule: 'Taux de certification / attestation',
    definition:
      'Pourcentage de jeunes formés ayant obtenu une certification ou une attestation reconnue.',
    variables: [
      'Identifiant du bénéficiaire',
      'Type de certification ou attestation',
      'Statut d’obtention',
      'Organisme certificateur',
      'Date de délivrance',
    ],
    collecte: 'Vérification post-formation sur la base des documents délivrés.',
    calcul: '(Nombre de jeunes certifiés ou attestés / Nombre total de jeunes formés) × 100.',
    sources: ['Certificats', 'Attestations', 'Rapports partenaires'],
    frequence: 'À la fin de la formation ou après la session de certification.',
    precautions: [
      'Distinguer certification officielle et attestation de participation',
      'Vérifier l’existence de la preuve',
      'Ne pas compter les jeunes seulement présentés à l’examen',
    ],
    projetsConcernes: ['P16', 'P20', 'P19', 'P15'],
  },
  {
    code: 'A4',
    pilier: 'A',
    intitule: 'Gain de compétences',
    definition:
      'Pourcentage de jeunes déclarant une amélioration significative des compétences ciblées.',
    variables: [
      'Score ou niveau avant formation',
      'Score ou niveau après formation',
      'Domaine de compétence',
      'Appréciation du bénéficiaire',
    ],
    collecte: 'Questionnaire standardisé avant/après, éventuellement complété par un test court.',
    calcul:
      'Soit variation moyenne entre T0 et T1, soit proportion de bénéficiaires ayant progressé au-delà d’un seuil défini.',
    sources: ['Questionnaires bénéficiaires', 'Tests', 'Fiches d’évaluation'],
    frequence: 'Au début et à la fin de la formation.',
    precautions: [
      'Utiliser les mêmes outils à T0 et T1',
      'Distinguer progression déclarée et progression objectivée',
      'Administrer T0 avant tout apprentissage',
    ],
    projetsConcernes: ['P16', 'P20', 'P19', 'P15', 'P14'],
  },
  {
    code: 'A5',
    pilier: 'A',
    intitule: 'Taux d’insertion professionnelle à 6/12 mois',
    definition:
      'Pourcentage de jeunes ayant un emploi ou une activité génératrice de revenu liée aux compétences acquises.',
    variables: [
      'Statut d’emploi',
      'Type d’activité',
      'Secteur',
      'Lien avec la formation',
      'Tranche de revenu',
      'Date d’accès à l’emploi ou à l’activité',
    ],
    collecte:
      'Enquête de suivi à 6 mois ou 12 mois, avec vérification légère sur échantillon si possible.',
    calcul:
      '(Nombre de jeunes en emploi ou AGR liée à la formation / Nombre total de jeunes suivis) × 100.',
    sources: ['Enquêtes post-formation', 'Contrats', 'Attestations', 'Registres'],
    frequence: 'À 6 mois et/ou à 12 mois.',
    precautions: [
      'Préciser le moment exact du suivi',
      'Distinguer emploi durable, stage, mission ponctuelle et AGR',
      'Ne pas attribuer automatiquement l’insertion à la formation',
    ],
    projetsConcernes: ['P16', 'P20', 'P19', 'P15'],
  },

  // ─────────────────────────── CATÉGORIE B ───────────────────────────
  {
    code: 'B1',
    pilier: 'B',
    intitule: 'Activités économiques appuyées',
    definition: 'Nombre de micro-entreprises ou AGR portées par des jeunes et soutenues par l’OIF.',
    variables: [
      'Nom ou identifiant de la structure',
      'Type de structure',
      'Date de création',
      'Secteur d’activité',
      'Montant et nature de l’appui',
    ],
    collecte: 'Enregistrement au moment de l’octroi de l’appui.',
    calcul: 'Décompte des structures ayant effectivement bénéficié d’un appui.',
    sources: ['Protocoles ou conventions', 'Rapports financiers', 'Bases de suivi'],
    frequence: 'À chaque nouvel appui, puis consolidation périodique.',
    precautions: [
      'Définir ce qui est considéré comme un appui',
      'Distinguer création, renforcement et relance',
      'Éviter de compter plusieurs fois une même structure',
    ],
    projetsConcernes: ['P14', 'P15', 'P19', 'P20', 'P17'],
    donneeLiveCle: 'B1',
  },
  {
    code: 'B2',
    pilier: 'B',
    intitule: 'Taux de survie à 12/24 mois',
    definition: 'Pourcentage de structures appuyées encore actives après 12 ou 24 mois.',
    variables: [
      'Statut actif/inactif',
      'Revenu ou chiffre d’affaires récent',
      'Durée d’activité',
      'Cause d’arrêt le cas échéant',
    ],
    collecte:
      'Enquête de suivi, complétée si possible par des visites de terrain ou vérifications ciblées.',
    calcul: '(Nombre de structures encore actives / Nombre total de structures appuyées) × 100.',
    sources: ['Enquêtes bénéficiaires', 'Visites terrain', 'Registres simplifiés'],
    frequence: 'À 12 mois et/ou à 24 mois.',
    precautions: [
      'Définir précisément ce qu’est une structure active',
      'Distinguer activité ralentie, activité saisonnière et arrêt complet',
      'Vérifier les déclarations si possible',
    ],
    projetsConcernes: ['P14', 'P15', 'P19', 'P20', 'P17'],
  },
  {
    code: 'B3',
    pilier: 'B',
    intitule: 'Emplois créés ou maintenus',
    definition: 'Nombre d’emplois occupés par des jeunes dans les structures appuyées.',
    variables: [
      'Nombre d’emplois au départ',
      'Nombre d’emplois au suivi',
      'Sexe et âge des employés',
      'Type d’emploi',
      'Statut formel/informel',
    ],
    collecte: 'Déclaration des bénéficiaires, complétée par des vérifications légères.',
    calcul:
      'Emplois créés = emplois au suivi – emplois au départ ; emplois maintenus = emplois initiaux encore présents au suivi.',
    sources: ['Enquêtes bénéficiaires', 'Visites terrain', 'Documents internes de gestion'],
    frequence: 'À la situation initiale et lors des suivis.',
    precautions: [
      'Distinguer clairement emplois créés et emplois maintenus',
      'Éviter de compter des appuis ponctuels comme des emplois',
      'Documenter la durée des postes',
    ],
    projetsConcernes: ['P14', 'P15', 'P19', 'P20', 'P17'],
  },
  {
    code: 'B4',
    pilier: 'B',
    intitule: 'Emplois indirects (estimés)',
    definition: 'Estimation des emplois générés indirectement dans la chaîne de valeur.',
    variables: [
      'Type de partenaires ou fournisseurs concernés',
      'Hypothèse de calcul',
      'Nombre d’emplois estimés',
    ],
    collecte:
      'Estimation documentée séparément à partir d’études de cas ou d’analyses sectorielles.',
    calcul: 'Calcul estimatif fondé sur des hypothèses explicites.',
    sources: ['Études de cas', 'Analyses sectorielles', 'Entretiens avec les acteurs économiques'],
    frequence: 'Ponctuelle, selon les besoins d’analyse.',
    precautions: [
      'Toujours préciser qu’il s’agit d’une estimation',
      'Expliciter la méthode utilisée',
      'Ne pas agréger sans distinction aux emplois directs',
    ],
    projetsConcernes: ['P17', 'P20', 'P19', 'P15'],
  },

  // ─────────────────────────── CATÉGORIE C ───────────────────────────
  {
    code: 'C1',
    pilier: 'C',
    intitule: 'Mises en relation effectives',
    definition: 'Nombre de mises en relation documentées facilitées par l’OIF.',
    variables: ['Type de mise en relation', 'Date', 'Acteurs impliqués', 'Suite donnée si connue'],
    collecte:
      'Traçabilité obligatoire via une plateforme, un registre d’événement ou une base dédiée.',
    calcul: 'Décompte des mises en relation documentées.',
    sources: ['Plateformes', 'Bases de données', 'Rapports d’événement'],
    frequence: 'En continu.',
    precautions: [
      'Ne compter que les mises en relation réelles et traçables',
      'Distinguer contact, orientation et mise en relation aboutie',
      'Harmoniser les catégories',
    ],
    projetsConcernes: ['P17', 'P16', 'P15', 'nouveau projet emploi jeunesse'],
  },
  {
    code: 'C2',
    pilier: 'C',
    intitule: 'Taux de conversion en opportunités',
    definition: 'Pourcentage de mises en relation ayant abouti à une opportunité rémunérée.',
    variables: [
      'Type d’opportunité',
      'Date d’obtention',
      'Caractère rémunéré ou non',
      'Lien avec la mise en relation',
    ],
    collecte: 'Enquête de suivi post-mise en relation.',
    calcul:
      '(Nombre de mises en relation aboutissant à une opportunité rémunérée / Nombre total de mises en relation) × 100.',
    sources: ['Enquêtes ciblées', 'Témoignages documentés', 'Registres de suivi'],
    frequence: 'À intervalles réguliers après les mises en relation.',
    precautions: [
      'Définir le délai d’observation',
      'Distinguer opportunité proposée, acceptée et effectivement commencée',
      'Clarifier la notion de rémunération',
    ],
    projetsConcernes: ['P17', 'P16', 'P15', 'nouveau projet emploi jeunesse'],
  },
  {
    code: 'C3',
    pilier: 'C',
    intitule: 'Emplois obtenus',
    definition: 'Nombre d’emplois ou de stages obtenus grâce à l’intermédiation OIF.',
    variables: [
      'Type d’opportunité',
      'Durée',
      'Rémunération',
      'Date de début',
      'Lien avec l’intermédiation',
    ],
    collecte:
      'Déclaration du bénéficiaire, complétée si possible par des données de plateforme ou des preuves légères.',
    calcul: 'Décompte du nombre d’emplois ou stages attribués au dispositif d’intermédiation.',
    sources: ['Enquêtes bénéficiaires', 'Plateforme', 'Pièces simples de confirmation'],
    frequence: 'Périodique.',
    precautions: [
      'Distinguer emploi, stage et autre opportunité',
      'Éviter les attributions abusives',
      'Préciser la durée de l’emploi ou du stage',
    ],
    projetsConcernes: ['P16', 'P17', 'P15', 'nouveau projet emploi jeunesse'],
  },
  {
    code: 'C4',
    pilier: 'C',
    intitule: 'Délai d’accès à l’opportunité',
    definition: 'Temps moyen entre inscription et obtention d’une opportunité.',
    variables: ['Date d’inscription', 'Date d’obtention de l’opportunité'],
    collecte: 'Collecte automatique ou semi-automatique à partir de la plateforme.',
    calcul: 'Somme des délais individuels divisée par le nombre de cas complets.',
    sources: ['Plateforme', 'Base de données de suivi'],
    frequence: 'En continu, avec consolidation périodique.',
    precautions: [
      'Vérifier la qualité des dates',
      'Exclure les cas incomplets',
      'Envisager aussi la médiane si les écarts sont très importants',
    ],
    projetsConcernes: ['P16', 'P17', 'nouveau projet emploi jeunesse'],
  },
  {
    code: 'C5',
    pilier: 'C',
    intitule: 'Satisfaction / utilité',
    definition: 'Pourcentage de jeunes déclarant que l’appui de l’OIF a été déterminant.',
    variables: [
      'Niveau de satisfaction',
      'Utilité perçue',
      'Rôle attribué à l’OIF',
      'Suggestions d’amélioration',
    ],
    collecte: 'Enquête de satisfaction standardisée.',
    calcul: '(Nombre de jeunes jugeant l’appui déterminant / Nombre total de répondants) × 100.',
    sources: ['Enquêtes bénéficiaires'],
    frequence: 'À la fin de l’activité et/ou lors du suivi.',
    precautions: [
      'Utiliser des échelles simples',
      'Distinguer satisfaction générale et utilité effective',
      'Éviter les questions orientées',
    ],
    projetsConcernes: ['P16', 'P17', 'P20', 'P15', 'P19', 'nouveau projet emploi jeunesse'],
  },

  // ─────────────────────────── CATÉGORIE D ───────────────────────────
  {
    code: 'D1',
    pilier: 'D',
    intitule: 'Cadres / dispositifs politiques emploi-jeunes appuyés',
    definition: 'Nombre de politiques, stratégies ou dispositifs bénéficiant de l’appui OIF.',
    variables: [
      'Intitulé du document ou dispositif',
      'Type',
      'Nature de la contribution OIF',
      'Niveau d’adoption',
      'Date',
    ],
    collecte: 'Revue documentaire et veille institutionnelle.',
    calcul:
      'Décompte des documents ou dispositifs ayant effectivement bénéficié d’un appui identifié.',
    sources: ['Textes officiels', 'Rapports', 'Notes techniques'],
    frequence: 'Selon l’évolution des dispositifs.',
    precautions: [
      'Distinguer appui à l’élaboration, appui à la validation et adoption effective',
      'Conserver des traces formelles de la contribution OIF',
    ],
    projetsConcernes: ['P9', 'P15', 'P17', 'P18', 'P20'],
  },
  {
    code: 'D2',
    pilier: 'D',
    intitule: 'Capacités institutionnelles emploi-jeunes renforcées',
    definition:
      'Pourcentage d’acteurs publics formés déclarant une amélioration de leurs pratiques.',
    variables: ['Type d’acteur', 'Compétences renforcées', 'Pratique modifiée', 'Usage effectif'],
    collecte: 'Enquête avant/après, complétée si besoin par des études de cas.',
    calcul:
      '(Nombre d’acteurs déclarant une amélioration / Nombre total d’acteurs formés interrogés) × 100.',
    sources: ['Enquêtes', 'Évaluations', 'Études de cas'],
    frequence: 'Après formation et lors de suivis.',
    precautions: [
      'Illustrer les changements par des exemples concrets',
      'Ne pas se limiter à l’auto-déclaration',
      'Distinguer amélioration perçue et changement effectif',
    ],
    projetsConcernes: ['P15', 'P17', 'P18', 'P20'],
  },
  {
    code: 'D3',
    pilier: 'D',
    intitule: 'Effets observables sur l’environnement',
    definition: 'Changements observables plausiblement liés aux appuis OIF.',
    variables: [
      'Type de changement observé',
      'Niveau d’observation',
      'Lien plausible avec l’appui',
      'Éléments de preuve ou de contexte',
    ],
    collecte: 'Analyse qualitative fondée sur des études de cas, observations et entretiens.',
    calcul: 'Pas de calcul standard ; documentation qualitative structurée.',
    sources: ['Études de cas', 'Rapports projets', 'Entretiens', 'Observations'],
    frequence: 'Périodique, selon l’avancement des projets.',
    precautions: [
      'Distinguer contribution et attribution',
      'Ne pas généraliser abusivement',
      'Privilégier des changements concrets, vérifiables et bien décrits',
    ],
    projetsConcernes: ['P9', 'P15', 'P17', 'P18', 'P19', 'P20'],
  },

  // ─────────────────────────── MARQUEUR F ────────────────────────────
  {
    code: 'F1',
    pilier: 'F',
    intitule: 'Apport du français à l’employabilité',
    definition:
      'Pourcentage de bénéficiaires déclarant que le français a facilité l’accès ou l’amélioration de l’emploi.',
    variables: [
      'Niveau de français avant et après',
      'Usage professionnel du français',
      'Utilité perçue du français',
      'Lien avec l’accès à l’emploi ou à l’activité',
    ],
    collecte: 'Auto-déclaration standardisée, éventuellement complétée par un test léger.',
    calcul:
      '(Nombre de bénéficiaires déclarant un effet positif du français / Nombre total de bénéficiaires interrogés) × 100.',
    sources: ['Enquêtes bénéficiaires', 'Tests légers le cas échéant'],
    frequence: 'Après la formation et lors du suivi d’insertion.',
    precautions: [
      'Ne pas confondre employabilité et emploi effectivement obtenu',
      'Compléter si possible par des exemples concrets',
      'Distinguer amélioration linguistique et usage réel dans le travail',
    ],
    projetsConcernes: ['Tous les projets'],
  },
];

/**
 * Helpers de navigation : retourne l'indicateur précédent / suivant dans
 * l'ordre d'affichage (A1 → A2 → … → A5 → B1 → … → F1).
 */
export function indicateurParCode(code: string): Indicateur | undefined {
  return INDICATEURS.find((i) => i.code.toLowerCase() === code.toLowerCase());
}

export function indicateurPrecedent(code: string): Indicateur | undefined {
  const idx = INDICATEURS.findIndex((i) => i.code === code);
  return idx > 0 ? INDICATEURS[idx - 1] : undefined;
}

export function indicateurSuivant(code: string): Indicateur | undefined {
  const idx = INDICATEURS.findIndex((i) => i.code === code);
  return idx >= 0 && idx < INDICATEURS.length - 1 ? INDICATEURS[idx + 1] : undefined;
}

export function indicateursParPilier(code: CodePilier): Indicateur[] {
  return INDICATEURS.filter((i) => i.pilier === code);
}

/**
 * Projets emblématiques de l'OIF (V2.4 — placeholder enrichi à mesure
 * que des libellés complets sont ajoutés à `projets.libelle` en BDD).
 *
 * Codes issus du Cadre Commun (P9, P14-P20) — projets actifs sur la
 * thématique emploi-jeunes.
 */
export type ProjetEmblematique = {
  code: string;
  libelle: string;
  description: string;
  thematique: string;
  pilierPrincipal: CodePilier;
};

export const PROJETS_EMBLEMATIQUES: ProjetEmblematique[] = [
  {
    code: 'P14',
    libelle: 'Appui à l’entrepreneuriat des jeunes',
    description:
      'Programme d’appui financier et technique aux jeunes porteurs de projets d’AGR et micro-entreprises.',
    thematique: 'Entrepreneuriat',
    pilierPrincipal: 'B',
  },
  {
    code: 'P15',
    libelle: 'Innovations vertes et économie durable',
    description:
      'Projets d’insertion économique des jeunes dans les filières agriculture durable, énergies renouvelables et économie circulaire.',
    thematique: 'Économie verte',
    pilierPrincipal: 'A',
  },
  {
    code: 'P16',
    libelle: 'D-CLIC PRO — Formation aux métiers du numérique',
    description:
      'Programme phare de formation des jeunes francophones aux métiers du numérique, de l’innovation et de la création de contenus.',
    thematique: 'Numérique',
    pilierPrincipal: 'A',
  },
  {
    code: 'P17',
    libelle: 'Mises en relation économiques et commerciales',
    description:
      'Rencontres B2B, événements professionnels et plateformes d’intermédiation pour connecter jeunes francophones et opportunités.',
    thematique: 'Intermédiation',
    pilierPrincipal: 'C',
  },
  {
    code: 'P18',
    libelle: 'Renforcement institutionnel emploi-jeunes',
    description:
      'Appui aux ministères et institutions publiques en charge des politiques emploi-jeunes des États membres.',
    thematique: 'Gouvernance',
    pilierPrincipal: 'D',
  },
  {
    code: 'P19',
    libelle: 'Insertion professionnelle des jeunes diplômés',
    description:
      'Dispositifs d’accompagnement des jeunes diplômés sans emploi vers une insertion durable.',
    thematique: 'Insertion',
    pilierPrincipal: 'A',
  },
  {
    code: 'P20',
    libelle: 'Tourisme, accueil et services francophones',
    description:
      'Formation et insertion dans les métiers du tourisme, de l’accueil et des services dans l’espace francophone.',
    thematique: 'Tourisme',
    pilierPrincipal: 'A',
  },
  {
    code: 'P9',
    libelle: 'Plaidoyer politiques publiques jeunesse',
    description:
      'Soutien aux politiques publiques jeunesse et aux dialogues nationaux sur l’employabilité.',
    thematique: 'Plaidoyer',
    pilierPrincipal: 'D',
  },
];
