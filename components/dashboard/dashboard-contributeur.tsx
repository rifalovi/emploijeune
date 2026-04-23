import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Users, Upload, CheckCircle2, ClipboardEdit } from 'lucide-react';
import { KpiCard } from './kpi-card';
import type { KpiContributeur } from '@/lib/kpis/types';

function statutLibelle(s: string): string {
  switch (s) {
    case 'succes':
      return 'Succès';
    case 'echec_partiel':
      return 'Succès partiel';
    case 'echec_total':
      return 'Échec';
    case 'en_cours':
      return 'En cours';
    case 'annule':
      return 'Annulé';
    default:
      return s;
  }
}

export function DashboardContributeur({ data }: { data: KpiContributeur }) {
  const dernier = data.dernier_import;
  const completude = data.completude;

  let sousTexteImport = 'Aucun import déposé pour le moment';
  let alerteImport = false;
  if (dernier) {
    const date = format(new Date(dernier.demarre_a), "d MMM yyyy 'à' HH:mm", { locale: fr });
    sousTexteImport = `${dernier.fichier_nom} — ${statutLibelle(dernier.statut)} (${date})`;
    alerteImport =
      dernier.nb_erreurs > 0 ||
      dernier.statut === 'echec_partiel' ||
      dernier.statut === 'echec_total';
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        titre="Bénéficiaires que j'ai saisis"
        valeur={data.beneficiaires_saisis}
        sousTexte="Total de mes contributions (A1)"
        icone={Users}
        href="/beneficiaires?mien=true"
      />
      <KpiCard
        titre="Mon dernier import"
        valeur={dernier ? `${dernier.nb_lignes_a1 + dernier.nb_lignes_b1}` : '—'}
        sousTexte={sousTexteImport}
        icone={Upload}
        href={dernier ? `/imports/${dernier.id}` : '/imports'}
        alerte={alerteImport}
        badgeTexte="Erreurs"
      />
      <KpiCard
        titre="Ma complétude"
        valeur={`${completude.valeur}\u00a0%`}
        sousTexte={`${completude.numerateur ?? 0} lignes complètes sur ${completude.denominateur ?? 0}`}
        icone={CheckCircle2}
        href="/beneficiaires?mien=true&completude=incomplete"
        alerte={completude.alerte}
      />
      <KpiCard
        titre="Formulaires à remplir"
        valeur={data.formulaires_a_remplir}
        sousTexte="Enquêtes en attente pour mes bénéficiaires"
        icone={ClipboardEdit}
        href="/enquetes?a_remplir=true"
        alerte={data.formulaires_a_remplir > 0}
        badgeTexte="À faire"
      />
    </div>
  );
}
