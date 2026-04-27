import { Users, GraduationCap, Building2, Briefcase, Globe2, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PROGRAMMES_STRATEGIQUES } from '@/lib/design/oif/programmes';
import { cn } from '@/lib/utils';
import type { IndicateursOif } from '@/lib/kpis/indicateurs-oif';
import { CompteurAnime } from './compteur-anime';

/**
 * Grille des 5 indicateurs OIF stratégiques V1 (V1.7.0 — refonte premium).
 *
 * Design SaaS-grade (Linear / Vercel / Stripe-inspired) :
 *   - **Hero A1** : carte large `xl:col-span-2`, gradient bleu OIF profond,
 *     icône Lucide en background à 10 % d'opacité, chiffre `text-6xl/7xl`
 *     blanc avec compteur animé, badge doré « Vue globale » + détails
 *     femmes/hommes en blanc/80.
 *   - **4 cards secondaires** (A4, B1, B4, F1) : fond blanc, bordure
 *     gauche 4 px colorée selon code (A4 violet PS2, B1 vert PS3,
 *     B4 doré, F1 cyan PS1), icône colorée dans box arrondie haut-droite,
 *     compteur animé, hover `translate-y-1` + `shadow-xl`,
 *     icône `scale-110` au hover.
 *   - **Animations** : compteur 0 → valeur cible (1,5 s ease-out), fade-in
 *     au montage avec stagger via `animation-delay` (Tailwind animate).
 *   - **Layout** : `grid-cols-1` mobile, `sm:grid-cols-2` tablette
 *     (A1 full-width), `xl:grid-cols-3` desktop (A1 span-2 row 1).
 *
 * A4 et F1 affichent un placeholder « À venir » car ils dépendent des
 * questionnaires longitudinaux non alimentés en V1.
 */

const COULEUR_BLEU_OIF = '#0E4F88';
const COULEUR_DORE = '#F5A623';

