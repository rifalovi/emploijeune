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

      <Card>
        <CardContent className="bg-amber-50/50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Phase MOCK email V1</strong> — l’envoi automatique d’emails (activation, reset)
          est désactivé tant que la configuration Resend n’est pas branchée (Étape 6.5d). En
          attendant, le lien d’activation est retourné dans le toast de succès et dans les logs
          serveur — copiez-le et envoyez-le manuellement à l’utilisateur.
        </CardContent>
      </Card>

      <UtilisateurTable rows={utilisateurs} />
    </div>
  );
}
