import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type DemandeAccesListItem = {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role_souhaite: 'editeur_projet' | 'contributeur_partenaire';
  contexte_souhaite: string | null;
  justification: string;
  statut: 'pending' | 'approved' | 'rejected';
  raison_rejet: string | null;
  created_at: string;
  decided_at: string | null;
};

/**
 * Liste paginée des demandes d'accès (admin_scs only via RLS).
 * Limité à 200 lignes V1 — pagination/filtres en V1.5 si volume.
 */
export async function listDemandesAcces(
  filtre?: 'pending' | 'approved' | 'rejected',
): Promise<DemandeAccesListItem[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from('demandes_acces')
    .select(
      'id, email, prenom, nom, role_souhaite, contexte_souhaite, justification, statut, raison_rejet, created_at, decided_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (filtre) q = q.eq('statut', filtre);
  const { data, error } = await q;
  if (error) throw new Error(`Impossible de charger les demandes : ${error.message}`);
  return (data ?? []) as DemandeAccesListItem[];
}

export async function compterDemandesEnAttente(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from('demandes_acces')
    .select('id', { count: 'exact', head: true })
    .eq('statut', 'pending');
  return count ?? 0;
}
