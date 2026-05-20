import { listerDocumentsPublics } from '@/lib/documents-publics/queries';
import { DocumentsPublicsClient } from './documents-client';

export const metadata = { title: 'Documents publics — Super Admin' };

export default async function DocumentsPublicsPage() {
  const documents = await listerDocumentsPublics();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Documents publics téléchargeables</h2>
        <p className="text-muted-foreground text-sm">
          Uploadez les PDF qui s&apos;affichent en téléchargement sur les pages publiques (note de
          cadrage, etc.). Les fichiers sont stockés dans Supabase Storage et accessibles sans
          authentification via une URL publique.
        </p>
      </header>

      <DocumentsPublicsClient documents={documents} />
    </div>
  );
}
