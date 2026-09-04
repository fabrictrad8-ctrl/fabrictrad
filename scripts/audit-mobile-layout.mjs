import { chromium } from '@playwright/test';

const baseURL = process.env.MOBILE_AUDIT_BASE_URL || 'http://127.0.0.1:3000';

const routes = [
  '/',
  '/login',
  '/register',
  '/marketplace',
  '/categories',
  '/vendors',
  '/product-detail',
  '/buyer-dashboard',
  '/buyer-requirements',
  '/company-purchasing',
  '/cart',
  '/custom-order',
  '/seller-dashboard',
  '/seller-dashboard?tab=inventory',
  '/seller-dashboard?tab=orders',
  '/seller-dashboard?tab=notifications',
  '/catalogs-pricing',
  '/seller-registration',
  '/profile',
  '/admin-login',
  '/admin-portal',
  '/help',
  '/privacy',
  '/terms',
];

const viewports = [
  { name: 'small-phone', width: 360, height: 800 },
  { name: 'iphone-like', width: 390, height: 844 },
  { name: 'large-phone', width: 430, height: 932 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
];

const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    for (const route of routes) {
      const url = new URL(route, baseURL).toString();
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      if (!response || response.status() >= 500) {
        failures.push(`${viewport.name} ${route}: HTTP ${response?.status() ?? 'no response'}`);
        continue;
      }

      await page.waitForTimeout(250);

      const audit = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const viewportWidth = window.innerWidth;
        const scrollWidth = Math.max(root.scrollWidth, body?.scrollWidth || 0);
        const overflow = scrollWidth - viewportWidth;

        const visible = (element) => {
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        const wideElements = Array.from(document.querySelectorAll('body *'))
          .filter((element) => visible(element))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(),
              className: typeof element.className === 'string' ? element.className.slice(0, 160) : '',
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              overflowX: window.getComputedStyle(element).overflowX,
            };
          })
          .filter((item) => item.right > viewportWidth + 3 && item.left < viewportWidth && item.overflowX !== 'auto' && item.overflowX !== 'scroll')
          .slice(0, 8);

        const tooSmallFormControls = viewportWidth <= 767
          ? Array.from(document.querySelectorAll('input, select, textarea'))
              .filter((element) => visible(element))
              .filter((element) => Number.parseFloat(window.getComputedStyle(element).fontSize) < 16)
              .slice(0, 6)
              .map((element) => ({
                tag: element.tagName.toLowerCase(),
                type: element.getAttribute('type') || '',
                className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
              }))
          : [];

        return { overflow, scrollWidth, viewportWidth, wideElements, tooSmallFormControls };
      });

      if (audit.overflow > 3) {
        failures.push(
          `${viewport.name} ${route}: horizontal overflow ${audit.scrollWidth}px > ${audit.viewportWidth}px; ` +
          `offenders=${JSON.stringify(audit.wideElements)}`
        );
      }

      if (audit.tooSmallFormControls.length) {
        failures.push(
          `${viewport.name} ${route}: form controls below 16px font-size; ` +
          `controls=${JSON.stringify(audit.tooSmallFormControls)}`
        );
      }

      console.log(`✓ ${viewport.name.padEnd(15)} ${route}`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('\nMobile layout audit failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nMobile layout audit passed across all configured routes and viewports.');
