import { Users, GraduationCap, ClipboardList, Phone } from 'lucide-react';
import { KpiCard } from './kpi-card';
import type { KpiEditeurProjet } from '@/lib/kpis/types';

export function DashboardEditeurProjet({ data }: { data: KpiEditeurProjet }) {
  const a2 = data.taux_achevement;
  const contacts = data.contacts_valides;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        titre="Bénéficiaires de mes projets"
        valeur={data.beneficiaires_projets}
        sousTexte={`Périmètre : ${data.projets_geres.length} projet(s) géré(s)`}
        icone={Users}
        href="/beneficiaires"
      />
      <KpiCard
        titre="Taux d'achèvement (A2)"
        valeur={`${a2.valeur}\u00a0%`}
        sousTexte={
          a2.proxy
            ? 'Approximation via statut « formation achevée » — enquête A2 à venir'
            : `${a2.numerateur ?? 0} / ${a2.denominateur ?? 0}`
        }
        icone={GraduationCap}
        href="/beneficiaires?statut=FORMATION_ACHEVEE"
      />
      <KpiCard
        titre="Cohortes à enquêter"
        valeur={data.cohortes_a_enqueter}
        sousTexte="Bénéficiaires formés il y a 6 à 12 mois sans réponse A5"
        icone={ClipboardList}
        href="/enquetes/a5"
        alerte={data.cohortes_a_enqueter > 0}
        badgeTexte="À lancer"
      />
      <KpiCard
        titre="Contacts valides"
        valeur={`${contacts.valeur}\u00a0%`}
        sousTexte={`${contacts.numerateur ?? 0} bénéficiaires joignables sur ${contacts.denominateur ?? 0} consentis`}
        icone={Phone}
        href="/beneficiaires?filtre=sans_contact"
        alerte={contacts.alerte}
      />
    </div>
  );
}
