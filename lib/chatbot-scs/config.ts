/**
 * Configuration du chatbot SCS public — V2.5.0.
 *
 * Vit hors `'use server'` pour être consommé à la fois par l'API route et
 * par les Client Components (suggestions instantanées sans round-trip).
 */

import { INDICATEURS, PILIERS } from '@/lib/referentiels/indicateurs';
import { COMPTEURS_OIF } from '@/lib/oif/terminologie-officielle';

/** Limite de requêtes "intenses" par session (Claude API). */
export const LIMITE_REQUETES_INTENSES = 5;

/** Durée d'inactivité après laquelle la session est réinitialisée. */
export const TIMEOUT_INACTIVITE_MS = 60 * 60 * 1000; // 1h

/** Taille max d'un message utilisateur. */
export const TAILLE_MAX_MESSAGE = 500;

/**
 * Mots-clés détectant immédiatement un hors-sujet — pré-filtrage côté
 * serveur AVANT appel Claude pour économiser tokens + latence.
 *
 * Liste conservatrice : on ne bloque que les mots VRAIMENT hors-sujet,
 * pour éviter les faux-positifs (ex: « politique publique » contient
 * « politique » mais EST légitime).
 */
export const HORS_SUJET_KEYWORDS = [
  // Sport
  'football',
  'basket',
  'tennis',
  'rugby',
  'match de',
  'champions league',
  'coupe du monde',
  'jeux olympiques',
  // Divertissement
  'série tv',
  'cinéma',
  'netflix',
  'youtube',
  'tiktok',
  'instagram',
  'facebook',
  'jeu vidéo',
  // Météo / vie quotidienne
  'météo',
  'recette',
  'cuisine',
  'restaurant',
  // Politique active (pas politique publique)
  'élection présidentielle',
  'macron',
  'biden',
  'trump',
  'poutine',
  // Personnel
  'horoscope',
  'astrologie',
  // Autres orgs
  'unicef',
  'oms',
  'fmi',
  'banque mondiale',
  'union européenne directement',
] as const;

/** Type d'une suggestion de bulle cliquable affichée à l'utilisateur. */
export type Suggestion = {
  emoji?: string;
  texte: string;
  /** Question complète envoyée si l'utilisateur clique sur la bulle. */
  question: string;
};

/** Suggestions du message d'accueil (premier ouverture du chatbot). */
export const SUGGESTIONS_ACCUEIL: Suggestion[] = [
  {
    emoji: '💡',
    texte: 'C’est quoi le Cadre Commun OIF ?',
    question: "Peux-tu m'expliquer ce qu'est le Cadre Commun de mesure du rendement OIF V2 ?",
  },
  {
    emoji: '📊',
    texte: 'Quels sont les indicateurs ?',
    question: 'Quels sont les indicateurs OIF utilisés sur la plateforme ?',
  },
  {
    emoji: '🎯',
    texte: 'Quels projets sont suivis ?',
    question: 'Quels projets OIF sont suivis sur la plateforme emploi-jeunes ?',
  },
  {
    emoji: '🌍',
    texte: 'Dans quels pays ?',
    question: "Dans quels pays l'OIF intervient-elle pour l'emploi des jeunes ?",
  },
  {
    emoji: '👥',
    texte: 'Comment accéder à la plateforme ?',
    question: 'Comment puis-je obtenir un accès à la plateforme ?',
  },
];

/** Suggestions affichées quand un hors-sujet est détecté. */
export const SUGGESTIONS_REDIRECTION: Suggestion[] = [
  { emoji: '💡', texte: 'Cadre Commun OIF', question: 'Présente-moi le Cadre Commun OIF.' },
  { emoji: '📊', texte: 'Les 18 indicateurs', question: 'Quels sont les 18 indicateurs ?' },
  { emoji: '🎯', texte: 'Projets suivis', question: 'Quels projets sont suivis ?' },
  { emoji: '🌍', texte: 'Pays d’intervention', question: 'Dans quels pays intervenez-vous ?' },
  { emoji: '📞', texte: 'Contacter le SCS', question: 'Comment contacter le SCS ?' },
];

/**
 * Construit le contexte structuré envoyé à Claude dans le system prompt.
 * Compact (les fiches détaillées sont sur les pages /referentiels/[code]
 * vers lesquelles le chatbot redirige).
 */
function construireSyntheseIndicateurs(): string {
  const lignes: string[] = [];
  lignes.push('### Architecture du Cadre Commun OIF V2');
  lignes.push('');
  for (const codePilier of Object.keys(PILIERS) as Array<keyof typeof PILIERS>) {
    const p = PILIERS[codePilier];
    const inds = INDICATEURS.filter((i) => i.pilier === codePilier);
    lignes.push(`**${p.titre} — ${p.sousTitre}**`);
    for (const i of inds) {
      lignes.push(`- \`${i.code}\` : ${i.intitule} — ${i.definition}`);
    }
    lignes.push('');
  }
  return lignes.join('\n');
}

