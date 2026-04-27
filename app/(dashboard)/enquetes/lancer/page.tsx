import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { WizardCampagne } from '@/components/campagnes/wizard-campagne';

export const metadata: Metadata = {
  title: 'Lancer une campagne de collecte — OIF Emploi Jeunes',
};

/**
 * Page wizard de lancement d'une campagne de collecte ciblée (V1.2.5).
 *
 * Méthodologie OIF : on ne lance jamais une enquête à toute la base d'un
 * projet — on cible une STRATE précise (ex. « bénéficiaires Mali 2024
 * formés D-CLIC »). Cette page propose 3 sections :
 *   1. Type de campagne (questionnaire, type vague, nom, description)
 *   2. Définition de la strate (toutes / filtres / sélection manuelle)
 *   3. Paramètres d'envoi (plafond, email test, date)
 *
 * Réservé admin_scs / editeur_projet / contributeur_partenaire.
 */
export default async function LancerCampagnePage() {
  const utilisateur = await requireUtilisateurValide();
  if (!['admin_scs', 'editeur_projet', 'contributeur_partenaire'].includes(utilisateur.role)) {
    notFound();
  }

  // Référentiels nécessaires aux Selects/MultiSelects
  const supabase = await createSupabaseServerClient();
  const [projetsRes, paysRes] = await Promise.all([
    supabase.from('projets').select('code, libelle').order('ordre_affichage', { ascending: true }),
    supabase
      .from('pays')
      .select('code_iso, libelle_fr')
      .eq('actif', true)
      .order('libelle_fr', { ascending: true }),
  ]);

  const projets = (projetsRes.data ?? []).map((p) => ({ code: p.code, libelle: p.libelle }));
  const pays = (paysRes.data ?? []).map((p) => ({ code: p.code_iso, libelle: p.libelle_fr }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/enquetes"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Retour à la liste des enquêtes
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Lancer une campagne de collecte</h1>
        <p className="text-muted-foreground text-sm">
          Définissez la strate, ajustez les paramètres d&apos;envoi puis lancez (ou sauvegardez en
          brouillon).
        </p>
      </header>

      <WizardCampagne projets={projets} pays={pays} />
    </div>
  );
}
