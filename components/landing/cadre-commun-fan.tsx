'use client';

import { useState } from 'react';

/**
 * CadreCommunFan — Diagramme en éventail interactif.
 *
 * Client Component : les `<path>` de chaque secteur répondent au hover
 * et affichent une bulle avec le nom du cadre associé.
 */

const SECTEURS = [
  {
    code: 'A',
    path: 'M15,265 A225,225 0 0,0 80.9,105.9 L184.8,209.8 A78,78 0 0,1 162,265 Z',
    fill: '#A8D8D5',
    fillHover: '#7DCAC6',
    couleur: '#0098A0',
    cx: 100,
    cy: 207,
    titre: 'Formation, compétences et insertion',
  },
  {
    code: 'B',
    path: 'M80.9,105.9 A225,225 0 0,0 240,40 L240,187 A78,78 0 0,1 184.8,209.8 Z',
    fill: '#B8E0B0',
    fillHover: '#90D086',
    couleur: '#5BAD4E',
    cx: 182,
    cy: 125,
    titre: 'Activités économiques, entrepreneuriat et emploi',
  },
  {
    code: 'C',
    path: 'M240,40 A225,225 0 0,0 399.1,105.9 L295.2,209.8 A78,78 0 0,1 240,187 Z',
    fill: '#E8D87A',
    fillHover: '#D4C040',
    couleur: '#B8A000',
    cx: 298,
    cy: 125,
    titre: "Intermédiation et accès aux opportunités",
  },
  {
    code: 'D',
    path: 'M399.1,105.9 A225,225 0 0,0 465,265 L318,265 A78,78 0 0,1 295.2,209.8 Z',
    fill: '#F5C4A0',
    fillHover: '#EEA070',
    couleur: '#D96030',
    cx: 380,
    cy: 207,
    titre: "Écosystèmes et conditions de l'emploi",
  },
];

export function CadreCommunFan() {
  const [actif, setActif] = useState<string | null>(null);

  const secteurActif = SECTEURS.find((s) => s.code === actif) ?? null;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="0 0 480 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full drop-shadow-sm"
        role="img"
        aria-label="Diagramme en éventail du Cadre Commun de Mesure OIF"
      >
        {SECTEURS.map((s) => (
          <g
            key={s.code}
            onMouseEnter={() => setActif(s.code)}
            onMouseLeave={() => setActif(null)}
            className="cursor-pointer"
            role="img"
            aria-label={`Cadre ${s.code} : ${s.titre}`}
          >
            <path
              d={s.path}
              fill={actif === s.code ? s.fillHover : s.fill}
              stroke="white"
              strokeWidth="4"
              style={{ transition: 'fill 0.15s ease' }}
            />
            <circle cx={s.cx} cy={s.cy} r="26" fill={s.couleur} />
            <text
              x={s.cx}
              y={s.cy + 5}
              textAnchor="middle"
              fontSize="15"
              fontWeight="bold"
              fill="white"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {s.code}
            </text>
          </g>
        ))}

        {/* Cercle central blanc */}
        <circle cx="240" cy="265" r="74" fill="white" />

        {/* Texte central */}
        <text
          x="240"
          y="257"
          textAnchor="middle"
          fontSize="8"
          fill="#64748b"
          letterSpacing="0.1em"
          fontWeight="600"
        >
          CADRE COMMUN
        </text>
        <text
          x="240"
          y="270"
          textAnchor="middle"
          fontSize="8"
          fill="#94a3b8"
          letterSpacing="0.08em"
        >
          DE MESURE
        </text>
      </svg>

      {/* Label sous le SVG — hauteur réservée pour éviter le layout shift.
          Concept : on n'utilise pas d'absolute overlay (risque de stacking context
          derrière le filtre drop-shadow du SVG). Un bloc statique sous le SVG
          est plus fiable cross-browser et accessible (aria-live). */}
      <div className="flex min-h-[36px] w-full items-center justify-center" aria-live="polite">
        {secteurActif ? (
          <span
            className="rounded-xl px-4 py-1.5 text-sm font-semibold text-white shadow-md"
            style={{ backgroundColor: secteurActif.couleur }}
          >
            {secteurActif.code} — {secteurActif.titre}
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            Survolez un cadre pour en savoir plus
          </span>
        )}
      </div>
    </div>
  );
}
