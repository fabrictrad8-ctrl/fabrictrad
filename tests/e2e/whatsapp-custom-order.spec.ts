import { expect, test } from '@playwright/test';

test('public WhatsApp custom-order entry renders and points to the official number', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).not.toHaveText('');
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0);

  const whatsapp = page.getByRole('link', { name: /WhatsApp \+91 79772 86898/i });
  await expect(whatsapp).toBeVisible();
  await expect(whatsapp).toHaveAttribute('href', /https:\/\/wa\.me\/917977286898\?text=CATALOGUE/);
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
