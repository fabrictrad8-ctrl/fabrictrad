import { expect, test, type Page } from '@playwright/test';

type Role = 'public' | 'buyer' | 'seller' | 'admin';
type RouteCase = { role: Role; path: string; label: string; capture?: boolean };

const buyerTabs = [
  'overview',
  'orders',
  'tracking',
  'wishlist',
  'company',
  'disputes',
  'requirements',
  'notifications',
  'account',
];

const sellerTabs = [
  'overview',
  'upload',
  'inventory',
  'variants',
  'catalogs',
  'orders',
  'requests',
  'inbox',
  'fulfillment',
  'courier',
  'earnings',
  'analytics',
  'categories',
  'billing',
  'disputes',
  'notifications',
  'profile',
];

const adminTabs = [
  'dashboard',
  'activity',
  'sellers',
  'listings',
  'orders',
  'payments',
  'reconciliation',
  'top-sellers',
  'seller-metrics',
  'fulfillment',
  'discounts',
  'errors',
  'settings',
];

const routes: RouteCase[] = [
  { role: 'public', path: '/', label: 'home', capture: true },
  { role: 'public', path: '/login', label: 'login', capture: true },
  { role: 'public', path: '/admin-login', label: 'admin login', capture: true },
  { role: 'public', path: '/register', label: 'register' },
  { role: 'public', path: '/buyer-registration', label: 'buyer registration' },
  { role: 'public', path: '/seller-registration', label: 'seller registration' },
  { role: 'public', path: '/auth/reset-password', label: 'password reset' },
  { role: 'public', path: '/auth/setup', label: 'account setup' },
  { role: 'public', path: '/help', label: 'help' },
  { role: 'public', path: '/privacy', label: 'privacy' },
  { role: 'public', path: '/terms', label: 'terms' },

  { role: 'buyer', path: '/marketplace', label: 'buyer marketplace', capture: true },
  { role: 'buyer', path: '/categories', label: 'buyer categories', capture: true },
  { role: 'buyer', path: '/vendors', label: 'buyer vendors', capture: true },
  { role: 'buyer', path: '/product-detail', label: 'product detail', capture: true },
  { role: 'buyer', path: '/cart', label: 'buyer cart', capture: true },
  { role: 'buyer', path: '/account', label: 'buyer account' },
  { role: 'buyer', path: '/auth/phone?role=buyer&returnTo=/buyer-dashboard', label: 'optional phone collection' },
  { role: 'buyer', path: '/buyer-requirements', label: 'requirements board' },
  { role: 'buyer', path: '/profile', label: 'buyer profile' },
  { role: 'buyer', path: '/company-purchasing', label: 'company purchasing', capture: true },
  { role: 'buyer', path: '/marketplace?category=cotton', label: 'legacy category link' },
  { role: 'buyer', path: '/marketplace?seller=v1', label: 'legacy vendor link' },
  ...buyerTabs.map<RouteCase>((tab) => ({
    role: 'buyer',
    path: tab === 'overview' ? '/buyer-dashboard' : `/buyer-dashboard?tab=${tab}`,
    label: `buyer dashboard ${tab}`,
    capture: tab === 'overview' || tab === 'company',
  })),

  { role: 'seller', path: '/marketplace', label: 'seller marketplace' },
  { role: 'seller', path: '/categories', label: 'seller categories' },
  { role: 'seller', path: '/vendors', label: 'seller vendors' },
  { role: 'seller', path: '/profile', label: 'seller profile' },
  { role: 'seller', path: '/catalogs-pricing', label: 'catalog pricing page' },
  { role: 'seller', path: '/seller-product-rules', label: 'seller product rules', capture: true },
  ...sellerTabs.map<RouteCase>((tab) => ({
    role: 'seller',
    path: tab === 'overview' ? '/seller-dashboard' : `/seller-dashboard?tab=${tab}`,
    label: `seller dashboard ${tab}`,
    capture: ['overview', 'upload', 'inventory', 'orders'].includes(tab),
  })),

  ...adminTabs.map<RouteCase>((tab) => ({
    role: 'admin',
    path: tab === 'dashboard' ? '/admin-portal' : `/admin-portal?tab=${tab}`,
    label: `admin ${tab}`,
    capture: ['dashboard', 'sellers', 'orders', 'top-sellers', 'seller-metrics'].includes(tab),
  })),
];

const ignoredConsolePatterns = [
  /Failed to load resource/i,
  /example\.supabase\.co/i,
  /ERR_NAME_NOT_RESOLVED/i,
  /net::ERR_/i,
  /favicon/i,
];

