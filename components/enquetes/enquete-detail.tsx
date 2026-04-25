import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BadgeProjet } from '@/components/shared/badge-projet';
import { QUESTIONNAIRES, type Question } from '@/lib/schemas/enquetes/questionnaires';
import { questionEstVisible } from '@/lib/schemas/enquetes/moteur-regles';
import {
  VAGUE_ENQUETE_LIBELLES,
  CANAL_COLLECTE_LIBELLES,
  type VagueEnquete,
  type CanalCollecte,
} from '@/lib/schemas/enquetes/nomenclatures';
import type { SessionEnqueteDetail } from '@/lib/enquetes/queries';
import type { ProgrammeStrategiqueCode } from '@/lib/schemas/nomenclatures';

export type EnqueteDetailProps = {
  session: SessionEnqueteDetail;
};

/**
 * Vue lecture seule d'une session d'enquête (Étape 6e).
 *
 * Architecture :
 *   - Reconstruit le payload imbriqué à partir de `reponses` (map indicateur
 *     → donnees) pour pouvoir réutiliser le moteur ALLER À en lecture
 *   - Affiche les sections du questionnaire d'origine, en montrant
 *     uniquement les questions visibles selon les réponses saisies
 *   - Pour chaque question : libellé + valeur formatée (libellé humain
 *     pour les enums, oui/non, etc.)
 */
export function EnqueteDetail({ session }: EnqueteDetailProps) {
  if (!session.questionnaire) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-6 text-sm">
          Cette session ne contient aucune cible identifiable.
        </CardContent>
      </Card>
    );
  }

  const def = QUESTIONNAIRES[session.questionnaire];
  const ps = session.programme_strategique as ProgrammeStrategiqueCode | null;

  // Reconstruction du payload imbriqué pour le moteur ALLER À.
  // Mapping indicateur → racine du payload (ex. A2 → 'a2', C5 → 'c5').
  const payload = construirePayloadDepuisReponses(session.reponses);

  return (
    <div className="space-y-4">
      {/* En-tête : cible + métadonnées */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contexte</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Champ label="Cible">
            <span className="font-medium">{session.cible_libelle ?? '—'}</span>
          </Champ>
          <Champ label="Questionnaire">
            <Badge variant="outline" className="font-mono">
              {session.questionnaire}
            </Badge>
          </Champ>
          <Champ label="Projet">
            {session.projet_code ? (
              <BadgeProjet code={session.projet_code} programmeStrategique={ps} variant="inline" />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Champ>
          <Champ label="Date de collecte">
            {format(new Date(session.date_collecte), 'd MMMM yyyy', { locale: fr })}
          </Champ>
          <Champ label="Vague">
            {VAGUE_ENQUETE_LIBELLES[session.vague_enquete as VagueEnquete] ?? session.vague_enquete}
          </Champ>
          <Champ label="Canal">
            {CANAL_COLLECTE_LIBELLES[session.canal_collecte as CanalCollecte] ??
              session.canal_collecte}
          </Champ>
          <Champ label="Indicateurs collectés">
            <div className="flex flex-wrap gap-1">
              {Object.keys(session.reponses)
                .sort()
                .map((code) => (
                  <Badge key={code} variant="secondary" className="font-mono text-xs">
                    {code}
                  </Badge>
                ))}
            </div>
          </Champ>
          <Champ label="Saisie le">
            {format(new Date(session.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
          </Champ>
        </CardContent>
      </Card>

      {/* Sections — affichage filtré par moteur ALLER À */}
      {def.sections.map((section, i) => {
        const visibles = section.questions.filter((q) => questionEstVisible(q, payload));
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
            <CardContent className="space-y-4">
              {visibles.map((q) => (
                <ReponseAffichage key={q.id} question={q} payload={payload} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function ReponseAffichage({
  question,
  payload,
}: {
  question: Question;
  payload: Record<string, unknown>;
}) {
  const valeur = lireValeur(payload, question.champ_payload);
  const valeurFormatee = formaterValeur(question, valeur);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground font-mono text-xs">{question.id}</span>
        <p className="text-sm leading-snug">{question.libelle}</p>
      </div>
      <p className="text-sm font-medium">{valeurFormatee}</p>
    </div>
  );
}

function lireValeur(payload: Record<string, unknown>, chemin: string): unknown {
  const segs = chemin.split('.');
  let cursor: unknown = payload;
  for (const s of segs) {
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[s];
  }
  return cursor;
}

function formaterValeur(question: Question, valeur: unknown): React.ReactNode {
  if (valeur === undefined || valeur === null || valeur === '') {
    return <span className="text-muted-foreground italic">Non renseigné</span>;
  }
  if (question.type === 'oui_non') {
    return valeur === true ? 'Oui' : 'Non';
  }
  if ((question.type === 'choix_unique' || question.type === 'echelle') && question.options) {
    const opt = question.options.find((o) => o.valeur === valeur);
    return opt?.libelle ?? String(valeur);
  }
  if (typeof valeur === 'string' || typeof valeur === 'number') {
    return String(valeur);
  }
  return JSON.stringify(valeur);
}

/**
 * Reconstruit un payload imbriqué (a2.foo, b3.bar) à partir de la map
 * indicateur → donnees. Utilisé par le moteur ALLER À en lecture.
 */
function construirePayloadDepuisReponses(
  reponses: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [code, donnees] of Object.entries(reponses)) {
    const racine = code.toLowerCase(); // A2 → 'a2', C5 → 'c5'
    payload[racine] = donnees;

    // Effets/observations/témoignage sont stockés au niveau de A5/B4
    // mais référencés au niveau racine du payload par le questionnaire.
    if (donnees.effets_impacts !== undefined) payload.effets_impacts = donnees.effets_impacts;
    if (donnees.observations !== undefined) payload.observations_libres = donnees.observations;
    if (donnees.temoignage !== undefined) payload.temoignage = donnees.temoignage;
  }
  return payload;
}
