import type { Metadata } from 'next';
import { Download, FileText, Calendar } from 'lucide-react';
import { HeaderPublic } from '@/components/landing/header-public';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { getAuthUser } from '@/lib/supabase/auth';
import { listerDocumentsPublicsAvecFichier } from '@/lib/documents-publics/queries';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Documents publics – OIF Emploi Jeunes',
  description:
    "Bibliothèque des documents publics téléchargeables du Service de Conception et Suivi (SCS) de l'OIF : note de cadrage, rapports, plaquettes.",
};

export const revalidate = 60;

export default async function DocumentsPubliquePage() {
  const [documents, user] = await Promise.all([listerDocumentsPublicsAvecFichier(), getAuthUser()]);

  return (
    <div className="bg-background min-h-screen">
      <HeaderPublic isAuthenticated={Boolean(user)} />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-8 md:py-16">
        <section>
          <Badge
            variant="outline"
            className="text-xs"
            style={{ color: '#F5A623', borderColor: '#F5A62366' }}
          >
            Ressources documentaires
          </Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0E4F88] md:text-4xl">
            Documents publics
          </h1>
          <p className="text-muted-foreground mt-4 max-w-3xl text-sm leading-relaxed">
            Téléchargez les documents publics du Service de Conception et Suivi de l&apos;OIF :
            cadre méthodologique, rapports d&apos;activité, plaquettes institutionnelles.
          </p>
        </section>

        <section className="mt-10">
          {documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <FileText className="mx-auto size-8 text-slate-300" aria-hidden />
              <p className="mt-3 text-sm font-medium text-slate-500">
                Aucun document publié pour l&apos;instant.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Les documents apparaîtront ici dès leur mise en ligne par l&apos;équipe SCS.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {documents.map((doc) => (
                <li
                  key={doc.cle}
                  className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-5 transition-shadow hover:shadow-md"
                >
                  <div
                    className="flex size-12 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: '#0E4F8815', color: '#0E4F88' }}
                  >
                    <FileText className="size-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-slate-900">{doc.libelle}</h2>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span>{doc.nomFichier}</span>
                      <span className="tabular-nums">
                        {(doc.tailleOctets / 1024).toFixed(0)} Ko
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" aria-hidden />
                        {new Date(doc.uploadedAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <a
                    href={doc.urlPublique}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: 'default', size: 'sm' }),
                      'gap-2 bg-[#0E4F88] hover:bg-[#0a3d6b]',
                    )}
                  >
                    <Download className="size-4" aria-hidden />
                    Télécharger
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="border-t bg-slate-50 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500 sm:px-8">
          © {new Date().getFullYear()} OIF · Service de Conception et Suivi
        </div>
      </footer>
    </div>
  );
}
