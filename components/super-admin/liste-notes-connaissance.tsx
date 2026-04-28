'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, Trash2, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  archiverNoteConnaissance,
  desarchiverNoteConnaissance,
  supprimerNoteConnaissance,
} from '@/lib/ia/base-connaissance-actions';

export type NoteConnaissanceItem = {
  id: string;
  titre: string;
  type: string;
  contenu_text: string | null;
  fichier_extracted_text: string | null;
  source_conversation_id: string | null;
  ajoute_at: string;
  archive: boolean;
  tags: string[];
};

export function ListeNotesConnaissance({
  notes,
  archives = false,
}: {
  notes: NoteConnaissanceItem[];
  archives?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (notes.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm italic">
        {archives
          ? 'Aucune note archivée.'
          : 'Aucune note pour l\u2019instant. Ajoutez la première via le formulaire ci-contre.'}
      </p>
    );
  }

  const onArchiver = (id: string) =>
    startTransition(async () => {
      const res = await archiverNoteConnaissance(id);
      if (res.status === 'erreur') toast.error(res.message);
      else {
        toast.success('Note archivée');
        router.refresh();
      }
    });

  const onDesarchiver = (id: string) =>
    startTransition(async () => {
      const res = await desarchiverNoteConnaissance(id);
      if (res.status === 'erreur') toast.error(res.message);
      else {
        toast.success('Note réactivée');
        router.refresh();
      }
    });

  const onSupprimer = (id: string) => {
    if (!confirm('Supprimer définitivement cette note ?')) return;
    startTransition(async () => {
      const res = await supprimerNoteConnaissance(id);
      if (res.status === 'erreur') toast.error(res.message);
      else {
        toast.success('Note supprimée');
        router.refresh();
      }
    });
  };

  return (
    <ul className="divide-y divide-slate-200">
      {notes.map((n) => {
        const contenu = n.contenu_text ?? n.fichier_extracted_text ?? '';
        const apercu = contenu.length > 280 ? contenu.slice(0, 280) + '…' : contenu;
        return (
          <li key={n.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 shrink-0 text-slate-500" aria-hidden />
                  <h3 className="font-semibold text-slate-900">{n.titre}</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {n.type.replace('_', ' ')}
                  </Badge>
                </div>
                {n.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {n.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                {apercu && (
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                    {apercu}
                  </p>
                )}
                <p className="text-muted-foreground mt-2 text-xs">
                  Ajoutée le {new Date(n.ajoute_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                {archives ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDesarchiver(n.id)}
                    disabled={pending}
                    className="gap-1.5"
                  >
                    <ArchiveRestore className="size-3.5" aria-hidden />
                    Réactiver
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onArchiver(n.id)}
                    disabled={pending}
                    className="gap-1.5"
                  >
                    <Archive className="size-3.5" aria-hidden />
                    Archiver
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSupprimer(n.id)}
                  disabled={pending}
                  className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Supprimer
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
