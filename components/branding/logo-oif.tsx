import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Composant officiel du logotype de l'Organisation Internationale de la
 * Francophonie (OIF).
 *
 * Source normative : `docs/branding/sources/OIF_mini_charte.pdf` (éd. 2007,
 * W & Cie). Ce composant respecte les règles d'utilisation édictées par la
 * charte :
 *   - Taille minimum : 96 px de largeur (équivalent web de 25 mm charte p. 6)
 *   - Espace protégé : hauteur du « L » de « la francophonie » tout autour
 *   - Ratio proportionnel préservé (pas de déformation — interdit p. 11)
 *   - 4 variantes officielles uniquement, pas de création de variantes
 *
 * ⚠️ INTERDITS FORMELS (charte p. 11) :
 *   - Pas de modification des couleurs du logotype
 *   - Pas de déformation (stretch / compress)
 *   - Pas d'association avec un autre symbole à l'intérieur du logotype
 *   - Pas de placement sur un fond perturbé sans cartouche blanc
 *   - Pas d'utilisation sous la taille minimum
 *
 * Pour toute question branding : com@francophonie.org
 */

const TAILLE_MINIMUM_PX = 96;

/**
 * Ratios largeur/hauteur intrinsèques des fichiers PNG officiels. Utilisés
 * pour réserver la hauteur avant chargement de l'image (éviter CLS).
 */
const LOGO_RATIOS = {
  quadri: 881 / 438, // ≈ 2.01
  'quadri-texte-blanc': 881 / 438,
  noir: 2362 / 1007, // ≈ 2.35
  blanc: 2362 / 1007,
} as const;

const LOGO_FILES = {
  quadri: '/assets/branding/oif/logo-oif-quadri.png',
  'quadri-texte-blanc': '/assets/branding/oif/logo-oif-quadri-texte-blanc.png',
  noir: '/assets/branding/oif/logo-oif-noir.png',
  blanc: '/assets/branding/oif/logo-oif-blanc.png',
} as const;

const TAILLES_PREDEFINIES = {
  sm: 96, // taille minimum conforme charte
  md: 160,
  lg: 240,
  xl: 400,
} as const;

type LogoVariant = keyof typeof LOGO_FILES;
type LogoSize = keyof typeof TAILLES_PREDEFINIES | number;

export type LogoOifProps = {
  /**
   * Version à afficher.
   * - `quadri` (défaut) : version couleur — privilégier sur fond clair
   * - `quadri-texte-blanc` : version couleur avec typographie en réserve blanche, pour fond sombre
   * - `noir` : monochrome noir — usage print ou fax
   * - `blanc` : monochrome blanc — pour fond de couleur
   */
  variant?: LogoVariant;
  /**
   * Taille en largeur (px) : `sm` (96 min), `md` (160), `lg` (240), `xl` (400),
   * ou valeur numérique custom (≥ 96).
   */
  size?: LogoSize;
  /**
   * Si `true` (défaut), ajoute l'espace protégé autour du logo conformément
   * à la charte (hauteur du « L » de « la francophonie » ≈ 10 % de la largeur).
   */
  withProtectedSpace?: boolean;
  /**
   * Classes Tailwind additionnelles à appliquer au conteneur.
   */
  className?: string;
  /**
   * `aria-label` personnalisé. Par défaut : « Logo officiel de l'Organisation
   * Internationale de la Francophonie ».
   */
  ariaLabel?: string;
  /**
   * Priorité de chargement (défaut : `false`). Mettre à `true` pour la page
   * de connexion ou l'écran d'accueil (logo au-dessus de la ligne de flottaison).
   */
  priority?: boolean;
};

export function LogoOIF({
  variant = 'quadri',
  size = 'md',
  withProtectedSpace = true,
  className,
  ariaLabel = "Logo officiel de l'Organisation Internationale de la Francophonie",
  priority = false,
}: LogoOifProps) {
  const widthPx =
    typeof size === 'number' ? Math.max(size, TAILLE_MINIMUM_PX) : TAILLES_PREDEFINIES[size];

  // Avertissement développement si passage sous la taille minimum
  if (process.env.NODE_ENV !== 'production' && widthPx < TAILLE_MINIMUM_PX) {
    console.warn(
      `[LogoOIF] taille de ${widthPx}px inférieure au minimum charte (96px). ` +
        `La charte graphique OIF impose une largeur minimum de 25 mm / 96 px. ` +
        `Voir docs/branding.md.`,
    );
  }

  const ratio = LOGO_RATIOS[variant];
  const heightPx = Math.round(widthPx / ratio);

  // Espace protégé : hauteur du « L » ≈ 10 % de la largeur du logo (approximation
  // des mesures de la charte page 6). Appliqué en padding autour.
  const protectedPaddingPx = withProtectedSpace ? Math.round(widthPx * 0.1) : 0;

  return (
    <span
      className={cn('inline-block', className)}
      style={{
        padding: withProtectedSpace ? `${protectedPaddingPx}px` : undefined,
      }}
      role="img"
      aria-label={ariaLabel}
    >
      <Image
        src={LOGO_FILES[variant]}
        alt={ariaLabel}
        width={widthPx}
        height={heightPx}
        priority={priority}
        style={{ width: `${widthPx}px`, height: 'auto' }}
      />
    </span>
  );
}
