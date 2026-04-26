import 'server-only';
import { randomUUID } from 'crypto';

/**
 * Helper d'envoi d'email — intégration Resend (Étape 6.5d).
 *
 * Comportement :
 *   - Si `RESEND_API_KEY` est définie → envoi RÉEL via l'API Resend
 *     depuis `RESEND_FROM_EMAIL` (domaine `suivi-projet.org`).
 *   - Si `RESEND_API_KEY` est ABSENTE → fallback MOCK (log console
 *     + extraction du premier href). Permet aux tests CI / dev sans
 *     clé de continuer à fonctionner.
 *
 * Le destinataire de test pour la phase pilote est l'email perso de
 * Carlos (`rifalovi@yahoo.fr`) — à utiliser comme valeur par défaut
 * dans les UI admin de génération de tokens.
 */

export type EnvoyerEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Override du from. Défaut : RESEND_FROM_EMAIL ou fallback noreply@suivi-projet.org. */
  from?: string;
};

export type EnvoyerEmailResult =
  | { status: 'envoye'; messageId: string }
  | { status: 'mock'; messageId: string; lienExtrait: string | null }
  | { status: 'erreur'; message: string };

function fromHeader(): string {
  const email = process.env.RESEND_FROM_EMAIL ?? 'noreply@suivi-projet.org';
  const name = process.env.RESEND_FROM_NAME ?? 'Plateforme OIF Emploi Jeunes';
  return `${name} <${email}>`;
}

/**
 * Envoie un email via Resend (production) ou MOCK (dev/CI sans clé).
 */
export async function envoyerEmail(input: EnvoyerEmailInput): Promise<EnvoyerEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  // Fallback MOCK si pas de clé
  if (!apiKey) {
    return envoyerEmailMock(input);
  }

  try {
    // Lazy-import pour ne pas charger Resend en dev si pas de clé
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: input.from ?? fromHeader(),
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[envoyerEmail][Resend] Erreur API', error);
      return { status: 'erreur', message: error.message ?? 'Erreur Resend' };
    }
    if (!data?.id) {
      return { status: 'erreur', message: 'Réponse Resend sans id' };
    }
    return { status: 'envoye', messageId: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue Resend';
    // eslint-disable-next-line no-console
    console.error('[envoyerEmail][Resend] Exception', err);
    return { status: 'erreur', message };
  }
}

/**
 * MOCK — log structuré + extraction du premier href du HTML pour faciliter
 * le copier-coller manuel des liens d'activation pendant les tests.
 */
function envoyerEmailMock(input: EnvoyerEmailInput): EnvoyerEmailResult {
  const messageId = `mock-${randomUUID()}`;
  const destinataires = Array.isArray(input.to) ? input.to : [input.to];
  const matchHref = /href=["']([^"']+)["']/.exec(input.html);
  const lienExtrait = matchHref?.[1] ?? null;

  // eslint-disable-next-line no-console
  console.info('[envoyerEmail][MOCK]', {
    messageId,
    to: destinataires,
    subject: input.subject,
    from: input.from ?? fromHeader(),
    replyTo: input.replyTo,
    htmlLength: input.html.length,
    lienExtrait,
  });

  return { status: 'mock', messageId, lienExtrait };
}
