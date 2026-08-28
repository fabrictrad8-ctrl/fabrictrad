import { expect, test, type Page } from '@playwright/test';

type PublicRoute = { path: string; label: string };
type ProtectedRoute = { path: string; destination: '/login' | '/admin-login' };

const publicRoutes: PublicRoute[] = [
  { path: '/', label: 'home' },
  { path: '/login', label: 'login' },
  { path: '/admin-login', label: 'admin login' },
  { path: '/register', label: 'register' },
  { path: '/buyer-registration', label: 'buyer registration' },
  { path: '/seller-registration', label: 'seller registration' },
  { path: '/how-to-use', label: 'how to use' },
  { path: '/help', label: 'help' },
  { path: '/privacy', label: 'privacy' },
  { path: '/terms', label: 'terms' },
];

const protectedRoutes: ProtectedRoute[] = [
  { path: '/marketplace', destination: '/login' },
  { path: '/categories', destination: '/login' },
  { path: '/vendors', destination: '/login' },
  { path: '/product-detail', destination: '/login' },
  { path: '/cart', destination: '/login' },
  { path: '/account', destination: '/login' },
  { path: '/profile', destination: '/login' },
  { path: '/buyer-dashboard', destination: '/login' },
  { path: '/buyer-requirements', destination: '/login' },
  { path: '/company-purchasing', destination: '/login' },
  { path: '/seller-dashboard', destination: '/login' },
  { path: '/catalogs-pricing', destination: '/login' },
  { path: '/seller-product-rules', destination: '/login' },
  { path: '/admin-portal', destination: '/admin-login' },
];

const ignoredConsolePatterns = [
  /Failed to load resource/i,
  /example\.supabase\.co/i,
  /ERR_NAME_NOT_RESOLVED/i,
  /net::ERR_/i,
  /favicon/i,
];

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

async function assertBasicVisualIntegrity(page: Page, route: string) {
  await expect(page.locator('body')).not.toContainText(
    /Application error|Internal Server Error|This page could not be found|NEXT_NOT_FOUND/i
  );
  await expect(page.locator('main').first()).toBeVisible();

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
  expect(duplicateIds, `Duplicate IDs on ${route}`).toEqual([]);

  expect(await page.locator('img:not([alt])').count(), `Images without alt text on ${route}`).toBe(0);

  const overflow = await page.evaluate(() => {
    const width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return Math.max(0, width - window.innerWidth);
  });
  expect(overflow, `Horizontal overflow on ${route}`).toBeLessThanOrEqual(2);

  await assertNoHeaderCollisions(page);
}

for (const route of publicRoutes) {
  test(`public visual: ${route.label}`, async ({ page }) => {
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

    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response, `No navigation response for ${route.path}`).not.toBeNull();
    expect(response?.status(), `Unexpected status for ${route.path}`).toBeLessThan(400);
    await page.waitForTimeout(250);

    await assertBasicVisualIntegrity(page, route.path);
    expect(pageErrors, `Page errors on ${route.path}`).toEqual([]);
    expect(consoleErrors, `Console errors on ${route.path}`).toEqual([]);
    expect(brokenImages, `Broken images on ${route.path}`).toEqual([]);
  });
}

for (const route of protectedRoutes) {
  test(`authorization boundary: ${route.path}`, async ({ page }) => {
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response).not.toBeNull();
    await expect(page).toHaveURL((url) => url.pathname === route.destination);
    await expect(page.locator('body')).not.toContainText(
      /Application error|Internal Server Error|This page could not be found|NEXT_NOT_FOUND/i
    );
  });
}

test('synthetic demo sessions are unavailable', async ({ request }) => {
  const getResponse = await request.get('/api/auth/demo-session');
  expect(getResponse.status()).toBe(404);

  const postResponse = await request.post('/api/auth/demo-session', { data: {} });
  expect(postResponse.status()).toBe(404);
});

test('reduced-motion preference is respected on the public login experience', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const duration = await page.locator('main').first().evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).animationDuration || '0')
  );
  expect(duration).toBeLessThanOrEqual(0.01);
});
