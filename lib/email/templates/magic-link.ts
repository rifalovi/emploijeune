import { boutonCta, escapeHtml, footerTexte, wrapperHtml, type TemplateEmail } from './_partages';

/**
 * Template — Lien magique de connexion (admin SCS).
 *
 * Variables : {prenom?}, {lien_magic}.
 * Sujet : « Lien de connexion — Plateforme OIF Emploi Jeunes ».
 *
 * Note : l'usage du magic-link est réservé en V1 aux administrateurs SCS
 * (cf. décisions stratégiques V1/V1.5). Les autres rôles utilisent
 * login + mot de passe.
 */
export type MagicLinkArgs = {
  prenom?: string;
  lienMagic: string;
};

export function templateMagicLink(args: MagicLinkArgs): TemplateEmail {
  const subject = 'Lien de connexion — Plateforme OIF Emploi Jeunes';
  const salutation = args.prenom
    ? `<strong>${escapeHtml(args.prenom)}</strong>`
    : 'utilisateur(rice)';

  const corpsHtml = `
    <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px;">
      Connexion à la plateforme OIF Emploi Jeunes
    </h1>
    <p style="margin: 12px 0;">Bonjour ${salutation},</p>
    <p style="margin: 12px 0;">
      Vous avez demandé un lien de connexion sécurisé. Cliquez sur le bouton ci-dessous pour
      vous connecter (lien valable <strong>1 heure</strong>, à usage unique) :
    </p>
    ${boutonCta({ libelle: 'Me connecter', url: args.lienMagic })}
    <p style="margin: 16px 0; color: #6b7280; font-size: 13px;">
      Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — votre compte
      reste sécurisé.
    </p>
  `;

  const prenomTxt = args.prenom ? args.prenom : 'utilisateur(rice)';
  const text = `Connexion à la plateforme OIF Emploi Jeunes

Bonjour ${prenomTxt},

Vous avez demandé un lien de connexion sécurisé. Cliquez sur ce lien pour vous connecter (valable 1 heure, à usage unique) :

${args.lienMagic}

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — votre compte reste sécurisé.

${footerTexte()}`;

  return { subject, html: wrapperHtml(corpsHtml), text };
}
