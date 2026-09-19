import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DatasetInput, HistoriqueJob, IndicateurSource } from './types';

/**
 * Liste les indicateurs actifs pouvant servir de source à l'Atelier d'analyse.
 * (Les réponses d'enquête sont rattachées à un `indicateur_code`.)
 */
export async function listerIndicateursSource(): Promise<IndicateurSource[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('indicateurs')
    .select('code, libelle')
    .eq('actif', true)
    .order('ordre_affichage', { ascending: true });
  if (error) return [];
  return (data ?? []).map((r) => ({ code: r.code, libelle: r.libelle }));
}

/**
 * Charge les réponses d'enquête d'un indicateur en jeu de données DataStudio.
 * Le champ JSONB `donnees` de chaque réponse fournit les colonnes ; les clés
 * rencontrées forment l'ensemble des variables.
 */
export async function chargerDatasetEnquete(
  indicateurCode: string,
  projetCode?: string,
): Promise<DatasetInput> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('reponses_enquetes')
    .select('donnees')
    .eq('indicateur_code', indicateurCode)
    .is('deleted_at', null)
    .limit(5000);
  if (projetCode) query = query.eq('projet_code', projetCode);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows: Record<string, unknown>[] = (data ?? []).map((r) => {
    const d = r.donnees;
    return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
  });
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return { rows, columns, name: indicateurCode };
}

/** Programmes stratégiques actifs (pour l'analyse multi-projets). */
export async function listerProgrammes(): Promise<{ code: string; libelle: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('programmes_strategiques')
    .select('code, libelle')
    .eq('actif', true)
    .order('ordre_affichage', { ascending: true });
  return (data ?? []).map((p) => ({ code: p.code, libelle: p.libelle }));
}

/** Projets actifs (avec leur programme stratégique) pour l'analyse multi-projets. */
export async function listerProjets(): Promise<
  { code: string; libelle: string; programme: string }[]
> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('projets')
    .select('code, libelle, programme_strategique, actif')
    .eq('actif', true)
    .order('ordre_affichage', { ascending: true });
  return (data ?? []).map((p) => ({
    code: p.code,
    libelle: p.libelle,
    programme: p.programme_strategique,
  }));
}

/**
 * Analyse multi-projets : empile les réponses d'un indicateur sur PLUSIEURS
 * projets en une seule base, en ajoutant les colonnes « Projet » et « Programme
 * stratégique ». Permet ensuite de croiser tout résultat par projet/programme.
 * (Traitement mensuel : on plafonne le volume par sécurité.)
 */
export async function chargerDatasetMultiProjets(
  indicateurCode: string,
  projetCodes: string[],
): Promise<DatasetInput> {
  const supabase = await createSupabaseServerClient();

  const [{ data: projets }, { data: programmes }] = await Promise.all([
    supabase.from('projets').select('code, libelle, programme_strategique'),
    supabase.from('programmes_strategiques').select('code, libelle'),
  ]);
  const projMap = new Map(
    (projets ?? []).map((p) => [p.code, p as { libelle: string; programme_strategique: string }]),
  );
  const progMap = new Map((programmes ?? []).map((p) => [p.code, p.libelle]));

  let query = supabase
    .from('reponses_enquetes')
    .select('donnees, projet_code')
    .eq('indicateur_code', indicateurCode)
    .is('deleted_at', null)
    .limit(20000);
  if (projetCodes.length > 0) query = query.in('projet_code', projetCodes);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows: Record<string, unknown>[] = (data ?? []).map((r) => {
    const d =
      r.donnees && typeof r.donnees === 'object' && !Array.isArray(r.donnees)
        ? (r.donnees as Record<string, unknown>)
        : {};
    const proj = r.projet_code ? projMap.get(r.projet_code) : undefined;
    const progLib = proj
      ? (progMap.get(proj.programme_strategique) ?? proj.programme_strategique)
      : '';
    return {
      ...d,
      Projet: proj?.libelle ?? r.projet_code ?? '(non affecté)',
      Programme: progLib || '(non affecté)',
    };
  });

  const cles = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const columns = [
    ...cles.filter((k) => k !== 'Projet' && k !== 'Programme'),
    'Projet',
    'Programme',
  ];
  return {
    rows,
    columns,
    name: `Multi-projets — ${indicateurCode}`,
    variable_labels: { Projet: 'Projet', Programme: 'Programme stratégique' },
  };
}

/**
 * Historique des traitements de l'utilisateur (table datastudio_jobs).
 * La table peut ne pas encore exister en base (migration non appliquée) :
 * on renvoie alors un message plutôt qu'une erreur bloquante.
 */
export async function listerHistorique(): Promise<{
  jobs: HistoriqueJob[];
  erreur: string | null;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('datastudio_jobs')
    .select('id, type, titre, source, statut, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { jobs: [], erreur: error.message };
  return { jobs: (data ?? []) as HistoriqueJob[], erreur: null };
}
