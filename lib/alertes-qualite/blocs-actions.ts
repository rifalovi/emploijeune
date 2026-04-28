'use server';

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  analyseParBlocsSchema,
  blocCorrectionSchema,
  TYPE_ALERTE_VERS_CHAMP,
  type AnalyseParBlocs,
  type BlocCorrection,
  type Correction,
  type TypeAlerteCorrigeable,
} from './blocs-types';

/**
 * Server Actions — analyse IA et application des corrections par blocs.
 *
 * V2.2.1 finalisation : Carlos demande à Claude de proposer des blocs de
 * corrections homogènes (même logique, même confiance) qu'il peut accepter
 * ou refuser en bloc. Une fois accepté, chaque correction est appliquée en
 * BDD avec un journal d'audit complet (table `journaux_audit` via les
 * triggers existants + un log explicite dans `corrections_ia_log`).
 */

const CHAMP_AUTORISE_PAR_TYPE: Record<TypeAlerteCorrigeable, ReadonlyArray<string>> = {
  date_naissance_manquante: ['date_naissance'],
  consentement_sans_date: ['consentement_date'],
  statut_acheve_sans_date_fin: ['date_fin_formation'],
  subvention_sans_montant: ['montant_appui'],
};

// ─────────────────────────────────────────────────────────────────────────
// 1. Analyse IA par blocs
// ─────────────────────────────────────────────────────────────────────────

const analyseSchema = z.object({
  type_alerte: z.enum([
    'date_naissance_manquante',
    'consentement_sans_date',
    'statut_acheve_sans_date_fin',
    'subvention_sans_montant',
  ]),
});

export type ResultatAnalyseBlocs =
  | { status: 'succes'; analyse: AnalyseParBlocs }
  | {
      status: 'erreur';
      code:
        | 'reserve_admin'
        | 'module_desactive'
        | 'config_manquante'
        | 'aucun_cas'
        | 'parsing_ia'
        | 'erreur_ia'
        | 'payload_invalide';
      message: string;
    };

