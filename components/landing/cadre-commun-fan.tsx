'use client';

import { useState } from 'react';

/**
 * CadreCommunFan — Diagramme en éventail interactif avec légendes ancrées.
 *
 * Concept de mise en page (cf. capture utilisateur du 30/05/2026) :
 *   - Layout en 3 colonnes : label A (gauche) | SVG + labels B/C en haut (centre) | label D (droite).
 *   - Chaque légende affiche un titre coloré + une description grise en
 *     permanence (pas seulement au survol).
 *   - Le survol d'une brique ou d'un label intensifie la couleur du secteur
 *     correspondant et atténue les autres (focus visuel sans masquer
 *     l'information).
 *   - Sur mobile (< md), on bascule en colonne unique et les légendes
 *     passent au-dessus/en-dessous du SVG pour rester lisibles.
 */

type Secteur = {
  code: 'A' | 'B' | 'C' | 'D';
  path: string;
  fill: string;
  fillHover: string;
  couleur: string;
  cx: number;
  cy: number;
  titre: string;
  nomCourt: string;
  description: string;
};

const SECTEURS: Secteur[] = [
  {
    code: 'A',
    path: 'M15,265 A225,225 0 0,0 80.9,105.9 L184.8,209.8 A78,78 0 0,1 162,265 Z',
    fill: '#A8D8D5',
    fillHover: '#7DCAC6',
    couleur: '#0098A0',
    cx: 100,
    cy: 207,
    titre: 'Formation, compétences et insertion',
    nomCourt: 'Formation et Compétences',
    description:
      "Développer les compétences et l'employabilité pour faciliter l'insertion professionnelle.",
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
    nomCourt: 'Activités Économiques',
    description:
      "Encourager l'entrepreneuriat et la création d'emplois durables.",
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
    nomCourt: 'Intermédiation',
    description:
      "Faciliter l'accès aux opportunités d'emploi et la mise en relation.",
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
    nomCourt: "Écosystèmes d'Emploi",
    description:
      "Créer un environnement favorable à la croissance de l'emploi.",
  },
];

/* ─── Carte légende réutilisable ─────────────────────────────────────────── */

/**
 * Bloc légende : titre coloré + description grise. Sert pour les 4 cadres.
 * Aligne le texte selon la position dans le layout (gauche → align right,
 * droite → align left, haut → centré).
 */
function Legende({
  secteur,
  align,
  estActif,
  autreActif,
  onEnter,
  onLeave,
}: {
  secteur: Secteur;
  align: 'left' | 'right' | 'center';
  estActif: boolean;
  autreActif: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const textAlign =
    align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className={`${textAlign} max-w-[180px] cursor-pointer transition-opacity focus:outline-none`}
      style={{ opacity: autreActif ? 0.55 : 1 }}
      aria-label={`${secteur.nomCourt} — ${secteur.titre}`}
    >
      <span
        className="block text-sm font-bold leading-tight"
        style={{ color: secteur.couleur, textShadow: estActif ? '0 0 1px currentColor' : undefined }}
      >
        {secteur.nomCourt}
      </span>
      <span className="mt-1.5 block text-xs leading-snug text-slate-500">
        {secteur.description}
      </span>
    </button>
  );
}

/* ─── SVG pur ────────────────────────────────────────────────────────────── */

function FanSvg({
  actif,
  setActif,
}: {
  actif: string | null;
  setActif: (code: string | null) => void;
}) {
  return (
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
            style={{
              transition: 'fill 0.15s ease, opacity 0.15s ease',
              opacity: actif && actif !== s.code ? 0.55 : 1,
            }}
          />
          <circle
            cx={s.cx}
            cy={s.cy}
            r="26"
            fill={s.couleur}
            style={{
              transition: 'opacity 0.15s ease',
              opacity: actif && actif !== s.code ? 0.7 : 1,
            }}
          />
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
  );
}

/* ─── Composant principal ────────────────────────────────────────────────── */

export function CadreCommunFan() {
  const [actif, setActif] = useState<string | null>(null);
  const enter = (code: string) => () => setActif(code);
  const leave = () => setActif(null);

  const A = SECTEURS[0]!;
  const B = SECTEURS[1]!;
  const C = SECTEURS[2]!;
  const D = SECTEURS[3]!;

  return (
    <div className="w-full">
      {/* ── Desktop (md+) : grid 3 colonnes label gauche | SVG | label droite ── */}
      <div className="hidden items-center gap-4 md:grid md:grid-cols-[1fr_minmax(0,2fr)_1fr] lg:gap-8">
        {/* Colonne gauche : label A aligné à droite (vers la brique A) */}
        <div className="flex justify-end">
          <Legende
            secteur={A}
            align="right"
            estActif={actif === 'A'}
            autreActif={!!actif && actif !== 'A'}
            onEnter={enter('A')}
            onLeave={leave}
          />
        </div>

        {/* Colonne centrale : labels B/C en haut + SVG */}
        <div className="flex flex-col items-center gap-3">
          {/* Labels B (gauche) + C (droite) au-dessus du SVG, côte à côte */}
          <div className="flex w-full items-start justify-between gap-4 px-2">
            <Legende
              secteur={B}
              align="center"
              estActif={actif === 'B'}
              autreActif={!!actif && actif !== 'B'}
              onEnter={enter('B')}
              onLeave={leave}
            />
            <Legende
              secteur={C}
              align="center"
              estActif={actif === 'C'}
              autreActif={!!actif && actif !== 'C'}
              onEnter={enter('C')}
              onLeave={leave}
            />
          </div>

          {/* SVG centré */}
          <div className="w-full max-w-md">
            <FanSvg actif={actif} setActif={setActif} />
          </div>
        </div>

        {/* Colonne droite : label D aligné à gauche (vers la brique D) */}
        <div className="flex justify-start">
          <Legende
            secteur={D}
            align="left"
            estActif={actif === 'D'}
            autreActif={!!actif && actif !== 'D'}
            onEnter={enter('D')}
            onLeave={leave}
          />
        </div>
      </div>

      {/* ── Mobile (< md) : labels au-dessus et en-dessous, SVG au centre ──
          Concept : sur petit écran on ne peut pas étaler 3 colonnes, on
          empile verticalement : B+C en haut, SVG au centre, A+D en bas. */}
      <div className="flex flex-col items-center gap-4 md:hidden">
        <div className="grid w-full grid-cols-2 gap-3">
          <Legende
            secteur={B}
            align="center"
            estActif={actif === 'B'}
            autreActif={!!actif && actif !== 'B'}
            onEnter={enter('B')}
            onLeave={leave}
          />
          <Legende
            secteur={C}
            align="center"
            estActif={actif === 'C'}
            autreActif={!!actif && actif !== 'C'}
            onEnter={enter('C')}
            onLeave={leave}
          />
        </div>

        <div className="w-full max-w-sm">
          <FanSvg actif={actif} setActif={setActif} />
        </div>

        <div className="grid w-full grid-cols-2 gap-3">
          <Legende
            secteur={A}
            align="center"
            estActif={actif === 'A'}
            autreActif={!!actif && actif !== 'A'}
            onEnter={enter('A')}
            onLeave={leave}
          />
          <Legende
            secteur={D}
            align="center"
            estActif={actif === 'D'}
            autreActif={!!actif && actif !== 'D'}
            onEnter={enter('D')}
            onLeave={leave}
          />
        </div>
      </div>
    </div>
  );
}