async function prepareRole(page: Page, role: Role) {
  await page.route('**/api/admin/seller-metrics*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        range: { from: null, to: null },
        sellers: [],
        summary: { sellers: 0, activeSellers: 0, orders: 0, gmv: 0, commission: 0 },
      }),
    });
  });

  await page.route(/https:\/\/example\.supabase\.co\/.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
      headers: { 'access-control-allow-origin': '*' },
    });
  });

  if (role !== 'public') {
    await page.context().addCookies([
      {
        name: 'fabrictrad_demo_role',
        value: role,
        url: 'http://127.0.0.1:3000',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  }
}

async function assertNoHeaderCollisions(page: Page) {
  const collisions = await page.evaluate(() => {
    const visible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || '1') > 0.01 &&
        rect.width > 2 &&
        rect.height > 2 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight
      );
    };

    const result: string[] = [];
    document.querySelectorAll('header').forEach((header, headerIndex) => {
      if (!visible(header)) return;
      const children = Array.from(header.children).filter((child) => {
        const style = window.getComputedStyle(child);
        return visible(child) && style.position !== 'absolute' && style.position !== 'fixed';
      });

      for (let first = 0; first < children.length; first += 1) {
        for (let second = first + 1; second < children.length; second += 1) {
          const a = children[first].getBoundingClientRect();
          const b = children[second].getBoundingClientRect();
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapX > 3 && overlapY > 3) {
            result.push(`header ${headerIndex}: child ${first} overlaps child ${second}`);
          }
        }
      }
    });
    return result;
  });

  expect(collisions).toEqual([]);
}

async function assertUsableTargets(page: Page) {
  const undersized = await page.evaluate(() => {
    const selectors = [
      'header button',
      'header a',
      '.ft-mobile-dock button',
      '.sidebar-nav-item',
      '.ft-sidebar-item',
      '.ft-primary-action',
      '.btn-primary',
    ];
    const failures: string[] = [];
    document.querySelectorAll<HTMLElement>(selectors.join(',')).forEach((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const hidden =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        Number(style.opacity || '1') <= 0.01 ||
        rect.width === 0 ||
        rect.height === 0 ||
        rect.right <= 0 ||
        rect.bottom <= 0 ||
        rect.left >= window.innerWidth ||
        rect.top >= window.innerHeight;
      if (hidden) return;
      if (rect.width < 24 || rect.height < 24) {
        failures.push(`${element.tagName.toLowerCase()} ${element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 32) || element.className}: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    });
    return failures;
  });

  expect(undersized).toEqual([]);
}

for (const routeCase of routes) {
  test(`${routeCase.role}: ${routeCase.label}`, async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const brokenImages: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (!ignoredConsolePatterns.some((pattern) => pattern.test(text))) consoleErrors.push(text);
    });
    page.on('response', (response) => {
      if (response.request().resourceType() !== 'image' || response.status() < 400) return;
      brokenImages.push(`${response.status()} ${response.url()}`);
    });

    await prepareRole(page, routeCase.role);
    const response = await page.goto(routeCase.path, { waitUntil: 'domcontentloaded' });
    expect(response, `No navigation response for ${routeCase.path}`).not.toBeNull();
    expect(response?.status(), `Unexpected status for ${routeCase.path}`).toBeLessThan(400);

    await page.waitForTimeout(500);

    const finalPath = new URL(page.url()).pathname;
    if (routeCase.role !== 'public') {
      expect(finalPath, `${routeCase.role} route redirected to login`).not.toBe('/login');
    }

    await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error|This page could not be found|NEXT_NOT_FOUND/i);
    await expect(page.locator('main').first()).toBeVisible();
    await expect(page.locator('.ft-skip-link')).toHaveCount(1);
    await expect(page.locator('main#main-content').first()).toHaveCount(1);

    const duplicateIds = await page.evaluate(() => {
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      document.querySelectorAll<HTMLElement>('[id]').forEach((element) => {
        if (!element.id) return;
        if (seen.has(element.id)) duplicates.add(element.id);
        seen.add(element.id);
      });
      return Array.from(duplicates);
    });
    expect(duplicateIds).toEqual([]);

    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt, `Images without alt text on ${routeCase.path}`).toBe(0);

    const overflow = await page.evaluate(() => {
      const width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      return Math.max(0, width - window.innerWidth);
    });
    expect(overflow, `Horizontal overflow on ${routeCase.path}`).toBeLessThanOrEqual(2);

    await assertNoHeaderCollisions(page);
    await assertUsableTargets(page);

    expect(pageErrors, `Page errors on ${routeCase.path}`).toEqual([]);
    expect(consoleErrors, `Console errors on ${routeCase.path}`).toEqual([]);
    expect(brokenImages, `Broken images on ${routeCase.path}`).toEqual([]);

    if (routeCase.capture) {
      const safeName = `${routeCase.role}-${routeCase.label}-${testInfo.project.name}`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
      await page.screenshot({ path: testInfo.outputPath(`${safeName}.png`), fullPage: true });
    }
  });
}

test('reduced-motion preference disables non-essential route animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepareRole(page, 'buyer');
  await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
  const duration = await page.locator('main').first().evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).animationDuration || '0')
  );
  expect(duration).toBeLessThanOrEqual(0.01);
});