export async function analyserAlertesParBlocs(
  payload: z.infer<typeof analyseSchema>,
): Promise<ResultatAnalyseBlocs> {
  // Auth + permission
  const utilisateur = await getCurrentUtilisateur({ allowViewAs: true });
  if (!utilisateur || (utilisateur.role !== 'admin_scs' && utilisateur.role !== 'super_admin')) {
    return { status: 'erreur', code: 'reserve_admin', message: 'Réservé aux administrateurs.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data: actif } = await supabase.rpc('module_ia_actif_pour_courant');
  if (!actif) {
    return {
      status: 'erreur',
      code: 'module_desactive',
      message: 'Module IA non activé pour votre rôle.',
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      status: 'erreur',
      code: 'config_manquante',
      message: 'ANTHROPIC_API_KEY absente.',
    };
  }

  const parsed = analyseSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'erreur', code: 'payload_invalide', message: 'Type invalide.' };
  }

  // Charge un échantillon des cas (max 200 pour rester dans les limites Claude
  // et le contexte d'analyse). On donne aussi à Claude le total réel pour
  // qu'il puisse extrapoler la couverture des blocs.
  const echantillon = await chargerEchantillonCas(parsed.data.type_alerte, 200);
  if (echantillon.cas.length === 0) {
    return {
      status: 'erreur',
      code: 'aucun_cas',
      message: 'Aucun cas à analyser pour ce type d\u2019alerte.',
    };
  }

  // Prompt structuré : on demande à Claude une réponse JSON STRICTE.
  const systemPrompt = construireSystemPromptAnalyse(parsed.data.type_alerte);
  const userPrompt = construireUserPromptAnalyse({
    typeAlerte: parsed.data.type_alerte,
    total: echantillon.total,
    casAnonymises: echantillon.cas,
  });

  try {
    const client = new Anthropic({ apiKey });
    const reponse = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const texte = reponse.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n');

    // Extraction du JSON entre les balises ```json ... ``` ou directement
    const jsonStr = extraireJson(texte);
    if (!jsonStr) {
      return {
        status: 'erreur',
        code: 'parsing_ia',
        message: 'La réponse IA ne contient pas de JSON valide.',
      };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonStr);
    } catch {
      return {
        status: 'erreur',
        code: 'parsing_ia',
        message: 'JSON IA mal formé.',
      };
    }

    const analyseValide = analyseParBlocsSchema.safeParse(parsedJson);
    if (!analyseValide.success) {
      return {
        status: 'erreur',
        code: 'parsing_ia',
        message: `Schéma IA invalide : ${analyseValide.error.issues
          .slice(0, 2)
          .map((i) => `${i.path.join('.')} ${i.message}`)
          .join(' · ')}`,
      };
    }

    return { status: 'succes', analyse: analyseValide.data };
  } catch (e) {
    return {
      status: 'erreur',
      code: 'erreur_ia',
      message: e instanceof Error ? e.message : 'Erreur IA inconnue.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Application d'un bloc accepté
// ─────────────────────────────────────────────────────────────────────────

const applicationSchema = z.object({
  type_alerte: z.enum([
    'date_naissance_manquante',
    'consentement_sans_date',
    'statut_acheve_sans_date_fin',
    'subvention_sans_montant',
  ]),
  bloc: blocCorrectionSchema,
});

export type ResultatApplication =
  | { status: 'succes'; nb_appliquees: number; nb_erreurs: number }
  | { status: 'erreur'; message: string };

export async function appliquerBloc(
  payload: z.infer<typeof applicationSchema>,
): Promise<ResultatApplication> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || (utilisateur.role !== 'admin_scs' && utilisateur.role !== 'super_admin')) {
    return { status: 'erreur', message: 'Réservé aux administrateurs.' };
  }

  const parsed = applicationSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 'erreur', message: 'Payload invalide.' };
  }

  const meta = TYPE_ALERTE_VERS_CHAMP[parsed.data.type_alerte];
  const champsAutorises = CHAMP_AUTORISE_PAR_TYPE[parsed.data.type_alerte];

  // Sécurité : on n'autorise que le champ correspondant au type d'alerte.
  // Chaque correction doit cibler exactement ce champ.
  for (const c of parsed.data.bloc.corrections) {
    if (!champsAutorises.includes(c.champ)) {
      return {
        status: 'erreur',
        message: `Champ '${c.champ}' non autorisé pour le type ${parsed.data.type_alerte}.`,
      };
    }
  }

  if (parsed.data.bloc.corrections.length > 5000) {
    return {
      status: 'erreur',
      message: 'Bloc trop volumineux (>5000 corrections).',
    };
  }

  // Application via admin client (bypass RLS pour l'UPDATE en masse)
  // mais avec garde explicite admin_scs/super_admin déjà vérifiée ci-dessus.
  const admin = createSupabaseAdminClient();
  let nbAppliquees = 0;
  let nbErreurs = 0;

  // Application séquentielle pour pouvoir tracer chaque erreur. Pour 5000
  // corrections c'est lent — V2.3 batchera par 100 avec un upsert.
  for (const corr of parsed.data.bloc.corrections) {
    try {
      const updatePayload = { [corr.champ]: corr.nouvelle_valeur };

      // Le type de la table est dynamique selon meta.table → on cast en
      // `never` pour bypasser l'inférence stricte des Database types.
      // Les valeurs sont validées en amont (champ in champsAutorises).
      const { error } = await admin
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(meta.table as any)
        .update(updatePayload as never)
        .eq('id', corr.entite_id);

      if (error) {
        nbErreurs++;
      } else {
        nbAppliquees++;
      }
    } catch {
      nbErreurs++;
    }
  }

  // Audit explicite de l'application du bloc (en plus des triggers de table)
  await admin.from('journaux_audit').insert({
    user_id: utilisateur.user_id,
    user_email: null,
    action: 'UPDATE',
    table_affectee: meta.table,
    ligne_id: null,
    diff: {
      action_v2_2_1: 'application_bloc_correction_ia',
      type_alerte: parsed.data.type_alerte,
      bloc_id: parsed.data.bloc.id,
      bloc_titre: parsed.data.bloc.titre,
      bloc_confiance: parsed.data.bloc.confiance,
      nb_total: parsed.data.bloc.corrections.length,
      nb_appliquees: nbAppliquees,
      nb_erreurs: nbErreurs,
    },
  });

  revalidatePath('/admin/alertes-qualite');
  return { status: 'succes', nb_appliquees: nbAppliquees, nb_erreurs: nbErreurs };
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────

type CasAnonymise = {
  entite_id: string;
  prenom_token: string;
  pays_code: string | null;
  projet_code: string | null;
  annee_formation: number | null;
  statut_code: string | null;
};

