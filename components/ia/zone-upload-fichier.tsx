'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { traiterUploadIa, type FichierTraite } from '@/lib/ia/upload-actions';
import { cn } from '@/lib/utils';

/**
 * Zone d'upload de fichiers pour le chat assistant IA — V2.2.1.
 *
 * Formats supportés (V2.2.1) :
 *   • Texte : .txt, .md, .csv (lecture directe, max 50 000 chars)
 *   • Images : .jpg, .jpeg, .png, .webp (envoi à Claude Vision)
 *
 * PDF/DOCX : différé V2.3 (dépendances pdf-parse / mammoth).
 *
 * Pattern : drag-drop + bouton « Joindre ». Les fichiers sont uploadés
 * vers la server action `traiterUploadIa` qui retourne le contenu extrait
 * (texte) ou base64 (image). Le parent récupère ce résultat via
 * `onFichiersAjoutes` pour les inclure dans le prochain message envoyé
 * à Claude.
 */

type Props = {
  fichiersAttaches: FichierTraite[];
  onFichiersAjoutes: (fichiers: FichierTraite[]) => void;
  onFichierRetire: (index: number) => void;
  disabled?: boolean;
};

export function ZoneUploadFichier({
  fichiersAttaches,
  onFichiersAjoutes,
  onFichierRetire,
  disabled,
}: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onUpload = async (files: FileList | File[]) => {
    if (disabled) return;
    if (fichiersAttaches.length + files.length > 5) {
      toast.error('Maximum 5 fichiers par message.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      for (const f of Array.from(files)) {
        formData.append('fichiers', f);
      }
      const res = await traiterUploadIa(formData);
      if (res.status === 'erreur') {
        toast.error(res.message);
        return;
      }
      onFichiersAjoutes(res.fichiers);
      toast.success(
        res.fichiers.length === 1 ? '1 fichier ajouté' : `${res.fichiers.length} fichiers ajoutés`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Échec upload');
    } finally {
      setUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void onUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-2">
      {/* Liste des fichiers attachés */}
      {fichiersAttaches.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {fichiersAttaches.map((f, i) => (
            <li
              key={`${f.nom}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
            >
              {f.type === 'image' ? (
                <ImageIcon className="size-3 text-[#0E4F88]" aria-hidden />
              ) : (
                <FileText className="size-3 text-[#0E4F88]" aria-hidden />
              )}
              <span className="max-w-[160px] truncate font-medium text-slate-700">{f.nom}</span>
              <span className="text-muted-foreground tabular-nums">
                {(f.taille / 1024).toFixed(1)} KB
              </span>
              <button
                type="button"
                onClick={() => onFichierRetire(i)}
                aria-label={`Retirer ${f.nom}`}
                className="ml-1 inline-flex size-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Bouton Joindre + drag-drop */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'rounded-md transition-colors',
          dragActive && 'bg-[#0E4F88]/5 ring-2 ring-[#0E4F88]/30',
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || uploading || fichiersAttaches.length >= 5}
          onClick={() => inputRef.current?.click()}
          className="gap-1.5 text-xs"
        >
          <Paperclip className="size-3.5" aria-hidden />
          {uploading
            ? 'Upload…'
            : dragActive
              ? 'Déposez ici'
              : 'Joindre un fichier (TXT, MD, CSV, image)'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept=".txt,.md,.csv,image/jpeg,image/png,image/webp,image/gif,text/plain,text/markdown,text/csv"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              void onUpload(e.target.files);
              e.target.value = ''; // permet de re-sélectionner le même fichier
            }
          }}
        />
      </div>
    </div>
  );
}
