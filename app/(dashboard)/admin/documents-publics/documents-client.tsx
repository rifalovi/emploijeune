'use client';

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Upload, FileText, Trash2, ExternalLink, FileCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocumentPublic } from '@/lib/documents-publics/queries';
import {
  uploaderDocumentPublic,
  supprimerDocumentPublic,
} from '@/lib/documents-publics/server-actions';

const TAILLE_MAX_OCTETS = 20 * 1024 * 1024;

type Props = {
  documents: DocumentPublic[];
};

export function DocumentsPublicsClient({ documents }: Props) {
  return (
    <div className="space-y-4">
      {documents.map((doc) => (
        <SlotDocument key={doc.cle} doc={doc} />
      ))}
    </div>
  );
}

function SlotDocument({ doc }: { doc: DocumentPublic }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const aFichier = doc.urlPublique.length > 0;

  const onPickFile = () => inputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés.');
      e.target.value = '';
      return;
    }
    if (file.size > TAILLE_MAX_OCTETS) {
      toast.error(`Fichier trop volumineux (max ${TAILLE_MAX_OCTETS / (1024 * 1024)} Mo).`);
      e.target.value = '';
      return;
    }

    setProgress('Lecture du fichier…');
    const base64 = await fileToBase64(file);
    setProgress('Envoi sur le serveur…');

    startTransition(async () => {
      const res = await uploaderDocumentPublic({
        cle: doc.cle,
        libelle: doc.libelle,
        nomFichier: file.name,
        contentType: 'application/pdf',
        taille: file.size,
        fichierBase64: base64,
      });
      setProgress(null);
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success('Document mis à jour. Il est désormais téléchargeable sur la page publique.');
    });

    e.target.value = '';
  };

  const onDelete = () => {
    if (!confirm(`Supprimer le document "${doc.libelle}" ? Cette action est immédiate.`)) return;
    startTransition(async () => {
      const res = await supprimerDocumentPublic(doc.cle);
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success('Document supprimé.');
    });
  };

  return (
    <div className="rounded-lg border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-[#0E4F88]" aria-hidden />
            <h3 className="font-semibold text-slate-900">{doc.libelle}</h3>
            <code className="text-muted-foreground text-xs">[{doc.cle}]</code>
          </div>
          {aFichier ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className="flex items-center gap-2 text-emerald-700">
                <FileCheck2 className="size-4" aria-hidden />
                <span className="font-medium">{doc.nomFichier}</span>
                <span className="text-muted-foreground text-xs">
                  · {(doc.tailleOctets / 1024).toFixed(0)} Ko · uploadé le{' '}
                  {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}
                </span>
              </p>
              <a
                href={doc.urlPublique}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#0E4F88] hover:underline"
              >
                <ExternalLink className="size-3" aria-hidden />
                Voir le fichier
              </a>
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm italic">
              Aucun fichier uploadé pour l&apos;instant. Le bouton de téléchargement est masqué sur
              la page publique.
            </p>
          )}
          {progress && <p className="mt-2 text-xs text-slate-500">{progress}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={onPickFile} disabled={pending} size="sm" className="gap-2">
            <Upload className="size-4" aria-hidden />
            {aFichier ? 'Remplacer' : 'Uploader'}
          </Button>
          {aFichier && (
            <Button
              onClick={onDelete}
              disabled={pending}
              variant="outline"
              size="sm"
              className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="size-4" aria-hidden />
              Retirer
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
