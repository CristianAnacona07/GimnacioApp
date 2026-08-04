import { test, expect, Page } from '@playwright/test';

/**
 * Smoke E2E specs covering the critical user journeys.
 *
 * These use resilient, semantic selectors (getByRole / getByText / getByLabel)
 * so they survive CSS/markup refactors. They assume a dev server running at the
 * configured baseURL (http://localhost:4200).
 *
 * App routing facts these specs rely on (see src/app/app.routes.ts + guards/auth.ts):
 *  - '/'            -> redirects to '/gimnasios' (the gym selector)
 *  - '/login'       -> login page (guarded by noAuthGuard)
 *  - '/admin'       -> requires a selected gym AND a valid token. The authGuard
 *                      redirects to '/gimnasios' when NO gym is selected, and to
 *                      '/login' when a gym IS selected but there is no token.
 */

/**
 * Seed a selected gym in localStorage so that guarded routes redirect to /login
 * (missing token) rather than to /gimnasios (missing gym selection).
 */
async function seedSelectedGym(page: Page) {
  // Navigate to an in-origin page first so localStorage is writable for this origin.
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem(
      'gymActual',
      JSON.stringify({
        _id: 'e2e-gym',
        nombre: 'E2E Gym',
        slogan: 'Testing gym',
        colores: { primario: '#f97316' },
      }),
    );
  });
}

test.describe('Home / gym selector', () => {
  test('root redirects to the gym selector and it loads', async ({ page }) => {
    await page.goto('/');

    // '' redirects to '/gimnasios'.
    await expect(page).toHaveURL(/\/gimnasios$/);

    // Brand + search box for finding a gym should render.
    await expect(page.getByRole('heading', { name: 'GymApp' })).toBeVisible();
    await expect(page.getByPlaceholder(/Busc.* tu gimnasio/i)).toBeVisible();
  });

  test('gym search box is interactive', async ({ page }) => {
    await page.goto('/gimnasios');

    const search = page.getByPlaceholder(/Busc.* tu gimnasio/i);
    await expect(search).toBeVisible();
    await search.fill('powerhouse');
    await expect(search).toHaveValue('powerhouse');
  });
});

test.describe('Login page', () => {
  test('renders the login form with email, password and submit', async ({ page }) => {
    await page.goto('/login');

    // Email + password fields (labelled via <label for=...>).
    await expect(page.getByLabel(/Correo electr/i)).toBeVisible();
    await expect(page.getByLabel(/Contrase/i)).toBeVisible();

    // Primary submit action.
    await expect(page.getByRole('button', { name: /Iniciar Sesi/i })).toBeVisible();

    // Auxiliary links.
    await expect(page.getByRole('link', { name: /Reg.strate/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Olvidaste tu contrase/i })).toBeVisible();
  });

  test('accepts input in the email and password fields', async ({ page }) => {
    await page.goto('/login');

    const email = page.getByLabel(/Correo electr/i);
    const password = page.getByLabel(/Contrase/i);

    await email.fill('socio@example.com');
    await password.fill('supersecret');

    await expect(email).toHaveValue('socio@example.com');
    await expect(password).toHaveValue('supersecret');
  });

  test('does not authenticate with empty credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /Iniciar Sesi/i }).click();

    // Submitting empty credentials must NOT navigate into a protected area.
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: /Iniciar Sesi/i })).toBeVisible();
  });
});

test.describe('Route protection', () => {
  test('unauthenticated visit to /admin redirects away from admin', async ({ page }) => {
    // With a gym selected but no token, the authGuard sends the user to /login.
    await seedSelectedGym(page);

    await page.goto('/admin');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: /Iniciar Sesi/i })).toBeVisible();
  });

  test('unauthenticated /admin with no gym selected redirects to gym selector', async ({
    page,
  }) => {
    // Fresh context: no gym, no token -> guard redirects to /gimnasios.
    await page.goto('/gimnasios');
    await page.evaluate(() => localStorage.clear());

    await page.goto('/admin');

    await expect(page).toHaveURL(/\/gimnasios$/);
    await expect(page.getByRole('heading', { name: 'GymApp' })).toBeVisible();
  });
});
