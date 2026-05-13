import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUtilisateurValide } from '@/lib/supabase/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ImportsPageClient } from './imports-client';

export const metadata: Metadata = {
  title: 'Imports – OIF Emploi Jeunes',
};

/**
 * Page imports — admin_scs + editeur_projet + super_admin.
 *
 * Si le module `import_ia` est activé pour le rôle (cf. /super-admin/modules),
 * la zone bénéficiaires accepte aussi PDF/DOCX/TXT et propose un toggle
 * « Analyser avec IA » pour ces formats.
 */
export default async function ImportsPage() {
  const utilisateur = await requireUtilisateurValide();
  if (!['super_admin', 'admin_scs', 'editeur_projet'].includes(utilisateur.role)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: importIaActif } = await supabase.rpc('module_actif_pour_courant', {
    p_module: 'import_ia',
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Imports</h1>
        <p className="text-muted-foreground text-sm">
          Importez en masse des bénéficiaires (A1) ou des structures (B1) depuis un fichier au
          format Template. Les erreurs sont reportées ligne par ligne pour correction et ré-import.{' '}
          {importIaActif === true && (
            <span className="font-medium text-purple-700">
              Le module IA est actif pour votre rôle : vous pouvez aussi importer des PDF/DOCX/TXT.
            </span>
          )}
        </p>
      </header>

      <ImportsPageClient importIaActif={importIaActif === true} />
    </div>
  );
}
