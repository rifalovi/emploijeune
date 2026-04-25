import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import type { StructureFilters } from '@/lib/schemas/structure';
import { getNomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import {
  genererClasseurStructures,
  construireNomFichierExportStructures,
  type ExportStructuresContext,
  type ExportStructuresFiltresAppliques,
  type StructureExportRow,
} from './export-helpers';

/**
 * Récupère toutes les structures correspondant aux filtres (paginées par
 * pages de 1000, plafond 5000 — décision Q1 Étape 5e) et génère un classeur
 * Excel B1 au format Template V1.
 *
 * Tri serveur : `projet_code` ASC puis `nom_structure` ASC (ordre stable
 * indépendant des dates de saisie, attendu par le SCS pour comparaison
 * d'exports successifs). RLS appliquée naturellement.
 *
 * Utilisé depuis la Route Handler `app/api/structures/export/route.ts`.
 */
export async function exporterStructuresExcel(filters: StructureFilters): Promise<{
  buffer: ArrayBuffer;
  filename: string;
  count: number;
}> {
  const supabase = await createSupabaseServerClient();

  // Étape 1 : IDs par pertinence si recherche textuelle
  let idsParPertinence: string[] | null = null;
  if (filters.q) {
    const { data: hits, error } = await supabase.rpc('rechercher_structures', {
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

  // Étape 3 : requête principale paginée (toutes colonnes B1 + JOIN orga)
  const PAGE = 1000;
  const PLAFOND = 5000;
  const rows: StructureExportRow[] = [];
  let offset = 0;

  while (offset < PLAFOND) {
    let query = supabase
      .from('structures')
      .select(
        `
        id,
        nom_structure, type_structure_code, secteur_activite_code, secteur_precis,
        intitule_initiative, date_creation, statut_creation,
        projet_code, pays_code, organisation_id,
        porteur_prenom, porteur_nom, porteur_sexe, porteur_date_naissance, fonction_porteur,
        annee_appui, nature_appui_code, montant_appui, devise_code,
        consentement_recueilli, consentement_date,
        telephone_porteur, courriel_porteur,
        adresse, ville, localite, latitude, longitude,
        chiffre_affaires, employes_permanents, employes_temporaires, emplois_crees,
        commentaire,
        source_import, created_at, updated_at,
        organisation:organisations!organisation_id ( nom )
        `,
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
    if (filters.type_structure_code)
      query = query.eq('type_structure_code', filters.type_structure_code);
    if (filters.secteur_activite_code)
      query = query.eq('secteur_activite_code', filters.secteur_activite_code);
    if (filters.nature_appui_code) query = query.eq('nature_appui_code', filters.nature_appui_code);
    if (filters.statut_creation)
      query = query.eq(
        'statut_creation',
        filters.statut_creation as 'creation' | 'renforcement' | 'relance',
      );
    if (filters.annee_appui) query = query.eq('annee_appui', filters.annee_appui);
    if (filters.mien) {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) query = query.eq('created_by', auth.user.id);
    }

    const restant = PLAFOND - offset;
    const taillePage = Math.min(PAGE, restant);

    const { data, error } = await query
      .order('projet_code', { ascending: true })
      .order('nom_structure', { ascending: true })
      .range(offset, offset + taillePage - 1);

    if (error) throw new Error(`Export indisponible : ${error.message}`);

    type RawRow = Omit<StructureExportRow, 'organisation_nom'> & {
      organisation: { nom: string } | { nom: string }[] | null;
    };
    const page = ((data ?? []) as RawRow[]).map((r): StructureExportRow => {
      const orga = Array.isArray(r.organisation) ? r.organisation[0] : r.organisation;
      return {
        id: r.id,
        nom_structure: r.nom_structure,
        type_structure_code: r.type_structure_code,
        secteur_activite_code: r.secteur_activite_code,
        secteur_precis: r.secteur_precis,
        intitule_initiative: r.intitule_initiative,
        date_creation: r.date_creation,
        statut_creation: r.statut_creation,
        projet_code: r.projet_code,
        pays_code: r.pays_code,
        organisation_id: r.organisation_id,
        organisation_nom: orga?.nom ?? null,
        porteur_prenom: r.porteur_prenom,
        porteur_nom: r.porteur_nom,
        porteur_sexe: r.porteur_sexe,
        porteur_date_naissance: r.porteur_date_naissance,
        fonction_porteur: r.fonction_porteur,
        annee_appui: r.annee_appui,
        nature_appui_code: r.nature_appui_code,
        montant_appui: r.montant_appui,
        devise_code: r.devise_code,
        consentement_recueilli: r.consentement_recueilli,
        consentement_date: r.consentement_date,
        telephone_porteur: r.telephone_porteur,
        courriel_porteur: r.courriel_porteur,
        adresse: r.adresse,
        ville: r.ville,
        localite: r.localite,
        latitude: r.latitude,
        longitude: r.longitude,
        chiffre_affaires: r.chiffre_affaires,
        employes_permanents: r.employes_permanents,
        employes_temporaires: r.employes_temporaires,
        emplois_crees: r.emplois_crees,
        commentaire: r.commentaire,
        source_import: r.source_import,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });

    rows.push(...page);
    if (page.length < taillePage) break;
    offset += taillePage;
  }

  // Contexte metadata
  const utilisateur = await getCurrentUtilisateur();
  const { data: auth } = await supabase.auth.getUser();
  const userEmail = auth.user?.email ?? '';

  const context: ExportStructuresContext = {
    utilisateurNomComplet: utilisateur?.nom_complet ?? userEmail ?? 'Inconnu',
    utilisateurEmail: userEmail,
    utilisateurRole: utilisateur?.role ?? 'inconnu',
    filtresAppliques: {
      q: filters.q,
      projet_code: filters.projet_code,
      ps: filters.ps,
      pays_code: filters.pays_code,
      type_structure_code: filters.type_structure_code,
      secteur_activite_code: filters.secteur_activite_code,
      nature_appui_code: filters.nature_appui_code,
      statut_creation: filters.statut_creation,
      annee_appui: filters.annee_appui,
      mien: filters.mien,
    } as ExportStructuresFiltresAppliques,
    nombreLignes: rows.length,
    dateExport: new Date(),
    appVersion: process.env.npm_package_version ?? '0.1.0',
  };

  const nomenclatures = await getNomenclatures();
  const buffer = await genererClasseurStructures(rows, nomenclatures, context);
  const filename = construireNomFichierExportStructures(
    context.filtresAppliques,
    context.dateExport,
  );

  return { buffer, filename, count: rows.length };
}
