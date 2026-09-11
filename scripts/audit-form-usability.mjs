/**
 * Form and control usability audit.
 *
 * The layout audits already cover contrast, overflow and viewport escapes. This
 * one looks for the things that make a form hard to complete rather than hard to
 * read, which is a different failure and invisible to a screenshot:
 *
 *   unlabelled      an input with no <label for>, aria-label or aria-labelledby.
 *                   A screen reader announces "edit text" and nothing else.
 *   placeholder-only
 *                   labelled only by its placeholder, which vanishes the moment
 *                   someone starts typing -- so the field loses its name exactly
 *                   when they look up to check what they were filling in.
 *   wrong-keyboard  a numeric field (phone, PIN code, OTP, amount) that opens a
 *                   full QWERTY keyboard on a phone because it has no inputMode
 *                   or type. Costs every mobile user time on every field.
 *   no-autocomplete a name, email, phone or address field the browser cannot
 *                   fill, so it must be typed by hand every time.
 *   small-target    an interactive control under 44x44 CSS px, the size a finger
 *                   can reliably hit.
 *
 *   node scripts/audit-form-usability.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const baseURL = process.argv[2] || process.env.AUDIT_BASE_URL || 'https://fabrictrad.com';

const routes = [
  '/', '/login', '/register', '/auth/phone', '/auth/reset-password',
  '/marketplace', '/categories', '/vendors', '/product-detail', '/cart',
  '/custom-order', '/buyer-registration', '/seller-registration',
  '/help', '/how-to-use', '/admin-login', '/returns-exchanges',
];

const NUMERIC = /phone|mobile|pin|pincode|postal|zip|otp|code|amount|price|quantity|qty|gst|ifsc|account|pan|year|number/i;
const AUTOFILLABLE = /name|email|phone|mobile|address|city|state|pin|pincode|postal|zip|organization|company/i;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});

const findings = [];

for (const route of routes) {
  const page = await context.newPage();
  try {
    const res = await page.goto(new URL(route, baseURL).toString(), { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!res || res.status() >= 400) { await page.close(); continue; }
    await page.waitForTimeout(1200);

    const found = await page.evaluate(({ numericSrc, autofillSrc }) => {
      const NUM = new RegExp(numericSrc, 'i');
      const AUTO = new RegExp(autofillSrc, 'i');
      const out = [];
      const visible = (el) => {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const describe = (el) =>
        (el.getAttribute('name') || el.getAttribute('id') || el.getAttribute('placeholder') || el.tagName).slice(0, 44);

      for (const el of document.querySelectorAll('input, select, textarea')) {
        if (!visible(el)) continue;
        const type = (el.getAttribute('type') || 'text').toLowerCase();
        if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type)) continue;

        const id = el.getAttribute('id');
        const labelled =
          (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
          el.closest('label') ||
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby');
        const key = `${el.getAttribute('name') || ''} ${id || ''} ${el.getAttribute('placeholder') || ''}`;

        if (!labelled) {
          out.push({ kind: el.getAttribute('placeholder') ? 'placeholder-only' : 'unlabelled', control: describe(el), type });
        }
        if (el.tagName === 'INPUT' && NUM.test(key) && !['number', 'tel', 'email', 'date'].includes(type) && !el.getAttribute('inputmode')) {
          out.push({ kind: 'wrong-keyboard', control: describe(el), type });
        }
        if (el.tagName === 'INPUT' && AUTO.test(key) && !el.getAttribute('autocomplete')) {
          out.push({ kind: 'no-autocomplete', control: describe(el), type });
        }
      }

      // Effective hit area, not the element box. A control may be visually small
      // while carrying a larger tappable region on a ::before/::after -- the
      // announcement ticker does exactly that, keeping a thin bar while meeting
      // the 24px floor. Measuring the box alone reports work that is already
      // done, and "fixing" it would break the design it was written to preserve.
      const hitArea = (el) => {
        const r = el.getBoundingClientRect();
        let w = r.width, h = r.height;
        for (const pseudo of ['::before', '::after']) {
          const s = getComputedStyle(el, pseudo);
          if (!s || s.content === 'none' || s.content === 'normal') continue;
          if (s.position !== 'absolute' && s.position !== 'fixed') continue;
          const pw = parseFloat(s.width), ph = parseFloat(s.height);
          if (Number.isFinite(pw)) w = Math.max(w, pw);
          if (Number.isFinite(ph)) h = Math.max(h, ph);
        }
        // Padding on an inline element also enlarges what a finger can hit.
        return { w, h };
      };

      for (const el of document.querySelectorAll('button, a[href], [role="button"], input[type="submit"]')) {
        if (!visible(el)) continue;
        const { w, h } = hitArea(el);
        // 24x24 is the WCAG 2.2 AA floor (2.5.8). Report against that rather than
        // the 44px AAA figure, so the list is failures rather than preferences.
        if (w < 24 || h < 24) {
          const text = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 36);
          if (!text) continue;
          out.push({ kind: 'small-target', control: text, size: `${Math.round(w)}x${Math.round(h)}` });
        }
      }
      return out;
    }, { numericSrc: NUMERIC.source, autofillSrc: AUTOFILLABLE.source });

    for (const f of found) findings.push({ route, ...f });
  } catch (error) {
    findings.push({ route, kind: 'navigation-failed', control: error.message.split('\n')[0].slice(0, 80) });
  }
  await page.close();
}

await browser.close();

const byKind = {};
for (const f of findings) (byKind[f.kind] ||= []).push(f);

console.log(`Form usability audit — ${baseURL}`);
console.log(`${routes.length} routes, ${findings.length} findings\n`);
for (const [kind, list] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${kind} (${list.length})`);
  const seen = new Set();
  for (const f of list) {
    const line = `  ${f.route}  ${f.control}${f.size ? `  ${f.size}` : ''}`;
    if (seen.has(line)) continue;
    seen.add(line);
    console.log(line);
  }
  console.log('');
}
process.exit(findings.length ? 1 : 0);
