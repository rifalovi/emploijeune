'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { QuestionRenderer } from './question-renderer';
import { useBrouillonEnquete } from './use-brouillon-enquete';
import {
  QUESTIONNAIRES,
  type Questionnaire,
  type Question,
} from '@/lib/schemas/enquetes/questionnaires';
import { questionEstVisible } from '@/lib/schemas/enquetes/moteur-regles';
import {
  VAGUES_ENQUETE_VALUES,
  VAGUE_ENQUETE_LIBELLES,
  CANAUX_COLLECTE_VALUES,
  CANAL_COLLECTE_LIBELLES,
} from '@/lib/schemas/enquetes/nomenclatures';
import {
  soumissionQuestionnaireASchema,
  soumissionQuestionnaireBSchema,
} from '@/lib/schemas/enquetes/schemas';
import { soumettreEnquete } from '@/lib/enquetes/mutations';

export type EnqueteSaisieProps = {
  questionnaire: 'A' | 'B';
  cibleId: string;
  cibleLibelle: string;
};

/**
 * Composant central de saisie d'un questionnaire d'enquête (Étape 6d).
 *
 * Architecture :
 *   - State payload imbriqué (a2/a3/a4/a5/f1/c5 ou b2/b3/b4/c5 + métadonnées)
 *   - Brouillon localStorage debouncé (cf. useBrouillonEnquete)
 *   - Moteur ALLER À : questionEstVisible filtre dynamiquement les questions
 *   - Validation Zod côté client AVANT soumission au Server Action (6e)
 *   - Pas de navigation en étapes — toutes sections visibles + scroll
 *     (formulaire ≤ 25 questions visibles max, soutenable en page unique)
 */

type PayloadEnquete = Record<string, unknown>;

// Valeurs par défaut pour ne pas avoir des champs `undefined` dans le payload
// initial — facilite la lecture dans le moteur de règles `affiche_si`.
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

export function EnqueteSaisie({ questionnaire, cibleId, cibleLibelle }: EnqueteSaisieProps) {
  const router = useRouter();
  const def: Questionnaire = QUESTIONNAIRES[questionnaire];

  const initialPayload = useMemo(() => payloadInitial(questionnaire), [questionnaire]);
  const { payload, setPayload, effacer, derniereSauvegarde } = useBrouillonEnquete<PayloadEnquete>(
    questionnaire,
    cibleId,
    initialPayload,
  );

  const [vague, setVague] = useState<string>('ponctuelle');
  const [canal, setCanal] = useState<string>('formulaire_web');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  /** Met à jour un champ du payload (chemin pointé). */
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

  const handleEffacerBrouillon = () => {
    if (!confirm('Effacer le brouillon ? Les réponses saisies seront perdues.')) return;
    effacer();
    setPayload(initialPayload);
    setErreurs({});
    toast.info('Brouillon effacé');
  };

  const handleSoumettre = () => {
    setErreurs({});
    const payloadAvecMeta = {
      ...payload,
      questionnaire,
      cible_id: cibleId,
      vague_enquete: vague,
      canal_collecte: canal,
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
      const result = await soumettreEnquete(parse.data);
      if (result.status === 'succes') {
        effacer();
        toast.success(
          `Enquête soumise : ${result.indicateurs.length} indicateur${result.indicateurs.length > 1 ? 's' : ''} enregistré${result.indicateurs.length > 1 ? 's' : ''}`,
        );
        router.push(`/enquetes/${result.session_id}`);
      } else {
        toast.error(result.message);
      }
    });
  };

  // Moteur ALLER À : utilise lireValeur via une closure sur payload pour
  // que les sauts conditionnels se mettent à jour à chaque saisie.
  const visibleEvaluator = (q: Question) => questionEstVisible(q, payload);

  return (
    <div className="space-y-4">
      {/* Bandeau cible + brouillon + métadonnées collecte */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contexte de la collecte</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Cible</Label>
            <p className="font-medium">{cibleLibelle}</p>
            <Badge variant="outline" className="font-mono text-xs">
              Questionnaire {questionnaire}
            </Badge>
          </div>
          <div className="space-y-1">
            <Label htmlFor="vague" className="text-muted-foreground text-xs">
              Vague d’enquête
            </Label>
            <Select value={vague} onValueChange={(v) => setVague(v ?? 'ponctuelle')}>
              <SelectTrigger id="vague">
                <SelectValue>
                  {(v: string | null) =>
                    v ? VAGUE_ENQUETE_LIBELLES[v as keyof typeof VAGUE_ENQUETE_LIBELLES] : ''
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VAGUES_ENQUETE_VALUES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {VAGUE_ENQUETE_LIBELLES[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="canal" className="text-muted-foreground text-xs">
              Canal de collecte
            </Label>
            <Select value={canal} onValueChange={(v) => setCanal(v ?? 'formulaire_web')}>
              <SelectTrigger id="canal">
                <SelectValue>
                  {(v: string | null) =>
                    v ? CANAL_COLLECTE_LIBELLES[v as keyof typeof CANAL_COLLECTE_LIBELLES] : ''
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CANAUX_COLLECTE_VALUES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CANAL_COLLECTE_LIBELLES[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sections du questionnaire */}
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

      {/* Pied de page : brouillon + actions */}
      <div className="bg-card sticky bottom-0 -mx-4 flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:-mx-8 md:px-8">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {derniereSauvegarde ? (
            <>
              <CheckCircle2 aria-hidden className="size-3" />
              Brouillon sauvegardé localement à{' '}
              {derniereSauvegarde.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </>
          ) : (
            <>
              <Save aria-hidden className="size-3" />
              Aucun brouillon sauvegardé
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleEffacerBrouillon}
            disabled={pending}
          >
            <Trash2 aria-hidden className="size-4" />
            Effacer le brouillon
          </Button>
          <Button type="button" onClick={handleSoumettre} disabled={pending}>
            <Send aria-hidden className="size-4" />
            {pending ? 'Soumission…' : 'Soumettre l’enquête'}
          </Button>
        </div>
      </div>
    </div>
  );
}
