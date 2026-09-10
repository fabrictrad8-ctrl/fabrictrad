// Renders the narrated-guide slide frames via Chromium (Playwright) instead of raw
// Pillow text drawing, because Pillow's Windows build lacks libraqm and cannot shape
// Devanagari/Gujarati text correctly (conjuncts and vowel-sign reordering break).
// Chromium's built-in text engine (HarfBuzz) shapes these scripts correctly.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workDir = process.argv[2] || path.join(root, 'guide-work');
mkdirSync(workDir, { recursive: true });

const source = JSON.parse(readFileSync(path.join(root, 'scripts/guide-narration.json'), 'utf8'));

const fontFiles = { en: 'Latin.ttf', hi: 'Devanagari.ttf', gu: 'Gujarati.ttf' };
const fontFamilies = { en: 'GuideLatin', hi: 'GuideDevanagari', gu: 'GuideGujarati' };
const labels = {
  en: { buyer: 'BUYER GUIDE', seller: 'SELLER GUIDE', step: 'STEP', where: 'WHERE TO GO', narrated: 'Narrated quick start' },
  hi: { buyer: 'खरीदार मार्गदर्शिका', seller: 'विक्रेता मार्गदर्शिका', step: 'चरण', where: 'यहाँ जाएँ', narrated: 'आवाज़ के साथ मार्गदर्शन' },
  gu: { buyer: 'ખરીદદાર માર્ગદર્શિકા', seller: 'વિક્રેતા માર્ગદર્શિકા', step: 'પગલું', where: 'અહીં જાઓ', narrated: 'અવાજ સાથે માર્ગદર્શન' },
};
const navPaths = {
  account: ['Create account', 'Buyer / Seller'], login: ['Sign in', 'Language'],
  discover: ['Marketplace', 'Product details'], drape: ['Product details', 'Virtual Drape'],
  payment: ['Cart', 'Order', 'Razorpay'], tracking: ['Buyer dashboard', 'Orders / Track packages'],
  catalogue: ['Seller dashboard', 'Add product / Products'], bank: ['Seller dashboard', 'Earnings', 'Payout account'],
  split: ['Buyer payment', 'Seller 90%', 'FabricTrad 10%'], whatsapp: ['Seller number', 'Catalogue assistant', 'Review draft'],
  shipping: ['Paid order', 'Choose carrier', 'AWB + tracking link'], earnings: ['Orders / Invoices', 'Earnings', 'Transfer status'],
  help: ['Dashboard', 'Support / Disputes'],
};

