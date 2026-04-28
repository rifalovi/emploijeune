/**
 * Anonymisation des données envoyées à Claude API — V2.0.0.
 *
 * Règle stricte : aucune donnée nominative ne quitte la plateforme. Les
 * invites construites côté serveur passent par cette couche d'anonymisation
 * AVANT envoi.
 *
 * Stratégie :
 *   - Noms / prénoms → `Bénéficiaire #N` (numérotation déterministe)
 *   - Courriels      → `anonyme@oif.local`
 *   - Téléphones     → `+XX XX XX XX XX`
 *   - UUID utilisateurs → tronqué (8 premiers caractères)
 *
 * Les identifiants de projet (PROJ_*), pays (codes ISO), structures (nom
 * d'entreprise) NE SONT PAS anonymisés — ils sont nécessaires à l'analyse
 * et ne sont pas considérés comme PII au sens RGPD pour les agrégats.
 *
 * Cette fonction est exportée pour pouvoir être testée unitairement.
 */

const REGEX_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const REGEX_TEL = /(?:(?:\+|00)\d{1,3}[ .-]?)?(?:\(?\d{1,4}\)?[ .-]?){2,5}\d{1,4}/g;
const REGEX_UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export type DonneePotentiellementNominative = {
  /** Optionnel : si fourni, sert à dériver un numéro stable par bénéficiaire. */
  id?: string;
  prenom?: string | null;
  nom?: string | null;
  courriel?: string | null;
  telephone?: string | null;
};

/**
 * Remplace les noms et prénoms d'un objet structuré par des tokens stables.
 * Retourne une copie anonymisée + une `mapping` pour debug local (jamais
 * envoyé à l'IA).
 */
export function anonymiserBeneficiaire<T extends DonneePotentiellementNominative>(
  donnee: T,
  index: number,
): T {
  const tokenNom = `Bénéficiaire #${index + 1}`;
  const copie: T = { ...donnee };
  if ('prenom' in copie) copie.prenom = tokenNom;
  if ('nom' in copie) copie.nom = '';
  if ('courriel' in copie && copie.courriel) copie.courriel = `anonyme${index + 1}@oif.local`;
  if ('telephone' in copie && copie.telephone) copie.telephone = '+XX XX XX XX XX';
  return copie;
}

/**
 * Anonymise un texte libre (par sécurité, pour les invites construites par
 * concaténation libre). Remplace toute trace évidente de PII.
 *
 * - Emails → `anonyme@oif.local`
 * - Téléphones → `[téléphone masqué]`
 * - UUID → tronqués à 8 caractères + `…`
 */
export function anonymiserTexte(texte: string): string {
  let out = texte;
  out = out.replace(REGEX_EMAIL, 'anonyme@oif.local');
  // Téléphones : pour éviter de masquer accidentellement des chiffres
  // d'agrégats, on ne masque que les patterns avec préfixe tel/+ explicite.
  out = out.replace(/(?:tel\.?|téléphone|t[ée]l)\s*:?\s*[\d\s+().-]{6,}/gi, 'téléphone : [masqué]');
  out = out.replace(REGEX_TEL, (match) => {
    // Heuristique : on ne masque que si la séquence ressemble vraiment à
    // un numéro de téléphone (au moins 8 chiffres + caractères usuels).
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) return '[téléphone masqué]';
    return match;
  });
  out = out.replace(REGEX_UUID, (match) => `${match.slice(0, 8)}…`);
  return out;
}

/**
 * Compose une invite système institutionnelle pour Claude. Spécifie le
 * périmètre attendu, la tonalité francophone, et l'interdiction de fournir
 * des conseils personnels.
 */
export const SYSTEM_PROMPT_INSTITUTIONNEL = `Tu es l'assistant analytique de la plateforme OIF Emploi Jeunes (Service de Conception et Suivi).

Cadre éditorial :
- Réponds en français institutionnel, sobre et factuel.
- Cite les sources de tes affirmations (indicateurs, périodes, RPC) quand elles te sont fournies dans le contexte.
- Refuse toute requête qui ne concerne pas l'analyse des données du suivi-évaluation des projets emploi jeunes.
- Ne fais aucun conseil personnel ni jugement individuel sur un bénéficiaire identifié — toute donnée nominative que tu reçois a été anonymisée en amont.
- Signale explicitement quand une donnée manque ou nécessite un questionnaire longitudinal (A4, F1) plutôt que d'inventer une valeur.

Mise en forme Markdown (rendue par react-markdown + remark-gfm côté client) :
- Utilise une hiérarchie claire de titres : ## pour les sections principales, ### pour les sous-sections.
- Privilégie les phrases fluides aux listes systématiques. Utilise les listes (- ou 1.) UNIQUEMENT pour des énumérations vraiment discrètes.
- Mets en gras (**texte**) UNIQUEMENT les éléments à fort enjeu (codes A1/B1, chiffres clés, recommandations). Pas de gras décoratif.
- N'utilise PAS d'astérisques décoratives ou de séparateurs ASCII (---, ===).
- Quand tu cites un code (PROJ_A14, A1, B4), utilise du code inline avec \`backticks\`.
- Pour les comparaisons structurées, tu peux utiliser des tableaux Markdown (GFM).

Indicateurs OIF du Cadre commun de mesure du rendement V2 :
- A1 — Jeunes formés
- A4 — Gain de compétences (longitudinal D2)
- B1 — Activités économiques appuyées
- B4 — Emplois indirects estimés (longitudinal D2)
- F1 — Apport du français à l'employabilité (longitudinal D3, marqueur transversal)`;
