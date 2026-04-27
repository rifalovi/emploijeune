/**
 * Helpers communs aux templates email (Étape 6.5d).
 *
 * Principes Carlos (cf. message du 26/04/2026) :
 *   - HTML simple + version texte alternative obligatoire.
 *   - Pas d'images embed (problèmes de spam).
 *   - Branding minimaliste : pas de logo OIF officiel sans validation
 *     hiérarchique (V1.5/V2 si validé direction communication OIF).
 *   - Multi-langues : FR par défaut, EN reporté V1.5.
 *   - Variables remplaçables : {prenom}, {nom}, {nom_projet}, {lien},
 *     {role} — implémentées en arguments TypeScript typés (sécurisé,
 *     pas de injection HTML possible).
 */

export const COULEUR_PRIMAIRE = '#0E4F88';
export const COULEUR_TEXTE = '#1f2937';
export const COULEUR_MUTED = '#6b7280';
export const FONT_STACK = 'Inter, system-ui, -apple-system, sans-serif';

export type TemplateEmail = {
  /** Sujet de l'email (sans préfixe — ajouté par le destinataire si besoin). */
  subject: string;
  /** HTML formaté pour les clients email (max-width 560px). */
  html: string;
  /** Version texte brut (obligatoire, fallback pour clients sans HTML). */
  text: string;
};

/** Échappement HTML pour interpoler des variables dans le HTML sans risque. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wrapper HTML standard utilisé par tous les templates.
 * Branding minimaliste sans logo OIF officiel (V1).
 *
 * Footer V1 : mention « Plateforme OIF Emploi Jeunes » + RGPD basique.
 * Note V1.5 : ce footer sera enrichi quand l'alias support@suivi-projet.org
 * sera disponible (Étape 10).
 */
export function wrapperHtml(corps: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 24px; background: #f3f4f6; font-family: ${FONT_STACK}; color: ${COULEUR_TEXTE};">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px;">
    ${corps}
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px;">
    ${footerHtml()}
  </div>
</body>
</html>`;
}

function footerHtml(): string {
  return `
    <p style="color: ${COULEUR_MUTED}; font-size: 12px; line-height: 1.5; margin: 4px 0;">
      <strong>Plateforme OIF Emploi Jeunes</strong> — outil de suivi des projets de
      l'Organisation Internationale de la Francophonie.
    </p>
    <p style="color: ${COULEUR_MUTED}; font-size: 11px; line-height: 1.5; margin: 4px 0;">
      Cet email vous est envoyé dans le cadre du suivi statistique anonymisé des projets OIF.
      Si vous pensez l'avoir reçu par erreur, vous pouvez l'ignorer. Aucune relance automatique
      ne sera déclenchée sans votre interaction.
    </p>
    <p style="color: ${COULEUR_MUTED}; font-size: 11px; line-height: 1.5; margin: 4px 0;">
      Conformément au RGPD, vos données sont traitées exclusivement pour le suivi des projets
      OIF, conservées le temps nécessaire à l'évaluation, et accessibles uniquement aux
      personnes habilitées (Service de Conception et Suivi de projet).
    </p>
  `;
}

export function footerTexte(): string {
  return `
---
Plateforme OIF Emploi Jeunes — outil de suivi des projets de l'Organisation Internationale de la Francophonie.

Cet email vous est envoyé dans le cadre du suivi statistique anonymisé des projets OIF. Si vous pensez l'avoir reçu par erreur, vous pouvez l'ignorer.

RGPD : vos données sont traitées exclusivement pour le suivi des projets OIF, accessibles uniquement aux personnes habilitées (SCS).
`.trim();
}

/** Bouton CTA standardisé. */
export function boutonCta(args: { libelle: string; url: string }): string {
  return `
    <p style="margin: 24px 0; text-align: center;">
      <a href="${args.url}" style="display: inline-block; background: ${COULEUR_PRIMAIRE}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
        ${escapeHtml(args.libelle)}
      </a>
    </p>
    <p style="color: ${COULEUR_MUTED}; font-size: 12px; line-height: 1.5; margin: 8px 0;">
      Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
      <code style="word-break: break-all; font-size: 11px;">${args.url}</code>
    </p>
  `;
}
