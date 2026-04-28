import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur, type UtilisateurProfile } from '@/lib/supabase/auth';

/**
 * Mode view-as (admin SCS) — V1.1.5.
 *
 * L'admin SCS peut visualiser les dashboards comme un autre utilisateur
 * (cas d'usage : support, démo, audit RGPD, contrôle des permissions
 * d'affichage). Le contexte view-as est porté par un cookie httpOnly signé
 * (HMAC SHA-256) — pas de session Supabase additionnelle, pas de
 * modification du JWT.
 *
 * Sécurité :
 *   - Cookie scellé (HMAC) avec SUPABASE_SERVICE_ROLE_KEY comme secret.
 *   - Expiration 30 minutes max (TTL serveur + côté cookie).
 *   - sameSite=strict, httpOnly, secure en production.
 *   - Tous les écrits/Server Actions doivent appeler `assertNotInViewAsMode()`
 *     pour refuser strictement l'écriture en mode view-as.
 *   - Audit `VIEW_AS_START` / `VIEW_AS_END` dans `journaux_audit`.
 *
 * Hors scope V1.1.5 : la RLS Postgres reste celle de l'admin réel — la vue
 * view-as cible le DASHBOARD (KPI, graphiques, activité) via une RPC dédiée
 * `get_indicateurs_oif_v1_for_user`. Les listes bénéficiaires/structures
 * affichent toujours le périmètre admin.
 */

const COOKIE_NAME = 'oif_view_as';
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export type ViewAsContext = {
  adminUserId: string;
  targetUserId: string;
  expiresAt: number;
};

function getSecret(): string {
  // En l'absence d'un secret dédié, on dérive de SUPABASE_SERVICE_ROLE_KEY.
  // Si Carlos veut isoler, ajouter VIEW_AS_SECRET dans .env.local.
  const dedie = process.env.VIEW_AS_SECRET;
  if (dedie && dedie.length >= 32) return dedie;
  const sb = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (sb && sb.length >= 32) return sb;
  throw new Error(
    'VIEW_AS_SECRET (ou SUPABASE_SERVICE_ROLE_KEY ≥ 32 chars) manquant pour signer le cookie view-as.',
  );
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function verifySignature(payload: string, signature: string): boolean {
  const attendue = sign(payload);
  if (attendue.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(attendue), Buffer.from(signature));
  } catch {
    return false;
  }
}

function encode(ctx: ViewAsContext): string {
  const payload = `${ctx.adminUserId}.${ctx.targetUserId}.${ctx.expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function decode(raw: string | undefined): ViewAsContext | null {
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 4) return null;
  const adminUserId = parts[0]!;
  const targetUserId = parts[1]!;
  const expiresAtStr = parts[2]!;
  const signature = parts[3]!;
  const payload = `${adminUserId}.${targetUserId}.${expiresAtStr}`;
  if (!verifySignature(payload, signature)) return null;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  return { adminUserId, targetUserId, expiresAt };
}

/**
 * Lit le cookie et retourne le contexte view-as actif (ou null si absent /
 * expiré / signature invalide).
 */
export async function getViewAsContext(): Promise<ViewAsContext | null> {
  const store = await cookies();
  return decode(store.get(COOKIE_NAME)?.value);
}

/**
 * Pose le cookie view-as. À appeler depuis une Server Action après garde
 * admin_scs.
 */
export async function setViewAsCookie(ctx: ViewAsContext): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, encode(ctx), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor((ctx.expiresAt - Date.now()) / 1000),
  });
}

/**
 * Supprime le cookie view-as. À appeler à la sortie de mode ou à la
 * déconnexion.
 */
export async function clearViewAsCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * TTL standard utilisé par la Server Action d'entrée en mode view-as.
 */
export function buildViewAsExpiresAt(): number {
  return Date.now() + TTL_MS;
}

/**
 * Charge le profil utilisateur cible via service_role. Retourne null si la
 * cible est introuvable ou inactive.
 */
export async function chargerProfilCible(targetUserId: string): Promise<UtilisateurProfile | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('utilisateurs')
    .select('id, user_id, nom_complet, role, organisation_id, statut_validation, actif')
    .eq('user_id', targetUserId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data || !data.actif) return null;
  return data as UtilisateurProfile;
}

/**
 * Refus strict en écriture en mode view-as. Toutes les Server Actions qui
 * mutent des données doivent appeler ce helper en début. Throw si view-as
 * actif.
 */
export async function assertNotInViewAsMode(): Promise<void> {
  const ctx = await getViewAsContext();
  if (ctx) {
    throw new Error(
      'Action impossible en mode visualisation (view-as). Cliquez sur « Revenir à mon admin » pour reprendre votre session.',
    );
  }
}

export type UtilisateurEffectif = {
  /** Profil utilisé pour l'UI (rôle, organisation, projets affichés). */
  profil: UtilisateurProfile;
  /** Profil de l'admin réellement authentifié (toujours présent). */
  reel: UtilisateurProfile;
  /** Vrai si l'admin SCS regarde via view-as. */
  isViewAs: boolean;
  /** Contexte view-as si actif. */
  viewAsContext: ViewAsContext | null;
};

/**
 * Retourne le profil EFFECTIF (rôle/org/projets affichés) pour le rendu UI :
 *   - Si admin_scs en mode view-as → profil cible.
 *   - Sinon → profil réel.
 *
 * Conserve toujours le profil réel pour les gardes sécurité côté Server
 * Actions. Les composants UI peuvent piocher dans `profil` pour décider du
 * rendu (KPI, navigation, badges) et `viewAsContext` pour afficher le
 * bandeau permanent.
 *
 * Retourne null si pas d'utilisateur authentifié.
 */
export async function getUtilisateurEffectif(): Promise<UtilisateurEffectif | null> {
  // allowViewAs: true — ce helper est utilisé pour le RENDU (layout +
  // dashboard) pendant lequel on doit pouvoir lire l'admin réel + cookie
  // view-as. La garde view-as côté écriture passe par
  // getCurrentUtilisateur() sans options (default allowViewAs=false).
  const reel = await getCurrentUtilisateur({ allowViewAs: true });
  if (!reel) return null;

  const ctx = await getViewAsContext();
  if (!ctx || (reel.role !== 'admin_scs' && reel.role !== 'super_admin')) {
    // Si non admin ou pas de cookie : profil réel uniquement.
    if (ctx && reel.role !== 'admin_scs' && reel.role !== 'super_admin') {
      // Cookie présent mais l'utilisateur n'est plus admin → on nettoie.
      await clearViewAsCookie();
    }
    return { profil: reel, reel, isViewAs: false, viewAsContext: null };
  }

  // Cohérence : l'admin réel doit correspondre au signataire du cookie.
  if (ctx.adminUserId !== reel.user_id) {
    await clearViewAsCookie();
    return { profil: reel, reel, isViewAs: false, viewAsContext: null };
  }

  const cible = await chargerProfilCible(ctx.targetUserId);
  if (!cible) {
    // Cible désactivée/supprimée entre-temps → on sort proprement.
    await clearViewAsCookie();
    return { profil: reel, reel, isViewAs: false, viewAsContext: null };
  }

  return { profil: cible, reel, isViewAs: true, viewAsContext: ctx };
}
