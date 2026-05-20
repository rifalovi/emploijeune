import { createSupabaseServerClient } from '@/lib/supabase/server';
import { INDICATEURS, PILIERS } from '@/lib/referentiels/indicateurs';
import { AffichagePublicClient } from './affichage-client';
import type { ConfigIndicateur } from './affichage-client';

export const metadata = { title: 'Affichage public — Super Admin' };

export default async function AffichagePublicPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('config_vitrine_indicateurs')
    .select('indicateur_code, visible, ordre');

  const configParCode = new Map(
    (data ?? []).map((r) => [r.indicateur_code, { visible: r.visible, ordre: r.ordre }]),
  );

  const config: ConfigIndicateur[] = INDICATEURS.map((ind) => {
    const c = configParCode.get(ind.code);
    return {
      code: ind.code,
      pilier: ind.pilier,
      intitule: ind.intitule,
      labelMetrique: ind.labelMetrique ?? ind.intitule,
      visible: c?.visible ?? false,
      ordre: c?.ordre ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          Configuration de la vitrine publique
        </h2>
        <p className="text-muted-foreground text-sm">
          Sélectionnez les indicateurs du Cadre Commun à afficher dans la section{' '}
          <strong>Données agrégées</strong> de la page d&apos;accueil publique. L&apos;ordre
          d&apos;affichage est défini par le numéro de la colonne « Ordre » (1 = premier).
        </p>
      </header>

      <AffichagePublicClient config={config} piliers={PILIERS} />
    </div>
  );
}
