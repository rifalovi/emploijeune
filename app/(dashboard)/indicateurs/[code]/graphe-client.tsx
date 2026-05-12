'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TYPES_GRAPHIQUE,
  TYPE_GRAPHIQUE_LIBELLES,
  type TypeGraphique,
  type ValeurAnnee,
} from '@/lib/indicateurs-annuels/types';

type Props = {
  code: string;
  valeurs: ValeurAnnee[];
  couleur: string;
};

/**
 * Composant graphique avec sélecteur de type. L'utilisateur choisit parmi
 * barres / ligne / aire / secteur. Le choix est local (non persisté).
 *
 * Le type par défaut dépend du code :
 *   - A2 (taux) : ligne (évolution dans le temps)
 *   - B4 (montant) : barres
 *   - autres : barres
 */
export function GrapheIndicateurAnnuel({ code, valeurs, couleur }: Props) {
  const typeParDefaut: TypeGraphique = code === 'A2' ? 'ligne' : 'barres';
  const [type, setType] = useState<TypeGraphique>(typeParDefaut);

  // Données préparées avec dépendances (ventilations)
  const data = valeurs.map((v) => ({
    annee: String(v.annee),
    valeur: v.valeur,
    femmes: v.femmes,
    hommes: v.hommes,
    creation: v.creation,
    renforcement: v.renforcement,
    numerateur: v.numerateur,
    denominateur: v.denominateur,
  }));

  const formatYAxis = (n: number) => {
    if (code === 'A2') return `${n}%`;
    if (code === 'B4') return `${(n / 1000).toFixed(0)} k€`;
    return String(n);
  };
  const formatTooltip = (v: unknown): string => {
    if (typeof v !== 'number') return '—';
    if (code === 'A2') return `${v.toFixed(1)} %`;
    if (code === 'B4') return `${v.toLocaleString('fr-FR')} €`;
    return v.toLocaleString('fr-FR');
  };

  // Ventilation appliquée seulement aux types adaptés (barres / aire empilable)
  const aVentilationSexe = code === 'A1' && valeurs.some((v) => v.femmes !== undefined);
  const aVentilationStatut = code === 'B1' && valeurs.some((v) => v.creation !== undefined);

  return (
    <div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium">Type de graphique :</span>
        {TYPES_GRAPHIQUE.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              type === t
                ? 'bg-[#0E4F88] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {TYPE_GRAPHIQUE_LIBELLES[t]}
          </button>
        ))}
      </div>

      <div className="mt-3 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'ligne' ? (
            <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="annee" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: '#64748b' }}
                domain={code === 'A2' ? [0, 100] : undefined}
              />
              <Tooltip
                formatter={formatTooltip}
                labelStyle={{ color: '#0E4F88' }}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="valeur"
                stroke={couleur}
                strokeWidth={2.5}
                dot={{ r: 4, fill: couleur }}
                name="Valeur"
              />
            </LineChart>
          ) : type === 'aire' ? (
            <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="annee" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: '#64748b' }}
                domain={code === 'A2' ? [0, 100] : undefined}
              />
              <Tooltip
                formatter={formatTooltip}
                labelStyle={{ color: '#0E4F88' }}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="valeur"
                stroke={couleur}
                fill={`${couleur}55`}
                strokeWidth={2}
                name="Valeur"
              />
            </AreaChart>
          ) : type === 'secteur' ? (
            // Pour un PieChart, on agrège chaque année comme une part du total.
            // C'est utile pour les indicateurs cumulatifs (effectifs, montants).
            <PieChart>
              <Tooltip formatter={formatTooltip} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={data.filter((d) => typeof d.valeur === 'number' && d.valeur > 0)}
                dataKey="valeur"
                nameKey="annee"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(props) => {
                  const value = typeof props.value === 'number' ? props.value : 0;
                  return `${props.name} : ${formatTooltip(value)}`;
                }}
              >
                {data.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={`${couleur}${Math.max(40, 255 - idx * 35)
                      .toString(16)
                      .padStart(2, '0')}`}
                  />
                ))}
              </Pie>
            </PieChart>
          ) : (
            // Type 'barres' par défaut
            <BarChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="annee" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: '#64748b' }}
                domain={code === 'A2' ? [0, 100] : undefined}
              />
              <Tooltip
                formatter={formatTooltip}
                labelStyle={{ color: '#0E4F88' }}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              {(aVentilationSexe || aVentilationStatut) && (
                <Legend wrapperStyle={{ fontSize: 11 }} />
              )}
              {aVentilationSexe ? (
                <>
                  <Bar dataKey="femmes" stackId="vent" name="Femmes" fill={couleur} />
                  <Bar dataKey="hommes" stackId="vent" name="Hommes" fill={`${couleur}80`} />
                </>
              ) : aVentilationStatut ? (
                <>
                  <Bar dataKey="creation" stackId="vent" name="Création" fill={couleur} />
                  <Bar
                    dataKey="renforcement"
                    stackId="vent"
                    name="Renforcement"
                    fill={`${couleur}80`}
                  />
                </>
              ) : (
                <Bar dataKey="valeur" fill={couleur} name="Valeur" />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
