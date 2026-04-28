import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { getSessionEnqueteById } from '@/lib/enquetes/queries';
import { EnqueteDetail } from '@/components/enquetes/enquete-detail';
import { EnqueteDetailActions } from '@/components/enquetes/enquete-detail-actions';

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSessionEnqueteById(id);
  if (!session) return { title: 'Enquête — OIF Emploi Jeunes' };
  return {
    title: `Enquête ${session.questionnaire ?? ''} · ${session.cible_libelle ?? ''} — OIF Emploi Jeunes`,
  };
}

export default async function EnqueteDetailPage({ params }: PageProps) {
  const utilisateur = await requireUtilisateurValide();
  const { id } = await params;

  const session = await getSessionEnqueteById(id);
  if (!session) notFound();

  const peutSupprimer = utilisateur.role === 'admin_scs' || utilisateur.role === 'super_admin';

  const liensCible = session.beneficiaire_id
    ? { href: `/beneficiaires/${session.beneficiaire_id}`, label: 'Voir la fiche bénéficiaire' }
    : session.structure_id
      ? { href: `/structures/${session.structure_id}`, label: 'Voir la fiche structure' }
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/enquetes"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Retour à la liste
        </Link>
        {liensCible && (
          <Link
            href={liensCible.href}
            className="text-muted-foreground hover:text-foreground text-sm underline"
          >
            {liensCible.label}
          </Link>
        )}
      </div>

      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Enquête · {session.cible_libelle ?? '—'}
          </h1>
          <p className="text-muted-foreground text-sm">
            Session {id.slice(0, 8)}… — {Object.keys(session.reponses).length} indicateurs
            collectés.
          </p>
        </div>
        <EnqueteDetailActions
          sessionId={id}
          cibleLibelle={session.cible_libelle ?? 'cette session'}
          peutSupprimer={peutSupprimer}
        />
      </header>

      {session.deleted_at && (
        <div className="border-destructive bg-destructive/5 text-destructive rounded-md border p-3 text-sm">
          Cette session est supprimée (soft-delete) depuis le{' '}
          {new Date(session.deleted_at).toLocaleString('fr-FR', { dateStyle: 'long' })}.
          Restauration possible par un administrateur SCS.
        </div>
      )}

      <EnqueteDetail session={session} />
    </div>
  );
}
