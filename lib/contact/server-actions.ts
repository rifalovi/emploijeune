'use server';

import { envoyerEmail } from '@/lib/email/envoyer';
import { escapeHtml } from '@/lib/email/templates/_partages';
import {
  messageContactSchema,
  SUJET_CONTACT_LIBELLES,
  type EnvoyerMessageContactResult,
  type SujetContact,
} from '@/lib/schemas/contact';

/**
 * Server Action : envoie un message du formulaire de contact public vers
 * `projets@francophonie.org` (V1.5.0).
 *
 * Sécurité :
 *   - Pas de garde rôle (formulaire public).
 *   - Validation Zod stricte (nom, email, sujet enum, message 20-5000).
 *   - Rate-limit V1.5+ si abus (pour l'instant : Resend gère le quota).
 *   - Reply-To = email du visiteur pour permettre la réponse directe.
 */

const DESTINATAIRE_PROJETS = 'projets@francophonie.org';

export async function envoyerMessageContact(raw: unknown): Promise<EnvoyerMessageContactResult> {
  const parse = messageContactSchema.safeParse(raw);
  if (!parse.success) {
    return {
      status: 'erreur_validation',
      issues: parse.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    };
  }
  const data = parse.data;
  const sujetLibelle = SUJET_CONTACT_LIBELLES[data.sujet as SujetContact] ?? data.sujet;

  const subject = `[Contact plateforme] ${sujetLibelle} : ${data.nom}`;

  const html = `
    <p>Nouveau message reçu via le formulaire de contact de la plateforme OIF Emploi Jeunes.</p>
    <table style="border-collapse: collapse; margin-top: 16px;">
      <tr>
        <td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 13px;">Nom</td>
        <td style="padding: 4px 0; font-weight: 600;">${escapeHtml(data.nom)}</td>
      </tr>
      <tr>
        <td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 13px;">Email</td>
        <td style="padding: 4px 0;">
          <a href="mailto:${encodeURIComponent(data.email)}">${escapeHtml(data.email)}</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 4px 12px 4px 0; color: #6b7280; font-size: 13px;">Sujet</td>
        <td style="padding: 4px 0;">${escapeHtml(sujetLibelle)}</td>
      </tr>
    </table>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;">
    <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(data.message)}</p>
  `;

  const text = [
    `Nouveau message reçu via le formulaire de contact de la plateforme OIF Emploi Jeunes.`,
    ``,
    `Nom    : ${data.nom}`,
    `Email  : ${data.email}`,
    `Sujet  : ${sujetLibelle}`,
    ``,
    `--- Message ---`,
    data.message,
  ].join('\n');

  const result = await envoyerEmail({
    to: DESTINATAIRE_PROJETS,
    subject,
    html,
    text,
    replyTo: data.email,
  });

  if (result.status === 'erreur') {
    return { status: 'erreur_envoi', message: result.message };
  }
  return { status: 'succes' };
}
