import { expect, test, type Page } from '@playwright/test';

type Role = 'public' | 'buyer' | 'seller' | 'admin';
type MobileRoute = { role: Role; path: string; label: string };

const viewports = [
  { width: 320, height: 760, label: 'compact-android' },
  { width: 360, height: 800, label: 'android' },
  { width: 390, height: 844, label: 'iphone' },
  { width: 430, height: 932, label: 'large-phone' },
];

const routes: MobileRoute[] = [
  { role: 'public', path: '/', label: 'home' },
  { role: 'public', path: '/login', label: 'login' },
  { role: 'public', path: '/admin-login', label: 'admin-login' },
  { role: 'public', path: '/register', label: 'register' },
  { role: 'public', path: '/buyer-registration', label: 'buyer-registration' },
  { role: 'public', path: '/seller-registration', label: 'seller-registration' },
  { role: 'public', path: '/help', label: 'help' },
  { role: 'public', path: '/how-to-use', label: 'how-to-use' },
  { role: 'public', path: '/privacy', label: 'privacy' },
  { role: 'public', path: '/terms', label: 'terms' },

  { role: 'buyer', path: '/marketplace', label: 'marketplace' },
  { role: 'buyer', path: '/categories', label: 'categories' },
  { role: 'buyer', path: '/vendors', label: 'vendors' },
  { role: 'buyer', path: '/product-detail', label: 'product-detail' },
  { role: 'buyer', path: '/cart', label: 'cart' },
  { role: 'buyer', path: '/custom-order', label: 'custom-order' },
  { role: 'buyer', path: '/buyer-dashboard', label: 'buyer-dashboard' },
  { role: 'buyer', path: '/buyer-dashboard?tab=orders', label: 'buyer-orders' },
  { role: 'buyer', path: '/buyer-dashboard?tab=company', label: 'buyer-company' },
  { role: 'buyer', path: '/buyer-requirements', label: 'buyer-requirements' },
  { role: 'buyer', path: '/company-purchasing', label: 'company-purchasing' },
  { role: 'buyer', path: '/profile', label: 'profile' },
  { role: 'buyer', path: '/returns-exchanges', label: 'returns-exchanges' },

  { role: 'seller', path: '/seller-dashboard', label: 'seller-dashboard' },
  { role: 'seller', path: '/seller-dashboard?tab=upload', label: 'seller-add-product' },
  { role: 'seller', path: '/seller-dashboard?tab=inventory', label: 'seller-products' },
  { role: 'seller', path: '/seller-dashboard?tab=orders', label: 'seller-orders' },
  { role: 'seller', path: '/seller-dashboard?tab=inbox', label: 'seller-inbox' },
  { role: 'seller', path: '/seller-dashboard?tab=earnings', label: 'seller-earnings' },
  { role: 'seller', path: '/seller-dashboard?tab=profile', label: 'seller-profile' },
  { role: 'seller', path: '/catalogs-pricing', label: 'catalogs-pricing' },
  { role: 'seller', path: '/seller-product-rules', label: 'seller-product-rules' },

  { role: 'admin', path: '/admin-portal', label: 'admin-dashboard' },
  { role: 'admin', path: '/admin-portal?tab=sellers', label: 'admin-sellers' },
  { role: 'admin', path: '/admin-portal?tab=orders', label: 'admin-orders' },
  { role: 'admin', path: '/admin-portal?tab=payments', label: 'admin-payments' },
  { role: 'admin', path: '/admin-portal?tab=settings', label: 'admin-settings' },
];

async function setupNetworkStubs(page: Page) {
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
}

async function setRole(page: Page, role: Role) {
  if (role === 'public') {
    await page.context().clearCookies({ name: 'fabrictrad_demo_role' });
    return;
  }

  await page.context().addCookies([
    {
      name: 'fabrictrad_demo_role',
      value: role,
      url: 'http://localhost:3000',
      httpOnly: false,
      sameSite: 'Lax',
    },
  ]);
}

