import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Requêtes des alertes qualité (admin_scs uniquement via RLS).
 *
 * Les 3 types d'alertes correspondent à ce que la fonction KPI
 * `get_kpis_dashboard_admin_scs` agrège (cf. migration 005) :
 *   - A. Bénéficiaires : `consentement_recueilli = TRUE` mais
 *     `consentement_date IS NULL` (RGPD incomplet).
 *   - B. Bénéficiaires : `date_naissance IS NULL` (anonymisation
 *     possible mais champ recommandé pour analyses cohortes).
 *   - C. Structures : `nature_appui_code = 'SUBVENTION'` mais
 *     `montant_appui IS NULL` (audit financier).
 */

export type AlerteQualite = {
  type: 'consentement_sans_date' | 'date_naissance_manquante' | 'subvention_sans_montant';
  type_libelle: string;
  entite_id: string;
  entite_nom: string;
  entite_lien: string;
  projet_code: string | null;
  pays_code: string | null;
  cree_le: string;
};

const TYPE_LIBELLES = {
  consentement_sans_date: 'Consentement RGPD recueilli sans date',
  date_naissance_manquante: 'Date de naissance manquante',
  subvention_sans_montant: 'Subvention déclarée sans montant',
} as const;

export async function listerAlertesQualite(filtres: {
  type?: string;
  projet?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AlerteQualite[]; total: number; compteurs: Record<string, number> }> {
  const supabase = await createSupabaseServerClient();
  const limit = filtres.limit ?? 50;
  const offset = filtres.offset ?? 0;

  // Compteurs globaux (pour les badges + filtre)
  const [{ count: nbConsentement }, { count: nbDateNaissance }, { count: nbSubvention }] =
    await Promise.all([
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
        .from('structures')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('nature_appui_code', 'SUBVENTION')
        .is('montant_appui', null),
    ]);

  const compteurs = {
    consentement_sans_date: nbConsentement ?? 0,
    date_naissance_manquante: nbDateNaissance ?? 0,
    subvention_sans_montant: nbSubvention ?? 0,
  };
  const total =
    (filtres.type === 'consentement_sans_date' ? compteurs.consentement_sans_date : 0) +
      (filtres.type === 'date_naissance_manquante' ? compteurs.date_naissance_manquante : 0) +
      (filtres.type === 'subvention_sans_montant' ? compteurs.subvention_sans_montant : 0) ||
    compteurs.consentement_sans_date +
      compteurs.date_naissance_manquante +
      compteurs.subvention_sans_montant;

  // Construction de la liste agrégée
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

  // Type C — subvention sans montant
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

  // Tri global par date desc + pagination en mémoire (les volumes restent
  // raisonnables pour le pilote — V1.5 si > 5k alertes simultanées).
  rows.sort((a, b) => b.cree_le.localeCompare(a.cree_le));
  return { rows: rows.slice(offset, offset + limit), total, compteurs };
}