export function KpiGridOif({ data }: { data: IndicateursOif }) {
  const i = data.indicateurs;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {/* HERO — A1 : col-span-2 sur desktop, full-width tablette */}
      <KpiHeroCard
        code="A1"
        libelle={i.A1.libelle}
        valeur={i.A1.valeur}
        icone={GraduationCap}
        femmes={i.A1.femmes}
        hommes={i.A1.hommes}
        delaiMs={0}
      />
      <KpiSecondaireCard
        code="A4"
        libelle={i.A4.libelle}
        valeur={i.A4.valeur}
        icone={Users}
        couleur={PROGRAMMES_STRATEGIQUES.PS2.principale}
        proxy={i.A4.proxy}
        delaiMs={120}
      />
      <KpiSecondaireCard
        code="B1"
        libelle={i.B1.libelle}
        valeur={i.B1.valeur}
        icone={Building2}
        couleur={PROGRAMMES_STRATEGIQUES.PS3.principale}
        delaiMs={240}
      />
      <KpiSecondaireCard
        code="B4"
        libelle={i.B4.libelle}
        valeur={i.B4.valeur}
        icone={Briefcase}
        couleur={COULEUR_DORE}
        details={i.B4.mention ?? null}
        delaiMs={360}
      />
      <KpiSecondaireCard
        code="F1"
        libelle={i.F1.libelle}
        valeur={i.F1.valeur}
        icone={Globe2}
        couleur={PROGRAMMES_STRATEGIQUES.PS1.principale}
        proxy={i.F1.proxy}
        delaiMs={480}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero card A1 (V1.7.0 premium) — col-span-2 desktop, gradient bleu OIF
// ─────────────────────────────────────────────────────────────────────────────
function KpiHeroCard({
  code,
  libelle,
  valeur,
  icone: Icone,
  femmes,
  hommes,
  delaiMs,
}: {
  code: string;
  libelle: string;
  valeur: number | null;
  icone: typeof Users;
  femmes?: number;
  hommes?: number;
  delaiMs: number;
}) {
  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-0 shadow-md transition-all',
        'hover:-translate-y-1 hover:shadow-2xl',
        'animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-700',
        'sm:col-span-2 xl:col-span-2',
      )}
      style={{
        background: `linear-gradient(135deg, ${COULEUR_BLEU_OIF} 0%, #1565a8 60%, #0E4F88 100%)`,
        animationDelay: `${delaiMs}ms`,
      }}
    >
      {/* Icône XXL en background à 10% d'opacité */}
      <Icone
        aria-hidden
        className="pointer-events-none absolute -right-6 -bottom-8 size-56 text-white opacity-[0.07] transition-transform duration-500 group-hover:scale-110"
      />
      {/* Pattern subtle radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.12) 0%, transparent 50%)',
        }}
      />
      <CardContent className="relative z-10 p-8 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge
              variant="outline"
              className="border-white/40 bg-white/15 font-mono text-xs text-white backdrop-blur-sm"
            >
              {code}
            </Badge>
            <p className="text-sm leading-tight font-medium text-white/90 md:text-base">
              {libelle}
            </p>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 gap-1 border-transparent text-xs font-medium backdrop-blur-sm"
            style={{
              backgroundColor: `${COULEUR_DORE}25`,
              color: COULEUR_DORE,
            }}
          >
            <TrendingUp aria-hidden className="size-3" />
            Vue globale
          </Badge>
        </div>
        <div className="mt-6">
          {valeur !== null ? (
            <>
              <div className="text-6xl font-bold text-white tabular-nums md:text-7xl">
                <CompteurAnime valeur={valeur} dureeMs={1500} delaiMs={delaiMs} />
              </div>
              {femmes !== undefined && hommes !== undefined && (
                <p className="mt-3 text-sm text-white/80 md:text-base">
                  <strong className="text-white">{femmes.toLocaleString('fr-FR')}</strong> femmes ·{' '}
                  <strong className="text-white">{hommes.toLocaleString('fr-FR')}</strong> hommes
                </p>
              )}
            </>
          ) : (
            <p className="text-base text-white/70 italic">À venir</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card secondaire (V1.7.0 premium) — bordure gauche 4px, icône box, hover lift
// ─────────────────────────────────────────────────────────────────────────────
function KpiSecondaireCard({
  code,
  libelle,
  valeur,
  icone: Icone,
  couleur,
  details = null,
  proxy = null,
  delaiMs,
}: {
  code: string;
  libelle: string;
  valeur: number | null;
  icone: typeof Users;
  couleur: string;
  details?: string | null;
  proxy?: string | null;
  delaiMs: number;
}) {
  return (
    <Card
      className={cn(
        'group overflow-hidden border-l-4 bg-white transition-all',
        'hover:-translate-y-1 hover:shadow-xl',
        'animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-700',
      )}
      style={{
        borderLeftColor: couleur,
        animationDelay: `${delaiMs}ms`,
      }}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <Badge
              variant="outline"
              className="font-mono text-xs"
              style={{ color: couleur, borderColor: `${couleur}66` }}
            >
              {code}
            </Badge>
            <p className="text-sm leading-tight font-medium text-gray-700">{libelle}</p>
          </div>
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: `${couleur}1a`, color: couleur }}
          >
            <Icone aria-hidden className="size-5" />
          </div>
        </div>
        <div className="mt-5">
          {valeur !== null ? (
            <>
              <div className="text-4xl font-bold text-gray-900 tabular-nums">
                <CompteurAnime valeur={valeur} dureeMs={1500} delaiMs={delaiMs} />
              </div>
              {details && <p className="text-muted-foreground mt-1.5 text-xs">{details}</p>}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3">
              <span className="text-sm font-medium text-gray-700 italic">À venir</span>
              {proxy && <p className="text-muted-foreground mt-1 text-xs">{proxy}</p>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