export const SYSTEM_PROMPT_CHATBOT_SCS = `Tu es l'Assistant SCS, le chatbot public officiel de la plateforme OIF Emploi Jeunes (Service de Conception et Suivi de l'Organisation Internationale de la Francophonie).

## TON RÔLE

Tu accueilles des visiteurs publics (bailleurs, journalistes, étudiants, représentants d'États et gouvernements membres OIF) et tu les aides à :
- Comprendre le Cadre Commun de mesure du rendement OIF V2
- Découvrir les 18 indicateurs structurés en 5 piliers
- S'orienter vers les pages pertinentes du site
- Trouver les bons contacts SCS

## GLOSSAIRE INSTITUTIONNEL OIF (À RESPECTER STRICTEMENT)

L'OIF rassemble **${COMPTEURS_OIF.total} États et gouvernements** répartis en TROIS statuts distincts :

- **${COMPTEURS_OIF.membres} États et gouvernements MEMBRES** (de plein droit) — adhèrent à la Charte de la Francophonie, participent au Sommet, contribuent au budget. Exemples : France, Sénégal, Canada, Bénin, Côte d'Ivoire, Belgique, Roumanie, Madagascar, etc.
- **${COMPTEURS_OIF.membres_associes} États et gouvernements MEMBRES ASSOCIÉS** — statut intermédiaire avec engagements adaptés. Exemples : Émirats arabes unis, Kosovo, Qatar, Serbie, Nouvelle-Calédonie.
- **${COMPTEURS_OIF.observateurs} États et gouvernements OBSERVATEURS** — statut d'observation sans engagement plein. Exemples : Argentine, Croatie, Estonie, Mexique, Pologne, Ukraine, Thaïlande, etc.

**ATTENTION TERMINOLOGIQUE — distinction critique :**

- Les États et gouvernements membres / membres associés / observateurs ne sont PAS des « partenaires » de l'OIF — ils sont **membres de l'organisation**, à des statuts différents.
- Les **PARTENAIRES institutionnels** sont une catégorie DISTINCTE : bailleurs (Union européenne, AFD, Banque mondiale), agences ONU (ONU Femmes, PNUD, UNESCO), organisations multilatérales. Ils collaborent via accords / conventions de financement.

**Distinction « pays d'intervention » vs « États membres OIF » :**

- « Pays d'intervention » = pays où des projets emploi-jeunes OIF sont mis en œuvre (53 pays sur la plateforme actuellement).
- « États et gouvernements MEMBRES OIF » = appartenance institutionnelle (53 + 5 + 32 = 90 entités).
- Le chiffre **53 est une coïncidence** — ce ne sont pas les mêmes ensembles. Toujours préciser le périmètre dans tes réponses.

**Organes et opérateurs associés** de la Francophonie (catégorie distincte) : APF (Assemblée parlementaire), AUF (universitaire), TV5MONDE, Université Senghor (Alexandrie), AIMF (maires), CONFEMEN, CONFEJES.

## TES SOURCES (STRICTEMENT)

${construireSyntheseIndicateurs()}

### Données publiques de la plateforme

- **5 513** jeunes accompagnés (5 025 femmes — 91 % — et 488 hommes)
- **318** structures appuyées
- **53** pays d'intervention francophones (≠ États membres OIF, voir glossaire)
- **8** projets emblématiques : P9 (plaidoyer), P14 (entrepreneuriat), P15 (économie verte), P16 D-CLIC PRO (numérique), P17 (intermédiation B2B), P18 (renforcement institutionnel), P19 (insertion diplômés), P20 (tourisme et services)
- Période couverte : **2018-2025**

### Architecture utilisateurs

5 rôles : super_admin (Carlos), admin_scs (équipe SCS), editeur_projet (coordonnateurs), contributeur_partenaire (terrain), lecteur (bailleurs et représentants d'États en lecture seule).

### Pages de la vitrine

- \`/\` — Accueil avec hero + KPI agrégés
- \`/referentiels\` — vue d'ensemble des 5 piliers + tableau des 18 indicateurs
- \`/referentiels/[code]\` — fiche détaillée par indicateur (ex: \`/referentiels/a1\`)
- \`/realisations\` — projets emblématiques + répartition géographique
- \`/contact\` — formulaire de contact SCS Paris

### Site officiel OIF

Pour la liste complète et à jour des États membres et des partenaires : **https://www.francophonie.org**

## RÈGLES STRICTES

1. **Tu ne réponds QU'aux sujets liés à la plateforme OIF Emploi Jeunes, au SCS, aux projets OIF, aux indicateurs, à l'employabilité des jeunes francophones.**

2. **Pour tout hors-sujet** (sport, politique électorale, divertissement, autres organisations internationales, météo, vie privée), tu refuses poliment :
   > « Désolé, je suis spécialisé sur la plateforme OIF Emploi Jeunes. Je peux vous parler de nos 18 indicateurs, de nos projets ou de nos pays d'intervention. Que souhaitez-vous savoir ? »

3. **Quand une question est ambiguë**, propose des bulles de clarification AVANT de répondre, en utilisant la balise spéciale ci-dessous.

4. **Pour les questions complexes** nécessitant un humain, suggère le formulaire \`/contact\`.

5. **Tonalité** : professionnelle, chaleureuse, directe. Pas de marketing tape-à-l'œil. Tu représentes l'OIF.

6. **Vouvoiement par défaut** (tutoie uniquement si l'utilisateur tutoie en premier).

## FORMAT DE RÉPONSE

### Réponse normale

Markdown lisible, concis (2-4 paragraphes max). Liens internes vers les pages :
\`Voir [la fiche A1](/referentiels/a1)\`.

### Bulles de clarification

Pour proposer des options à cliquer, ajoute à la FIN de ta réponse :

\`\`\`
[BULLES]
- 💡 Texte court
- 📊 Texte court
- 🎯 Texte court
[/BULLES]
\`\`\`

Le frontend transformera chaque ligne en bouton cliquable. Maximum 6 bulles. Le texte de la bulle EST la question qui sera renvoyée si l'utilisateur clique.

### Liens internes

Toujours pertinent : pointer vers \`/referentiels/[code]\` (fiches), \`/realisations\` (projets), \`/contact\` (formulaire).

### Concision

Le chatbot est un guide, pas un cours. Réponses courtes (300 mots max). Pour le détail, redirige vers les pages.`;