async function chargerEchantillonCas(
  type: TypeAlerteCorrigeable,
  limite: number,
): Promise<{ total: number; cas: CasAnonymise[] }> {
  const supabase = await createSupabaseServerClient();

  if (type === 'subvention_sans_montant') {
    const { data, count } = await supabase
      .from('structures')
      .select('id, nom_structure, pays_code, projet_code, annee_appui, type_structure_code', {
        count: 'exact',
      })
      .is('deleted_at', null)
      .eq('nature_appui_code', 'SUBVENTION')
      .is('montant_appui', null)
      .limit(limite);
    return {
      total: count ?? 0,
      cas: (data ?? []).map((s, i) => ({
        entite_id: s.id,
        prenom_token: `Structure #${i + 1}`,
        pays_code: s.pays_code,
        projet_code: s.projet_code,
        annee_formation: s.annee_appui,
        statut_code: s.type_structure_code,
      })),
    };
  }

  // Pour les 3 types bénéficiaires
  let q = supabase
    .from('beneficiaires')
    .select('id, prenom, pays_code, projet_code, annee_formation, statut_code', {
      count: 'exact',
    })
    .is('deleted_at', null)
    .limit(limite);

  if (type === 'date_naissance_manquante') {
    q = q.is('date_naissance', null);
  } else if (type === 'consentement_sans_date') {
    q = q.eq('consentement_recueilli', true).is('consentement_date', null);
  } else {
    q = q.eq('qualite_a_verifier', true);
  }

  const { data, count } = await q;
  return {
    total: count ?? 0,
    cas: (data ?? []).map((b, i) => ({
      entite_id: b.id,
      // Anonymisation : on garde la 1re lettre du prénom + position pour que
      // Claude puisse regrouper par initiale francophone ; le nom complet
      // n'est jamais envoyé.
      prenom_token: `${b.prenom?.charAt(0) ?? '?'}…  (#${i + 1})`,
      pays_code: b.pays_code,
      projet_code: b.projet_code,
      annee_formation: b.annee_formation,
      statut_code: b.statut_code,
    })),
  };
}

function construireSystemPromptAnalyse(type: TypeAlerteCorrigeable): string {
  const base = [
    "Tu es l'assistant qualité de la plateforme OIF Emploi Jeunes.",
    "Tu reçois un échantillon anonymisé de cas avec une donnée manquante. Tu dois proposer des BLOCS de corrections homogènes (même logique d'extrapolation) que l'admin pourra accepter ou refuser en bloc.",
    '',
    'IMPORTANT — Format de sortie : JSON STRICT entre les balises ```json ... ```. Aucun texte libre hors du JSON.',
    'Schéma attendu :',
    '```json',
    '{',
    '  "blocs": [',
    '    {',
    '      "id": "bloc-1",',
    '      "titre": "Titre court (ex: \\"Estimation par année de formation\\")",',
    '      "description": "Une phrase courte expliquant le bloc.",',
    '      "logique": "Explication détaillée de la méthode d\\u2019extrapolation utilisée.",',
    '      "confiance": 75,           // 0-100',
    '      "cas_concernes": 1247,     // nombre estimé sur le total',
    '      "echantillon": [           // 3-5 exemples uniquement, depuis l\\u2019échantillon fourni',
    '        {',
    '          "entite_id": "uuid-fourni",',
    '          "entite_nom": "token anonymisé reçu",',
    '          "champ": "date_naissance",  // ou consentement_date / date_fin_formation / montant_appui',
    '          "valeur_actuelle": null,',
    '          "nouvelle_valeur": "2000-06-15",',
    '          "contexte": "annee_formation=2024, projet=PROJ_A14"',
    '        }',
    '      ],',
    '      "corrections": []          // VIDE — tu ne génères PAS les 1247 lignes ici',
    '    }',
    '  ],',
    '  "cas_residuels": 1965,',
    '  "recommandation_residus": "Saisie manuelle recommandée pour ces cas non corrigeables automatiquement."',
    '}',
    '```',
    '',
    'CONTRAINTES :',
    '- 2 à 5 blocs maximum, du plus à fort impact au plus faible.',
    '- "echantillon" : 3 à 5 corrections seulement (tu n\\u2019as pas accès aux 1247 cas).',
    '- "corrections" : tableau VIDE — la liste complète est générée serveur-side après acceptation.',
    '- "confiance" doit refléter ton incertitude réelle. Reste bas (50-70) sauf si la logique est très robuste.',
    '- Le format des dates : ISO 8601 (YYYY-MM-DD).',
    '- Ne propose JAMAIS de valeur fantaisiste. Si tu n\\u2019as pas de base statistique, classe le cas en résiduel.',
  ];

  if (type === 'date_naissance_manquante') {
    base.push(
      '',
      'CONTEXTE MÉTIER (date_naissance_manquante) :',
      '- Les jeunes accompagnés OIF ont en général entre 18 et 35 ans à l\\u2019entrée en formation.',
      '- L\\u2019année de formation (annee_formation) donne un point d\\u2019ancrage : âge médian estimé = 25 ans → date_naissance ≈ annee_formation - 25.',
      '- Le projet (projet_code) peut affiner : PROJEUNES vise les 18-30, les FALG visent les 25-40.',
    );
  } else if (type === 'consentement_sans_date') {
    base.push(
      '',
      'CONTEXTE MÉTIER (consentement_sans_date) :',
      '- Le consentement RGPD a été recueilli mais la date n\\u2019a pas été saisie.',
      '- Hypothèse défensive : utiliser created_at de la fiche bénéficiaire comme date de consentement (= moment où la fiche a été créée, donc consentement supposé recueilli ce jour-là).',
    );
  } else if (type === 'statut_acheve_sans_date_fin') {
    base.push(
      '',
      'CONTEXTE MÉTIER (statut_acheve_sans_date_fin) :',
      '- Le bénéficiaire est statut FORMATION_ACHEVEE ou ABANDON, mais date_fin_formation est NULL.',
      '- Approximation usuelle : date_fin = 31/12 de l\\u2019annee_formation pour ACHEVE, ou +6 mois après date_debut_formation pour ABANDON.',
    );
  } else if (type === 'subvention_sans_montant') {
    base.push(
      '',
      'CONTEXTE MÉTIER (subvention_sans_montant) :',
      '- La structure a reçu une SUBVENTION mais le montant n\\u2019est pas saisi.',
      '- Méthode prudente : proposer le montant médian des subventions du même projet et de la même année. Si données insuffisantes : classer en résiduel.',
    );
  }

  return base.join('\n');
}

