import { boutonCta, escapeHtml, footerTexte, wrapperHtml, type TemplateEmail } from './_partages';

/**
 * Template — Invitation à répondre à un questionnaire d'enquête (lien public).
 *
 * Variables : {cible_libelle}, {nom_projet?}, {questionnaire}, {lien},
 *             {expire_at}.
 * Sujet : « Enquête OIF Emploi Jeunes — votre avis compte ».
 */
export type InvitationEnqueteArgs = {
  cibleLibelle: string;
  nomProjet?: string | null;
  questionnaire: 'A' | 'B';
  url: string;
  expireAt: Date;
};

export function templateInvitationEnquete(args: InvitationEnqueteArgs): TemplateEmail {
  const subject = `Enquête OIF Emploi Jeunes — votre avis compte`;
  const dureeMin = args.questionnaire === 'A' ? '5 à 10' : '5 à 8';
  const dateFr = args.expireAt.toLocaleDateString('fr-FR', { dateStyle: 'long' });
  const projetTxt = args.nomProjet ? ` (projet ${escapeHtml(args.nomProjet)})` : '';
  const projetTexteBrut = args.nomProjet ? ` (projet ${args.nomProjet})` : '';

  const corpsHtml = `
    <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px;">
      Enquête OIF Emploi Jeunes
    </h1>
    <p style="margin: 12px 0;">
      Bonjour <strong>${escapeHtml(args.cibleLibelle)}</strong>,
    </p>
    <p style="margin: 12px 0;">
      Dans le cadre du suivi des projets de l'Organisation Internationale de la Francophonie
      (OIF)${projetTxt}, nous vous invitons à répondre à un court questionnaire
      (${dureeMin} minutes).
    </p>
    <p style="margin: 12px 0;">
      Vos réponses sont strictement confidentielles et serviront uniquement au pilotage des
      actions OIF, conformément au secret statistique.
    </p>
    ${boutonCta({ libelle: 'Démarrer le questionnaire', url: args.url })}
    <p style="margin: 16px 0; color: #6b7280; font-size: 13px;">
      Lien valable jusqu'au <strong>${escapeHtml(dateFr)}</strong>. Une seule réponse par
      invitation.
    </p>
  `;

  const text = `Enquête OIF Emploi Jeunes

Bonjour ${args.cibleLibelle},

Dans le cadre du suivi des projets de l'Organisation Internationale de la Francophonie (OIF)${projetTexteBrut}, nous vous invitons à répondre à un court questionnaire (${dureeMin} minutes).

Vos réponses sont strictement confidentielles et serviront uniquement au pilotage des actions OIF, conformément au secret statistique.

Lien d'accès (valable jusqu'au ${dateFr}, une seule réponse par invitation) :

${args.url}

${footerTexte()}`;

  return { subject, html: wrapperHtml(corpsHtml), text };
}
