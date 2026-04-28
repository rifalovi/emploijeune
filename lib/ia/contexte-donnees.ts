import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Enrichissement du contexte IA avec les vraies données de la plateforme — V2.2.0.
 *
 * Bug v2.0.0 : Carlos demandait « indicateurs avec chiffres », l'IA répondait
 * « tableau à compléter » parce qu'elle n'avait aucune donnée dans son contexte.
 *
 * Fix : à chaque appel à `analyser()`, on construit un bloc de contexte
 * factuel injecté dans le system prompt. Claude voit ainsi les chiffres
 * actuels et peut répondre précisément.
 *
 * Données injectées :
 *   • 5 indicateurs OIF (A1, A4, B1, B4, F1)
 *   • Top 10 pays par bénéficiaires
 *   • Top 10 projets par bénéficiaires
 *   • Répartition par programme stratégique (PS1/PS2/PS3)
 *   • Compteurs structures, organisations, utilisateurs
 *
 * Aucune donnée nominative n'est exposée — uniquement des agrégats.
 */

export type ContexteDonnees = {
  indicateurs: {
    A1: { libelle: string; valeur: number | null; femmes?: number; hommes?: number };
    A4: { libelle: string; valeur: number | null; proxy?: string };
    B1: { libelle: string; valeur: number | null };
    B4: { libelle: string; valeur: number | null; proxy?: string };
    F1: { libelle: string; valeur: number | null; proxy?: string };
  };
  bar_pays: Array<{ code: string; libelle: string | null; beneficiaires: number }>;
  bar_projets: Array<{ code: string; libelle: string | null; beneficiaires: number }>;
  pie_programmes: Array<{ code: string; libelle: string | null; beneficiaires: number }>;
  totaux: {
    structures: number;
    organisations: number;
    utilisateurs_actifs: number;
  };
  date_extraction: string;
};

/**
 * Charge les données live pour l'utilisateur authentifié. Les données sont
 * filtrées par RLS — l'IA ne voit donc que ce que l'utilisateur peut voir.
 */
export async function chargerContexteDonnees(): Promise<ContexteDonnees | null> {
  try {
    const supabase = await createSupabaseServerClient();

    const [oifResp, structuresResp, organisationsResp, utilisateursResp] = await Promise.all([
      supabase.rpc('get_indicateurs_oif_v1', { p_periode: 'all' }),
      supabase
        .from('structures')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null),
      supabase
        .from('organisations')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null),
      supabase
        .from('utilisateurs')
        .select('id', { count: 'exact', head: true })
        .eq('actif', true)
        .is('deleted_at', null),
    ]);

    if (oifResp.error || !oifResp.data) return null;
    const oif = oifResp.data as ContexteDonnees;

    return {
      indicateurs: oif.indicateurs,
      bar_pays: oif.bar_pays ?? [],
      bar_projets: oif.bar_projets ?? [],
      pie_programmes: oif.pie_programmes ?? [],
      totaux: {
        structures: structuresResp.count ?? 0,
        organisations: organisationsResp.count ?? 0,
        utilisateurs_actifs: utilisateursResp.count ?? 0,
      },
      date_extraction: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Sérialise le contexte en bloc Markdown injecté dans le system prompt.
 * Format optimisé pour la lecture par Claude : sections claires, listes
 * concises, sources tracées.
 */
export function formaterContexteDonnees(ctx: ContexteDonnees): string {
  const lignes: string[] = [];
  lignes.push('## Données actuelles de la plateforme');
  lignes.push(
    `_Extraites le ${new Date(ctx.date_extraction).toLocaleString('fr-FR')} via la RPC \`get_indicateurs_oif_v1\` (RLS appliquée pour l'utilisateur authentifié)._`,
  );
  lignes.push('');

  // Indicateurs OIF
  lignes.push('### 5 indicateurs OIF stratégiques');
  const i = ctx.indicateurs;
  const ligneA1 =
    i.A1.valeur !== null
      ? `**A1 — ${i.A1.libelle}** : **${i.A1.valeur.toLocaleString('fr-FR')}**` +
        (i.A1.femmes !== undefined && i.A1.hommes !== undefined
          ? ` (${i.A1.femmes.toLocaleString('fr-FR')} femmes · ${i.A1.hommes.toLocaleString('fr-FR')} hommes)`
          : '')
      : `**A1 — ${i.A1.libelle}** : à venir`;
  lignes.push(`- ${ligneA1}`);

  const formatIndicateur = (
    code: string,
    ind: { libelle: string; valeur: number | null; proxy?: string },
  ) => {
    if (ind.valeur === null) {
      return `- **${code} — ${ind.libelle}** : à venir${ind.proxy ? ` (${ind.proxy})` : ''}`;
    }
    return `- **${code} — ${ind.libelle}** : **${ind.valeur.toLocaleString('fr-FR')}**`;
  };
  lignes.push(formatIndicateur('A4', i.A4));
  lignes.push(formatIndicateur('B1', i.B1));
  lignes.push(formatIndicateur('B4', i.B4));
  lignes.push(formatIndicateur('F1', i.F1));
  lignes.push('');

  // Top pays
  if (ctx.bar_pays.length > 0) {
    lignes.push('### Top pays par bénéficiaires');
    for (const p of ctx.bar_pays) {
      lignes.push(
        `- ${p.libelle ?? p.code} (\`${p.code}\`) : ${p.beneficiaires.toLocaleString('fr-FR')}`,
      );
    }
    lignes.push('');
  }

  // Top projets
  if (ctx.bar_projets.length > 0) {
    lignes.push('### Top projets par bénéficiaires');
    for (const p of ctx.bar_projets) {
      lignes.push(
        `- \`${p.code}\` (${p.libelle ?? '—'}) : ${p.beneficiaires.toLocaleString('fr-FR')}`,
      );
    }
    lignes.push('');
  }

  // Programmes stratégiques
  if (ctx.pie_programmes.length > 0) {
    const total = ctx.pie_programmes.reduce((s, p) => s + p.beneficiaires, 0);
    lignes.push('### Répartition par programme stratégique');
    for (const p of ctx.pie_programmes) {
      const pct = total > 0 ? Math.round((p.beneficiaires / total) * 100) : 0;
      lignes.push(
        `- \`${p.code}\` ${p.libelle ?? ''} : ${p.beneficiaires.toLocaleString('fr-FR')} (${pct}%)`,
      );
    }
    lignes.push('');
  }

  // Totaux complémentaires
  lignes.push('### Autres totaux');
  lignes.push(`- Structures actives : **${ctx.totaux.structures.toLocaleString('fr-FR')}**`);
  lignes.push(`- Organisations actives : **${ctx.totaux.organisations.toLocaleString('fr-FR')}**`);
  lignes.push(
    `- Utilisateurs actifs : **${ctx.totaux.utilisateurs_actifs.toLocaleString('fr-FR')}**`,
  );
  lignes.push('');

  lignes.push(
    '_Toujours utiliser ces chiffres. Ne JAMAIS répondre « à compléter » ou « données non disponibles » si le chiffre est présent ci-dessus._',
  );

  return lignes.join('\n');
}
