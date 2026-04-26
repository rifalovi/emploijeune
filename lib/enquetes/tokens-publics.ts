'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { envoyerEmail } from '@/lib/email/envoyer';
import { templateInvitationEnquete } from '@/lib/email/templates';
import type { Json } from '@/lib/supabase/database.types';
import {
  soumissionQuestionnaireASchema,
  soumissionQuestionnaireBSchema,
  type SoumissionQuestionnaireAOutput,
  type SoumissionQuestionnaireBOutput,
} from '@/lib/schemas/enquetes/schemas';
import { INDICATEURS_PAR_QUESTIONNAIRE } from '@/lib/schemas/enquetes/nomenclatures';

// =============================================================================
// Types & helpers
// =============================================================================

const EXPIRATION_PAR_DEFAUT_JOURS = 30;

/** Détail public d'une cible (rendu côté formulaire sans révéler de PII). */
export type CibleTokenDetail = {
  questionnaire: 'A' | 'B';
  cible_libelle: string;
  /**
   * UUID de la cible (bénéficiaire ou structure). Indispensable côté client
   * pour construire le payload de soumission. Pas une fuite : le client la
   * possède déjà dans le token (lien email reçu) — c'est cohérent.
   */
  cible_id: string;
  projet_code: string | null;
  vague_enquete: string;
  expire_at: string;
};

export type ValiderTokenResult =
  | { status: 'valide'; cible: CibleTokenDetail }
  | { status: 'inconnu' }
  | { status: 'expire' }
  | { status: 'consomme' };

// =============================================================================
// 1. Validation publique du token (côté Server Component de la route publique)
// =============================================================================

/**
 * Valide un token public et retourne les métadonnées de la cible pour
 * pré-remplir le formulaire.
 *
 * Pas de fuite d'existence : `inconnu`, `expire`, `consomme` ont des
 * statuts distincts mais aucun ne révèle la PII de la cible. Le seul
 * cas qui révèle quelque chose est `valide`, et c'est intentionnel
 * (le destinataire doit voir « vous répondez en tant que X »).
 */
