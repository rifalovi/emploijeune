import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import type { BeneficiaireFilters } from '@/lib/schemas/beneficiaire';
import type { BeneficiaireListItem } from './queries';
import { getNomenclatures } from './nomenclatures-cache';
import {
  genererClasseurBeneficiaires,
  construireNomFichierExport,
  type ExportContext,
  type ExportFiltresAppliques,
} from './export-helpers';

/**
 * Récupère tous les bénéficiaires correspondant aux filtres (pas de pagination,
 * pas de plafond 500 — l'export est exhaustif dans la limite de la RLS) et
 * génère un classeur Excel au format Template V1.
 *
 * Utilisé depuis la Route Handler `app/api/beneficiaires/export/route.ts`.
 */
export async function exporterBeneficiairesExcel(filters: BeneficiaireFilters): Promise<{
  buffer: ArrayBuffer;
  filename: string;
  count: number;
}> {
  const supabase = await createSupabaseServerClient();

  // Étape 1 : IDs par pertinence si recherche textuelle
  let idsParPertinence: string[] | null = null;
  if (filters.q) {
    const { data: hits, error } = await supabase.rpc('rechercher_beneficiaires', {
      search_text: filters.q,
    });
    if (error) throw new Error(`Recherche indisponible : ${error.message}`);
    idsParPertinence = (hits ?? []).map((h: { id: string }) => h.id);
  }

  // Étape 2 : résolution PS → codes projet
  let codesProjetsPS: string[] | null = null;
  if (filters.ps) {
    const { data: projetsPS } = await supabase
      .from('projets')
      .select('code')
      .eq('programme_strategique', filters.ps);
    codesProjetsPS = (projetsPS ?? []).map((p) => p.code);
  }

  // Étape 3 : requête principale — exhaustive (on lit par pages de 1000)
  const PAGE = 1000;
  const rows: BeneficiaireListItem[] = [];
  let offset = 0;
  while (true) {
    let query = supabase
      .from('beneficiaires')
      .select(
        'id, prenom, nom, sexe, date_naissance, projet_code, pays_code, domaine_formation_code, annee_formation, statut_code, consentement_recueilli, created_by, organisation_id, updated_at',
      )
      .is('deleted_at', null);

    if (idsParPertinence) {
      if (idsParPertinence.length === 0) break;
      query = query.in('id', idsParPertinence);
    }
    if (codesProjetsPS) {
      if (codesProjetsPS.length === 0) break;
      query = query.in('projet_code', codesProjetsPS);
    }
    if (filters.projet_code) query = query.eq('projet_code', filters.projet_code);
    if (filters.pays_code) query = query.eq('pays_code', filters.pays_code);
    if (filters.domaine_formation_code)
      query = query.eq('domaine_formation_code', filters.domaine_formation_code);
    if (filters.annee_formation) query = query.eq('annee_formation', filters.annee_formation);
    if (filters.statut_code) query = query.eq('statut_code', filters.statut_code);
    if (filters.sexe) query = query.eq('sexe', filters.sexe as 'F' | 'M' | 'Autre');
    if (filters.mien) {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) query = query.eq('created_by', auth.user.id);
    }

    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(`Export indisponible : ${error.message}`);
    const page = (data ?? []) as BeneficiaireListItem[];
    rows.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
    // Safety : plafond à 50 000 pour éviter les excès
    if (offset > 50_000) break;
  }

  // Contexte metadata
  const utilisateur = await getCurrentUtilisateur();
  const { data: auth } = await supabase.auth.getUser();
  const userEmail = auth.user?.email ?? '';

  const context: ExportContext = {
    utilisateurNomComplet: utilisateur?.nom_complet ?? userEmail ?? 'Inconnu',
    utilisateurEmail: userEmail,
    utilisateurRole: utilisateur?.role ?? 'inconnu',
    filtresAppliques: {
      q: filters.q,
      projet_code: filters.projet_code,
      ps: filters.ps,
      pays_code: filters.pays_code,
      domaine_formation_code: filters.domaine_formation_code,
      annee_formation: filters.annee_formation,
      statut_code: filters.statut_code,
      sexe: filters.sexe,
      mien: filters.mien,
    } as ExportFiltresAppliques,
    nombreLignes: rows.length,
    dateExport: new Date(),
    appVersion: process.env.npm_package_version ?? '0.1.0',
  };

  const nomenclatures = await getNomenclatures();
  const buffer = await genererClasseurBeneficiaires(rows, nomenclatures, context);
  const filename = construireNomFichierExport(context.filtresAppliques, context.dateExport);

  return { buffer, filename, count: rows.length };
}
