import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EnqueteSaisie } from '@/components/enquetes/enquete-saisie';

export const metadata: Metadata = {
  title: 'Nouvelle enquête — OIF Emploi Jeunes',
};

type PageProps = {
  searchParams: Promise<{ cible_type?: string; cible_id?: string }>;
};

/**
 * Page de saisie d'un nouveau questionnaire d'enquête (Étape 6d).
 *
 * Paramètres URL requis :
 *   - cible_type=beneficiaire → questionnaire A (indicateurs A2/A3/A4/A5/F1/C5)
 *   - cible_type=structure   → questionnaire B (indicateurs B2/B3/B4/C5)
 *   - cible_id=UUID
 *
 * Sans paramètres : affiche une carte d'aide indiquant comment lancer
 * une enquête depuis une fiche bénéficiaire ou structure (CTA pages
 * détail à brancher en 6e).
 */
export default async function NouvelleEnquetePage({ searchParams }: PageProps) {
  await requireUtilisateurValide();
  const { cible_type, cible_id } = await searchParams;

  if (!cible_type || !cible_id) {
    return <SansCible />;
  }

  if (cible_type !== 'beneficiaire' && cible_type !== 'structure') {
    notFound();
  }
  if (
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cible_id)
  ) {
    notFound();
  }

  // Vérifie l'accès RLS à la cible (si l'utilisateur ne la voit pas, 404
  // pour ne pas fuiter d'info sur l'existence de la fiche).
  const supabase = await createSupabaseServerClient();
  let cibleLibelle: string | null = null;

  if (cible_type === 'beneficiaire') {
    const { data } = await supabase
      .from('beneficiaires')
      .select('prenom, nom')
      .eq('id', cible_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (data) cibleLibelle = `${data.prenom} ${data.nom}`;
  } else {
    const { data } = await supabase
      .from('structures')
      .select('nom_structure')
      .eq('id', cible_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (data) cibleLibelle = data.nom_structure;
  }

  if (!cibleLibelle) notFound();

  const questionnaire: 'A' | 'B' = cible_type === 'beneficiaire' ? 'A' : 'B';

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
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle enquête · {cibleLibelle}</h1>
        <p className="text-muted-foreground text-sm">
          Questionnaire {questionnaire} — saisissez les réponses ci-dessous. Le brouillon est
          sauvegardé automatiquement dans votre navigateur.
        </p>
      </header>

      <EnqueteSaisie questionnaire={questionnaire} cibleId={cible_id} cibleLibelle={cibleLibelle} />
    </div>
  );
}

function SansCible() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle enquête</h1>
        <p className="text-muted-foreground text-sm">
          Choisissez la cible (bénéficiaire ou structure) avant de démarrer.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comment lancer une enquête ?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Une session d’enquête est rattachée à une fiche bénéficiaire (questionnaire A) ou à une
            fiche structure (questionnaire B). Pour démarrer :
          </p>
          <ol className="ml-5 list-decimal space-y-2">
            <li>
              Allez sur la page{' '}
              <Link href="/beneficiaires" className="text-primary underline">
                Bénéficiaires
              </Link>{' '}
              ou{' '}
              <Link href="/structures" className="text-primary underline">
                Structures
              </Link>
              .
            </li>
            <li>Ouvrez la fiche du bénéficiaire / de la structure ciblé(e).</li>
            <li>Cliquez sur le bouton « Lancer une enquête » dans la fiche.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
