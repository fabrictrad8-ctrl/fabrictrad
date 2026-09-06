import { expect, test } from '@playwright/test';

test('public buying routes keep WhatsApp reserved for sellers', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).not.toHaveText('');
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0);

  await expect(page.locator('a[href*="wa.me"], a[href*="api.whatsapp.com"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Custom order' }).first()).toHaveAttribute(
    'href',
    '/custom-order'
  );
  expect(pageErrors).toEqual([]);
});

test('custom-order studio preserves the destination through buyer sign-in', async ({ page }) => {
  await page.goto('/custom-order', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/login\?role=buyer&next=%2Fcustom-order/);
  await expect(page.getByRole('heading', { name: /Welcome back|Sign in/i })).toBeVisible();
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0);
});
