import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import type { EnqueteFilters } from '@/lib/schemas/enquetes/schemas';
import {
  genererClasseurEnquetes,
  construireNomFichierExportEnquetes,
  type ExportEnquetesContext,
  type ExportEnquetesFiltresAppliques,
  type ReponseEnqueteExportRow,
} from './export-helpers';

/**
 * Récupère toutes les réponses d'enquête correspondant aux filtres et
 * génère un classeur Excel multi-feuilles.
 *
 * Pagination : 1000 lignes par batch, plafond 10 000 (≈ 1 666 sessions
 * de 6 indicateurs — couvre largement les 5 623 bénéficiaires V2).
 *
 * Tri : session_enquete_id puis indicateur_code (ordre stable, lignes
 * d'une même session contiguës dans la feuille « Réponses »).
 */
export async function exporterEnquetesExcel(filters: EnqueteFilters): Promise<{
  buffer: ArrayBuffer;
  filename: string;
  count: number;
}> {
  const supabase = await createSupabaseServerClient();

  // Étape 1 : si recherche textuelle, on filtre par session_enquete_id
  // appartenant aux résultats de la fonction lister_sessions_enquete (qui
  // gère la recherche par cible_libelle). Sinon NULL → pas de filtre.
  let sessionsAutorisees: string[] | null = null;
  if (
    filters.q ||
    filters.questionnaire ||
    filters.cible_id ||
    filters.date_debut ||
    filters.date_fin ||
    filters.mien
  ) {
    let mienUid: string | null = null;
    if (filters.mien) {
      const { data: auth } = await supabase.auth.getUser();
      mienUid = auth.user?.id ?? null;
    }
    const { data: hits } = await supabase.rpc('lister_sessions_enquete', {
      p_questionnaire: filters.questionnaire ?? null,
      p_projet_code: filters.projet_code ?? null,
      p_cible_id: filters.cible_id ?? null,
      p_vague_enquete: filters.vague_enquete ?? null,
      p_canal_collecte: filters.canal_collecte ?? null,
      p_date_debut: filters.date_debut ? filters.date_debut.toISOString().slice(0, 10) : null,
      p_date_fin: filters.date_fin ? filters.date_fin.toISOString().slice(0, 10) : null,
      p_recherche: filters.q ?? null,
      p_mien_uid: mienUid,
      p_limit: 5000,
      p_offset: 0,
    });
    sessionsAutorisees = (hits ?? []).map((h: { id: string }) => h.id);
    if (sessionsAutorisees.length === 0) {
      return await produireClasseurVide(filters);
    }
  }

  // Étape 2 : fetch paginé des réponses
  const PAGE = 1000;
  const PLAFOND = 10_000;
  const rows: ReponseEnqueteExportRow[] = [];
  let offset = 0;

  type RawRow = {
    id: string;
    session_enquete_id: string | null;
    indicateur_code: string;
    beneficiaire_id: string | null;
    structure_id: string | null;
    projet_code: string | null;
    donnees: Record<string, unknown> | null;
    vague_enquete: string;
    canal_collecte: string;
    date_collecte: string;
    created_at: string;
    updated_at: string;
    beneficiaire: { prenom: string; nom: string } | { prenom: string; nom: string }[] | null;
    structure: { nom_structure: string } | { nom_structure: string }[] | null;
  };

  while (offset < PLAFOND) {
    let query = supabase
      .from('reponses_enquetes')
      .select(
        `
        id, session_enquete_id, indicateur_code,
        beneficiaire_id, structure_id, projet_code,
        donnees, vague_enquete, canal_collecte, date_collecte,
        created_at, updated_at,
        beneficiaire:beneficiaires!beneficiaire_id ( prenom, nom ),
        structure:structures!structure_id ( nom_structure )
        `,
      )
      .is('deleted_at', null)
      .not('session_enquete_id', 'is', null);

    if (sessionsAutorisees) {
      query = query.in('session_enquete_id', sessionsAutorisees);
    } else {
      // Filtres simples qui ne nécessitent pas de pré-résolution
      if (filters.projet_code) query = query.eq('projet_code', filters.projet_code);
      if (filters.vague_enquete)
        query = query.eq(
          'vague_enquete',
          filters.vague_enquete as
            | '6_mois'
            | '12_mois'
            | '24_mois'
            | 'ponctuelle'
            | 'avant_formation'
            | 'fin_formation',
        );
      if (filters.canal_collecte)
        query = query.eq(
          'canal_collecte',
          filters.canal_collecte as
            | 'formulaire_web'
            | 'entretien'
            | 'telephone'
            | 'import'
            | 'email'
            | 'sms'
            | 'whatsapp',
        );
    }

    const restant = PLAFOND - offset;
    const taillePage = Math.min(PAGE, restant);
    const { data, error } = await query
      .order('session_enquete_id', { ascending: true })
      .order('indicateur_code', { ascending: true })
      .range(offset, offset + taillePage - 1);

    if (error) throw new Error(`Export indisponible : ${error.message}`);
    const page = (data ?? []) as unknown as RawRow[];
    for (const r of page) {
      const ben = Array.isArray(r.beneficiaire) ? r.beneficiaire[0] : r.beneficiaire;
      const str = Array.isArray(r.structure) ? r.structure[0] : r.structure;
      const cibleLibelle = ben ? `${ben.prenom} ${ben.nom}` : (str?.nom_structure ?? null);
      rows.push({
        session_id: r.session_enquete_id!,
        reponse_id: r.id,
        indicateur_code: r.indicateur_code,
        beneficiaire_id: r.beneficiaire_id,
        structure_id: r.structure_id,
        cible_libelle: cibleLibelle,
        projet_code: r.projet_code,
        vague_enquete: r.vague_enquete,
        canal_collecte: r.canal_collecte,
        date_collecte: r.date_collecte,
        donnees: r.donnees ?? {},
        created_at: r.created_at,
        updated_at: r.updated_at,
      });
    }
    if (page.length < taillePage) break;
    offset += taillePage;
  }

  // Contexte metadata
  const utilisateur = await getCurrentUtilisateur();
  const { data: auth } = await supabase.auth.getUser();
  const userEmail = auth.user?.email ?? '';

  const context: ExportEnquetesContext = {
    utilisateurNomComplet: utilisateur?.nom_complet ?? userEmail ?? 'Inconnu',
    utilisateurEmail: userEmail,
    utilisateurRole: utilisateur?.role ?? 'inconnu',
    filtresAppliques: {
      q: filters.q,
      questionnaire: filters.questionnaire,
      projet_code: filters.projet_code,
      vague_enquete: filters.vague_enquete,
      canal_collecte: filters.canal_collecte,
      cible_id: filters.cible_id,
      date_debut: filters.date_debut,
      date_fin: filters.date_fin,
      mien: filters.mien,
    } as ExportEnquetesFiltresAppliques,
    nombreReponses: rows.length,
    nombreSessions: 0, // calculé dans le helper via grouperParSession
    dateExport: new Date(),
    appVersion: process.env.npm_package_version ?? '0.1.0',
  };

  const buffer = await genererClasseurEnquetes(rows, context);
  const filename = construireNomFichierExportEnquetes(context.filtresAppliques, context.dateExport);
  return { buffer, filename, count: rows.length };
}

async function produireClasseurVide(filters: EnqueteFilters): Promise<{
  buffer: ArrayBuffer;
  filename: string;
  count: number;
}> {
  const context: ExportEnquetesContext = {
    utilisateurNomComplet: 'Inconnu',
    utilisateurEmail: '',
    utilisateurRole: 'inconnu',
    filtresAppliques: {
      q: filters.q,
      questionnaire: filters.questionnaire,
      projet_code: filters.projet_code,
      vague_enquete: filters.vague_enquete,
      canal_collecte: filters.canal_collecte,
      cible_id: filters.cible_id,
      date_debut: filters.date_debut,
      date_fin: filters.date_fin,
      mien: filters.mien,
    } as ExportEnquetesFiltresAppliques,
    nombreReponses: 0,
    nombreSessions: 0,
    dateExport: new Date(),
    appVersion: process.env.npm_package_version ?? '0.1.0',
  };
  const buffer = await genererClasseurEnquetes([], context);
  const filename = construireNomFichierExportEnquetes(context.filtresAppliques, context.dateExport);
  return { buffer, filename, count: 0 };
}
