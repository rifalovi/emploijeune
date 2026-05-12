'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { BarChart3, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toggleIndicateurVisu } from '@/lib/indicateurs-annuels/server-actions';

type Props = {
  code: string;
  visuActiveeInit: boolean;
  visuForceeInit: boolean;
  nbAnnees: number;
};

/**
 * Encart super_admin permettant de forcer l'activation ou la désactivation
 * de la visualisation graphique pour un indicateur, peu importe le nombre
 * d'années collectées.
 *
 * Logique :
 *   - Par défaut, la règle automatique s'applique : visu activée si ≥ 2 années.
 *   - Si on active "Forcer le choix", on peut décider manuellement (on/off).
 *   - Si on retire "Forcer le choix", on revient à la règle automatique.
 */
export function ToggleVisuClient({ code, visuActiveeInit, visuForceeInit, nbAnnees }: Props) {
  const [visuForcee, setVisuForcee] = useState(visuForceeInit);
  const [visuActivee, setVisuActivee] = useState(visuActiveeInit);
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const res = await toggleIndicateurVisu({
        code,
        visu_forcee: visuForcee,
        valeur: visuActivee,
      });
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success(
        visuForcee
          ? `Visualisation forcée à ${visuActivee ? 'activée' : 'désactivée'} pour ${code}.`
          : `Visualisation de ${code} : règle automatique restaurée (≥ 2 années).`,
      );
    });
  };

  const regleAuto = nbAnnees >= 2;

  return (
    <section className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
      <header className="flex items-center gap-2">
        <BarChart3 className="size-4 text-purple-700" aria-hidden />
        <h2 className="text-sm font-semibold text-purple-900">
          Configuration de la visualisation (super_admin)
        </h2>
      </header>

      <div className="mt-3 space-y-3 text-xs text-purple-900">
        <p>
          La règle automatique active la visualisation à partir de{' '}
          <strong>2 années de collecte</strong>. Actuellement : {nbAnnees} année
          {nbAnnees > 1 ? 's' : ''} → règle auto = {regleAuto ? 'activée' : 'désactivée'}.
        </p>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
          <div>
            <p className="font-medium">Forcer un choix manuel</p>
            <p className="text-muted-foreground text-[10px]">
              Bypass la règle automatique. Utile pour démos ou pour masquer un indicateur peu
              fiable.
            </p>
          </div>
          <Switch
            checked={visuForcee}
            onCheckedChange={setVisuForcee}
            disabled={pending}
            aria-label="Forcer le choix manuel"
          />
        </div>

        {visuForcee && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
            <div>
              <p className="font-medium">Visualisation activée</p>
              <p className="text-muted-foreground text-[10px]">
                Choix appliqué peu importe le nombre d&apos;années.
              </p>
            </div>
            <Switch
              checked={visuActivee}
              onCheckedChange={setVisuActivee}
              disabled={pending}
              aria-label="Visualisation activée"
            />
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={pending}
            className="bg-purple-700 hover:bg-purple-800"
          >
            {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </section>
  );
}
