import type { Metadata } from 'next';
import { BookOpen, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FormulaireAjouterNote } from '@/components/super-admin/formulaire-ajouter-note';
import { ListeNotesConnaissance } from '@/components/super-admin/liste-notes-connaissance';

export const metadata: Metadata = {
  title: 'Base de connaissance — Super Administration',
};

export const dynamic = 'force-dynamic';

export default async function BaseConnaissancePage() {
  const supabase = await createSupabaseServerClient();
  const { data: notes } = await supabase
    .from('base_connaissance')
    .select(
      'id, titre, type, contenu_text, fichier_extracted_text, source_conversation_id, ajoute_at, archive, tags',
    )
    .order('ajoute_at', { ascending: false });

  const actives = (notes ?? []).filter((n) => !n.archive);
  const archivees = (notes ?? []).filter((n) => n.archive);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span
                className="inline-flex size-10 items-center justify-center rounded-lg text-white"
                style={{ background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }}
              >
                <BookOpen className="size-5" aria-hidden />
              </span>
              <div>
                <CardTitle>Base de connaissance institutionnelle</CardTitle>
                <CardDescription>
                  Notes et références ajoutées par le super_admin. Injectées automatiquement dans le
                  contexte de l'assistant IA via recherche full-text (top 5 pertinents).
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ListeNotesConnaissance notes={actives} />
          </CardContent>
        </Card>

        {archivees.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Archives ({archivees.length})</CardTitle>
              <CardDescription>
                Notes archivées : retirées du contexte IA mais conservées en base. Désarchivable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ListeNotesConnaissance notes={archivees} archives />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar sticky : formulaire d'ajout */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#0E4F88]" aria-hidden />
              <CardTitle className="text-base">Ajouter une note</CardTitle>
            </div>
            <CardDescription>
              Texte libre ou note d'analyse institutionnelle. Sera intégrée au contexte IA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormulaireAjouterNote />
          </CardContent>
        </Card>

        <Card className="mt-4 border-blue-100 bg-blue-50/30">
          <CardContent className="p-4 text-xs text-slate-600">
            <Badge
              variant="outline"
              className="mb-2 text-[10px]"
              style={{ borderColor: '#0E4F8866', color: '#0E4F88' }}
            >
              Comment ça marche
            </Badge>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                Recherche full-text PostgreSQL (français) à chaque appel IA — top 5 pertinents
                injectés.
              </li>
              <li>
                Les notes archivées ne sont plus envoyées à Claude mais restent en base pour
                consultation.
              </li>
              <li>
                Lecture accessible à tous les rôles ayant le module IA actif. Écriture : super_admin
                uniquement.
              </li>
            </ul>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