type MobileAudit = {
  documentOverflow: number;
  structural: string[];
  controls: string[];
  fixed: string[];
};

async function auditMobileGeometry(page: Page): Promise<MobileAudit> {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const tolerance = 2;

    const visible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || '1') > 0.01 &&
        rect.width > 1 &&
        rect.height > 1
      );
    };

    const scrollContained = (element: Element) => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        const overflowX = style.overflowX;
        if ((overflowX === 'auto' || overflowX === 'scroll') && parent.scrollWidth > parent.clientWidth + tolerance) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    const describe = (element: Element) => {
      const html = element as HTMLElement;
      const id = html.id ? `#${html.id}` : '';
      const classes = typeof html.className === 'string'
        ? `.${html.className.trim().split(/\s+/).slice(0, 3).join('.')}`
        : '';
      const text = (html.getAttribute('aria-label') || html.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48);
      return `${html.tagName.toLowerCase()}${id}${classes}${text ? ` (${text})` : ''}`;
    };

    const escapesViewport = (element: Element) => {
      if (!visible(element) || scrollContained(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.left < -tolerance || rect.right > viewportWidth + tolerance;
    };

    const structural: string[] = [];
    document
      .querySelectorAll('main, main > *, main section, main article, main form, main fieldset, [role="dialog"], header, footer')
      .forEach((element) => {
        if (escapesViewport(element)) structural.push(describe(element));
      });

    const controls: string[] = [];
    document.querySelectorAll('main input, main textarea, main select, main button, main a').forEach((element) => {
      if (escapesViewport(element)) controls.push(describe(element));
    });

    const fixed: string[] = [];
    document.querySelectorAll<HTMLElement>('body *').forEach((element) => {
      if (!visible(element)) return;
      const style = window.getComputedStyle(element);
      if (style.position !== 'fixed') return;
      const rect = element.getBoundingClientRect();
      if (rect.left < -tolerance || rect.right > viewportWidth + tolerance) fixed.push(describe(element));
    });

    const width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return {
      documentOverflow: Math.max(0, width - viewportWidth),
      structural: Array.from(new Set(structural)).slice(0, 20),
      controls: Array.from(new Set(controls)).slice(0, 20),
      fixed: Array.from(new Set(fixed)).slice(0, 20),
    };
  });
}

for (const viewport of viewports) {
  test(`site-wide mobile contract: ${viewport.width}px ${viewport.label}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Dedicated contract runs once using the mobile browser project.');
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setupNetworkStubs(page);

    const failures: string[] = [];
    let activeRole: Role | null = null;

    for (const routeCase of routes) {
      if (routeCase.role !== activeRole) {
        await setRole(page, routeCase.role);
        activeRole = routeCase.role;
      }

      const response = await page.goto(routeCase.path, { waitUntil: 'domcontentloaded' });
      if (!response || response.status() >= 400) {
        failures.push(`${routeCase.label}: navigation status ${response?.status() ?? 'none'}`);
        continue;
      }

      await page.waitForTimeout(250);
      const finalPath = new URL(page.url()).pathname;
      if (routeCase.role !== 'public' && finalPath === '/login') {
        failures.push(`${routeCase.label}: unexpectedly redirected to login`);
        continue;
      }

      const audit = await auditMobileGeometry(page);
      if (audit.documentOverflow > 2) failures.push(`${routeCase.label}: document overflow ${audit.documentOverflow}px`);
      if (audit.structural.length) failures.push(`${routeCase.label}: structural clipping -> ${audit.structural.join(' | ')}`);
      if (audit.controls.length) failures.push(`${routeCase.label}: clipped controls -> ${audit.controls.join(' | ')}`);
      if (audit.fixed.length) failures.push(`${routeCase.label}: fixed overlay outside viewport -> ${audit.fixed.join(' | ')}`);
    }

    expect(failures, `Mobile layout failures at ${viewport.width}px`).toEqual([]);
  });
}
