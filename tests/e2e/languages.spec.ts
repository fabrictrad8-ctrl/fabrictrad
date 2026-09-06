import { expect, test } from '@playwright/test';

test('all offered languages switch, survive navigation and stay readable', async ({ page }) => {
  await page.goto('/');
  const picker = page.locator('[data-language-control="embedded"] select').first();
  await expect(picker).toBeVisible();
  const codes = await picker.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  expect(codes).toEqual(['en', 'hi', 'bn', 'gu', 'kn', 'ml', 'mr', 'pa', 'ta', 'te']);
  for (const code of codes) {
    await picker.selectOption(code);
    await expect(page.locator('html')).toHaveAttribute('lang', code);
    await expect(page.locator('h1')).not.toBeEmpty();
    if (code !== 'en') await expect(page.locator('h1')).not.toContainText('Textile trade');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
  await picker.selectOption('hi');
  await page.locator('header a[href="/register"]').click();
  await expect(page.locator('h1')).toContainText('नई शुरुआत');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.locator('h1')).toContainText('नई शुरुआत');
  await page.locator('[data-language-control="embedded"] select').selectOption('en');
  await page.locator('header a[href="/login"]').click();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
});
