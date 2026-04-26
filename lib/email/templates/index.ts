/**
 * Barrel des templates email (Étape 6.5d + hotfix 6.5h-quinquies).
 */
export { templateInvitationCompte } from './invitation-compte';
export type { InvitationCompteArgs } from './invitation-compte';
export { templateResetMotPasse } from './reset-mot-passe';
export type { ResetMotPasseArgs } from './reset-mot-passe';
export { templateInvitationEnquete } from './invitation-enquete';
export type { InvitationEnqueteArgs } from './invitation-enquete';
export { templateMagicLink } from './magic-link';
export type { MagicLinkArgs } from './magic-link';
export {
  templateConfirmationDemande,
  templateNotificationSCS,
  templateRejetDemande,
} from './demande-acces';
export type {
  ConfirmationDemandeArgs,
  NotificationSCSArgs,
  RejetDemandeArgs,
} from './demande-acces';
export type { TemplateEmail } from './_partages';
