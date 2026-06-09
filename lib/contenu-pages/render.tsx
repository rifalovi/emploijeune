import type { ReactNode } from 'react';

/**
 * Interprète les marqueurs de mise en forme stockés en base CMS.
 *
 * Marqueurs supportés :
 *   **texte**       → <strong>
 *   *texte*         → <em>
 *   {centre}texte   → préfixe retiré (l'alignement est géré par le parent)
 *   {gauche}texte   → idem
 *   {droite}texte   → idem
 *
 * Retourne null pour les blocs explicitement masqués (valeur null).
 */
export function renderCms(text: string | null | undefined): ReactNode {
  if (text === null || text === undefined) return null;

  // Retire le préfixe d'alignement
  const cleaned = text.replace(/^\{(centre|gauche|droite)\}\s*/i, '').trim();
  if (!cleaned) return null;

  return <>{parseInline(cleaned)}</>;
}

/**
 * Extrait l'alignement si présent ({centre}, {gauche}, {droite}).
 * Retourne null si aucun préfixe.
 */
export function alignmentFromCms(text: string | null | undefined): 'center' | 'left' | 'right' | null {
  if (!text) return null;
  const m = text.match(/^\{(centre|gauche|droite)\}/i);
  if (!m) return null;
  if (m[1] === 'centre') return 'center';
  if (m[1] === 'droite') return 'right';
  return 'left';
}

// ── Parsing inline bold + italic ─────────────────────────────────────────────

function parseInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // **bold** doit être testé avant *italic* pour éviter le conflit
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/gs;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      parts.push(<em key={key++}>{match[2]}</em>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
