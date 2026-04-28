'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { analyserAlertesIa } from '@/lib/alertes-qualite/ia-actions';
import { MarkdownRenderer } from '@/components/ia/markdown-renderer';

/**
 * Panneau sticky d'analyse IA des alertes qualité — V2.2.0.
 *
 * MVP : bouton « Demander une analyse IA » qui interroge Claude sur le
 * type d'alerte sélectionné et affiche le résultat structuré (causes,
 * corrections, prévention, risque RGPD).
 *
 * V2.3 (TODO) : propositions de correction par ligne avec checkboxes +
 * application en masse avec audit log (cf. brief Sprint v2.2 — feature 5).
 */
export function PanneauAnalyseIa({ typeAlerte }: { typeAlerte: string }) {
  const [analyse, setAnalyse] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onAnalyser = () => {
    setAnalyse(null);
    startTransition(async () => {
      const res = await analyserAlertesIa({ type: typeAlerte });
      if (res.status === 'erreur') {
        toast.error(res.message);
        return;
      }
      setAnalyse(res.analyse);
    });
  };

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex size-8 items-center justify-center rounded-lg text-white"
            style={{ background: 'linear-gradient(135deg, #5D0073 0%, #0E4F88 100%)' }}
          >
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-base">Analyse IA</CardTitle>
            <CardDescription>
              {typeAlerte === ''
                ? 'Sélectionnez un type d\u2019alerte ci-contre pour analyse.'
                : 'Demandez à Claude des recommandations sur le type filtré.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          onClick={onAnalyser}
          disabled={pending || typeAlerte === ''}
          className="w-full gap-1.5"
          size="sm"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {pending ? 'Analyse en cours…' : 'Demander une analyse IA'}
        </Button>

        {analyse && (
          <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-md border border-slate-200 bg-slate-50/50 p-3">
            <MarkdownRenderer>{analyse}</MarkdownRenderer>
          </div>
        )}

        <p className="text-muted-foreground mt-3 text-[11px] italic">
          MVP V2.2 : analyse synthétique. Corrections par ligne avec validation cas-par-cas en V2.3.
        </p>
      </CardContent>
    </Card>
  );
}
