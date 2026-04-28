import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Requêtes des alertes qualité (admin_scs / super_admin via RLS).
 *
 * Hotfix v2.2.1 : ajout du 4e type `statut_acheve_sans_date_fin` qui
 * correspond à `beneficiaires.qualite_a_verifier = TRUE`. Sans ce type,
 * la page comptait 5512 alertes alors que le dashboard en affichait
 * 11024 — incohérence visible côté super_admin.
 *
 * Les 4 types correspondent à ce que la fonction KPI
 * `get_kpis_dashboard_admin_scs` agrège (cf. migration 007) :
 *   - A. consentement_sans_date         : `consentement_recueilli = TRUE`
 *        mais `consentement_date IS NULL` (RGPD incomplet)
 *   - B. date_naissance_manquante       : `date_naissance IS NULL`
 *   - C. statut_acheve_sans_date_fin    : `qualite_a_verifier = TRUE`
 *        (statut FORMATION_ACHEVEE / ABANDON sans date_fin_formation)
 *   - D. subvention_sans_montant        : `nature_appui_code = 'SUBVENTION'`
 *        mais `montant_appui IS NULL`
 */

export type TypeAlerte =
  | 'consentement_sans_date'
  | 'date_naissance_manquante'
  | 'statut_acheve_sans_date_fin'
  | 'subvention_sans_montant';

export type AlerteQualite = {
  type: TypeAlerte;
  type_libelle: string;
  entite_id: string;
  entite_nom: string;
  entite_lien: string;
  projet_code: string | null;
  pays_code: string | null;
  cree_le: string;
};

export const TYPE_LIBELLES: Record<TypeAlerte, string> = {
  consentement_sans_date: 'Consentement RGPD recueilli sans date',
  date_naissance_manquante: 'Date de naissance manquante',
  statut_acheve_sans_date_fin: 'Statut achevé/abandon sans date de fin',
  subvention_sans_montant: 'Subvention déclarée sans montant',
} as const;

export async function listerAlertesQualite(filtres: {
  type?: string;
  projet?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AlerteQualite[]; total: number; compteurs: Record<TypeAlerte, number> }> {
  const supabase = await createSupabaseServerClient();
  const limit = filtres.limit ?? 50;
  const offset = filtres.offset ?? 0;

  // Compteurs globaux des 4 types (parallélisés)
  const [
    { count: nbConsentement },
    { count: nbDateNaissance },
    { count: nbStatutAcheve },
    { count: nbSubvention },
  ] = await Promise.all([
    supabase
      .from('beneficiaires')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('consentement_recueilli', true)
      .is('consentement_date', null),
    supabase
      .from('beneficiaires')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .is('date_naissance', null),
    supabase
      .from('beneficiaires')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('qualite_a_verifier', true),
    supabase
      .from('structures')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('nature_appui_code', 'SUBVENTION')
      .is('montant_appui', null),
  ]);

  const compteurs: Record<TypeAlerte, number> = {
    consentement_sans_date: nbConsentement ?? 0,
    date_naissance_manquante: nbDateNaissance ?? 0,
    statut_acheve_sans_date_fin: nbStatutAcheve ?? 0,
    subvention_sans_montant: nbSubvention ?? 0,
  };

  // Total : si un filtre est sélectionné, on ne compte que ce type ; sinon
  // on somme tous les types.
  const total = filtres.type
    ? (compteurs[filtres.type as TypeAlerte] ?? 0)
    : compteurs.consentement_sans_date +
      compteurs.date_naissance_manquante +
      compteurs.statut_acheve_sans_date_fin +
      compteurs.subvention_sans_montant;

  // Construction de la liste détaillée
  const rows: AlerteQualite[] = [];

  // Type A — consentement sans date
  if (!filtres.type || filtres.type === 'consentement_sans_date') {
    let q = supabase
      .from('beneficiaires')
      .select('id, prenom, nom, projet_code, pays_code, created_at')
      .is('deleted_at', null)
      .eq('consentement_recueilli', true)
      .is('consentement_date', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (filtres.projet) q = q.eq('projet_code', filtres.projet);
    const { data } = await q;
    for (const b of data ?? []) {
      rows.push({
        type: 'consentement_sans_date',
        type_libelle: TYPE_LIBELLES.consentement_sans_date,
        entite_id: b.id,
        entite_nom: `${b.prenom} ${b.nom}`,
        entite_lien: `/beneficiaires/${b.id}`,
        projet_code: b.projet_code,
        pays_code: b.pays_code,
        cree_le: b.created_at,
      });
    }
  }

  // Type B — date_naissance manquante
  if (!filtres.type || filtres.type === 'date_naissance_manquante') {
    let q = supabase
      .from('beneficiaires')
      .select('id, prenom, nom, projet_code, pays_code, created_at')
      .is('deleted_at', null)
      .is('date_naissance', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (filtres.projet) q = q.eq('projet_code', filtres.projet);
    const { data } = await q;
    for (const b of data ?? []) {
      rows.push({
        type: 'date_naissance_manquante',
        type_libelle: TYPE_LIBELLES.date_naissance_manquante,
        entite_id: b.id,
        entite_nom: `${b.prenom} ${b.nom}`,
        entite_lien: `/beneficiaires/${b.id}`,
        projet_code: b.projet_code,
        pays_code: b.pays_code,
        cree_le: b.created_at,
      });
    }
  }

  // Type C — statut achevé/abandon sans date de fin (NOUVEAU v2.2.1)
  if (!filtres.type || filtres.type === 'statut_acheve_sans_date_fin') {
    let q = supabase
      .from('beneficiaires')
      .select('id, prenom, nom, projet_code, pays_code, created_at')
      .is('deleted_at', null)
      .eq('qualite_a_verifier', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (filtres.projet) q = q.eq('projet_code', filtres.projet);
    const { data } = await q;
    for (const b of data ?? []) {
      rows.push({
        type: 'statut_acheve_sans_date_fin',
        type_libelle: TYPE_LIBELLES.statut_acheve_sans_date_fin,
        entite_id: b.id,
        entite_nom: `${b.prenom} ${b.nom}`,
        entite_lien: `/beneficiaires/${b.id}`,
        projet_code: b.projet_code,
        pays_code: b.pays_code,
        cree_le: b.created_at,
      });
    }
  }

  // Type D — subvention sans montant
  if (!filtres.type || filtres.type === 'subvention_sans_montant') {
    let q = supabase
      .from('structures')
      .select('id, nom_structure, projet_code, pays_code, created_at')
      .is('deleted_at', null)
      .eq('nature_appui_code', 'SUBVENTION')
      .is('montant_appui', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (filtres.projet) q = q.eq('projet_code', filtres.projet);
    const { data } = await q;
    for (const s of data ?? []) {
      rows.push({
        type: 'subvention_sans_montant',
        type_libelle: TYPE_LIBELLES.subvention_sans_montant,
        entite_id: s.id,
        entite_nom: s.nom_structure,
        entite_lien: `/structures/${s.id}`,
        projet_code: s.projet_code,
        pays_code: s.pays_code,
        cree_le: s.created_at,
      });
    }
  }

  // Tri global par date desc + pagination en mémoire
  rows.sort((a, b) => b.cree_le.localeCompare(a.cree_le));
  return { rows: rows.slice(offset, offset + limit), total, compteurs };
}
