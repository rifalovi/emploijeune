import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LigneAudit } from '@/lib/utilisateurs/queries-detail';

export type AuditUtilisateurCardProps = {
  lignes: LigneAudit[];
};

const ACTION_LIBELLES: Record<string, string> = {
  INSERT: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  SOFT_DELETE: 'Soft-delete',
  RESTORE: 'Restauration',
};

const ACTION_COULEURS: Record<string, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  INSERT: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
  SOFT_DELETE: 'destructive',
  RESTORE: 'outline',
};

/**
 * Card audit (Étape 8 enrichie) — affichage en lecture seule des
 * 10 dernières actions sur l'utilisateur, lues depuis `journaux_audit`
 * (alimenté par le trigger `trg_utilisateurs_audit`).
 */
export function AuditUtilisateurCard({ lignes }: AuditUtilisateurCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">5. Historique d’audit</CardTitle>
        <CardDescription>
          {lignes.length === 0
            ? 'Aucune action enregistrée pour ce compte.'
            : `${lignes.length} action(s) récente(s) sur ce compte (max 10).`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lignes.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">
            Le journal d’audit est alimenté automatiquement par les triggers BDD.
          </p>
        ) : (
          <ol className="space-y-3">
            {lignes.map((l) => (
              <li key={l.id} className="border-muted border-l-2 pl-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={ACTION_COULEURS[l.action] ?? 'outline'}>
                    {ACTION_LIBELLES[l.action] ?? l.action}
                  </Badge>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {format(new Date(l.horodatage), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                  </span>
                </div>
                {l.user_email && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    par <code className="font-mono">{l.user_email}</code>
                  </p>
                )}
                {l.diff && Object.keys(l.diff).length > 0 && (
                  <details className="mt-1">
                    <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
                      Voir le détail
                    </summary>
                    <pre className="bg-muted mt-1 max-h-40 overflow-auto rounded p-2 text-xs">
                      {JSON.stringify(l.diff, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
