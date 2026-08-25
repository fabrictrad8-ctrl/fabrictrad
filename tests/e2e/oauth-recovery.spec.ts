import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const response = await page.request.post('/api/auth/demo-session', {
    data: {
      email: 'demo.buyer@fabrictrad.com',
      password: 'FabricDemo@2026',
    },
  });
  expect(response.ok()).toBeTruthy();
});

test('account recovery preserves the session and continues to the marketplace', async ({ page }) => {
  await page.route('**/api/auth/provision-account', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ready: true,
        role: 'buyer',
        requestedRole: 'buyer',
        canBuy: true,
        canSell: false,
        phonePresent: true,
      }),
    });
  });

  await page.goto('/auth/setup?role=buyer&reason=profile_setup', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Finishing your secure sign-in/i })).toBeVisible();
  await expect(page.getByText('Session preserved')).toBeVisible();
  await page.waitForURL('**/marketplace');
  await expect(page).not.toHaveURL(/\/login/);
});

test('account recovery exposes an accessible retry without logging out', async ({ page }) => {
  await page.route('**/api/auth/provision-account', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'profile_setup_failed',
        error: 'Your workspace could not be prepared yet.',
      }),
    });
  });

  await page.goto('/auth/setup?role=buyer&reason=profile_setup', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main [role="alert"]').filter({ hasText: 'automatic repair' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Retry account setup/i })).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);
});
