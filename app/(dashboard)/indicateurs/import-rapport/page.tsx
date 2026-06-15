import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { ImportRapportClient } from '@/components/indicateurs/import-rapport-client';

export const metadata: Metadata = {
  title: "Importer un rapport d'indicateurs – OIF Emploi Jeunes",
};

export const dynamic = 'force-dynamic';

/**
 * Import d'un rapport d'enquête (PDF/DOCX/TXT/XLSX) → extraction IA des valeurs
 * d'ensemble des indicateurs non auto-calculables → revue → enregistrement.
 * Réservé au super_admin (la saisie manuelle d'indicateurs l'est également).
 */
export default async function ImportRapportIndicateursPage() {
  const utilisateur = await requireUtilisateurValide();
  if (utilisateur.role !== 'super_admin') {
    redirect('/indicateurs');
  }
  return <ImportRapportClient />;
}
