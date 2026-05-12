'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ValeurAnnee } from '@/lib/indicateurs-annuels/types';

type Props = {
  code: string;
  valeurs: ValeurAnnee[];
  couleur: string;
};

/**
 * Graphique Recharts adapté au type d'indicateur :
 *   - A2 : LineChart (taux d'achèvement, courbe temporelle)
 *   - A1, B1 : BarChart par année avec ventilation femmes/hommes ou
 *     creation/renforcement (selon données dispo)
 *   - B4 : BarChart simple (montants annuels)
 *   - autres : LineChart par défaut
 */
export function GrapheIndicateurAnnuel({ code, valeurs, couleur }: Props) {
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

  // Indicateur taux (%) — LineChart sur 0..100
  if (code === 'A2') {
    return (
      <div className="mt-3 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="annee" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: '#64748b' }}
            />
            <Tooltip
              formatter={(v) =>
                typeof v === 'number' ? `${v.toFixed(1)} %` : '—'
              }
              labelStyle={{ color: '#0E4F88' }}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="valeur"
              stroke={couleur}
              strokeWidth={2.5}
              dot={{ r: 4, fill: couleur }}
              name="Taux"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // A1 — BarChart femmes/hommes empilés
  if (code === 'A1' && valeurs.some((v) => v.femmes !== undefined)) {
    return (
      <div className="mt-3 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="annee" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip
              labelStyle={{ color: '#0E4F88' }}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="femmes" stackId="sexe" name="Femmes" fill={couleur} />
            <Bar dataKey="hommes" stackId="sexe" name="Hommes" fill={`${couleur}80`} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // B1 — BarChart création/renforcement
  if (code === 'B1' && valeurs.some((v) => v.creation !== undefined)) {
    return (
      <div className="mt-3 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="annee" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip
              labelStyle={{ color: '#0E4F88' }}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="creation" stackId="b1" name="Création" fill={couleur} />
            <Bar dataKey="renforcement" stackId="b1" name="Renforcement" fill={`${couleur}80`} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // B4 — BarChart simple (€)
  if (code === 'B4') {
    return (
      <div className="mt-3 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="annee" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis
              tickFormatter={(v) => `${(v / 1000).toFixed(0)} k€`}
              tick={{ fontSize: 11, fill: '#64748b' }}
            />
            <Tooltip
              formatter={(v) =>
                typeof v === 'number' ? `${v.toLocaleString('fr-FR')} €` : '—'
              }
              labelStyle={{ color: '#0E4F88' }}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="valeur" fill={couleur} name="Volume d'appui" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Fallback générique — LineChart valeur
  return (
    <div className="mt-3 h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="annee" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip
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
      </ResponsiveContainer>
    </div>
  );
}
