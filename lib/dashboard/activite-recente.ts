import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Periode } from '@/lib/kpis/indicateurs-oif';

export type EvenementActivite = {
  id: string;
  type: 'beneficiaire_cree' | 'beneficiaire_maj' | 'structure_cree' | 'structure_maj' | 'import';
  libelle: string;
  detail: string | null;
  href: string | null;
  horodatage: string;
};

const FILTRE_DATE: Record<Periode, () => string | null> = {
  '7j': () => new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
  '30j': () => new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  '90j': () => new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
  all: () => null,
};

/**
 * Activité récente unifiée : créations/MAJ bénéficiaires + structures + imports.
 * Filtrée par RLS — admin voit tout, éditeur ses projets, etc.
 *
 * Les requêtes sont parallèles. Tri chronologique côté TS pour fusionner
 * les 3 sources, top 10 retournés.
 */
export async function getActiviteRecente(periode: Periode = '30j'): Promise<EvenementActivite[]> {
  const supabase = await createSupabaseServerClient();
  const dateMin = FILTRE_DATE[periode]();

  const baseBenef = supabase
    .from('beneficiaires')
    .select('id, prenom, nom, projet_code, created_at, updated_at')
    .is('deleted_at', null);
  const beneficiairesQ = dateMin
    ? baseBenef.gte('updated_at', dateMin).order('updated_at', { ascending: false }).limit(10)
    : baseBenef.order('updated_at', { ascending: false }).limit(10);

  const baseStruct = supabase
    .from('structures')
    .select('id, nom_structure, projet_code, created_at, updated_at')
    .is('deleted_at', null);
  const structuresQ = dateMin
    ? baseStruct.gte('updated_at', dateMin).order('updated_at', { ascending: false }).limit(10)
    : baseStruct.order('updated_at', { ascending: false }).limit(10);

  const baseImport = supabase
    .from('imports_excel')
    .select('id, fichier_nom, statut, nb_lignes_a1, nb_lignes_b1, demarre_a')
    .is('deleted_at', null);
  const importsQ = dateMin
    ? baseImport.gte('demarre_a', dateMin).order('demarre_a', { ascending: false }).limit(5)
    : baseImport.order('demarre_a', { ascending: false }).limit(5);

  const [benef, struct, imp] = await Promise.all([beneficiairesQ, structuresQ, importsQ]);

  const evts: EvenementActivite[] = [];

  for (const b of benef.data ?? []) {
    const cree = b.created_at === b.updated_at;
    evts.push({
      id: `b-${b.id}`,
      type: cree ? 'beneficiaire_cree' : 'beneficiaire_maj',
      libelle: cree ? 'Nouveau bénéficiaire' : 'Bénéficiaire mis à jour',
      detail: `${b.prenom} ${b.nom} · ${b.projet_code}`,
      href: `/beneficiaires/${b.id}`,
      horodatage: b.updated_at,
    });
  }

  for (const s of struct.data ?? []) {
    const cree = s.created_at === s.updated_at;
    evts.push({
      id: `s-${s.id}`,
      type: cree ? 'structure_cree' : 'structure_maj',
      libelle: cree ? 'Nouvelle structure' : 'Structure mise à jour',
      detail: `${s.nom_structure} · ${s.projet_code}`,
      href: `/structures/${s.id}`,
      horodatage: s.updated_at,
    });
  }

  for (const i of imp.data ?? []) {
    evts.push({
      id: `i-${i.id}`,
      type: 'import',
      libelle: 'Import Excel',
      detail: `${i.fichier_nom} · ${i.nb_lignes_a1 ?? 0} A1 + ${i.nb_lignes_b1 ?? 0} B1 · ${i.statut}`,
      href: '/imports',
      horodatage: i.demarre_a,
    });
  }

  evts.sort((a, b) => b.horodatage.localeCompare(a.horodatage));
  return evts.slice(0, 10);
}