const fileUrl = (p) => 'file:///' + p.replace(/\\/g, '/');
const dataUri = (p, mime) => `data:${mime};base64,${readFileSync(p).toString('base64')}`;
const logoUrl = dataUri(path.join(root, 'public/assets/brand/fabrictrad-logo-horizontal.png'), 'image/png');
const artUrl = dataUri(path.join(root, 'public/images/textile-showroom.webp'), 'image/webp');
const fontUrl = (lang) => fileUrl(path.join(root, 'scripts/guide-fonts', fontFiles[lang]));

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildHtml(role, lang, i, chapter, count) {
  const nav = navPaths[chapter.screen];
  const [title, body] = chapter[lang];
  const family = fontFamilies[lang];
  const navHtml = nav.map((label) => `<div class="nav-pill">${escapeHtml(label)}</div>`).join('');
  const progressPct = Math.round(((i + 1) / count) * 100);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8" />
  <style>
    @font-face { font-family: 'GuideLatin'; src: url('${fontUrl('en')}'); }
    @font-face { font-family: 'GuideDevanagari'; src: url('${fontUrl('hi')}'); }
    @font-face { font-family: 'GuideGujarati'; src: url('${fontUrl('gu')}'); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1280px; height: 720px; background: #f7f8fb; font-family: '${family}', sans-serif; overflow: hidden; }
    .stage { position: relative; width: 1280px; height: 720px; }
    .logo { position: absolute; left: 36px; top: 30px; height: 44px; }
    .kicker { position: absolute; left: 263px; top: 36px; font-size: 25px; font-weight: 700; color: #233f69; }
    .kicker-sub { position: absolute; left: 263px; top: 76px; font-size: 18px; color: #526078; }
    .counter { position: absolute; right: 36px; top: 40px; background: #e9edf4; border-radius: 18px; padding: 12px 22px; font-family: 'GuideLatin', sans-serif; font-size: 22px; font-weight: 700; color: #233f69; }
    .art { position: absolute; left: 36px; top: 140px; width: 410px; height: 510px; border-radius: 24px; object-fit: cover; }
    .nav-box { position: absolute; left: 58px; top: 354px; width: 366px; height: 274px; background: #fff; border-radius: 18px; padding: 24px; }
    .nav-title { font-size: 20px; font-weight: 700; color: #9b4b1f; margin-bottom: 22px; }
    .nav-pill { background: #eef2f8; border-radius: 10px; padding: 12px 16px; font-family: 'GuideLatin', sans-serif; font-size: 19px; font-weight: 600; color: #233f69; margin-bottom: 14px; }
    .content { position: absolute; left: 488px; top: 145px; width: 747px; }
    .step-label { font-size: 19px; font-weight: 700; color: #9b4b1f; margin-bottom: 20px; }
    .title { font-size: 36px; font-weight: 700; color: #172741; line-height: 1.32; margin-bottom: 26px; }
    .body { font-size: 26px; color: #3d4c64; line-height: 1.65; }
    .progress-track { position: absolute; left: 36px; top: 677px; width: 1208px; height: 6px; background: #dce2eb; border-radius: 3px; }
    .progress-fill { position: absolute; left: 36px; top: 677px; width: ${progressPct}%; height: 6px; background: #b65a24; border-radius: 3px; }
    .watermark { position: absolute; right: 36px; top: 692px; font-family: 'GuideLatin', sans-serif; font-size: 15px; color: #526078; }
  </style></head>
  <body><div class="stage">
    <img class="logo" src="${logoUrl}" />
    <div class="kicker">${escapeHtml(labels[lang][role])}</div>
    <div class="kicker-sub">${escapeHtml(labels[lang].narrated)}</div>
    <div class="counter">${String(i + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}</div>
    <img class="art" src="${artUrl}" />
    <div class="nav-box">
      <div class="nav-title">${escapeHtml(labels[lang].where)}</div>
      ${navHtml}
    </div>
    <div class="content">
      <div class="step-label" style="font-family: 'GuideLatin', sans-serif;">${escapeHtml(labels[lang].step)} ${String(i + 1).padStart(2, '0')}</div>
      <div class="title">${escapeHtml(title)}</div>
      <div class="body">${escapeHtml(body)}</div>
    </div>
    <div class="progress-track"></div>
    <div class="progress-fill"></div>
    <div class="watermark">fabrictrad.com</div>
  </div></body></html>`;
}

const jobs = [];
for (const [role, chapters] of Object.entries(source)) {
  for (const lang of Object.keys(fontFiles)) {
    chapters.forEach((chapter, i) => jobs.push({ role, lang, i, chapter, count: chapters.length }));
  }
}

const browser = await chromium.launch();
// deviceScaleFactor 1.5 rasterises the 1280x720 CSS stage at 1920x1080, which is what
// the guide videos in public/guides have always shipped as. At 1 this renders 720p and
// silently halves the committed assets' resolution on the next rebuild -- the layout is
// unchanged either way, since the scale factor affects the raster and not the CSS box.
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });

for (const job of jobs) {
  const dest = path.join(workDir, `${job.role}-${job.lang}-${String(job.i).padStart(2, '0')}.png`);
  const html = buildHtml(job.role, job.lang, job.i, job.chapter, job.count);
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: dest });
  console.log('FRAME', job.role, job.lang, job.i, dest);
}

await browser.close();
console.log('DONE', jobs.length, 'frames');
