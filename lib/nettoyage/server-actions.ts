'use server';

/**
 * Server Actions — Nettoyage des valeurs parasites en base de données.
 *
 * Ces actions sont réservées aux super_admin et admin_scs.
 * Elles opèrent en deux étapes :
 *   1. SCAN  — identifie les valeurs parasites sans modifier la BDD
 *   2. CLEAN — applique le nettoyage (remplace par NULL) sur confirmation
 *              UNIQUEMENT pour les champs nullable. Les champs NOT NULL
 *              sont signalés mais nécessitent une correction manuelle.
 *
 * Toutes les modifications sont journalisées dans journaux_audit.
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUtilisateur } from '@/lib/supabase/auth';
import {
  estValeurParasite,
  CHAMPS_TEXTE,
  CHAMPS_TEXTE_NULLABLE,
  CHAMPS_TEXTE_OBLIGATOIRES,
  type TableCible,
  type ValeurParasite,
  type RapportScan,
  type RapportNettoyage,
} from '@/lib/imports/normalizer-garbage';

const TABLES_CIBLES: TableCible[] = ['beneficiaires', 'structures'];

// =============================================================================
// Types de retour
// =============================================================================

export type ScanResult =
  | { status: 'succes'; rapport: RapportScan }
  | { status: 'erreur'; message: string };

export type NettoyageResult =
  | { status: 'succes'; rapport: RapportNettoyage }
  | { status: 'erreur'; message: string };

// =============================================================================
// Scan — détecte sans modifier
// =============================================================================

/**
 * Scanne toutes les tables cibles et retourne un rapport des valeurs parasites
 * trouvées. Aucune écriture en BDD — opération en lecture seule.
 *
 * Réservé super_admin / admin_scs.
 */
export async function scannerValeursParasites(): Promise<ScanResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs'].includes(utilisateur.role)) {
    return { status: 'erreur', message: 'Réservé aux administrateurs SCS et super_admin.' };
  }

  const admin = createSupabaseAdminClient();
  const parasites: ValeurParasite[] = [];

  for (const table of TABLES_CIBLES) {
    const champs = CHAMPS_TEXTE[table];
    const champsNullable = new Set(CHAMPS_TEXTE_NULLABLE[table]);
    const colonnes = ['id', ...champs].join(', ');

    const { data, error } = await admin.from(table).select(colonnes).is('deleted_at', null);

    if (error) {
      return { status: 'erreur', message: `Erreur scan ${table} : ${error.message}` };
    }

    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const id = row['id'] as string;
      for (const champ of champs) {
        const val = row[champ];
        if (typeof val === 'string' && val.trim().length > 0 && estValeurParasite(val)) {
          parasites.push({
            table,
            id,
            champ,
            valeur_actuelle: val,
            auto_corrigeable: champsNullable.has(champ),
          });
        }
      }
    }
  }

  // Statistiques agrégées
  const parTable = Object.fromEntries(TABLES_CIBLES.map((t) => [t, 0])) as Record<
    TableCible,
    number
  >;
  const parChamp: Record<string, number> = {};

  for (const p of parasites) {
    parTable[p.table] = (parTable[p.table] ?? 0) + 1;
    const clef = `${p.table}.${p.champ}`;
    parChamp[clef] = (parChamp[clef] ?? 0) + 1;
  }

  const totalAutoCorrigeables = parasites.filter((p) => p.auto_corrigeable).length;

  return {
    status: 'succes',
    rapport: {
      total_parasites: parasites.length,
      total_auto_corrigeables: totalAutoCorrigeables,
      total_manuels: parasites.length - totalAutoCorrigeables,
      par_table: parTable,
      par_champ: parChamp,
      // max 200 exemples pour l'UI — les plus courts d'abord (plus représentatifs)
      exemples: [...parasites]
        .sort((a, b) => {
          // Obligatoires en fin (nécessitent action manuelle)
          if (a.auto_corrigeable !== b.auto_corrigeable) return a.auto_corrigeable ? -1 : 1;
          return a.valeur_actuelle.length - b.valeur_actuelle.length;
        })
        .slice(0, 200),
    },
  };
}

