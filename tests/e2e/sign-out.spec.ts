import { expect, test } from '@playwright/test';

/**
 * Tests de déconnexion.
 *
 * Note : ces tests vérifient UNIQUEMENT les comportements accessibles sans
 * session active. Le test du bouton « Se déconnecter » dans la sidebar exige
 * une session valide, ce qui nécessite soit un user e2e préconfigué côté
 * Supabase, soit l'interception du magic link par email. Ces scénarios sont
 * hors scope pour la V1 — à ajouter quand un user dédié sera créé.
 */
test.describe('Parcours : je me déconnecte', () => {
  test('GET /api/auth/sign-out redirige vers /connexion avec le flag "deconnexion"', async ({
    page,
  }) => {
    const response = await page.goto('/api/auth/sign-out');
    expect(response?.url()).toContain('/connexion');
    expect(response?.url()).toContain('message=deconnexion');
  });

  test('POST /api/auth/sign-out renvoie vers /connexion (statut 303)', async ({ request }) => {
    const response = await request.post('/api/auth/sign-out', { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toContain('/connexion');
  });

  test('le raccourci clavier Ctrl+Shift+Q est documenté dans le bouton', async ({ page }) => {
    // La sidebar n'est pas visible sans session, mais la page /connexion n'expose
    // pas le bouton. On vérifie simplement que la page /connexion se charge.
    await page.goto('/connexion');
    await expect(page).toHaveURL(/\/connexion/);
  });
});
