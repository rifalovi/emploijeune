import { boutonCta, escapeHtml, footerTexte, wrapperHtml, type TemplateEmail } from './_partages';

/**
 * Template — Réinitialisation du mot de passe.
 *
 * Variables : {prenom?}, {lien_reset}.
 * Sujet : « Réinitialisation de votre mot de passe — Plateforme OIF Emploi Jeunes ».
 */
export type ResetMotPasseArgs = {
  /** Prénom optionnel (peut être vide en cas de demande sans contexte). */
  prenom?: string;
  lienReset: string;
};

export function templateResetMotPasse(args: ResetMotPasseArgs): TemplateEmail {
  const subject = 'Réinitialisation de votre mot de passe — Plateforme OIF Emploi Jeunes';
  const salutation = args.prenom
    ? `<strong>${escapeHtml(args.prenom)}</strong>`
    : 'utilisateur(rice)';

  const corpsHtml = `
    <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px;">
      Réinitialisation de votre mot de passe
    </h1>
    <p style="margin: 12px 0;">Bonjour ${salutation},</p>
    <p style="margin: 12px 0;">
      Une demande de réinitialisation de mot de passe a été faite pour votre compte sur la
      plateforme OIF Emploi Jeunes.
    </p>
    <p style="margin: 12px 0;">
      Cliquez ci-dessous pour définir un nouveau mot de passe (lien valable
      <strong>1 heure</strong>) :
    </p>
    ${boutonCta({ libelle: 'Réinitialiser mon mot de passe', url: args.lienReset })}
    <p style="margin: 16px 0; color: #6b7280; font-size: 13px;">
      Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — votre mot de
      passe actuel reste valide.
    </p>
  `;

  const prenomTxt = args.prenom ? args.prenom : 'utilisateur(rice)';
  const text = `Réinitialisation de votre mot de passe

Bonjour ${prenomTxt},

Une demande de réinitialisation de mot de passe a été faite pour votre compte sur la plateforme OIF Emploi Jeunes.

Cliquez sur ce lien pour définir un nouveau mot de passe (valable 1 heure) :

${args.lienReset}

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — votre mot de passe actuel reste valide.

${footerTexte()}`;

  return { subject, html: wrapperHtml(corpsHtml), text };
}
