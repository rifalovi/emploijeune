'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import { revalidatePath } from 'next/cache';
import { structureInsertSchema } from '@/lib/schemas/structure';
import { parseExcelFlexible } from './parser-excel-flexible';
import { parseCsv } from './parser-csv';
import { HEADERS_B1, mapLigneVersStructure } from './mapping-structures';
import type {
  ChampComparaison,
  ComparaisonDoublon,
  ErreurImport,
  LigneDoublonRapport,
  ResultatImport,
} from './types';

/**
 * Import en masse de structures depuis un fichier Excel (Étape 7).
 * Pattern miroir d'`importerBeneficiairesExcel`.
 */

export type ImporterStructuresInput = {
  fichierBuffer: ArrayBuffer | Buffer;
  fichierNom: string;
  fichierTaille: number;
  /** Hash SHA-256 du fichier (pour la session d'import). */
  fichierHash?: string;
  /** Nom de l'onglet à importer (multi-onglets). Si absent, auto-détection. */
  nomOnglet?: string;
  /** Code projet à appliquer par défaut si absent des cellules. */
  codeProjetDefaut?: string;
  /**
   * Forcer l'insertion des doublons identifiés (même nom+pays+projet ou même
   * contact porteur) pour traitement manuel ultérieur. Défaut : false.
   */
  forcerDoublons?: boolean;
};

/** Normalise un nom de structure pour la clé de dédoublonnage (≈ unaccent+lower). */
function cleNomStructure(nom: string): string {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function cleTelStruct(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[^\d+]/g, '');
  return s.length >= 6 ? s : null;
}