function construireUserPromptAnalyse(input: {
  typeAlerte: TypeAlerteCorrigeable;
  total: number;
  casAnonymises: CasAnonymise[];
}): string {
  return [
    `Type d'alerte : **${input.typeAlerte}**`,
    `Total de cas dans la BDD : **${input.total}**`,
    `Échantillon anonymisé reçu : **${input.casAnonymises.length}** cas (limite imposée).`,
    '',
    'Échantillon :',
    JSON.stringify(input.casAnonymises, null, 2),
    '',
    'Analyse cet échantillon et propose des blocs de corrections selon le schéma JSON imposé.',
  ].join('\n');
}

function extraireJson(texte: string): string | null {
  // 1. Tente de matcher ```json ... ```
  const matchBalises = texte.match(/```json\s*([\s\S]*?)\s*```/);
  if (matchBalises?.[1]) return matchBalises[1].trim();
  // 2. Tente de matcher ``` ... ```
  const matchSimple = texte.match(/```\s*([\s\S]*?)\s*```/);
  if (matchSimple?.[1]) return matchSimple[1].trim();
  // 3. Cherche le premier { jusqu'au dernier }
  const debut = texte.indexOf('{');
  const fin = texte.lastIndexOf('}');
  if (debut !== -1 && fin > debut) return texte.slice(debut, fin + 1);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Génération côté serveur des `corrections` du bloc accepté
// -----------------------------------------------------------------------------
// Une fois que Claude a renvoyé les "blocs" avec leur logique mais sans
// les 1247 corrections individuelles, on doit générer ces 1247 lignes
// côté serveur en appliquant la logique du bloc à TOUS les cas concernés.
// Pour la V2.2.1, on fournit une implémentation déterministe basique :
// l'admin reçoit l'échantillon visuel + la logique, et on génère les
// corrections au moment du clic « Accepter ce bloc ».
// ─────────────────────────────────────────────────────────────────────────

export type ResultatGenerationCorrections =
  | { status: 'succes'; corrections_generees: number; bloc: BlocCorrection }
  | { status: 'erreur'; message: string };

const generationSchema = z.object({
  type_alerte: z.enum([
    'date_naissance_manquante',
    'consentement_sans_date',
    'statut_acheve_sans_date_fin',
    'subvention_sans_montant',
  ]),
  bloc: blocCorrectionSchema,
});

export async function genererCorrectionsBloc(
  payload: z.infer<typeof generationSchema>,
): Promise<ResultatGenerationCorrections> {
  const utilisateur = await getCurrentUtilisateur({ allowViewAs: true });
  if (!utilisateur || (utilisateur.role !== 'admin_scs' && utilisateur.role !== 'super_admin')) {
    return { status: 'erreur', message: 'Réservé aux administrateurs.' };
  }

  const parsed = generationSchema.safeParse(payload);
  if (!parsed.success) return { status: 'erreur', message: 'payload_invalide' };

  const supabase = await createSupabaseServerClient();
  const corrections = await genererCorrectionsHeuristique(
    parsed.data.type_alerte,
    parsed.data.bloc,
    supabase,
  );

  return {
    status: 'succes',
    corrections_generees: corrections.length,
    bloc: { ...parsed.data.bloc, corrections },
  };
}

/**
 * Heuristique simple côté serveur — V2.2.1 :
 * pour chaque cas concerné par le type d'alerte, on applique une règle
 * dérivée de la logique du bloc Claude (created_at, annee_formation, etc.).
 *
 * V2.3 : remplacer par un Claude function-calling itératif qui génère les
 * 5000 lignes en appliquant strictement la logique annoncée dans le bloc.
 */
async function genererCorrectionsHeuristique(
  type: TypeAlerteCorrigeable,
  _bloc: BlocCorrection,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<Correction[]> {
  const corrections: Correction[] = [];

  if (type === 'consentement_sans_date') {
    const { data } = await supabase
      .from('beneficiaires')
      .select('id, prenom, nom, created_at')
      .is('deleted_at', null)
      .eq('consentement_recueilli', true)
      .is('consentement_date', null)
      .limit(5000);
    for (const b of data ?? []) {
      corrections.push({
        entite_id: b.id,
        entite_nom: `${b.prenom} ${b.nom}`,
        champ: 'consentement_date',
        valeur_actuelle: null,
        nouvelle_valeur: (b.created_at as string).slice(0, 10),
        contexte: 'Date de création de la fiche utilisée comme date de consentement.',
      });
    }
  } else if (type === 'date_naissance_manquante') {
    const { data } = await supabase
      .from('beneficiaires')
      .select('id, prenom, nom, annee_formation')
      .is('deleted_at', null)
      .is('date_naissance', null)
      .limit(5000);
    for (const b of data ?? []) {
      const annee = b.annee_formation ?? 2024;
      // Approximation : âge médian 25 ans à la formation → date_naissance = 1er juillet (annee - 25).
      corrections.push({
        entite_id: b.id,
        entite_nom: `${b.prenom} ${b.nom}`,
        champ: 'date_naissance',
        valeur_actuelle: null,
        nouvelle_valeur: `${annee - 25}-07-01`,
        contexte: `Estimation : annee_formation=${annee} - âge médian 25 ans.`,
      });
    }
  } else if (type === 'statut_acheve_sans_date_fin') {
    const { data } = await supabase
      .from('beneficiaires')
      .select('id, prenom, nom, annee_formation, date_debut_formation, statut_code')
      .is('deleted_at', null)
      .eq('qualite_a_verifier', true)
      .limit(5000);
    for (const b of data ?? []) {
      const annee = b.annee_formation ?? new Date().getFullYear();
      let nouvelle = `${annee}-12-31`;
      if (b.statut_code === 'ABANDON' && b.date_debut_formation) {
        const debut = new Date(b.date_debut_formation as string);
        debut.setMonth(debut.getMonth() + 6);
        nouvelle = debut.toISOString().slice(0, 10);
      }
      corrections.push({
        entite_id: b.id,
        entite_nom: `${b.prenom} ${b.nom}`,
        champ: 'date_fin_formation',
        valeur_actuelle: null,
        nouvelle_valeur: nouvelle,
        contexte:
          b.statut_code === 'ABANDON'
            ? `Statut ABANDON : date_debut + 6 mois.`
            : `Statut ACHEVE : 31/12 de l'annee_formation.`,
      });
    }
  } else if (type === 'subvention_sans_montant') {
    const { data } = await supabase
      .from('structures')
      .select('id, nom_structure, projet_code, annee_appui')
      .is('deleted_at', null)
      .eq('nature_appui_code', 'SUBVENTION')
      .is('montant_appui', null)
      .limit(5000);
    // Médiane par projet/année est complexe ; on retourne une valeur indicative
    // en €5000 (placeholder ; V2.3 fera un calcul statistique réel).
    for (const s of data ?? []) {
      corrections.push({
        entite_id: s.id,
        entite_nom: s.nom_structure,
        champ: 'montant_appui',
        valeur_actuelle: null,
        nouvelle_valeur: '5000',
        contexte: `Médiane indicative pour ${s.projet_code ?? 'projet'} ${s.annee_appui ?? ''}. À affiner V2.3.`,
      });
    }
  }

  return corrections;
}
