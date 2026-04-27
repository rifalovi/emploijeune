'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';

type Donnee = {
  code: string;
  libelle: string | null;
  beneficiaires: number;
};

/**
 * Pie chart Recharts — répartition bénéficiaires par programme stratégique
 * (PS1/PS2/PS3) — Étape 9 Q3.
 *
 * Couleurs : palette OFFICIELLE OIF (Code couleur programmation OIF.pdf)
 * via lib/design/oif/programmes.ts. PS1=#0198E9, PS2=#5D0073, PS3=#7EB301.
 */
const COULEURS_PS: Record<string, string> = {
  PS1: PROGRAMMES_STRATEGIQUES.PS1.principale,
  PS2: PROGRAMMES_STRATEGIQUES.PS2.principale,
  PS3: PROGRAMMES_STRATEGIQUES.PS3.principale,
};

export function ChartProgrammesPie({ data }: { data: Donnee[] }) {
  const total = data.reduce((s, d) => s + d.beneficiaires, 0);

  if (data.length === 0 || total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Répartition par programme stratégique</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground py-8 text-center text-sm italic">
          Aucun bénéficiaire dans le périmètre sélectionné.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Répartition par programme stratégique</CardTitle>
        <CardDescription>
          {total} bénéficiaire(s) · {data.length} programme(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="beneficiaires"
                nameKey="code"
                cx="50%"
                cy="50%"
                outerRadius={90}
                labelLine={false}
                label={(props) => {
                  // Hotfix v1.5.0 : n'affiche le label QUE si la slice
                  // dépasse 5% — sinon les slices minuscules (ex. PS1=1%
                  // PS2=1%) se chevauchent et deviennent illisibles. Les
                  // valeurs précises restent visibles dans le tooltip et la
                  // légende.
                  const p = props as unknown as { code?: string; beneficiaires?: number };
                  const code = p.code ?? '';
                  const nb = p.beneficiaires ?? 0;
                  const pct = Math.round((nb / total) * 100);
                  if (pct < 5) return '';
                  return `${code} ${pct}%`;
                }}
              >
                {data.map((d) => (
                  <Cell key={d.code} fill={COULEURS_PS[d.code] ?? 'hsl(var(--muted))'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v, _name, item) => {
                  const payload = (item as { payload?: Donnee }).payload;
                  return [
                    `${Number(v ?? 0)} bénéficiaire(s)`,
                    payload?.libelle ?? payload?.code ?? '',
                  ] as [string, string];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) => {
                  const code = String(value ?? '');
                  const item = data.find((d) => d.code === code);
                  return item?.libelle ? `${code} — ${item.libelle}` : code;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
