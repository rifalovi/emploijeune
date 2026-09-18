'use server';

import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { chargerDatasetEnquete } from './queries';
import type { DatasetInput } from './types';

const ROLES_AUTORISES = ['super_admin', 'admin_scs'];

/**
 * Action serveur : charge le jeu de données d'un indicateur (réponses
 * d'enquête) pour l'Atelier d'analyse. Réservée SCS / super_admin.
 */
export async function chargerDatasetEnqueteAction(
  indicateurCode: string,
  projetCode?: string,
): Promise<DatasetInput> {
  const utilisateur = await requireUtilisateurValide();
  if (!ROLES_AUTORISES.includes(utilisateur.role)) {
    throw new Error('Accès non autorisé.');
  }
  return chargerDatasetEnquete(indicateurCode, projetCode);
}
