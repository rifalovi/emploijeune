import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Link2 } from 'lucide-react';

import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { WizardCampagne } from '@/components/campagnes/wizard-campagne';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Lancer une campagne de collecte – OIF Emploi Jeunes',
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
 * Réservé super_admin / admin_scs / editeur_projet / contributeur_partenaire.
 */
export default async function LancerCampagnePage() {
  const utilisateur = await requireUtilisateurValide();
  if (
    !['super_admin', 'admin_scs', 'editeur_projet', 'contributeur_partenaire'].includes(
      utilisateur.role,
    )
  ) {
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

      {/* CTA collecte publique — pour les cas sans email ni référence connue */}
      <Card className="border-dashed border-[#5D0073]/30 bg-[#5D0073]/5">
        <CardContent className="flex items-start gap-4 py-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#5D0073]/10">
            <Link2 className="size-5 text-[#5D0073]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              Ni adresse email ni référence connue ?
            </p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Générez un <strong>lien public réutilisable</strong> (Type A bénéficiaires ou Type B structures)
              à partager par WhatsApp, affiche ou QR code. Les participants s'enregistrent sans compte
              et vous validez leurs soumissions avant intégration en base.
            </p>
          </div>
          <Link
            href="/collecte-publique"
            className="shrink-0 rounded-md bg-[#5D0073] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a005c] transition-colors"
          >
            Gérer les liens publics
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
