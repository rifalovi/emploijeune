'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EchelleLikert } from './echelle-likert';
import { RadioOuiNon } from './radio-oui-non';
import { RadioChoixUnique } from './radio-choix-unique';
import type { Question } from '@/lib/schemas/enquetes/questionnaires';
import { cn } from '@/lib/utils';

/**
 * Rend une question selon son type (oui_non, choix_unique, échelle, texte
 * court/long, nombre, année). Ce composant est l'unique point d'entrée
 * pour la traduction `Question` (déclaratif) → contrôle React (impératif).
 *
 * Convention valeur :
 *   - oui_non : boolean | undefined
 *   - choix_unique / echelle : string | undefined
 *   - texte_court / texte_long : string
 *   - nombre_entier / nombre_decimal / annee : number | undefined
 */

export type QuestionRendererProps = {
  question: Question;
  value: unknown;
  onChange: (valeur: unknown) => void;
  errorMessage?: string;
  disabled?: boolean;
};

export function QuestionRenderer({
  question,
  value,
  onChange,
  errorMessage,
  disabled,
}: QuestionRendererProps) {
  const id = `question-${question.id}`;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground font-mono text-xs">{question.id}</span>
        <Label htmlFor={id} className="text-sm leading-snug font-medium">
          {question.libelle}
          {question.obligatoire && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>
      {question.aide && <p className="text-muted-foreground text-xs italic">{question.aide}</p>}

      <ChampSaisie
        id={id}
        question={question}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />

      {errorMessage && <p className="text-destructive text-xs font-medium">{errorMessage}</p>}
    </div>
  );
}

function ChampSaisie({
  id,
  question,
  value,
  onChange,
  disabled,
}: {
  id: string;
  question: Question;
  value: unknown;
  onChange: (valeur: unknown) => void;
  disabled?: boolean;
}) {
  const name = id;

  switch (question.type) {
    case 'oui_non':
      return (
        <RadioOuiNon
          name={name}
          value={typeof value === 'boolean' ? value : undefined}
          onValueChange={onChange}
          disabled={disabled}
        />
      );

    case 'choix_unique':
      return (
        <RadioChoixUnique
          name={name}
          value={typeof value === 'string' ? value : undefined}
          onValueChange={onChange}
          options={question.options ?? []}
          disabled={disabled}
        />
      );

    case 'echelle':
      return (
        <EchelleLikert
          name={name}
          value={typeof value === 'string' ? value : undefined}
          onValueChange={onChange}
          options={question.options ?? []}
          disabled={disabled}
        />
      );

    case 'texte_court':
      return (
        <Input
          id={id}
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={500}
        />
      );

    case 'texte_long':
      return (
        <Textarea
          id={id}
          rows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={2000}
        />
      );

    case 'nombre_entier':
    case 'nombre_decimal':
    case 'annee': {
      const step = question.type === 'nombre_decimal' ? '0.01' : '1';
      return (
        <Input
          id={id}
          type="number"
          step={step}
          inputMode={question.type === 'nombre_decimal' ? 'decimal' : 'numeric'}
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(undefined);
              return;
            }
            const n = question.type === 'nombre_decimal' ? Number(raw) : Number.parseInt(raw, 10);
            onChange(Number.isNaN(n) ? undefined : n);
          }}
          disabled={disabled}
          className={cn('tabular-nums', question.type === 'annee' ? 'max-w-32' : 'max-w-48')}
        />
      );
    }

    default:
      return null;
  }
}
