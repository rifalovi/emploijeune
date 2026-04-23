import { UserCheck, ShieldCheck, AlertTriangle, Upload } from 'lucide-react';
import { KpiCard } from './kpi-card';
import type { KpiAdminScs } from '@/lib/kpis/types';

export function DashboardAdminScs({ data }: { data: KpiAdminScs }) {
  const rgpd = data.taux_rgpd;
  const imports = data.imports_recents;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        titre="Comptes à valider"
        valeur={data.comptes_en_attente}
        sousTexte={
          data.comptes_en_attente === 0
            ? 'Aucun compte en attente'
            : `${data.comptes_en_attente} utilisateur(s) ayant demandé l'accès`
        }
        icone={UserCheck}
        href="/admin/utilisateurs?statut=en_attente"
        alerte={data.comptes_en_attente > 0}
        badgeTexte="À valider"
      />
      <KpiCard
        titre="Complétude RGPD"
        valeur={`${rgpd.valeur}\u00a0%`}
        sousTexte={`${rgpd.numerateur ?? 0} bénéficiaires avec consentement sur ${rgpd.denominateur ?? 0}`}
        icone={ShieldCheck}
        href="/beneficiaires?filtre=sans_consentement"
        alerte={rgpd.alerte}
      />
      <KpiCard
        titre="Alertes qualité"
        valeur={data.alertes_qualite}
        sousTexte="Incohérences à corriger (consentement sans date, dates manquantes, etc.)"
        icone={AlertTriangle}
        href="/admin/alertes-qualite"
        alerte={data.alertes_qualite > 0}
      />
      <KpiCard
        titre="Imports récents (7 j)"
        valeur={imports.total}
        sousTexte={
          imports.avec_erreurs > 0
            ? `${imports.avec_erreurs} import(s) avec erreurs à examiner`
            : 'Aucune erreur sur les imports récents'
        }
        icone={Upload}
        href="/imports?periode=7j"
        alerte={imports.alerte}
        badgeTexte="Erreurs"
      />
    </div>
  );
}
