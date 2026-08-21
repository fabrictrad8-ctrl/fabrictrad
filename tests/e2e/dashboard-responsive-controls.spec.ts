import { expect, test, type Page } from '@playwright/test';

type CommerceRole = 'buyer' | 'seller';

async function prepareRole(page: Page, role: CommerceRole) {
  await page.route(/https:\/\/example\.supabase\.co\/.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
      headers: { 'access-control-allow-origin': '*' },
    });
  });

  const response = await page.request.post('http://127.0.0.1:3000/api/auth/demo-session', {
    data: {
      email: `demo.${role}@fabrictrad.com`,
      password: 'FabricDemo@2026',
    },
  });
  expect(response.ok()).toBeTruthy();
}

for (const role of ['buyer', 'seller'] as const) {
  test(`${role} dashboard navigation controls match the viewport`, async ({ page }) => {
    await prepareRole(page, role);
    await page.goto(`/${role}-dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    const labelRole = role === 'buyer' ? 'buyer' : 'seller';
    const trigger = page.getByRole('button', { name: `Open ${labelRole} navigation` });
    const mobileSearch = page.getByRole('link', { name: 'Search marketplace' });
    const viewportWidth = page.viewportSize()?.width ?? 1440;

    if (viewportWidth >= 768) {
      await expect(trigger).toBeHidden();
      await expect(mobileSearch).toBeHidden();
      await expect(page.getByRole('navigation', { name: `${role === 'buyer' ? 'Buyer' : 'Seller'} navigation` }).first()).toBeVisible();
      return;
    }

    await expect(trigger).toBeVisible();
    await expect(mobileSearch).toBeVisible();

    await trigger.click();
    const drawer = page.locator('aside.fixed').filter({
      has: page.getByRole('navigation', { name: `${role === 'buyer' ? 'Buyer' : 'Seller'} navigation` }),
    });
    await expect(drawer).toBeVisible();

    const closeButton = drawer.getByRole('button', { name: `Close ${labelRole} navigation` });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(drawer).toBeHidden();
  });
}
