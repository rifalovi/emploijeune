import { boutonCta, escapeHtml, footerTexte, wrapperHtml, type TemplateEmail } from './_partages';

/**
 * Templates email pour les demandes d'accès auto-service (V1-Enrichie-A).
 *
 * 3 variantes :
 *   - confirmationDemande : envoi automatique au demandeur après soumission
 *   - notificationSCS : notification interne SCS (nouvelle demande à traiter)
 *   - rejetDemande : envoi au demandeur si rejet (avec raison)
 *
 * L'email d'approbation réutilise `templateInvitationCompte` (le compte
 * créé suit le flux normal d'invitation).
 */

// =============================================================================
// 1. Confirmation de réception (au demandeur)
// =============================================================================

export type ConfirmationDemandeArgs = {
  prenom: string;
};

export function templateConfirmationDemande(args: ConfirmationDemandeArgs): TemplateEmail {
  const subject = 'Demande d’accès reçue : Plateforme OIF Emploi Jeunes';

  const corpsHtml = `
    <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px;">
      Votre demande d’accès a bien été reçue
    </h1>
    <p style="margin: 12px 0;">Bonjour <strong>${escapeHtml(args.prenom)}</strong>,</p>
    <p style="margin: 12px 0;">
      Nous accusons réception de votre demande d’accès à la plateforme
      OIF Emploi Jeunes. Le Service de Conception et Suivi (SCS) examinera
      votre demande dans les meilleurs délais.
    </p>
    <p style="margin: 12px 0;">
      Vous recevrez un nouvel email dès que votre demande aura été traitée.
      Selon le volume des demandes, ce traitement peut prendre quelques
      jours ouvrés.
    </p>
    <p style="margin: 16px 0; color: #6b7280; font-size: 13px;">
      Inutile de renvoyer une demande : un email suffit. Toute demande
      supplémentaire identique sera classée sans suite.
    </p>
  `;

  const text = `Votre demande d’accès a bien été reçue

Bonjour ${args.prenom},

Nous accusons réception de votre demande d’accès à la plateforme OIF Emploi Jeunes. Le Service de Conception et Suivi (SCS) examinera votre demande dans les meilleurs délais.

Vous recevrez un nouvel email dès que votre demande aura été traitée. Selon le volume des demandes, ce traitement peut prendre quelques jours ouvrés.

${footerTexte()}`;

  return { subject, html: wrapperHtml(corpsHtml), text };
}

// =============================================================================
// 2. Notification SCS (interne)
// =============================================================================

export type NotificationSCSArgs = {
  demandeur: { prenom: string; nom: string; email: string };
  roleLibelle: string;
  contexte: string | null;
  justification: string;
  lienAdmin: string;
};

export function templateNotificationSCS(args: NotificationSCSArgs): TemplateEmail {
  const subject = `Nouvelle demande d’accès : ${args.demandeur.prenom} ${args.demandeur.nom}`;

  const corpsHtml = `
    <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">
      Nouvelle demande d’accès à traiter
    </h1>
    <table style="border-collapse: collapse; margin: 16px 0; font-size: 14px; width: 100%;">
      <tr>
        <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top;">Demandeur</td>
        <td style="padding: 6px 0;"><strong>${escapeHtml(args.demandeur.prenom)} ${escapeHtml(args.demandeur.nom)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top;">Email</td>
        <td style="padding: 6px 0;"><code>${escapeHtml(args.demandeur.email)}</code></td>
      </tr>
      <tr>
        <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top;">Rôle souhaité</td>
        <td style="padding: 6px 0;">${escapeHtml(args.roleLibelle)}</td>
      </tr>
      ${
        args.contexte
          ? `<tr>
              <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top;">Contexte</td>
              <td style="padding: 6px 0;">${escapeHtml(args.contexte)}</td>
            </tr>`
          : ''
      }
      <tr>
        <td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top;">Justification</td>
        <td style="padding: 6px 0; white-space: pre-wrap;">${escapeHtml(args.justification)}</td>
      </tr>
    </table>
    ${boutonCta({ libelle: 'Traiter la demande', url: args.lienAdmin })}
  `;

  const text = `Nouvelle demande d’accès à traiter

Demandeur : ${args.demandeur.prenom} ${args.demandeur.nom}
Email : ${args.demandeur.email}
Rôle souhaité : ${args.roleLibelle}${args.contexte ? `\nContexte : ${args.contexte}` : ''}
Justification :
${args.justification}

Traiter la demande : ${args.lienAdmin}

${footerTexte()}`;

  return { subject, html: wrapperHtml(corpsHtml), text };
}

// =============================================================================
// 3. Rejet de la demande (au demandeur)
// =============================================================================

export type RejetDemandeArgs = {
  prenom: string;
  raison: string;
};

export function templateRejetDemande(args: RejetDemandeArgs): TemplateEmail {
  const subject = 'Demande d’accès non retenue : Plateforme OIF Emploi Jeunes';

  const corpsHtml = `
    <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px;">
      Demande d’accès non retenue
    </h1>
    <p style="margin: 12px 0;">Bonjour <strong>${escapeHtml(args.prenom)}</strong>,</p>
    <p style="margin: 12px 0;">
      Après examen, le Service de Conception et Suivi (SCS) ne peut donner
      suite favorable à votre demande d’accès à la plateforme OIF Emploi
      Jeunes pour la raison suivante :
    </p>
    <blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid #d1d5db; background: #f9fafb; color: #374151; font-size: 14px; white-space: pre-wrap;">${escapeHtml(args.raison)}</blockquote>
    <p style="margin: 12px 0;">
      Si vous pensez que cette décision résulte d’un malentendu, vous
      pouvez contacter le SCS pour discuter de votre situation.
    </p>
  `;

  const text = `Demande d’accès non retenue

Bonjour ${args.prenom},

Après examen, le Service de Conception et Suivi (SCS) ne peut donner suite favorable à votre demande d’accès à la plateforme OIF Emploi Jeunes pour la raison suivante :

${args.raison}

Si vous pensez que cette décision résulte d’un malentendu, vous pouvez contacter le SCS pour discuter de votre situation.

${footerTexte()}`;

  return { subject, html: wrapperHtml(corpsHtml), text };
}
