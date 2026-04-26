import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listUtilisateurs } from '@/lib/utilisateurs/queries';
import { getNomenclatures } from '@/lib/beneficiaires/nomenclatures-cache';
import { UtilisateurTable } from '@/components/admin/utilisateur-table';
import { DialogueCreerUtilisateur } from '@/components/admin/dialogue-creer-utilisateur';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Administration · Utilisateurs — OIF Emploi Jeunes',
};

export default async function AdminUtilisateursPage() {
  const utilisateur = await requireUtilisateurValide();
  if (utilisateur.role !== 'admin_scs') notFound();

  const supabase = await createSupabaseServerClient();
  const [utilisateurs, nomenclatures, organisationsData] = await Promise.all([
    listUtilisateurs(),
    getNomenclatures(),
    supabase
      .from('organisations')
      .select('id, nom')
      .is('deleted_at', null)
      .order('nom', { ascending: true })
      .limit(500),
  ]);

  const organisations = (organisationsData.data ?? []).map((o) => ({
    id: o.id,
    nom: o.nom,
  }));
  const projets = Array.from(nomenclatures.projets.entries()).map(([code, meta]) => ({
    code,
    libelle: meta.libelle,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1>
          <p className="text-muted-foreground text-sm">
            {utilisateurs.length.toLocaleString('fr-FR')} compte
            {utilisateurs.length > 1 ? 's' : ''} sur la plateforme. Création réservée aux
            administrateurs SCS.
          </p>
        </div>
        <DialogueCreerUtilisateur organisations={organisations} projets={projets} />
      </header>

      {!process.env.RESEND_API_KEY && (
        <Card>
          <CardContent className="bg-amber-50/50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>Phase MOCK email</strong> — la variable
            <code className="mx-1 rounded bg-amber-100/60 px-1 dark:bg-amber-900/40">
              RESEND_API_KEY
            </code>
            n’est pas définie dans <code>.env.local</code>. L’envoi automatique d’emails est
            désactivé : le lien d’activation est retourné dans le toast de succès et dans les logs
            serveur, à transmettre manuellement. Cf.{' '}
            <a
              href="https://github.com/rifalovi/emploijeune/blob/main/docs/configuration/resend-setup.md"
              className="underline"
            >
              docs/configuration/resend-setup.md
            </a>{' '}
            pour activer Resend.
          </CardContent>
        </Card>
      )}

      <UtilisateurTable rows={utilisateurs} />
    </div>
  );
}
