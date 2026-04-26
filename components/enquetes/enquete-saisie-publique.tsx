'use client';

import { useState, useTransition, useMemo } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QuestionRenderer } from './question-renderer';
import { QUESTIONNAIRES, type Question } from '@/lib/schemas/enquetes/questionnaires';
import { questionEstVisible } from '@/lib/schemas/enquetes/moteur-regles';
import {
  soumissionQuestionnaireASchema,
  soumissionQuestionnaireBSchema,
} from '@/lib/schemas/enquetes/schemas';
import { soumettreEnquetePublique } from '@/lib/enquetes/tokens-publics';

export type EnqueteSaisiePubliqueProps = {
  token: string;
  questionnaire: 'A' | 'B';
  cibleId: string;
  cibleLibelle: string;
};

type PayloadEnquete = Record<string, unknown>;

function payloadInitial(questionnaire: 'A' | 'B'): PayloadEnquete {
  if (questionnaire === 'A') {
    return {
      consentement_repondant: true,
      a2: {},
      a3: {},
      a4: {},
      a5: {},
      f1: {},
      c5: { source_questionnaire: 'A' },
    };
  }
  return {
    consentement_repondant: true,
    b2: {},
    b3: {},
    b4: {},
    c5: { source_questionnaire: 'B' },
  };
}

/**
 * Variante publique de EnqueteSaisie (Étape 6.5c).
 *
 * Différences avec EnqueteSaisie (mode authentifié) :
 *   - Pas de brouillon localStorage (le token est consommé en une fois,
 *     pas de retour possible — éviter le faux espoir).
 *   - Pas de Select vague/canal (forcés côté serveur depuis le token).
 *   - Pas de bouton Effacer (idem).
 *   - À la soumission, écran de remerciement final (pas de redirection
 *     vers /enquetes/[id] que le destinataire n'aurait pas accès à
 *     consulter sans auth).
 */
export function EnqueteSaisiePublique({
  token,
  questionnaire,
  cibleId,
  cibleLibelle,
}: EnqueteSaisiePubliqueProps) {
  const def = QUESTIONNAIRES[questionnaire];
  const initialPayload = useMemo(() => payloadInitial(questionnaire), [questionnaire]);
  const [payload, setPayload] = useState<PayloadEnquete>(initialPayload);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [soumis, setSoumis] = useState(false);

  const setChamp = (chemin: string, valeur: unknown) => {
    const segments = chemin.split('.');
    setPayload((prev) => {
      const next = { ...prev };
      if (segments.length === 1) {
        next[segments[0]!] = valeur;
        return next;
      }
      const [racine, ...reste] = segments;
      const racineKey = racine!;
      const sousObjet = { ...((next[racineKey] as Record<string, unknown> | undefined) ?? {}) };
      let cursor: Record<string, unknown> = sousObjet;
      for (let i = 0; i < reste.length - 1; i++) {
        const k = reste[i]!;
        cursor[k] = { ...((cursor[k] as Record<string, unknown> | undefined) ?? {}) };
        cursor = cursor[k] as Record<string, unknown>;
      }
      cursor[reste[reste.length - 1]!] = valeur;
      next[racineKey] = sousObjet;
      return next;
    });
  };

  const lireValeur = (chemin: string): unknown => {
    const segments = chemin.split('.');
    let cursor: unknown = payload;
    for (const seg of segments) {
      if (cursor === null || cursor === undefined || typeof cursor !== 'object') return undefined;
      cursor = (cursor as Record<string, unknown>)[seg];
    }
    return cursor;
  };

  const handleSoumettre = () => {
    setErreurs({});
    const payloadAvecMeta = {
      ...payload,
      questionnaire,
      cible_id: cibleId,
      vague_enquete: 'ponctuelle',
      canal_collecte: 'email',
      consentement_repondant: true,
    };

    const schema =
      questionnaire === 'A' ? soumissionQuestionnaireASchema : soumissionQuestionnaireBSchema;
    const parse = schema.safeParse(payloadAvecMeta);

    if (!parse.success) {
      const map: Record<string, string> = {};
      for (const issue of parse.error.issues) {
        const path = issue.path.join('.');
        if (!(path in map)) map[path] = issue.message;
      }
      setErreurs(map);
      toast.error(
        `${parse.error.issues.length} erreur${parse.error.issues.length > 1 ? 's' : ''} de validation`,
      );
      return;
    }

    startTransition(async () => {
      const result = await soumettreEnquetePublique(token, parse.data);
      if (result.status === 'succes') {
        setSoumis(true);
        toast.success('Merci ! Votre réponse a bien été enregistrée.');
      } else if (result.status === 'erreur_token') {
        toast.error('Ce lien n’est plus valide (déjà utilisé ou expiré).');
      } else if (result.status === 'erreur_validation') {
        const map: Record<string, string> = {};
        for (const issue of result.issues) {
          if (!(issue.path in map)) map[issue.path] = issue.message;
        }
        setErreurs(map);
        toast.error('Erreurs de validation côté serveur.');
      } else {
        toast.error(result.message);
      }
    });
  };

  if (soumis) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <CheckCircle2 className="size-12 text-green-600" aria-hidden />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Merci pour votre participation</h2>
            <p className="text-muted-foreground text-sm">
              Vos réponses ont bien été enregistrées. Vous pouvez fermer cette page.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const visibleEvaluator = (q: Question) => questionEstVisible(q, payload);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vous répondez en tant que</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="font-medium">{cibleLibelle}</p>
          <Badge variant="outline" className="mt-1 font-mono text-xs">
            Questionnaire {questionnaire}
          </Badge>
        </CardContent>
      </Card>

      {def.sections.map((section, i) => {
        const visibles = section.questions.filter(visibleEvaluator);
        if (visibles.length === 0) return null;
        return (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {i + 1}. {section.titre}
              </CardTitle>
              {section.description && (
                <p className="text-muted-foreground text-xs">{section.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              {visibles.map((question) => (
                <QuestionRenderer
                  key={question.id}
                  question={question}
                  value={lireValeur(question.champ_payload)}
                  onChange={(v) => setChamp(question.champ_payload, v)}
                  errorMessage={erreurs[question.champ_payload]}
                  disabled={pending}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={handleSoumettre} disabled={pending} size="lg">
          <Send aria-hidden className="size-4" />
          {pending ? 'Soumission…' : 'Envoyer mes réponses'}
        </Button>
      </div>
    </div>
  );
}
