/**
 * Analyseur Markdown minimal partagé par les exports Word et PDF du rapport IA.
 * Reconnaît titres (#, ##, ###), listes (-, *, •), et paragraphes. Le gras
 * **…** est retiré (texte simple) — suffisant pour un rendu propre en Word/PDF.
 */

export type BlocMd =
  | { type: 'h1' | 'h2' | 'h3'; texte: string }
  | { type: 'p'; texte: string }
  | { type: 'li'; texte: string };

function nettoyerInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export function parseMarkdown(markdown: string): BlocMd[] {
  const blocs: BlocMd[] = [];
  let dansCodeBlock = false;
  for (const brute of markdown.split('\n')) {
    const ligne = brute.trimEnd();
    // Ignore les blocs de code (```chart …```) : non rendus en Word/PDF.
    if (ligne.trimStart().startsWith('```')) {
      dansCodeBlock = !dansCodeBlock;
      continue;
    }
    if (dansCodeBlock) continue;
    if (!ligne.trim()) continue;
    const h = /^(#{1,3})\s+(.*)$/.exec(ligne);
    if (h) {
      const niveau = h[1]!.length;
      const type = niveau === 1 ? 'h1' : niveau === 2 ? 'h2' : 'h3';
      blocs.push({ type, texte: nettoyerInline(h[2] ?? '') });
      continue;
    }
    const li = /^\s*[-*•]\s+(.*)$/.exec(ligne);
    if (li) {
      blocs.push({ type: 'li', texte: nettoyerInline(li[1] ?? '') });
      continue;
    }
    blocs.push({ type: 'p', texte: nettoyerInline(ligne) });
  }
  return blocs;
}
