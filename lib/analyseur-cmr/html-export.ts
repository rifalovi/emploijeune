'use client';

/**
 * Génération des livrables HTML de l'analyseur de CMR (Livrable 3) :
 * - un tableau de bord détaillé (KPI, classement, par projet) ;
 * - une infographie exécutive (feux tricolores, messages clés).
 *
 * Les fichiers sont autoportants (CSS inline, aucune dépendance) et
 * téléchargeables, aux couleurs de la charte OIF. En ligne il n'existe pas
 * d'« URL locale » : on rend dans l'app et on propose le téléchargement.
 */

import type { CMRAnalyseResponse } from './types';

// Couleurs charte OIF (verrouillées).
const OIF = {
  bleu: '#0E4F88',
  cyan: '#0198E9',
  vert: '#7EB301',
  jaune: '#FDCD00',
  violet: '#5D0073',
  rouge: '#E40001',
  gris: '#2E292D',
  grisClair: '#DFDCD8',
};

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${v} %`;
}

const CSS = `
:root{--bleu:${OIF.bleu};--cyan:${OIF.cyan};--vert:${OIF.vert};--jaune:${OIF.jaune};--violet:${OIF.violet};--rouge:${OIF.rouge};--gris:${OIF.gris};--gris-clair:${OIF.grisClair};}
*{box-sizing:border-box}
body{font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;margin:0;color:#1a1a1a;background:#f6f7f9;line-height:1.5}
.wrap{max-width:1100px;margin:0 auto;padding:24px 16px}
header.hero{background:linear-gradient(135deg,var(--bleu),var(--violet));color:#fff;border-radius:14px;padding:28px 24px;margin-bottom:20px}
header.hero h1{margin:0 0 6px;font-size:26px}
header.hero p{margin:0;opacity:.9;font-size:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:18px 0}
.kpi{background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:14px 16px}
.kpi .v{font-size:26px;font-weight:800;color:var(--bleu)}
.kpi .l{font-size:12px;color:#5b6470;text-transform:uppercase;letter-spacing:.03em}
h2{color:var(--bleu);font-size:19px;margin:26px 0 10px;border-bottom:2px solid var(--gris-clair);padding-bottom:6px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;font-size:13px}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #eef0f2}
th{background:var(--bleu);color:#fff;font-weight:600}
tr:last-child td{border-bottom:none}
.bar{height:9px;border-radius:5px;background:var(--gris-clair);overflow:hidden;min-width:80px}
.bar>span{display:block;height:100%}
.badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#fff}
.card{background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:16px;margin-bottom:14px}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.msg h3{margin:0 0 8px;font-size:15px}
.msg ul{margin:0;padding-left:18px}
.msg li{margin:4px 0;font-size:13px}
.feux{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.feu{background:#fff;border:1px solid #e6e8eb;border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:8px;font-size:13px}
.feu .dot{font-size:18px}
.muted{color:#5b6470;font-size:12px}
footer{margin-top:28px;color:#5b6470;font-size:12px;text-align:center}
`;

function couleurScore(v: number): string {
  if (v >= 75) return OIF.vert;
  if (v >= 50) return OIF.jaune;
  return OIF.rouge;
}

function couleurStatut(s: string): string {
  return (
    { Conforme: OIF.vert, Corrigé: OIF.cyan, 'À vérifier': OIF.jaune, Critique: OIF.rouge }[s] ??
    OIF.gris
  );
}

function doc(titre: string, corps: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titre)}</title><style>${CSS}</style></head>
<body><div class="wrap">${corps}
<footer>Analyseur de CMR — OIF « Emploi Jeunes » · Généré le ${new Date().toLocaleString('fr-FR')}</footer>
</div></body></html>`;
}

function kpiBloc(res: CMRAnalyseResponse): string {
  const k = res.global.kpi;
  const cards: [string, string][] = [
    ['Projets', String(k.n_projets)],
    ['Indicateurs', String(k.n_indicateurs)],
    ['% atteinte (médian)', pct(k.taux_atteinte_global)],
    ['Anomalies', String(k.n_anomalies)],
    ['Score fiabilité', `${k.score_fiabilite}/100`],
    ['Score cohérence', `${k.score_coherence}/100`],
    ['Qualité données', `${k.score_qualite}/100`],
  ];
  return `<div class="kpis">${cards
    .map(
      ([l, v]) =>
        `<div class="kpi"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`,
    )
    .join('')}</div>`;
}

function classementTable(res: CMRAnalyseResponse): string {
  const rows = res.global.classement
    .map(
      (r) => `<tr>
<td>${esc(r.feu)}</td>
<td><strong>${esc(r.code)}</strong> ${esc(r.nom)}</td>
<td><div class="bar"><span style="width:${Math.min(100, r.fiabilite)}%;background:${couleurScore(
        r.fiabilite,
      )}"></span></div> ${r.fiabilite}/100</td>
<td>${pct(r.taux_atteinte_moyen)}</td>
<td>${r.n_anomalies}</td>
<td>${r.n_critiques}</td>
</tr>`,
    )
    .join('');
  return `<table><thead><tr><th></th><th>Projet</th><th>Fiabilité</th><th>Taux (médian)</th><th>Anomalies</th><th>Critiques</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function messagesBloc(res: CMRAnalyseResponse): string {
  const m = res.global.messages_cles;
  const liste = (t: string, items: string[], couleur: string) =>
    `<div class="card msg"><h3 style="color:${couleur}">${esc(t)}</h3><ul>${
      items.length ? items.map((x) => `<li>${esc(x)}</li>`).join('') : '<li class="muted">—</li>'
    }</ul></div>`;
  return `<div class="cols">
${liste('✅ 5 principales forces', m.forces, OIF.vert)}
${liste('⚠️ 5 principales faiblesses', m.faiblesses, OIF.rouge)}
${liste('🎯 Recommandations prioritaires', m.recommandations, OIF.bleu)}
</div>`;
}

/** Tableau de bord détaillé (Livrable 3 — dashboard_cmr.html). */
export function construireDashboardHtml(res: CMRAnalyseResponse): string {
  const parProjet = res.projets
    .map((p) => {
      const stat = Object.entries(p.statuts)
        .map(
          ([s, n]) =>
            `<span class="badge" style="background:${couleurStatut(s)}">${esc(s)} ${n}</span>`,
        )
        .join(' ');
      return `<div class="card">
<h3 style="margin:0 0 4px;color:${OIF.bleu}">${esc(p.code)} · ${esc(p.nom)}</h3>
<div class="muted">${p.n_indicateurs} indicateurs · fiabilité ${p.scores.fiabilite}/100 · ${esc(
        p.mention_qualite,
      )} · taux médian ${pct(p.taux_atteinte_moyen)}</div>
<div style="margin:8px 0">${stat}</div>
${
  p.anomalies.length
    ? `<table><thead><tr><th>Réf.</th><th>Type</th><th>Sévérité</th><th>Constat</th></tr></thead><tbody>${p.anomalies
        .slice(0, 12)
        .map(
          (a) =>
            `<tr><td>${esc(a.ref)}</td><td>${esc(a.type)}</td><td>${esc(
              a.severite,
            )}</td><td>${esc(a.message)}</td></tr>`,
        )
        .join('')}</tbody></table>${
        p.anomalies.length > 12
          ? `<div class="muted">… ${p.anomalies.length - 12} autres.</div>`
          : ''
      }`
    : '<div class="muted">Aucune anomalie détectée.</div>'
}
</div>`;
    })
    .join('');

  const corps = `
<header class="hero"><h1>Tableau de bord CMR — Portefeuille</h1>
<p>Audit automatisé du Cadre de Mesure du Rendement · ${res.n_projets} projets · ${res.n_indicateurs} indicateurs</p></header>
${kpiBloc(res)}
<h2>Classement des projets</h2>
${classementTable(res)}
<h2>Messages clés</h2>
${messagesBloc(res)}
<h2>Détail par projet</h2>
${parProjet}`;
  return doc('Tableau de bord CMR', corps);
}

/** Infographie exécutive (Livrable 3 — infographie_cmr.html). */
export function construireInfographieHtml(res: CMRAnalyseResponse): string {
  const feux = res.global.classement
    .map(
      (r) =>
        `<div class="feu"><span class="dot">${esc(r.feu)}</span><div><strong>${esc(
          r.code,
        )}</strong><br><span class="muted">${esc(r.nom)}</span></div></div>`,
    )
    .join('');
  const st = res.global.repartition_statuts;
  const corps = `
<header class="hero"><h1>Synthèse exécutive CMR</h1>
<p>Vue d'ensemble du portefeuille · fiabilité globale ${res.global.kpi.score_fiabilite}/100</p></header>
${kpiBloc(res)}
<h2>Feux tricolores par projet</h2>
<div class="feux">${feux}</div>
<h2>Répartition des indicateurs</h2>
<div class="cols">
<div class="kpi"><div class="v" style="color:${OIF.vert}">${st.Conforme}</div><div class="l">🟢 Conforme</div></div>
<div class="kpi"><div class="v" style="color:${OIF.cyan}">${st.Corrigé}</div><div class="l">🔵 Corrigé</div></div>
<div class="kpi"><div class="v" style="color:${OIF.jaune}">${st['À vérifier']}</div><div class="l">🟡 À vérifier</div></div>
<div class="kpi"><div class="v" style="color:${OIF.rouge}">${st.Critique}</div><div class="l">🔴 Critique</div></div>
</div>
<h2>Messages clés</h2>
${messagesBloc(res)}`;
  return doc('Infographie CMR', corps);
}

/** Déclenche le téléchargement d'un fichier HTML autoporté. */
export function telechargerHtml(nomFichier: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
