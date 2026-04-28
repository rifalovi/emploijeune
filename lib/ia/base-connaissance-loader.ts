import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Charge les notes pertinentes de la base de connaissance pour enrichir le
 * contexte IA — V2.2.0.
 *
 * Stratégie V1 : recherche full-text PostgreSQL (français) sur le titre +
 * contenu via la RPC `rechercher_base_connaissance`. Top 5 résultats
 * pertinents injectés dans le system prompt de Claude.
 *
 * V1.5 (à venir) : remplacer par embeddings (pgvector) pour une recherche
 * sémantique plus robuste.
 *
 * RLS : la RPC est `SECURITY DEFINER` mais filtre par
 * `module_ia_actif_pour_courant()` — donc seul un utilisateur ayant le
 * module IA activé pour son rôle voit le contenu.
 */

export type NoteConnaissance = {
  id: string;
  titre: string;
  type: string;
  contenu: string;
  pertinence: number;
};

export async function chargerBaseConnaissancePertinente(
  texteRequete: string,
  limite = 5,
): Promise<NoteConnaissance[]> {
  // Si la requête est trop courte, on ne charge rien (évite le bruit).
  if (!texteRequete || texteRequete.trim().length < 8) {
    return [];
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('rechercher_base_connaissance', {
      p_query: texteRequete,
      p_limit: limite,
    });

    if (error || !data) return [];

    // Filtre les notes vraiment pertinentes (rank > 0.05 pour éviter les
    // matches faibles qui poluent le contexte).
    const notes = (data as NoteConnaissance[]).filter((n) => n.pertinence > 0.05);
    return notes;
  } catch {
    return [];
  }
}
