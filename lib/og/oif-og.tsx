import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * Génération de l'image Open Graph / Twitter Card de la plateforme.
 *
 * PROBLÈME CORRIGÉ : l'ancienne image statique (app/opengraph-image.png)
 * utilisait le logo OIF « texte foncé » (marron/olive) posé sur le fond
 * bleu institutionnel #0E4F88 → contraste quasi nul, texte illisible dans
 * les aperçus WhatsApp / LinkedIn / Facebook, et logo décentré à droite
 * laissant un grand vide à gauche.
 *
 * CORRECTIF : on génère l'image à la volée avec `next/og` en utilisant la
 * variante officielle « quadri texte blanc » du logo (cercle en couleur +
 * texte blanc, fond transparent), centrée sur le bleu institutionnel. Le
 * texte est ainsi parfaitement lisible et la composition équilibrée.
 *
 * Le logo est colocalisé ici et lu via `fs` au moment du rendu. Cette route
 * de métadonnées est prérendue statiquement au build (aucun segment
 * dynamique) : `process.cwd()` pointe alors la racine du projet et le
 * fichier source est disponible. On évite volontairement
 * `fetch(new URL(..., import.meta.url))` : webpack transforme le PNG en
 * asset `/_next/static/media/...` dont l'URL relative fait échouer `fetch`
 * au prerender (« Failed to parse URL »).
 */

/** Bleu institutionnel OIF — cohérent avec l'usage `bg-[#0E4F88]` dans l'app. */
const OIF_BLEU = '#0E4F88';

/** Accent doré (V1.5.0) — filet décoratif sous le logo. */
const OIF_ACCENT = '#F5A623';

/** Dimensions standard d'une carte Open Graph / Twitter (summary_large_image). */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_ALT =
  "OIF – Plateforme de suivi et d'évaluation des projets emploi jeunes de la Francophonie";

export const OG_CONTENT_TYPE = 'image/png';

/**
 * Construit l'`ImageResponse` partagée par les routes opengraph-image et
 * twitter-image. Le logo est lu depuis l'asset colocalisé et encodé en
 * data-URI pour être injecté dans le rendu satori.
 */
export function renderOifOgImage(): ImageResponse {
  const logoBinaire = readFileSync(join(process.cwd(), 'lib/og/logo-oif-quadri-texte-blanc.png'));
  const logoSrc = `data:image/png;base64,${logoBinaire.toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: OIF_BLEU,
        padding: '80px',
      }}
    >
      {/* Logo OIF texte blanc — ratio d'origine 881x438 conservé. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} width={620} height={308} alt="" />

      {/* Filet doré décoratif. */}
      <div
        style={{
          width: '120px',
          height: '5px',
          borderRadius: '999px',
          backgroundColor: OIF_ACCENT,
          marginTop: '36px',
          marginBottom: '28px',
        }}
      />

      {/* Sous-titre — sans accents pour rester lisible avec la police par
            défaut de next/og. */}
      <div
        style={{
          display: 'flex',
          color: '#FFFFFF',
          fontSize: '34px',
          fontWeight: 600,
          letterSpacing: '0.5px',
          textAlign: 'center',
        }}
      >
        Plateforme de suivi des projets emploi jeunes
      </div>
    </div>,
    { ...OG_SIZE },
  );
}