export async function validerToken(token: string): Promise<ValiderTokenResult> {
  if (!/^[0-9a-f]{32}$/.test(token)) return { status: 'inconnu' };

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from('tokens_enquete_publique')
    .select(
      `
      questionnaire, cible_type, beneficiaire_id, structure_id,
      projet_code, vague_enquete, expire_at, consomme_at,
      beneficiaire:beneficiaires!beneficiaire_id ( prenom, nom ),
      structure:structures!structure_id ( nom_structure )
      `,
    )
    .eq('token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return { status: 'inconnu' };
  if (data.consomme_at) return { status: 'consomme' };
  if (new Date(data.expire_at).getTime() < Date.now()) return { status: 'expire' };

  const ben = Array.isArray(data.beneficiaire) ? data.beneficiaire[0] : data.beneficiaire;
  const str = Array.isArray(data.structure) ? data.structure[0] : data.structure;
  const cibleLibelle = ben ? `${ben.prenom} ${ben.nom}` : (str?.nom_structure ?? '—');
  const cibleId = data.cible_type === 'beneficiaire' ? data.beneficiaire_id! : data.structure_id!;

  return {
    status: 'valide',
    cible: {
      questionnaire: data.questionnaire as 'A' | 'B',
      cible_libelle: cibleLibelle,
      cible_id: cibleId,
      projet_code: data.projet_code,
      vague_enquete: data.vague_enquete,
      expire_at: data.expire_at,
    },
  };
}

// =============================================================================
// 2. Génération d'un token (admin/coordo/contributeur)
// =============================================================================

export type GenererTokenResult =
  | {
      status: 'succes';
      token: string;
      url: string;
      expire_at: string;
      emailEnvoi: 'envoye' | 'mock' | null;
      lienExtrait: string | null;
    }
  | { status: 'erreur_droits'; message: string }
  | { status: 'erreur_cible_introuvable'; message: string }
  | { status: 'erreur_inconnue'; message: string };

export type GenererTokenInput = {
  cibleType: 'beneficiaire' | 'structure';
  cibleId: string;
  vagueEnquete?: string;
  expirationJours?: number;
  /** Email à utiliser pour notification ; si absent, on tente de le déduire de la cible. */
  emailDestinataire?: string;
};

/**
 * Génère un token d'enquête publique pour une cible et envoie l'email
 * d'invitation (MOCK V1, Resend en V1.5d).
 *
 * Garde-fou : seuls admin_scs / editeur_projet / contributeur_partenaire
 * peuvent générer un token. RLS Supabase appliquée au INSERT.
 */
export async function genererTokenEnquete(input: GenererTokenInput): Promise<GenererTokenResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (
    !utilisateur ||
    !['admin_scs', 'editeur_projet', 'contributeur_partenaire'].includes(utilisateur.role)
  ) {
    return { status: 'erreur_droits', message: 'Réservé aux rôles autorisés.' };
  }

  const supabase = await createSupabaseServerClient();
  const questionnaire: 'A' | 'B' = input.cibleType === 'beneficiaire' ? 'A' : 'B';

  // Récupère cible (RLS-safe) pour projet + nom + email destinataire potentiel
  let projetCible: string | null = null;
  let cibleLibelle = '—';
  let emailCible: string | null = null;

  if (input.cibleType === 'beneficiaire') {
    const { data } = await supabase
      .from('beneficiaires')
      .select('prenom, nom, projet_code, courriel, consentement_recueilli')
      .eq('id', input.cibleId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) {
      return {
        status: 'erreur_cible_introuvable',
        message: 'Bénéficiaire introuvable ou hors de votre périmètre.',
      };
    }
    projetCible = data.projet_code;
    cibleLibelle = `${data.prenom} ${data.nom}`;
    if (data.consentement_recueilli) emailCible = data.courriel ?? null;
  } else {
    const { data } = await supabase
      .from('structures')
      .select('nom_structure, projet_code, courriel_porteur, consentement_recueilli')
      .eq('id', input.cibleId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) {
      return {
        status: 'erreur_cible_introuvable',
        message: 'Structure introuvable ou hors de votre périmètre.',
      };
    }
    projetCible = data.projet_code;
    cibleLibelle = data.nom_structure;
    if (data.consentement_recueilli) emailCible = data.courriel_porteur ?? null;
  }

  // Token 32 chars hex (128 bits entropie)
  const token = randomBytes(16).toString('hex');
  const expirationJours = input.expirationJours ?? EXPIRATION_PAR_DEFAUT_JOURS;
  const expireAt = new Date(Date.now() + expirationJours * 24 * 60 * 60 * 1000);

  const insertPayload = {
    token,
    cible_type: input.cibleType,
    beneficiaire_id: input.cibleType === 'beneficiaire' ? input.cibleId : null,
    structure_id: input.cibleType === 'structure' ? input.cibleId : null,
    questionnaire,
    vague_enquete: (input.vagueEnquete ?? 'ponctuelle') as
      | '6_mois'
      | '12_mois'
      | '24_mois'
      | 'ponctuelle'
      | 'avant_formation'
      | 'fin_formation',
    canal_collecte: 'email' as const,
    projet_code: projetCible,
    expire_at: expireAt.toISOString(),
  };

  const { error } = await supabase.from('tokens_enquete_publique').insert(insertPayload);
  if (error) {
    return { status: 'erreur_inconnue', message: `INSERT token : ${error.message}` };
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${origin}/enquetes/public/${token}`;

  // Envoi email destinataire si on a son adresse + consentement RGPD
  let emailEnvoi: 'envoye' | 'mock' | null = null;
  let lienExtrait: string | null = null;
  const destinataire = input.emailDestinataire ?? emailCible;

  if (destinataire) {
    const tpl = templateInvitationEnquete({
      cibleLibelle,
      nomProjet: projetCible,
      questionnaire,
      url,
      expireAt,
    });
    const envoi = await envoyerEmail({
      to: destinataire,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    if (envoi.status === 'mock') {
      emailEnvoi = 'mock';
      lienExtrait = envoi.lienExtrait;
    } else if (envoi.status === 'envoye') {
      emailEnvoi = 'envoye';
    }
  }

  revalidatePath('/enquetes');
  return {
    status: 'succes',
    token,
    url,
    expire_at: expireAt.toISOString(),
    emailEnvoi,
    lienExtrait,
  };
}

// =============================================================================
// 3. Soumission publique d'une enquête via token
// =============================================================================

export type SoumissionPubliqueResult =
  | { status: 'succes'; session_id: string; indicateurs: string[] }
  | { status: 'erreur_token' }
  | { status: 'erreur_validation'; issues: Array<{ path: string; message: string }> }
  | { status: 'erreur_inconnue'; message: string };

/**
 * Soumet un questionnaire via un token public.
 *
 * Pipeline (toutes les étapes côté serveur via service_role) :
 *   1. Valide le token (existence, non expiré, non consommé).
 *   2. Vérifie que questionnaire + cible_id du payload matchent ceux du token.
 *   3. Validation Zod du payload.
 *   4. INSERT N lignes reponses_enquetes (1 par indicateur cible).
 *   5. UPDATE token : consomme_at = NOW(), session_enquete_id = <uuid>.
 *
 * Sécurité :
 *   - service_role utilisé UNIQUEMENT côté serveur Next (pas exposé navigateur).
 *   - Le token ne peut être consommé qu'une fois (UPDATE avec garde
 *     `consomme_at IS NULL` dans la WHERE clause).
 *   - Pas de fuite info : un token déjà consommé renvoie `erreur_token`.
 */
export async function soumettreEnquetePublique(
  token: string,
  payload: SoumissionQuestionnaireAOutput | SoumissionQuestionnaireBOutput,
): Promise<SoumissionPubliqueResult> {
  if (!/^[0-9a-f]{32}$/.test(token)) return { status: 'erreur_token' };

  const adminClient = createSupabaseAdminClient();

  // Étape 1 : valider le token
  const { data: tokenRow, error: tokenError } = await adminClient
    .from('tokens_enquete_publique')
    .select(
      'id, token, cible_type, beneficiaire_id, structure_id, questionnaire, vague_enquete, canal_collecte, projet_code, expire_at, consomme_at',
    )
    .eq('token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (tokenError || !tokenRow) return { status: 'erreur_token' };
  if (tokenRow.consomme_at) return { status: 'erreur_token' };
  if (new Date(tokenRow.expire_at).getTime() < Date.now()) return { status: 'erreur_token' };

  // Étape 2 : cohérence questionnaire ↔ payload
  if (payload.questionnaire !== tokenRow.questionnaire) {
    return { status: 'erreur_token' };
  }
  const cibleAttendue =
    tokenRow.cible_type === 'beneficiaire' ? tokenRow.beneficiaire_id : tokenRow.structure_id;
  if (payload.cible_id !== cibleAttendue) {
    return { status: 'erreur_token' };
  }

  // Étape 3 : validation Zod côté serveur
  const schema =
    payload.questionnaire === 'A' ? soumissionQuestionnaireASchema : soumissionQuestionnaireBSchema;
  const parse = schema.safeParse(payload);
  if (!parse.success) {
    return {
      status: 'erreur_validation',
      issues: parse.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }
  const data = parse.data;

  // Étape 4 : construire les lignes reponses_enquetes
  const sessionId = crypto.randomUUID();
  const dateCollecte = data.date_collecte.toISOString().slice(0, 10);
  const beneficiaireId = data.questionnaire === 'A' ? data.cible_id : null;
  const structureId = data.questionnaire === 'B' ? data.cible_id : null;
  const indicateurs = INDICATEURS_PAR_QUESTIONNAIRE[data.questionnaire];

  const lignes = indicateurs.map((code) => {
    let donnees: Record<string, unknown> = {};
    if (data.questionnaire === 'A') {
      const dA = data as SoumissionQuestionnaireAOutput;
      switch (code) {
        case 'A2':
          donnees = { ...dA.a2 };
          break;
        case 'A3':
          donnees = { ...dA.a3 };
          break;
        case 'A4':
          donnees = { ...dA.a4 };
          break;
        case 'A5':
          donnees = {
            ...dA.a5,
            effets_impacts: dA.effets_impacts,
            observations: dA.observations_libres,
            temoignage: dA.temoignage,
          };
          break;
        case 'F1':
          donnees = { ...dA.f1 };
          break;
        case 'C5':
          donnees = { ...dA.c5 };
          break;
      }
    } else {
      const dB = data as SoumissionQuestionnaireBOutput;
      switch (code) {
        case 'B2':
          donnees = { ...dB.b2 };
          break;
        case 'B3':
          donnees = { ...dB.b3 };
          break;
        case 'B4':
          donnees = {
            ...dB.b4,
            effets_impacts: dB.effets_impacts,
            observations: dB.observations_libres,
            temoignage: dB.temoignage,
          };
          break;
        case 'C5':
          donnees = { ...dB.c5 };
          break;
      }
    }
    return {
      indicateur_code: code,
      beneficiaire_id: beneficiaireId,
      structure_id: structureId,
      projet_code: tokenRow.projet_code,
      donnees: donnees as Json,
      date_collecte: dateCollecte,
      vague_enquete: tokenRow.vague_enquete,
      canal_collecte: tokenRow.canal_collecte,
      session_enquete_id: sessionId,
      lien_public_token: token,
    };
  });

  // INSERT atomique des N lignes
  const { error: insertError } = await adminClient.from('reponses_enquetes').insert(lignes);
  if (insertError) {
    return { status: 'erreur_inconnue', message: `INSERT réponses : ${insertError.message}` };
  }

  // Étape 5 : marquer le token consommé (avec garde anti-double-consommation)
  const { error: updateError, count } = await adminClient
    .from('tokens_enquete_publique')
    .update(
      { consomme_at: new Date().toISOString(), session_enquete_id: sessionId },
      { count: 'exact' },
    )
    .eq('id', tokenRow.id)
    .is('consomme_at', null);

  if (updateError || count === 0) {
    // Cas pathologique : 2 soumissions concurrentes ; les réponses INSERT
    // sont déjà écrites. On laisse en place et on signale l'erreur — l'admin
    // pourra dédupliquer manuellement (rare en V1, à monitorer).
    return {
      status: 'erreur_inconnue',
      message:
        'Le token vient d’être utilisé par une autre soumission. Vos réponses ont été enregistrées mais peuvent être en doublon.',
    };
  }

  return { status: 'succes', session_id: sessionId, indicateurs: [...indicateurs] };
}
