import { OG_ALT, OG_CONTENT_TYPE, OG_SIZE, renderOifOgImage } from '@/lib/og/oif-og';

// Runtime Node requis pour lire le logo depuis `public/` via `fs`.
export const runtime = 'nodejs';

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function TwitterImage() {
  return renderOifOgImage();
}
