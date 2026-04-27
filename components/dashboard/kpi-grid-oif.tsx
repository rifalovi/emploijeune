import { Users, GraduationCap, Building2, Briefcase, Globe2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';
import { cn } from '@/lib/utils';
import type { IndicateursOif } from '@/lib/kpis/indicateurs-oif';

/**
 * Grille des 5 indicateurs OIF stratégiques V1 (V1.6.0 polish premium).
 *
 * Design CRExE-inspired :
 *   - 1ère card A1 « Jeunes formés » : bleu OIF plein, chiffre blanc proéminent
 *     (heros KPI). Premier point d'attention de l'utilisateur.
 *   - 4 autres cards : fond blanc, bordure gauche colorée selon code (A4 violet,
 *     B1 vert, B4 doré, F1 cyan), icône colorée, hover lift.
 *   - A4 et F1 affichent un placeholder « Phase 2 — Diapo D2/D3 » car ils
 *     dépendent des questionnaires longitudinaux non alimentés en V1.
 */

const COULEUR_BLEU_OIF = '#0E4F88';
const COULEUR_DORE = '#F5A623';

export function KpiGridOif({ data }: { data: IndicateursOif }) {
  const i = data.indicateurs;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {/* HERO — 1ère card en bleu plein */}
      <KpiHeroCard
        code="A1"
        libelle={i.A1.libelle}
        valeur={i.A1.valeur}
        icone={GraduationCap}
        details={
          i.A1.femmes !== undefined && i.A1.hommes !== undefined
            ? `${i.A1.femmes.toLocaleString('fr-FR')} femmes · ${i.A1.hommes.toLocaleString('fr-FR')} hommes`
            : null
        }
      />
      <KpiSecondaireCard
        code="A4"
        libelle={i.A4.libelle}
        valeur={i.A4.valeur}
        icone={Users}
        couleur={PROGRAMMES_STRATEGIQUES.PS2.principale}
        proxy={i.A4.proxy}
      />
      <KpiSecondaireCard
        code="B1"
        libelle={i.B1.libelle}
        valeur={i.B1.valeur}
        icone={Building2}
        couleur={PROGRAMMES_STRATEGIQUES.PS3.principale}
      />
      <KpiSecondaireCard
        code="B4"
        libelle={i.B4.libelle}
        valeur={i.B4.valeur}
        icone={Briefcase}
        couleur={COULEUR_DORE}
        details={i.B4.mention ?? null}
      />
      <KpiSecondaireCard
        code="F1"
        libelle={i.F1.libelle}
        valeur={i.F1.valeur}
        icone={Globe2}
        couleur={PROGRAMMES_STRATEGIQUES.PS1.principale}
        proxy={i.F1.proxy}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero card (premier KPI A1) : bleu OIF plein avec chiffre blanc
// ─────────────────────────────────────────────────────────────────────────────
function KpiHeroCard({
  code,
  libelle,
  valeur,
  icone: Icone,
  details = null,
}: {
  code: string;
  libelle: string;
  valeur: number | null;
  icone: typeof Users;
  details?: string | null;
}) {
  return (
    <Card
      className="overflow-hidden border-0 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl"
      style={{
        background: `linear-gradient(135deg, ${COULEUR_BLEU_OIF} 0%, #1565a8 100%)`,
      }}
    >
      <CardContent className="p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <Badge
              variant="outline"
              className="border-white/40 bg-white/15 font-mono text-xs text-white backdrop-blur-sm"
            >
              {code}
            </Badge>
            <p className="mt-1.5 text-sm leading-tight font-medium text-white/90">{libelle}</p>
          </div>
          <Icone aria-hidden className="size-6 shrink-0 text-white/80" />
        </div>
        <div className="mt-4">
          {valeur !== null ? (
            <>
              <div className="text-4xl font-bold text-white tabular-nums">
                {valeur.toLocaleString('fr-FR')}
              </div>
              {details && <p className="mt-1.5 text-xs text-white/75">{details}</p>}
            </>
          ) : (
            <p className="text-sm text-white/70 italic">À venir</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card secondaire : fond blanc, bordure gauche colorée
// ─────────────────────────────────────────────────────────────────────────────
function KpiSecondaireCard({
  code,
  libelle,
  valeur,
  icone: Icone,
  couleur,
  details = null,
  proxy = null,
}: {
  code: string;
  libelle: string;
  valeur: number | null;
  icone: typeof Users;
  couleur: string;
  details?: string | null;
  proxy?: string | null;
}) {
  return (
    <Card
      className={cn(
        'overflow-hidden border-l-4 transition-all hover:-translate-y-0.5 hover:shadow-md',
      )}
      style={{ borderLeftColor: couleur }}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <Badge
              variant="outline"
              className="font-mono text-xs"
              style={{ color: couleur, borderColor: `${couleur}66` }}
            >
              {code}
            </Badge>
            <p className="mt-1.5 text-sm leading-tight font-medium text-gray-700">{libelle}</p>
          </div>
          <div
            className="flex size-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${couleur}1a`, color: couleur }}
          >
            <Icone aria-hidden className="size-5" />
          </div>
        </div>
        <div className="mt-4">
          {valeur !== null ? (
            <>
              <div className="text-3xl font-bold text-gray-900 tabular-nums">
                {valeur.toLocaleString('fr-FR')}
              </div>
              {details && <p className="text-muted-foreground mt-1.5 text-xs">{details}</p>}
            </>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 p-2 text-xs">
              <span className="font-medium text-gray-700">À venir</span>
              {proxy && <p className="text-muted-foreground mt-0.5">{proxy}</p>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
