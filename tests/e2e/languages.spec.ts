import { expect, test, type Locator, type Page } from '@playwright/test';

// The language picker's reachability differs by page and viewport: some
// headers show it inline at all times, narrow public-facing pages tuck it
// behind a hamburger drawer, and pages with no embedded control at all fall
// back to the floating SitewideLanguageControl (collapsed to an icon on
// narrow viewports, expanded on tap). Resolve whichever is actually usable
// right now instead of assuming one fixed structure.
async function resolveLanguagePicker(page: Page): Promise<Locator> {
  const embedded = page.locator('[data-language-control="embedded"] select').first();
  if (await embedded.isVisible()) return embedded;

  const mobileMenuTrigger = page.locator('.ft-mobile-menu-trigger');
  if (await mobileMenuTrigger.isVisible()) {
    await mobileMenuTrigger.click();
    const drawerPicker = page.locator('.ft-mobile-commerce-menu [data-language-control="embedded"] select');
    if (await drawerPicker.isVisible()) return drawerPicker;
  }

  const fallbackTrigger = page.locator('[data-sitewide-language-control] button');
  if (await fallbackTrigger.isVisible()) {
    await fallbackTrigger.click();
    const fallbackPicker = page.locator('[data-sitewide-language-control] select');
    if (await fallbackPicker.isVisible()) return fallbackPicker;
  }

  return embedded;
}

test('all offered languages switch, survive navigation and stay readable', async ({ page }) => {
  await page.goto('/');

  const picker = await resolveLanguagePicker(page);
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

  const drawerRegisterLink = page.locator('.ft-mobile-commerce-menu a[href="/register"]');
  const registerLink = (await drawerRegisterLink.isVisible()) ? drawerRegisterLink : page.locator('header a[href="/register"]');
  await registerLink.click();
  await expect(page.locator('h1')).toContainText('नई शुरुआत');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.locator('h1')).toContainText('नई शुरुआत');

  const registerPicker = await resolveLanguagePicker(page);
  await registerPicker.selectOption('en');
  await page.locator('header a[href="/login"]').click();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
});
