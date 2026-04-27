import { boutonCta, escapeHtml, footerTexte, wrapperHtml, type TemplateEmail } from './_partages';

/**
 * Template — Invitation à activer son compte (créé par admin_scs).
 *
 * Variables : {prenom}, {role_libelle}, {lien_activation}.
 * Sujet : « Activation de votre compte — Plateforme OIF Emploi Jeunes ».
 */
export type InvitationCompteArgs = {
  prenom: string;
  roleLibelle: string;
  lienActivation: string;
};

export function templateInvitationCompte(args: InvitationCompteArgs): TemplateEmail {
  const subject = 'Activation de votre compte : Plateforme OIF Emploi Jeunes';

  const corpsHtml = `
    <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px;">
      Bienvenue sur la plateforme OIF Emploi Jeunes
    </h1>
    <p style="margin: 12px 0;">Bonjour <strong>${escapeHtml(args.prenom)}</strong>,</p>
    <p style="margin: 12px 0;">
      Le Service de Conception et Suivi de projet (SCS) vient de créer un compte à votre nom
      sur la plateforme OIF Emploi Jeunes.
    </p>
    <p style="margin: 12px 0;">
      Votre rôle : <strong>${escapeHtml(args.roleLibelle)}</strong>.
    </p>
    <p style="margin: 12px 0;">
      Pour activer votre compte et choisir votre mot de passe, cliquez sur le bouton
      ci-dessous. Le lien est valable <strong>24 heures</strong>.
    </p>
    ${boutonCta({ libelle: 'Activer mon compte', url: args.lienActivation })}
  `;

  const text = `Bienvenue sur la plateforme OIF Emploi Jeunes

Bonjour ${args.prenom},

Le Service de Conception et Suivi de projet (SCS) vient de créer un compte à votre nom sur la plateforme OIF Emploi Jeunes.

Votre rôle : ${args.roleLibelle}.

Pour activer votre compte et choisir votre mot de passe, ouvrez ce lien (valable 24 heures) :

${args.lienActivation}

${footerTexte()}`;

  return { subject, html: wrapperHtml(corpsHtml), text };
}