/** Affichage lisible d'une valeur (null si vide). */
function afficherValeurStruct(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

/**
 * Construit la comparaison champ par champ entre la structure importée et la
 * fiche existante reconnue comme doublon, avec un pourcentage de correspondance.
 */
function construireComparaisonStructure(
  importee: Record<string, unknown>,
  existante: Record<string, unknown>,
  critere: string,
): ComparaisonDoublon {
  const porteur = (r: Record<string, unknown>): string | null =>
    afficherValeurStruct(
      [afficherValeurStruct(r.porteur_prenom), afficherValeurStruct(r.porteur_nom)]
        .filter(Boolean)
        .join(' '),
    );

  const defs: { champ: string; importee: unknown; existante: unknown; tel?: boolean }[] = [
    {
      champ: 'Nom structure',
      importee: importee.nom_structure,
      existante: existante.nom_structure,
    },
    { champ: 'Pays', importee: importee.pays_code, existante: existante.pays_code },
    { champ: 'Projet', importee: importee.projet_code, existante: existante.projet_code },
    {
      champ: 'Type',
      importee: importee.type_structure_code,
      existante: existante.type_structure_code,
    },
    {
      champ: 'Secteur',
      importee: importee.secteur_activite_code,
      existante: existante.secteur_activite_code,
    },
    { champ: 'Porteur', importee: porteur(importee), existante: porteur(existante) },
    {
      champ: 'Courriel porteur',
      importee: importee.courriel_porteur,
      existante: existante.courriel_porteur,
    },
    {
      champ: 'Téléphone porteur',
      importee: importee.telephone_porteur,
      existante: existante.telephone_porteur,
      tel: true,
    },
    { champ: 'Année appui', importee: importee.annee_appui, existante: existante.annee_appui },
  ];

  const champs: ChampComparaison[] = defs.map((d) => {
    const impAff = afficherValeurStruct(d.importee);
    const exAff = afficherValeurStruct(d.existante);
    const identique = d.tel
      ? cleTelStruct(d.importee) === cleTelStruct(d.existante)
      : (impAff?.toLowerCase() ?? null) === (exAff?.toLowerCase() ?? null);
    return { champ: d.champ, valeur_importee: impAff, valeur_existante: exAff, identique };
  });

  const nbIdentiques = champs.filter((c) => c.identique).length;
  const pourcentage = champs.length > 0 ? Math.round((nbIdentiques / champs.length) * 100) : 0;
  const reference =
    [afficherValeurStruct(existante.nom_structure), afficherValeurStruct(existante.pays_code)]
      .filter(Boolean)
      .join(' · ') || 'Structure existante';

  return { critere, reference, pourcentage, champs };
}

export async function importerStructuresExcel(
  input: ImporterStructuresInput,
): Promise<ResultatImport> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs', 'editeur_projet'].includes(utilisateur.role)) {
    return {
      status: 'erreur_droits',
      message: 'Réservé aux administrateurs SCS et coordonnateurs de projet.',
    };
  }

  if (input.fichierTaille > 10 * 1024 * 1024) {
    return {
      status: 'erreur_fichier',
      message: 'Fichier trop volumineux (max 10 MB). Scindez le fichier.',
    };
  }

  // Parsing flexible : CSV ou Excel selon l'extension, avec sélection d'onglet
  const estCsv = input.fichierNom.toLowerCase().endsWith('.csv');
  const { lignes, erreursStructure } = estCsv
    ? await parseCsv(input.fichierBuffer, HEADERS_B1)
    : await parseExcelFlexible(input.fichierBuffer, HEADERS_B1, input.nomOnglet, 'structures');

  if (erreursStructure.length > 0) {
    return {
      status: 'succes',
      rapport: {
        fichier_nom: input.fichierNom,
        nb_lignes_total: 0,
        nb_lignes_inserees: 0,
        nb_lignes_ignorees: 0,
        erreurs: erreursStructure,
        import_id: null,
        execute_a: new Date().toISOString(),
      },
    };
  }

  const erreurs: ErreurImport[] = [];
  const doublons: LigneDoublonRapport[] = [];
  let nbInserees = 0;
  let nbDoublons = 0;

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  // Session d'import (best-effort) : permet l'annulation/rollback ultérieure.
  // Chaque structure insérée est taguée avec import_session_id.
  let importSessionId: string | null = null;
  const rollbackExpireAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data: session } = await adminClient
      .from('import_sessions')
      .insert({
        fichier_nom: input.fichierNom,
        fichier_hash: input.fichierHash ?? null,
        statut: 'en_cours',
        peut_rollback: true,
        rollback_expire_at: rollbackExpireAt,
        created_by: utilisateur.user_id,
      } as never)
      .select('id')
      .single();
    importSessionId = (session as { id: string } | null)?.id ?? null;
  } catch {
    // import_sessions absent du schéma (dev/staging non migré) → sans rollback
  }

  // Pré-cache des structures existantes pour le dédoublonnage applicatif :
  // clé identité (nom + pays + projet) + contacts porteur (courriel / tél).
  // On stocke la fiche complète (pas seulement la clé) pour pouvoir présenter
  // la comparaison champ par champ dans le rapport.
  const parCle = new Map<string, Record<string, unknown>>();
  const parContact = new Map<string, Record<string, unknown>>();
  if (!input.forcerDoublons) {
    try {
      let offset = 0;
      const PAGE = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data } = await adminClient
          .from('structures')
          .select(
            'nom_structure, pays_code, projet_code, type_structure_code, secteur_activite_code, porteur_prenom, porteur_nom, courriel_porteur, telephone_porteur, annee_appui',
          )
          .is('deleted_at', null)
          .range(offset, offset + PAGE - 1);
        const rows = (data ?? []) as Array<Record<string, unknown>>;
        for (const r of rows) {
          parCle.set(
            `${cleNomStructure(String(r.nom_structure ?? ''))}|${r.pays_code}|${r.projet_code}`,
            r,
          );
          if (r.courriel_porteur)
            parContact.set(`c:${String(r.courriel_porteur).toLowerCase()}`, r);
          const t = cleTelStruct(r.telephone_porteur);
          if (t) parContact.set(`t:${t}`, r);
        }
        if (rows.length < PAGE) break;
        offset += PAGE;
      }
    } catch {
      // table/réseau indisponible → pas de pré-cache, insertion simple
    }
  }

  // Détection des doublons INTERNES au fichier (même nom+pays+projet OU même
  // contact porteur sur plusieurs lignes). Depuis le retrait de l'index unique,
  // la base ne les bloque plus : on les identifie ici pour informer (et les
  // laisser passer si l'utilisateur force l'import).
  const intraStruct = new Map<number, { critere: string; ligneRef: number; valeur: string }>();
  if (!input.forcerDoublons) {
    const vusCle = new Map<string, number>();
    const vusContact = new Map<string, number>();
    for (const l of lignes) {
      const { donneesParsees } = mapLigneVersStructure(l.donnees, {
        tolerant: true,
        codeProjetDefaut: input.codeProjetDefaut,
      });
      if (!donneesParsees) continue;
      const nom = String((donneesParsees as Record<string, unknown>).nom_structure ?? '').trim();
      const pays = (donneesParsees as Record<string, unknown>).pays_code;
      const projet = (donneesParsees as Record<string, unknown>).projet_code;
      const cle = `${cleNomStructure(nom)}|${pays}|${projet}`;
      const courrielVal = (donneesParsees as Record<string, unknown>).courriel_porteur;
      const courriel = courrielVal ? `c:${String(courrielVal).toLowerCase()}` : null;
      const tel = cleTelStruct((donneesParsees as Record<string, unknown>).telephone_porteur);

      if (nom && vusCle.has(cle)) {
        intraStruct.set(l.numLigne, {
          critere: 'Nom + pays + projet en double dans le fichier',
          ligneRef: vusCle.get(cle)!,
          valeur: nom,
        });
      } else if (courriel && vusContact.has(courriel)) {
        intraStruct.set(l.numLigne, {
          critere: 'Courriel porteur en double dans le fichier',
          ligneRef: vusContact.get(courriel)!,
          valeur: String(courrielVal),
        });
      } else if (tel && vusContact.has(`t:${tel}`)) {
        intraStruct.set(l.numLigne, {
          critere: 'Téléphone porteur en double dans le fichier',
          ligneRef: vusContact.get(`t:${tel}`)!,
          valeur: tel,
        });
      }

      if (nom && !vusCle.has(cle)) vusCle.set(cle, l.numLigne);
      if (courriel && !vusContact.has(courriel)) vusContact.set(courriel, l.numLigne);
      if (tel && !vusContact.has(`t:${tel}`)) vusContact.set(`t:${tel}`, l.numLigne);
    }
  }

  // Traitement CONCURRENT par tranches — évite le timeout Vercel sur les
  // fichiers de plusieurs centaines de lignes (avant : insertions séquentielles
  // ≈ 100 ms/ligne → 582 lignes ≈ 60 s, à la limite du timeout).
  type ResultatLigne =
    | { statut: 'inseree' }
    | { statut: 'doublon'; doublon?: LigneDoublonRapport }
    | { statut: 'rejetee'; erreurs: ErreurImport[] };

  const traiterLigneStructure = async (
    numLigne: number,
    donnees: Record<string, unknown>,
  ): Promise<ResultatLigne> => {
    const { donneesParsees, erreursMapping } = mapLigneVersStructure(donnees, {
      tolerant: true,
      codeProjetDefaut: input.codeProjetDefaut,
    });
    if (erreursMapping.length > 0) {
      return {
        statut: 'rejetee',
        erreurs: erreursMapping.map((e) => ({
          ligne: numLigne,
          colonne: e.colonne,
          valeur: e.valeur,
          message: e.message,
        })),
      };
    }
    if (!donneesParsees) return { statut: 'rejetee', erreurs: [] };

    const parse = structureInsertSchema.safeParse(donneesParsees);
    if (!parse.success) {
      return {
        statut: 'rejetee',
        erreurs: parse.error.issues.map((issue) => ({
          ligne: numLigne,
          colonne: issue.path.join('.'),
          valeur: null,
          message: issue.message,
        })),
      };
    }

    // Doublon INTERNE au fichier (même identité ou contact qu'une ligne
    // précédente). Sauf forçage : on informe sans insérer.
    if (!input.forcerDoublons) {
      const intra = intraStruct.get(numLigne);
      if (intra) {
        return {
          statut: 'doublon',
          doublon: {
            numero_ligne: numLigne,
            comparaison: {
              critere: intra.critere,
              reference: `Ligne ${intra.ligneRef} du fichier`,
              pourcentage: 100,
              champs: [
                {
                  champ: intra.critere.toLowerCase().includes('courriel')
                    ? 'Courriel porteur'
                    : intra.critere.toLowerCase().includes('téléphone')
                      ? 'Téléphone porteur'
                      : 'Structure',
                  valeur_importee: intra.valeur,
                  valeur_existante: intra.valeur,
                  identique: true,
                },
              ],
            },
          },
        };
      }
    }

    // Dédoublonnage applicatif (sauf si forçage demandé) : doublon si même
    // nom+pays+projet OU même contact porteur. Sinon insertion.
    if (!input.forcerDoublons) {
      const cle = `${cleNomStructure(parse.data.nom_structure)}|${parse.data.pays_code}|${parse.data.projet_code}`;
      const tel = cleTelStruct(parse.data.telephone_porteur);
      const courriel = parse.data.courriel_porteur
        ? `c:${String(parse.data.courriel_porteur).toLowerCase()}`
        : null;

      // Identifier la fiche existante correspondante + le critère déclencheur,
      // par ordre de priorité : identité (nom+pays+projet) > courriel > téléphone.
      let existante: Record<string, unknown> | undefined;
      let critere: string | undefined;
      if (parCle.has(cle)) {
        existante = parCle.get(cle);
        critere = 'Nom + pays + projet identiques';
      } else if (courriel && parContact.has(courriel)) {
        existante = parContact.get(courriel);
        critere = 'Courriel porteur identique';
      } else if (tel && parContact.has(`t:${tel}`)) {
        existante = parContact.get(`t:${tel}`);
        critere = 'Téléphone porteur identique';
      }

      if (existante && critere) {
        return {
          statut: 'doublon',
          doublon: {
            numero_ligne: numLigne,
            comparaison: construireComparaisonStructure(parse.data, existante, critere),
          },
        };
      }
    }

    const { error: insertError } = await adminClient.from('structures').insert({
      ...parse.data,
      source_import: 'excel_v1',
      created_by: utilisateur.user_id,
      ...(importSessionId ? { import_session_id: importSessionId } : {}),
    } as never);

    if (insertError) {
      // Violation de contrainte unique (23505) = structure déjà présente
      // (même nom + pays + projet). Pas une erreur : doublon ignoré.
      if (
        (insertError as { code?: string }).code === '23505' ||
        /duplicate key|idx_structures_dedoublonnage/i.test(insertError.message)
      ) {
        return { statut: 'doublon' };
      }
      return {
        statut: 'rejetee',
        erreurs: [
          {
            ligne: numLigne,
            colonne: null,
            valeur: null,
            message: `INSERT BDD échoué : ${insertError.message}`,
          },
        ],
      };
    }
    return { statut: 'inseree' };
  };

  const CONCURRENCE = 25;
  for (let i = 0; i < lignes.length; i += CONCURRENCE) {
    const tranche = lignes.slice(i, i + CONCURRENCE);
    const resultats = await Promise.all(
      tranche.map((l) => traiterLigneStructure(l.numLigne, l.donnees)),
    );
    for (const r of resultats) {
      if (r.statut === 'inseree') nbInserees++;
      else if (r.statut === 'doublon') {
        nbDoublons++;
        if (r.doublon) doublons.push(r.doublon);
      } else erreurs.push(...r.erreurs);
    }
  }

  let importId: string | null = null;
  try {
    const { data: imp } = await supabase
      .from('imports_excel')
      .insert({
        fichier_nom: input.fichierNom,
        fichier_taille_octets: input.fichierTaille,
        version_template: 'V1',
        nb_lignes_a1: 0,
        nb_lignes_b1: lignes.length,
        nb_lignes_inserees: nbInserees,
        nb_erreurs: erreurs.length,
        rapport_erreurs: erreurs as unknown as never,
        statut: erreurs.length === 0 ? 'reussi' : 'partiel',
        termine_a: new Date().toISOString(),
        created_by: utilisateur.user_id,
      } as never)
      .select('id')
      .single();
    importId = imp?.id ?? null;
  } catch {
    // best-effort
  }

  // Finaliser la session d'import (compteurs + statut). Si rien n'a été
  // inséré, la session reste sans lignes liées → annulation sans effet.
  if (importSessionId) {
    try {
      await adminClient
        .from('import_sessions')
        .update({
          statut: 'complete',
          nb_inserees: nbInserees,
          nb_doublons: nbDoublons,
          nb_rejetees: erreurs.length,
          peut_rollback: nbInserees > 0,
        } as never)
        .eq('id', importSessionId);
    } catch {
      // best-effort
    }
  }

  revalidatePath('/structures');
  revalidatePath('/admin/imports');
  revalidatePath('/dashboard');
  revalidatePath('/realisations');

  return {
    status: 'succes',
    rapport: {
      fichier_nom: input.fichierNom,
      nb_lignes_total: lignes.length,
      nb_lignes_inserees: nbInserees,
      nb_lignes_ignorees: lignes.length - nbInserees,
      nb_doublons: nbDoublons,
      doublons,
      erreurs,
      import_id: importId,
      import_session_id: nbInserees > 0 ? importSessionId : null,
      rollback_expire_at: nbInserees > 0 ? rollbackExpireAt : null,
      execute_a: new Date().toISOString(),
    },
  };
}
