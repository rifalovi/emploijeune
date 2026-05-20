'use client';

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Trash2,
  ExternalLink,
  FileCheck2,
  Pencil,
  Plus,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DocumentPublic } from '@/lib/documents-publics/queries';
import {
  uploaderDocumentPublic,
  ajouterDocument,
  renommerDocument,
  viderDocument,
  supprimerDocumentDefinitif,
} from '@/lib/documents-publics/server-actions';

const TAILLE_MAX_OCTETS = 20 * 1024 * 1024;

type Props = {
  documents: DocumentPublic[];
};

export function DocumentsPublicsClient({ documents }: Props) {
  return (
    <div className="space-y-8">
      <FormulaireAjout />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-700">Documents existants</h2>
        {documents.length === 0 ? (
          <p className="text-muted-foreground rounded-md border bg-slate-50 px-4 py-6 text-sm">
            Aucun document pour l&apos;instant. Utilisez le formulaire ci-dessus pour en ajouter un.
          </p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <SlotDocument key={doc.cle} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulaire d'ajout — crée un nouveau document libre
// ─────────────────────────────────────────────────────────────────────────────

function FormulaireAjout() {
  const inputFichierRef = useRef<HTMLInputElement>(null);
  const [libelle, setLibelle] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  const reinitialiser = () => {
    setLibelle('');
    setFichier(null);
    if (inputFichierRef.current) inputFichierRef.current.value = '';
  };

  const onSubmit = async () => {
    if (libelle.trim().length < 3) {
      toast.error('Le libellé doit faire au moins 3 caractères.');
      return;
    }
    if (!fichier) {
      toast.error('Sélectionnez un fichier PDF.');
      return;
    }
    if (fichier.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés.');
      return;
    }
    if (fichier.size > TAILLE_MAX_OCTETS) {
      toast.error(`Fichier trop volumineux (max ${TAILLE_MAX_OCTETS / (1024 * 1024)} Mo).`);
      return;
    }

    const base64 = await fileToBase64(fichier);
    startTransition(async () => {
      const res = await ajouterDocument({
        libelle: libelle.trim(),
        nomFichier: fichier.name,
        contentType: 'application/pdf',
        taille: fichier.size,
        fichierBase64: base64,
      });
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success(`Document "${libelle.trim()}" ajouté à la bibliothèque publique.`);
      reinitialiser();
    });
  };

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-5">
      <div className="flex items-center gap-2">
        <Plus className="size-5 text-[#0E4F88]" aria-hidden />
        <h2 className="font-semibold text-slate-900">Ajouter un nouveau document</h2>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        Le document apparaîtra automatiquement dans la bibliothèque publique{' '}
        <code className="text-[11px]">/documents</code>.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="libelle-ajout" className="text-xs font-medium text-slate-700">
            Libellé
          </label>
          <Input
            id="libelle-ajout"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex. Rapport annuel 2025"
            disabled={pending}
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="fichier-ajout" className="text-xs font-medium text-slate-700">
            Fichier PDF
          </label>
          <Input
            ref={inputFichierRef}
            id="fichier-ajout"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
            disabled={pending}
            className="cursor-pointer"
          />
        </div>

        <Button onClick={onSubmit} disabled={pending} className="gap-2 sm:self-end">
          <Upload className="size-4" aria-hidden />
          {pending ? 'Ajout…' : 'Ajouter'}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot d'un document existant
// ─────────────────────────────────────────────────────────────────────────────

function SlotDocument({ doc }: { doc: DocumentPublic }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [renomme, setRenomme] = useState<string | null>(null);
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
      toast.success('Document mis à jour.');
    });

    e.target.value = '';
  };

  const onVider = () => {
    const message = doc.protege
      ? `Retirer le fichier de "${doc.libelle}" ? Le slot reste disponible pour un nouvel upload.`
      : `Vider "${doc.libelle}" sans supprimer le slot ?`;
    if (!confirm(message)) return;
    startTransition(async () => {
      const res = await viderDocument(doc.cle);
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success('Fichier retiré.');
    });
  };

  const onSupprimerDefinitif = () => {
    if (
      !confirm(
        `Supprimer définitivement "${doc.libelle}" ? Cette action est irréversible et le document disparaît de la bibliothèque publique.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await supprimerDocumentDefinitif(doc.cle);
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success('Document supprimé définitivement.');
    });
  };

  const onRenommer = () => {
    const valeur = renomme?.trim();
    if (!valeur || valeur.length < 3) {
      toast.error('Le libellé doit faire au moins 3 caractères.');
      return;
    }
    if (valeur === doc.libelle) {
      setRenomme(null);
      return;
    }
    startTransition(async () => {
      const res = await renommerDocument({ cle: doc.cle, libelle: valeur });
      if (res.status === 'erreur') {
        toast.error(`Échec : ${res.message}`);
        return;
      }
      toast.success('Libellé mis à jour.');
      setRenomme(null);
    });
  };

  return (
    <div className="rounded-lg border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="size-5 text-[#0E4F88]" aria-hidden />
            {renomme !== null ? (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={renomme}
                  onChange={(e) => setRenomme(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onRenommer();
                    if (e.key === 'Escape') setRenomme(null);
                  }}
                  autoFocus
                  maxLength={200}
                  className="h-8 max-w-md"
                />
                <Button onClick={onRenommer} disabled={pending} size="sm">
                  OK
                </Button>
                <Button
                  onClick={() => setRenomme(null)}
                  disabled={pending}
                  size="sm"
                  variant="ghost"
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-slate-900">{doc.libelle}</h3>
                {doc.protege && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                    title="Slot utilisé par une page spécifique (ex. /referentiels)"
                  >
                    <Lock className="size-3" aria-hidden />
                    Protégé
                  </span>
                )}
                <code className="text-muted-foreground text-xs">[{doc.cle}]</code>
                <button
                  type="button"
                  onClick={() => setRenomme(doc.libelle)}
                  className="text-muted-foreground hover:text-slate-700"
                  aria-label="Renommer"
                >
                  <Pencil className="size-3.5" />
                </button>
              </>
            )}
          </div>

          {aFichier ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className="flex flex-wrap items-center gap-2 text-emerald-700">
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
              Aucun fichier uploadé pour l&apos;instant. Le document n&apos;est pas visible sur les
              pages publiques.
            </p>
          )}
          {progress && <p className="mt-2 text-xs text-slate-500">{progress}</p>}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button onClick={onPickFile} disabled={pending} size="sm" className="gap-2">
            <Upload className="size-4" aria-hidden />
            {aFichier ? 'Remplacer' : 'Uploader'}
          </Button>
          {aFichier && doc.protege && (
            <Button
              onClick={onVider}
              disabled={pending}
              variant="outline"
              size="sm"
              className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="size-4" aria-hidden />
              Vider
            </Button>
          )}
          {!doc.protege && (
            <Button
              onClick={onSupprimerDefinitif}
              disabled={pending}
              variant="outline"
              size="sm"
              className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="size-4" aria-hidden />
              Supprimer
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
