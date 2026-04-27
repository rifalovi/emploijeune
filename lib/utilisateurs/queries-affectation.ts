import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type ProjetReferentiel = {
  code: string;
  libelle: string;
  programme_strategique: string | null;
  ordre_affichage: number;
};

export type AffectationCourante = {
  id: string;
  user_id: string;
  projet_code: string;
  role_dans_projet: string;
  date_debut: string;
  attribue_par: string | null;
  raison_debut: string | null;
  // Joined
  projet_libelle: string | null;
  attribue_par_email: string | null;
};

export type LigneHistorique = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_nom: string | null;
  projet_code: string;
  projet_libelle: string | null;
  role_dans_projet: string;
  date_debut: string;
  date_fin: string | null;
  attribue_par: string | null;
  transfere_par: string | null;
  transfere_a: string | null;
  raison_debut: string | null;
  raison_fin: string | null;
};

export type StructureHistoriqueProjet = {
  id: string;
  structure_id: string;
  projet_code: string;
  projet_libelle: string | null;
  date_debut_financement: string;
  date_fin_financement: string | null;
  motif_changement: string | null;
};

/**
 * Liste tous les projets du référentiel (admin_scs only ou via RLS lecture libre).
 */
export async function listProjetsReferentiel(): Promise<ProjetReferentiel[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('projets')
    .select('code, libelle, programme_strategique, ordre_affichage')
    .order('ordre_affichage', { ascending: true });
  return (data ?? []).map((p) => ({
    code: p.code,
    libelle: p.libelle,
    programme_strategique: p.programme_strategique ?? null,
    ordre_affichage: p.ordre_affichage,
  }));
}

/**
 * Affectations actives d'un utilisateur (admin_scs only — service_role).
 */
export async function getAffectationsCourantes(userId: string): Promise<AffectationCourante[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('affectation_projet_courante')
    .select(
      `id, user_id, projet_code, role_dans_projet, date_debut, attribue_par, raison_debut,
       projet:projets!projet_code ( libelle )`,
    )
    .eq('user_id', userId)
    .order('projet_code', { ascending: true });

  type Raw = {
    id: string;
    user_id: string;
    projet_code: string;
    role_dans_projet: string;
    date_debut: string;
    attribue_par: string | null;
    raison_debut: string | null;
    projet: { libelle: string } | { libelle: string }[] | null;
  };

  return ((data ?? []) as Raw[]).map((r) => {
    const proj = Array.isArray(r.projet) ? r.projet[0] : r.projet;
    return {
      id: r.id,
      user_id: r.user_id,
      projet_code: r.projet_code,
      role_dans_projet: r.role_dans_projet,
      date_debut: r.date_debut,
      attribue_par: r.attribue_par,
      raison_debut: r.raison_debut,
      projet_libelle: proj?.libelle ?? null,
      attribue_par_email: null,
    };
  });
}

/**
 * Historique complet d'un utilisateur (toutes ses affectations passées + actives).
 */
export async function getHistoriqueUtilisateur(userId: string): Promise<LigneHistorique[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('affectation_projet_historique')
    .select(
      `id, user_id, projet_code, role_dans_projet, date_debut, date_fin,
       attribue_par, transfere_par, transfere_a, raison_debut, raison_fin,
       projet:projets!projet_code ( libelle )`,
    )
    .eq('user_id', userId)
    .order('date_debut', { ascending: false });

  type Raw = {
    id: string;
    user_id: string;
    projet_code: string;
    role_dans_projet: string;
    date_debut: string;
    date_fin: string | null;
    attribue_par: string | null;
    transfere_par: string | null;
    transfere_a: string | null;
    raison_debut: string | null;
    raison_fin: string | null;
    projet: { libelle: string } | { libelle: string }[] | null;
  };

  return ((data ?? []) as Raw[]).map((r) => {
    const proj = Array.isArray(r.projet) ? r.projet[0] : r.projet;
    return {
      id: r.id,
      user_id: r.user_id,
      user_email: null,
      user_nom: null,
      projet_code: r.projet_code,
      projet_libelle: proj?.libelle ?? null,
      role_dans_projet: r.role_dans_projet,
      date_debut: r.date_debut,
      date_fin: r.date_fin,
      attribue_par: r.attribue_par,
      transfere_par: r.transfere_par,
      transfere_a: r.transfere_a,
      raison_debut: r.raison_debut,
      raison_fin: r.raison_fin,
    };
  });
}

/**
 * Historique complet d'un projet (tous les utilisateurs qui l'ont géré).
 * Joint avec la table utilisateurs pour récupérer le nom complet.
 */
export async function getHistoriqueProjet(projetCode: string): Promise<LigneHistorique[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('affectation_projet_historique')
    .select(
      `id, user_id, projet_code, role_dans_projet, date_debut, date_fin,
       attribue_par, transfere_par, transfere_a, raison_debut, raison_fin,
       projet:projets!projet_code ( libelle )`,
    )
    .eq('projet_code', projetCode)
    .order('date_debut', { ascending: false });

  type Raw = {
    id: string;
    user_id: string;
    projet_code: string;
    role_dans_projet: string;
    date_debut: string;
    date_fin: string | null;
    attribue_par: string | null;
    transfere_par: string | null;
    transfere_a: string | null;
    raison_debut: string | null;
    raison_fin: string | null;
    projet: { libelle: string } | { libelle: string }[] | null;
  };

  const lignes = (data ?? []) as Raw[];

  // Hydrate les noms des utilisateurs en une seule requête
  const userIds = Array.from(new Set(lignes.map((l) => l.user_id)));
  const { data: users } = userIds.length
    ? await supabase.from('utilisateurs').select('user_id, nom_complet').in('user_id', userIds)
    : { data: [] };

  const noms = new Map((users ?? []).map((u) => [u.user_id, u.nom_complet]));

  return lignes.map((r) => {
    const proj = Array.isArray(r.projet) ? r.projet[0] : r.projet;
    return {
      id: r.id,
      user_id: r.user_id,
      user_email: null,
      user_nom: noms.get(r.user_id) ?? null,
      projet_code: r.projet_code,
      projet_libelle: proj?.libelle ?? null,
      role_dans_projet: r.role_dans_projet,
      date_debut: r.date_debut,
      date_fin: r.date_fin,
      attribue_par: r.attribue_par,
      transfere_par: r.transfere_par,
      transfere_a: r.transfere_a,
      raison_debut: r.raison_debut,
      raison_fin: r.raison_fin,
    };
  });
}

/**
 * Historique des projets de financement d'une structure (B1).
 */
export async function getStructureHistoriqueProjet(
  structureId: string,
): Promise<StructureHistoriqueProjet[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('structure_projet_historique')
    .select(
      `id, structure_id, projet_code, date_debut_financement, date_fin_financement,
       motif_changement, projet:projets!projet_code ( libelle )`,
    )
    .eq('structure_id', structureId)
    .order('date_debut_financement', { ascending: false });

  type Raw = {
    id: string;
    structure_id: string;
    projet_code: string;
    date_debut_financement: string;
    date_fin_financement: string | null;
    motif_changement: string | null;
    projet: { libelle: string } | { libelle: string }[] | null;
  };

  return ((data ?? []) as Raw[]).map((r) => {
    const proj = Array.isArray(r.projet) ? r.projet[0] : r.projet;
    return {
      id: r.id,
      structure_id: r.structure_id,
      projet_code: r.projet_code,
      projet_libelle: proj?.libelle ?? null,
      date_debut_financement: r.date_debut_financement,
      date_fin_financement: r.date_fin_financement,
      motif_changement: r.motif_changement,
    };
  });
}
