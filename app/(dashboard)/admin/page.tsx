import { redirect } from 'next/navigation';

/**
 * Page racine /admin — redirige vers /admin/utilisateurs (la seule page
 * admin V1). Évite le 404 au clic sur l'item « Administration » de la
 * sidebar.
 *
 * V1.5 / V2 : remplacer par un dashboard admin (audit, paramètres,
 * statistiques d'usage) avec onglets vers /admin/utilisateurs,
 * /admin/journaux/emails, etc.
 */
export default function AdminPage() {
  redirect('/admin/utilisateurs');
}
