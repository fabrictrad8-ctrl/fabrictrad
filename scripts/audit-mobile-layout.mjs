import { chromium, webkit } from '@playwright/test';

const baseURL = process.env.MOBILE_AUDIT_BASE_URL || 'http://127.0.0.1:3000';

const routes = [
  '/',
  '/login',
  '/register',
  '/account',
  '/auth/phone',
  '/auth/reset-password',
  '/auth/setup',
  '/marketplace',
  '/categories',
  '/vendors',
  '/product-detail',
  '/buyer-dashboard',
  '/buyer-registration',
  '/buyer-requirements',
  '/buyer-agreement',
  '/company-purchasing',
  '/cart',
  '/custom-order',
  '/seller-dashboard',
  '/seller-dashboard?tab=inventory',
  '/seller-dashboard?tab=orders',
  '/seller-dashboard?tab=notifications',
  '/catalogs-pricing',
  '/seller-registration',
  '/seller-product-rules',
  '/seller-agreement',
  '/profile',
  '/admin-login',
  '/admin-portal',
  '/help',
  '/how-to-use',
  '/how-to-use/start',
  '/privacy',
  '/terms',
  '/returns-exchanges',
];

const androidUA = (model) =>
  `Mozilla/5.0 (Linux; Android 14; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36`;
const iphoneUA = (ios = '18_0') =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS ${ios} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1`;

const devices = [
  // Samsung / Android phone classes.
  { name: 'galaxy-s23', engine: 'chromium', width: 360, height: 780, dpr: 3, userAgent: androidUA('SM-S911B') },
  { name: 'galaxy-s23-ultra', engine: 'chromium', width: 412, height: 915, dpr: 3.5, userAgent: androidUA('SM-S918B') },
  { name: 'galaxy-a54', engine: 'chromium', width: 412, height: 915, dpr: 2.625, userAgent: androidUA('SM-A546B') },
  { name: 'pixel-8', engine: 'chromium', width: 412, height: 915, dpr: 2.625, userAgent: androidUA('Pixel 8') },
  { name: 'compact-android', engine: 'chromium', width: 360, height: 800, dpr: 3, userAgent: androidUA('Android') },
  { name: 'galaxy-z-fold-cover', engine: 'chromium', width: 344, height: 882, dpr: 2.625, userAgent: androidUA('SM-F946B') },
  { name: 'galaxy-s23-landscape', engine: 'chromium', width: 780, height: 360, dpr: 3, userAgent: androidUA('SM-S911B') },

  // iPhone classes run with WebKit so layout is exercised against Safari's engine.
  { name: 'iphone-se', engine: 'webkit', width: 375, height: 667, dpr: 2, userAgent: iphoneUA('18_0') },
  { name: 'iphone-13-14', engine: 'webkit', width: 390, height: 844, dpr: 3, userAgent: iphoneUA('18_0') },
  { name: 'iphone-15', engine: 'webkit', width: 393, height: 852, dpr: 3, userAgent: iphoneUA('18_0') },
  { name: 'iphone-15-pro-max', engine: 'webkit', width: 430, height: 932, dpr: 3, userAgent: iphoneUA('18_0') },
  { name: 'iphone-15-landscape', engine: 'webkit', width: 852, height: 393, dpr: 3, userAgent: iphoneUA('18_0') },
];

const browserTypes = { chromium, webkit };
const browsers = new Map();
const failures = [];

const getBrowser = async (engine) => {
  if (!browsers.has(engine)) browsers.set(engine, await browserTypes[engine].launch({ headless: true }));
  return browsers.get(engine);
};

try {
  for (const device of devices) {
    const browser = await getBrowser(device.engine);
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      screen: { width: device.width, height: device.height },
      deviceScaleFactor: device.dpr,
      isMobile: true,
      hasTouch: true,
      userAgent: device.userAgent,
    });
    const page = await context.newPage();

    for (const route of routes) {
      const url = new URL(route, baseURL).toString();
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      if (!response || response.status() >= 500) {
        failures.push(`${device.name} ${route}: HTTP ${response?.status() ?? 'no response'}`);
        continue;
      }

      await page.waitForTimeout(220);

      const audit = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollWidth = Math.max(root.scrollWidth, body?.scrollWidth || 0);
        const overflow = scrollWidth - viewportWidth;
        const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';

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

        const escapedFixedControls = Array.from(document.querySelectorAll('body *'))
          .filter((element) => visible(element))
          .filter((element) => ['fixed', 'sticky'].includes(window.getComputedStyle(element).position))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(),
              className: typeof element.className === 'string' ? element.className.slice(0, 140) : '',
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom),
            };
          })
          .filter((item) => item.left < -4 || item.right > viewportWidth + 4 || item.top < -4 || item.bottom > viewportHeight + 4)
          .slice(0, 6);

        return {
          overflow,
          scrollWidth,
          viewportWidth,
          viewportHeight,
          viewportMeta,
          wideElements,
          tooSmallFormControls,
          escapedFixedControls,
        };
      });

      if (!audit.viewportMeta.includes('width=device-width') || !audit.viewportMeta.includes('initial-scale=1')) {
        failures.push(`${device.name} ${route}: responsive viewport metadata missing or incomplete: ${audit.viewportMeta}`);
      }

      if (audit.overflow > 3) {
        failures.push(
          `${device.name} ${route}: horizontal overflow ${audit.scrollWidth}px > ${audit.viewportWidth}px; ` +
          `offenders=${JSON.stringify(audit.wideElements)}`
        );
      }

      if (audit.tooSmallFormControls.length) {
        failures.push(
          `${device.name} ${route}: form controls below 16px font-size; ` +
          `controls=${JSON.stringify(audit.tooSmallFormControls)}`
        );
      }

      if (audit.escapedFixedControls.length) {
        failures.push(
          `${device.name} ${route}: fixed/sticky control escaped viewport; ` +
          `controls=${JSON.stringify(audit.escapedFixedControls)}`
        );
      }

      // Exercise the actual mobile header drawer on a representative shared-header route.
      if (route === '/help' && device.width <= 767) {
        const opener = page.locator('button[aria-label="Open menu"]').first();
        if (await opener.isVisible().catch(() => false)) {
          await opener.click();
          await page.waitForTimeout(80);
          const drawer = page.locator('.ft-mobile-commerce-menu').first();
          if (await drawer.isVisible().catch(() => false)) {
            const rect = await drawer.boundingBox();
            if (!rect || rect.x < -3 || rect.x + rect.width > device.width + 3) {
              failures.push(`${device.name} /help: mobile drawer escaped viewport: ${JSON.stringify(rect)}`);
            }
          } else {
            failures.push(`${device.name} /help: mobile menu button did not reveal the drawer`);
          }
          const closer = page.locator('.ft-mobile-commerce-menu button[aria-label="Close menu"]').first();
          if (await closer.isVisible().catch(() => false)) await closer.click();
        } else {
          failures.push(`${device.name} /help: mobile menu trigger is not visible`);
        }
      }

      console.log(`✓ ${device.name.padEnd(23)} ${device.engine.padEnd(8)} ${route}`);
    }

    await context.close();
  }
} finally {
  for (const browser of browsers.values()) await browser.close();
}

if (failures.length) {
  console.error('\nMobile layout audit failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`\nMobile layout audit passed across ${devices.length} Android/iPhone device profiles and ${routes.length} routes.`);