// =============================================================================
// Nettoyage — applique le remplacement NULL après confirmation
// =============================================================================

/**
 * Remplace par NULL toutes les valeurs parasites des champs NULLABLE.
 * Les champs NOT NULL (prenom, nom, porteur_nom, nom_structure) sont ignorés
 * car ils ne peuvent pas être mis à null — signalés dans le scan uniquement.
 *
 * ⚠️ Irréversible — toujours proposer un SCAN préalable avec confirmation UI.
 *
 * Réservé super_admin / admin_scs.
 */
export async function nettoyerValeursParasites(payload: {
  tables?: TableCible[];
}): Promise<NettoyageResult> {
  const utilisateur = await getCurrentUtilisateur();
  if (!utilisateur || !['super_admin', 'admin_scs'].includes(utilisateur.role)) {
    return { status: 'erreur', message: 'Réservé aux administrateurs SCS et super_admin.' };
  }

  const admin = createSupabaseAdminClient();
  const tablesACibler: TableCible[] = payload.tables ?? TABLES_CIBLES;

  let nbChampsNettoyes = 0;
  const idsAffectes = new Set<string>();
  const parTable = Object.fromEntries(TABLES_CIBLES.map((t) => [t, 0])) as Record<
    TableCible,
    number
  >;

  for (const table of tablesACibler) {
    // IMPORTANT : on ne cible QUE les champs nullable pour éviter la contrainte NOT NULL
    const champsNullable = CHAMPS_TEXTE_NULLABLE[table];
    const colonnes = ['id', ...champsNullable].join(', ');

    const { data, error } = await admin.from(table).select(colonnes).is('deleted_at', null);

    if (error) {
      return { status: 'erreur', message: `Erreur lecture ${table} : ${error.message}` };
    }

    // Groupe les mises à jour par enregistrement pour minimiser les requêtes
    const updates = new Map<string, Record<string, null>>();

    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const id = row['id'] as string;
      for (const champ of champsNullable) {
        const val = row[champ];
        if (typeof val === 'string' && val.trim().length > 0 && estValeurParasite(val)) {
          if (!updates.has(id)) updates.set(id, {});
          updates.get(id)![champ] = null;
          nbChampsNettoyes++;
          idsAffectes.add(id);
        }
      }
    }

    // Applique les mises à jour par lot de 50
    const entries = [...updates.entries()];
    const BATCH = 50;
    for (let i = 0; i < entries.length; i += BATCH) {
      const lot = entries.slice(i, i + BATCH);
      for (const [id, champsMaj] of lot) {
        const { error: errUpdate } = await admin
          .from(table)
          .update({ ...champsMaj, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (errUpdate) {
          return {
            status: 'erreur',
            message: `Erreur mise à jour ${table}/${id} : ${errUpdate.message}`,
          };
        }
      }
    }

    parTable[table] = updates.size;
  }

  // Journalise l'opération dans journaux_audit (best-effort, action UPDATE)
  try {
    await admin.from('journaux_audit').insert({
      user_id: utilisateur.id,
      action: 'UPDATE' as const,
      table_affectee: 'nettoyage_batch',
      diff: {
        operation: 'nettoyage_valeurs_parasites',
        nb_champs_nettoyes: nbChampsNettoyes,
        nb_enregistrements_affectes: idsAffectes.size,
        tables: tablesACibler,
        par_table: parTable,
      },
    });
  } catch {
    // best-effort — ne bloque pas le retour succès
  }

  revalidatePath('/beneficiaires');
  revalidatePath('/structures');
  revalidatePath('/super-admin/nettoyage-donnees');

  return {
    status: 'succes',
    rapport: {
      nb_champs_nettoyes: nbChampsNettoyes,
      nb_enregistrements_affectes: idsAffectes.size,
      par_table: parTable,
      execute_a: new Date().toISOString(),
    },
  };
}
