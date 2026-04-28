'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ajouterNoteConnaissance } from '@/lib/ia/base-connaissance-actions';

export function FormulaireAjouterNote() {
  const router = useRouter();
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [pending, startTransition] = useTransition();

  const onSubmit = () => {
    if (titre.trim().length < 3) {
      toast.error('Le titre doit faire au moins 3 caractères.');
      return;
    }
    if (contenu.trim().length < 10) {
      toast.error('Le contenu doit faire au moins 10 caractères.');
      return;
    }
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 20);

    startTransition(async () => {
      const res = await ajouterNoteConnaissance({
        titre: titre.trim(),
        type: 'note_analyse',
        contenu_text: contenu.trim(),
        tags,
      });
      if (res.status === 'erreur') {
        toast.error(res.message);
        return;
      }
      toast.success('Note ajoutée à la base de connaissance');
      setTitre('');
      setContenu('');
      setTagsRaw('');
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="bc-titre">Titre</Label>
        <Input
          id="bc-titre"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Ex. : méthodologie cohorte 2025"
          maxLength={200}
        />
      </div>
      <div>
        <Label htmlFor="bc-contenu">Contenu</Label>
        <Textarea
          id="bc-contenu"
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          rows={8}
          placeholder="Note libre, analyse, contexte institutionnel… Markdown accepté."
          maxLength={50000}
          className="resize-none"
        />
        <p className="text-muted-foreground mt-1 text-[11px]">
          {contenu.length} / 50 000 caractères
        </p>
      </div>
      <div>
        <Label htmlFor="bc-tags">Tags (séparés par virgules)</Label>
        <Input
          id="bc-tags"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="ex. méthodologie, cohorte, pilotage"
        />
      </div>
      <Button onClick={onSubmit} disabled={pending} className="w-full gap-1.5">
        <Plus className="size-4" aria-hidden />
        {pending ? 'Ajout en cours…' : 'Ajouter à la base'}
      </Button>
    </div>
  );
}
