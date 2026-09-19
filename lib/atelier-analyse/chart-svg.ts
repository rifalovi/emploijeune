'use client';

/**
 * Génère des graphiques (barres, secteurs/camembert, courbe) pour les exports
 * Word et PDF du rapport, sous forme de SVG puis de PNG. Le choix du type est
 * fait par l'IA dans le bloc ```chart``` (type: bar | pie | line) ; ce module
 * ne fait que le rendu, avec la palette institutionnelle OIF.
 */

import { PALETTE_PODIUM } from '@/lib/design/charts';

export type ChartSpec = {
  type: 'bar' | 'pie' | 'line';
  titre: string;
  data: { label: string; value: number }[];
};

const PALETTE = [...PALETTE_PODIUM, '#0E4F88', '#0198E9', '#7EB301', '#5D0073', '#F5A623'];
const couleur = (i: number) => PALETTE[i % PALETTE.length]!;

/** Analyse un bloc ```chart``` (JSON) en spécification exploitable. */
export function parseChartSpec(spec: string): ChartSpec | null {
  try {
    const j = JSON.parse(spec.trim()) as {
      type?: string;
      titre?: string;
      title?: string;
      data?: { label?: unknown; name?: unknown; value?: unknown; effectif?: unknown }[];
    };
    const type = j.type === 'pie' ? 'pie' : j.type === 'line' ? 'line' : 'bar';
    const data = (Array.isArray(j.data) ? j.data : [])
      .map((d) => ({
        label: String(d.label ?? d.name ?? ''),
        value: Number(d.value ?? d.effectif ?? 0),
      }))
      .filter((d) => d.label && Number.isFinite(d.value));
    if (data.length === 0) return null;
    return { type, titre: String(j.titre ?? j.title ?? ''), data };
  } catch {
    return null;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tronquer(s: string, n = 18): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

const FONT = 'Helvetica, Arial, sans-serif';

function svgBarres(spec: ChartSpec, w: number, h: number): string {
  const padL = 44;
  const padR = 16;
  const padT = spec.titre ? 34 : 16;
  const padB = 64;
  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const max = Math.max(...spec.data.map((d) => d.value), 1);
  const n = spec.data.length;
  const bw = (iw / n) * 0.62;
  const gap = (iw / n) * 0.38;
  const parts: string[] = [];
  // Grille horizontale + graduations.
  const ticks = 4;
  for (let t = 0; t <= ticks; t += 1) {
    const y = padT + ih - (ih * t) / ticks;
    const val = Math.round((max * t) / ticks);
    parts.push(
      `<line x1="${padL}" y1="${y}" x2="${padL + iw}" y2="${y}" stroke="#E2E8F0" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${padL - 6}" y="${y + 3}" font-size="9" fill="#94A3B8" text-anchor="end" font-family="${FONT}">${val}</text>`,
    );
  }
  spec.data.forEach((d, i) => {
    const x = padL + i * (bw + gap) + gap / 2;
    const bh = (d.value / max) * ih;
    const y = padT + ih - bh;
    parts.push(
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${couleur(i)}"/>`,
    );
    parts.push(
      `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="9" fill="#334155" text-anchor="middle" font-family="${FONT}">${d.value}</text>`,
    );
    parts.push(
      `<text x="${(x + bw / 2).toFixed(1)}" y="${padT + ih + 12}" font-size="9" fill="#475569" text-anchor="end" font-family="${FONT}" transform="rotate(-30 ${(x + bw / 2).toFixed(1)} ${padT + ih + 12})">${esc(tronquer(d.label))}</text>`,
    );
  });
  return parts.join('');
}

function svgCourbe(spec: ChartSpec, w: number, h: number): string {
  const padL = 44;
  const padR = 16;
  const padT = spec.titre ? 34 : 16;
  const padB = 64;
  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const max = Math.max(...spec.data.map((d) => d.value), 1);
  const n = spec.data.length;
  const stepX = n > 1 ? iw / (n - 1) : 0;
  const pts = spec.data.map((d, i) => {
    const x = padL + (n > 1 ? i * stepX : iw / 2);
    const y = padT + ih - (d.value / max) * ih;
    return { x, y, d };
  });
  const parts: string[] = [];
  const ticks = 4;
  for (let t = 0; t <= ticks; t += 1) {
    const y = padT + ih - (ih * t) / ticks;
    parts.push(
      `<line x1="${padL}" y1="${y}" x2="${padL + iw}" y2="${y}" stroke="#E2E8F0" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${padL - 6}" y="${y + 3}" font-size="9" fill="#94A3B8" text-anchor="end" font-family="${FONT}">${Math.round((max * t) / ticks)}</text>`,
    );
  }
  const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  parts.push(`<polyline points="${poly}" fill="none" stroke="${couleur(0)}" stroke-width="2.5"/>`);
  pts.forEach((p) => {
    parts.push(
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${couleur(0)}"/>`,
    );
    parts.push(
      `<text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" font-size="9" fill="#334155" text-anchor="middle" font-family="${FONT}">${p.d.value}</text>`,
    );
    parts.push(
      `<text x="${p.x.toFixed(1)}" y="${padT + ih + 14}" font-size="9" fill="#475569" text-anchor="middle" font-family="${FONT}">${esc(tronquer(p.d.label, 12))}</text>`,
    );
  });
  return parts.join('');
}

function svgSecteurs(spec: ChartSpec, w: number, h: number): string {
  const padT = spec.titre ? 34 : 12;
  const cx = h * 0.5 - 4 + 8;
  const cy = padT + (h - padT - 12) / 2;
  const r = Math.min(cx - 12, (h - padT - 24) / 2);
  const total = spec.data.reduce((s, d) => s + d.value, 0) || 1;
  const parts: string[] = [];
  let a0 = -Math.PI / 2;
  spec.data.forEach((d, i) => {
    const frac = d.value / total;
    const a1 = a0 + frac * 2 * Math.PI;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    if (frac >= 0.999) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${couleur(i)}"/>`);
    } else {
      parts.push(
        `<path d="M${cx.toFixed(1)},${cy.toFixed(1)} L${x0.toFixed(1)},${y0.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${couleur(i)}"/>`,
      );
    }
    a0 = a1;
  });
  // Légende à droite.
  const lx = cx + r + 22;
  let ly = padT + 6;
  spec.data.forEach((d, i) => {
    const pct = ((d.value / total) * 100).toFixed(1);
    parts.push(
      `<rect x="${lx}" y="${ly - 8}" width="10" height="10" rx="2" fill="${couleur(i)}"/>`,
    );
    parts.push(
      `<text x="${lx + 15}" y="${ly}" font-size="9.5" fill="#334155" font-family="${FONT}">${esc(tronquer(d.label, 26))} — ${pct}%</text>`,
    );
    ly += 17;
  });
  return parts.join('');
}

/** Construit le SVG complet (fond blanc, titre, corps selon le type). */
export function buildChartSvg(spec: ChartSpec, w = 560, h = 300): string {
  const corps =
    spec.type === 'pie'
      ? svgSecteurs(spec, w, h)
      : spec.type === 'line'
        ? svgCourbe(spec, w, h)
        : svgBarres(spec, w, h);
  const titre = spec.titre
    ? `<text x="${w / 2}" y="20" font-size="13" font-weight="bold" fill="#1E293B" text-anchor="middle" font-family="${FONT}">${esc(spec.titre)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#FFFFFF"/>${titre}${corps}</svg>`;
}

/**
 * Rasterise un graphique en PNG (data URL) via un canvas. Navigateur uniquement.
 * Renvoie null si le rendu échoue ou si la spécification est vide.
 */
export async function chartSpecToPng(
  spec: string,
  w = 560,
  h = 300,
  scale = 2,
): Promise<{ dataUrl: string; bytes: Uint8Array; width: number; height: number } | null> {
  const parsed = parseChartSpec(spec);
  if (!parsed) return null;
  const svg = buildChartSvg(parsed, w, h);
  const svgUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  const img = new Image();
  img.width = w;
  img.height = h;
  const chargee = new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
  });
  img.src = svgUrl;
  const ok = await chargee;
  if (!ok) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return { dataUrl, bytes, width: w, height: h };
}
