'use client';

import { useState, useTransition } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { envoyerMessageContact } from '@/lib/contact/server-actions';
import { SUJETS_CONTACT, SUJET_CONTACT_LIBELLES, type SujetContact } from '@/lib/schemas/contact';

export function FormulaireContact() {
  const [pending, startTransition] = useTransition();
  const [envoye, setEnvoye] = useState(false);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [sujet, setSujet] = useState<SujetContact>('question_generale');
  const [message, setMessage] = useState('');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const reset = () => {
    setNom('');
    setEmail('');
    setSujet('question_generale');
    setMessage('');
    setErreurs({});
    setEnvoye(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErreurs({});
    startTransition(async () => {
      const result = await envoyerMessageContact({ nom, email, sujet, message });
      if (result.status === 'succes') {
        setEnvoye(true);
        toast.success('Message envoyé', {
          description: "L'équipe SCS vous répondra sous 48h ouvrées.",
          duration: 8000,
        });
      } else if (result.status === 'erreur_validation') {
        const map: Record<string, string> = {};
        for (const i of result.issues) map[i.path] = i.message;
        setErreurs(map);
        toast.error(`${result.issues.length} erreur(s) de validation`);
      } else {
        toast.error(result.message);
      }
    });
  };

  if (envoye) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 aria-hidden className="size-8" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Message envoyé avec succès</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Merci pour votre message. L&apos;équipe SCS vous répondra sous 48h ouvrées à
          l&apos;adresse <strong>{email}</strong>.
        </p>
        <Button variant="outline" onClick={reset} className="mt-6">
          Envoyer un autre message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="nom">Nom complet *</Label>
          <Input
            id="nom"
            required
            maxLength={120}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Marie KOUASSI"
          />
          {erreurs.nom && <p className="text-destructive text-xs">{erreurs.nom}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@organisation.org"
          />
          {erreurs.email && <p className="text-destructive text-xs">{erreurs.email}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="sujet">Sujet *</Label>
        <Select value={sujet} onValueChange={(v) => setSujet((v ?? 'autre') as SujetContact)}>
          <SelectTrigger id="sujet">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUJETS_CONTACT.map((s) => (
              <SelectItem key={s} value={s}>
                {SUJET_CONTACT_LIBELLES[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="message">Message *</Label>
        <Textarea
          id="message"
          required
          rows={6}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Décrivez votre demande en quelques lignes (minimum 20 caractères)..."
        />
        <p className="text-muted-foreground flex justify-between text-xs">
          <span>
            {erreurs.message ? <span className="text-destructive">{erreurs.message}</span> : null}
          </span>
          <span className="tabular-nums">{message.length}/5000</span>
        </p>
      </div>

      <p className="text-muted-foreground text-xs">
        En envoyant ce formulaire, vous acceptez que vos données soient traitées par le SCS pour
        répondre à votre demande. Aucune utilisation commerciale.
      </p>

      <Button
        type="submit"
        disabled={pending}
        className="w-full gap-2 bg-[#0E4F88] hover:bg-[#0E4F88]/90 sm:w-auto"
      >
        <Send aria-hidden className="size-4" />
        {pending ? 'Envoi en cours...' : 'Envoyer le message'}
      </Button>
    </form>
  );
}
