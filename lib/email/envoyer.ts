import 'server-only';

/**
 * Helper d'envoi d'email — implémentation MOCK pour 6.5b/6.5c.
 *
 * En 6.5d, ce module sera remplacé par l'intégration Resend réelle
 * (sans changer la signature publique : `envoyerEmail({to, subject,
 * html, text?, replyTo?, from?})`).
 *
 * Comportement actuel :
 *   - Log structuré dans la console serveur (Next.js logs)
 *   - Pas d'envoi réseau réel
 *   - Retourne `{ status: 'mock', messageId: <uuid>, recu: false }`
 *     pour signaler explicitement à l'appelant que rien n'a quitté
 *     l'environnement
 *
 * Cas d'usage en V1 (pré-Resend) : permet de finaliser les Server
 * Actions de 6.5b et 6.5c sans dépendre de l'activation OVH/DNS, et
 * de récupérer les liens d'activation / public dans les logs serveur
 * pour test manuel.
 */

import { randomUUID } from 'crypto';

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

/**
 * Envoie un email — MOCK V1.
 *
 * Pour faciliter les tests manuels SCS pendant la phase mock, on extrait
 * le premier `href="..."` du HTML et on le retourne dans `lienExtrait` :
 * le SCS peut copier-coller ce lien depuis les logs serveur sans avoir
 * besoin d'inspecter le HTML brut.
 */
export async function envoyerEmail(input: EnvoyerEmailInput): Promise<EnvoyerEmailResult> {
  const messageId = `mock-${randomUUID()}`;
  const destinataires = Array.isArray(input.to) ? input.to : [input.to];

  // Extraction du premier lien pour faciliter les tests manuels
  const matchHref = /href=["']([^"']+)["']/.exec(input.html);
  const lienExtrait = matchHref?.[1] ?? null;

  // Log serveur structuré — visible dans la console Next.js
  // eslint-disable-next-line no-console
  console.info('[envoyerEmail][MOCK]', {
    messageId,
    to: destinataires,
    subject: input.subject,
    from: input.from ?? process.env.RESEND_FROM_EMAIL ?? 'noreply@suivi-projet.org',
    replyTo: input.replyTo,
    htmlLength: input.html.length,
    lienExtrait,
  });

  return { status: 'mock', messageId, lienExtrait };
}
