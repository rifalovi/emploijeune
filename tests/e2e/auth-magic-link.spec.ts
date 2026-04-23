import { expect, test } from '@playwright/test';

test.describe('Parcours : je demande un magic link', () => {
  test('la page /connexion affiche le formulaire en français', async ({ page }) => {
    await page.goto('/connexion');

    await expect(page.getByRole('heading', { name: /plateforme emploi jeunes/i })).toBeVisible();
    await expect(page.getByLabel(/adresse courriel/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /recevoir mon lien de connexion/i }),
    ).toBeVisible();
  });

  test('soumission avec un email invalide → message d’erreur', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel(/adresse courriel/i).fill('pas-un-email');
    await page.getByRole('button', { name: /recevoir mon lien/i }).click();
    await expect(page.getByText(/adresse courriel invalide/i)).toBeVisible();
  });

  test('soumission avec un email valide → écran de confirmation', async ({ page }) => {
    await page.goto('/connexion');
    const email = `e2e-test-${Date.now()}@example.com`;
    await page.getByLabel(/adresse courriel/i).fill(email);
    await page.getByRole('button', { name: /recevoir mon lien/i }).click();

    await expect(page.getByRole('heading', { name: /lien envoyé/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText(/1 heure/i)).toBeVisible();
  });

  test('la racine / redirige vers /connexion quand pas de session', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.url()).toContain('/connexion');
  });

  test('une route protégée (/dashboard) renvoie vers /connexion', async ({ page }) => {
    const response = await page.goto('/dashboard');
    expect(response?.url()).toContain('/connexion');
  });
});
