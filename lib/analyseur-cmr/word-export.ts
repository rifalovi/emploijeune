'use client';

/**
 * Export du rapport d'audit CMR en Word (.docx), aux couleurs de la charte OIF.
 * La bibliothèque `docx` est chargée dynamiquement (au clic) pour ne pas
 * alourdir le bundle. Reprend la structure du rapport HTML : résumé exécutif,
 * tableau des anomalies, synthèse par projet, analyse des incohérences et
 * décisions nécessitant une validation humaine.
 */

/* La lib `docx` n'expose pas de types précis : objets souples. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { CMRAnalyseResponse } from './types';

const BLEU = '0E4F88';
const GRIS = '64748B';
const POLICE = 'Calibri';

function texte(
  docx: any,
  contenu: string,
  opts: { bold?: boolean; color?: string; size?: number } = {},
): any {
  const { Paragraph, TextRun } = docx;
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: contenu,
        bold: opts.bold ?? false,
        color: opts.color,
        size: opts.size ?? 20,
        font: POLICE,
      }),
    ],
  });
}

function titre(docx: any, niveau: 1 | 2, contenu: string): any {
  const { Paragraph, TextRun } = docx;
  const conf =
    niveau === 1 ? { size: 26, after: 120, before: 220 } : { size: 22, after: 80, before: 140 };
  return new Paragraph({
    spacing: { after: conf.after, before: conf.before },
    children: [
      new TextRun({ text: contenu, bold: true, color: BLEU, size: conf.size, font: POLICE }),
    ],
  });
}

function cellule(docx: any, contenu: string, opts: { header?: boolean } = {}): any {
  const { TableCell, Paragraph, TextRun } = docx;
  return new TableCell({
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    shading: opts.header ? { fill: BLEU } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: contenu,
            bold: opts.header ?? false,
            color: opts.header ? 'FFFFFF' : undefined,
            size: 18,
            font: POLICE,
          }),
        ],
      }),
    ],
  });
}

function tableau(docx: any, entetes: string[], lignes: string[][]): any {
  const { Table, TableRow, WidthType } = docx;
  const rows = [
    new TableRow({
      tableHeader: true,
      children: entetes.map((h) => cellule(docx, h, { header: true })),
    }),
    ...lignes.map((ligne) => new TableRow({ children: ligne.map((c) => cellule(docx, c)) })),
  ];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${v} %`;
}

/** Génère et télécharge le rapport d'audit CMR au format Word (.docx). */
export async function exporterRapportWord(
  res: CMRAnalyseResponse,
  nomFichier = 'rapport_audit_cmr.docx',
): Promise<void> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun } = docx;
  const k = res.global.kpi;
  const m = res.global.messages_cles;

  const enfants: any[] = [];

  // Titre.
  enfants.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: "Rapport d'audit analytique du CMR",
          bold: true,
          color: BLEU,
          size: 34,
          font: POLICE,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Cadre de Mesure du Rendement · ${res.n_projets} projets · ${res.n_indicateurs} indicateurs`,
          italics: true,
          color: GRIS,
          size: 20,
          font: POLICE,
        }),
      ],
    }),
  );

  // 1. Résumé exécutif.
  enfants.push(titre(docx, 1, '1. Résumé exécutif'));
  enfants.push(
    texte(docx, `Nombre de projets audités : ${k.n_projets} · Indicateurs : ${k.n_indicateurs}`),
  );
  enfants.push(
    texte(
      docx,
      `Anomalies détectées : ${k.n_anomalies} · Taux d'atteinte médian : ${pct(k.taux_atteinte_global)}`,
    ),
  );
  enfants.push(
    texte(
      docx,
      `Qualité des données : ${k.score_qualite}/100 · Cohérence : ${k.score_coherence}/100`,
    ),
  );
  enfants.push(
    texte(
      docx,
      `Score global de fiabilité : ${k.score_fiabilite}/100 — ${mentionFiabilite(k.score_fiabilite)}`,
      { bold: true, size: 24 },
    ),
  );

  // 2. Tableau des anomalies.
  enfants.push(titre(docx, 1, '2. Tableau des anomalies'));
  const parType = new Map<string, number>();
  for (const p of res.projets)
    for (const a of p.anomalies) parType.set(a.type, (parType.get(a.type) ?? 0) + 1);
  const typesRows = [...parType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => [t, String(n)]);
  enfants.push(
    typesRows.length
      ? tableau(docx, ["Type d'anomalie", 'Occurrences'], typesRows)
      : texte(docx, 'Aucune anomalie détectée.'),
  );

  // 3. Synthèse par projet.
  enfants.push(titre(docx, 1, '3. Synthèse par projet'));
  enfants.push(
    tableau(
      docx,
      ['Projet', 'Indic.', 'Fiabilité', 'Anomalies', 'Critiques', 'Qualité'],
      res.projets.map((p) => [
        `${p.code} · ${p.nom}`,
        String(p.n_indicateurs),
        `${p.scores.fiabilite}/100`,
        String(p.n_anomalies),
        String(p.statuts.Critique),
        p.mention_qualite,
      ]),
    ),
  );

  // 4. Analyse des incohérences.
  enfants.push(titre(docx, 1, '4. Analyse des incohérences'));
  const liste = (t: string, items: string[]) => {
    enfants.push(titre(docx, 2, t));
    if (items.length) {
      for (const item of items) {
        enfants.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40 },
            children: [new TextRun({ text: item, size: 20, font: POLICE })],
          }),
        );
      }
    } else {
      enfants.push(texte(docx, '—'));
    }
  };
  liste('Forces', m.forces);
  liste('Faiblesses', m.faiblesses);
  liste('Recommandations prioritaires', m.recommandations);

  // 5. Décisions nécessitant une validation humaine.
  enfants.push(titre(docx, 1, '5. Décisions nécessitant une validation humaine'));
  enfants.push(
    texte(
      docx,
      'Hypothèses et corrections incertaines — proposées, non appliquées automatiquement (données originales préservées).',
      {
        color: GRIS,
      },
    ),
  );
  const decisions = res.projets.flatMap((p) =>
    p.indicateurs.flatMap((ind) =>
      ind.corrections
        .filter((c) => !c.applique)
        .map((c) => [p.code, ind.ref, c.champ, c.confiance, c.justification]),
    ),
  );
  enfants.push(
    decisions.length
      ? tableau(docx, ['Projet', 'Réf.', 'Champ', 'Confiance', 'Justification'], decisions)
      : texte(
          docx,
          'Aucune décision en attente : toutes les corrections sont arithmétiques et certaines.',
        ),
  );

  const doc = new Document({
    creator: 'Analyseur de CMR — OIF Emploi Jeunes',
    sections: [{ children: enfants }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function mentionFiabilite(score: number): string {
  if (score >= 85) return 'Fiabilité élevée';
  if (score >= 70) return 'Bonne fiabilité avec réserves';
  if (score >= 50) return 'Fiabilité moyenne — à consolider';
  return 'Fiabilité limitée — vérifications importantes requises';
}
