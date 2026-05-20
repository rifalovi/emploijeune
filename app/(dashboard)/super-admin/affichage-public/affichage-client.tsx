'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { saveConfigVitrine } from '@/lib/config-vitrine/server-actions';
import type { CodePilier, Pilier } from '@/lib/referentiels/indicateurs';

export type ConfigIndicateur = {
  code: string;
  pilier: CodePilier;
  intitule: string;
  labelMetrique: string;
  visible: boolean;
  ordre: number;
};

type Props = {
  config: ConfigIndicateur[];
  piliers: Record<CodePilier, Pilier>;
};

export function AffichagePublicClient({ config, piliers }: Props) {
  const [etat, setEtat] = useState<ConfigIndicateur[]>(config);
  const [pending, startTransition] = useTransition();

  const visiblesCount = useMemo(() => etat.filter((c) => c.visible).length, [etat]);

  const setVisible = (code: string, visible: boolean) => {
    setEtat((prev) =>
      prev.map((c) => {
        if (c.code !== code) return c;
        return {
          ...c,
          visible,
          // À l'activation, on attribue le prochain ordre dispo (max + 1).
          ordre: visible ? (c.ordre > 0 ? c.ordre : nextOrdre(prev)) : 0,
        };
      }),
    );
  };

  const setOrdre = (code: string, ordre: number) => {
    setEtat((prev) => prev.map((c) => (c.code === code ? { ...c, ordre } : c)));
  };

  const enregistrer = () => {
    const selections = etat.map((c) => ({ code: c.code, visible: c.visible, ordre: c.ordre }));
    startTransition(async () => {
      const res = await saveConfigVitrine(selections);
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success('Configuration enregistrée. La vitrine publique est à jour.');
    });
  };

  const parPilier = useMemo(() => {
    const ordreParPilier: CodePilier[] = ['A', 'B', 'C', 'D', 'F'];
    return ordreParPilier
      .map((pilier) => ({
        pilier: piliers[pilier],
        items: etat.filter((c) => c.pilier === pilier),
      }))
      .filter((g) => g.items.length > 0);
  }, [etat, piliers]);

  return (
    <div className="space-y-6">
      <div className="bg-muted/40 flex items-center justify-between rounded-md border p-3 text-sm">
        <span>
          <strong>{visiblesCount}</strong> indicateur{visiblesCount > 1 ? 's' : ''} sélectionné
          {visiblesCount > 1 ? 's' : ''}.
        </span>
        <Button onClick={enregistrer} disabled={pending} size="sm" className="gap-2">
          <Save className="size-4" aria-hidden />
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      <div className="space-y-8">
        {parPilier.map((groupe) => (
          <section key={groupe.pilier.code} className="space-y-3">
            <div className="flex items-baseline gap-3">
              <span
                className="inline-flex size-7 items-center justify-center rounded text-xs font-bold text-white"
                style={{ backgroundColor: groupe.pilier.couleur }}
              >
                {groupe.pilier.code}
              </span>
              <h3 className="text-sm font-semibold tracking-tight">
                {groupe.pilier.titre} — {groupe.pilier.sousTitre}
              </h3>
            </div>
            <ul className="divide-y rounded-md border">
              {groupe.items.map((ind) => (
                <li
                  key={ind.code}
                  className="hover:bg-muted/40 flex items-center gap-4 px-4 py-2.5"
                >
                  <Checkbox
                    id={`vitrine-${ind.code}`}
                    checked={ind.visible}
                    onCheckedChange={(v) => setVisible(ind.code, Boolean(v))}
                    aria-label={`Afficher ${ind.code}`}
                  />
                  <label
                    htmlFor={`vitrine-${ind.code}`}
                    className="min-w-0 flex-1 cursor-pointer text-sm"
                  >
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      {ind.code}
                    </span>{' '}
                    <span>{ind.intitule}</span>
                    {ind.labelMetrique !== ind.intitule && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({ind.labelMetrique})
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <label htmlFor={`ordre-${ind.code}`} className="text-muted-foreground text-xs">
                      Ordre
                    </label>
                    <Input
                      id={`ordre-${ind.code}`}
                      type="number"
                      min={0}
                      max={99}
                      value={ind.ordre || ''}
                      onChange={(e) => setOrdre(ind.code, Number(e.target.value) || 0)}
                      disabled={!ind.visible}
                      className="h-8 w-16 text-center text-sm"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        Les valeurs agrégées s&apos;affichent automatiquement à partir des bénéficiaires (A1), des
        structures (B1, B4) et des saisies manuelles (autres indicateurs). Si aucune valeur
        n&apos;est disponible, la carte affiche «&nbsp;—&nbsp;».
      </p>
    </div>
  );
}

function nextOrdre(items: ConfigIndicateur[]): number {
  const max = items.reduce((acc, c) => Math.max(acc, c.ordre ?? 0), 0);
  return max + 1;
}
