/**
 * Renders the FabricTrad social creative — Instagram, Facebook and YouTube, feed
 * and vertical — as PNGs, and stitches the video formats with ffmpeg.
 *
 *   node scripts/build-marketing-assets.mjs <outDir>
 *
 * Design notes, so future edits stay coherent rather than drifting:
 *
 * The only photography in the repo is one 1400x876 showroom shot, which crops
 * badly to 1080x1920 and cannot carry a campaign across seven aspect ratios. So
 * the system is typographic and material instead: the ground is a woven warp/weft
 * grid drawn in CSS, which is literally the subject matter, resolves at any size,
 * and needs no cropping. The photo appears only where a landscape crop is honest.
 *
 * Palette is FabricTrad's own, not invented: saffron #f0570f and zari gold #c9a24b
 * are already brand tokens (brand-identity-2026.css names the gold for zari, the
 * metallic thread in Indian weaving). Indigo is added as the ground because it is
 * the dye the trade is built on, and because a warm-cream-plus-serif treatment is
 * the default look every generator reaches for.
 *
 * Bahnschrift for display: condensed and technical, which reads as trade rather
 * than boutique. Noto Sans for running text, the product's own face.
 *
 * Every claim here is one the platform actually supports — the 90/10 split is
 * MARKETPLACE_SHARE_BPS, GST invoicing and GSTIN verification are live, Virtual
 * Drape and WhatsApp seller uploads are real features. No counts, no testimonials,
 * no ratings: the marketplace is early and inventing social proof would be a lie
 * that outlives the campaign.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'marketing-out'));
const framesDir = path.join(outDir, 'frames');
mkdirSync(framesDir, { recursive: true });

const dataUri = (p, mime) => `data:${mime};base64,${readFileSync(p).toString('base64')}`;
const logo = dataUri(path.join(root, 'public/assets/brand/fabrictrad-logo-horizontal.png'), 'image/png');
const logoDark = dataUri(path.join(root, 'public/assets/brand/fabrictrad-logo-horizontal-dark.png'), 'image/png');
const showroom = dataUri(path.join(root, 'public/images/textile-showroom.webp'), 'image/webp');

const INK = '#0d1729';
const SAFFRON = '#f0570f';
const GOLD = '#c9a24b';
const BONE = '#f4efe6';
const MADDER = '#3d1410'; // second ground: madder root, the red dye of the trade

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/** The woven ground: warp and weft as repeating gradients, with a slack, hand-loom feel. */
const weave = (scale = 1, alpha = 0.055) => `
  repeating-linear-gradient(90deg, rgba(255,255,255,${alpha}) 0 ${2 * scale}px, transparent ${2 * scale}px ${9 * scale}px),
  repeating-linear-gradient(0deg, rgba(255,255,255,${alpha * 0.8}) 0 ${2 * scale}px, transparent ${2 * scale}px ${9 * scale}px)`;

const shell = (w, h, inner, opts = {}) => `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'FTBody'; src: url('file://${path.join(root, 'scripts/guide-fonts/Latin.ttf').replace(/\\/g, '/')}'); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
  body {
    background: ${opts.warm ? MADDER : INK};
    color: ${BONE};
    font-family: 'FTBody', 'Segoe UI', sans-serif;
    position: relative;
  }
  .ground { position: absolute; inset: 0; background-image: ${weave(opts.weaveScale || 1, 0.055)}; }
  .ground.light { background-image: ${weave(opts.weaveScale || 1, 0.55)}; opacity: .35; }
  .glow { position: absolute; inset: 0;
    background: radial-gradient(120% 80% at 12% 6%, rgba(240,87,15,.30), transparent 58%),
                radial-gradient(90% 70% at 92% 98%, rgba(201,162,75,.22), transparent 60%); }
  .display { font-family: 'Bahnschrift', 'Bahnschrift Light Condensed', 'Segoe UI', sans-serif;
             font-weight: 700; letter-spacing: -.015em; line-height: .96; }
  /* The selvedge: a cloth's finished edge. Used as the structural rule on every
     format so the set reads as one family, never as decoration. */
  .selvedge { height: 6px; background: ${SAFFRON}; position: relative; }
  .selvedge::after { content:''; position:absolute; left:0; right:0; top: 11px; height: 2px; background: ${GOLD}; opacity:.85; }
  .wrap { position: relative; height: 100%; display: flex; flex-direction: column; }
  .logo { height: ${Math.round(Math.min(w, h) * 0.052)}px; }
  .foot { display: flex; align-items: center; justify-content: space-between; opacity: .92; }
  .url { font-family: 'Bahnschrift', sans-serif; letter-spacing: .1em; color: ${GOLD}; }
</style></head><body>${inner}</body></html>`;

/** One composition, reused across every aspect ratio with size-relative typography. */
const poster = (w, h, { kicker, lines, support, cta, light, photo }) => {
  const pad = Math.round(Math.min(w, h) * 0.085);
  const display = Math.round(Math.min(w, h) * (h / w > 1.4 ? 0.115 : 0.105));
  const supportSize = Math.round(Math.min(w, h) * 0.036);
  const kickerSize = Math.round(Math.min(w, h) * 0.026);
  return shell(w, h, `
    <div class="ground"></div>
    <div class="glow"></div>
    ${photo ? `<div style="position:absolute;inset:0;background:url('${showroom}') center/cover;opacity:.20;mix-blend-mode:luminosity"></div>` : ''}
    <div class="wrap" style="padding:${pad}px">
      <img class="logo" src="${logoDark}" style="align-self:flex-start" />
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(pad * 0.5)}px">
        <div style="font-family:'Bahnschrift',sans-serif;font-size:${kickerSize}px;letter-spacing:.18em;color:${GOLD}">${esc(kicker)}</div>
        <div class="display" style="font-size:${display}px">${lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>
        <div class="selvedge" style="width:${Math.round(w * 0.22)}px;margin-top:${Math.round(pad * 0.25)}px"></div>
        <div style="font-size:${supportSize}px;line-height:1.5;max-width:${Math.round(w * 0.82)}px;opacity:.88;margin-top:${Math.round(pad * 0.35)}px">${esc(support)}</div>
      </div>
      <div class="foot" style="font-size:${Math.round(supportSize * 0.85)}px">
        <div>${esc(cta)}</div><div class="url">FABRICTRAD.COM</div>
      </div>
    </div>`, { warm: light });
};

/** Vertical video scene: one idea, sized for a thumb-height screen. */
const scene = (w, h, { kicker, lines, support, light, photo }) => {
  // Coarser weave for motion: the 2px version aliases under zoompan and the
  // shimmer alone pushed a 15s vertical clip past 50MB.
  const pad = Math.round(Math.min(w, h) * 0.1);
  const display = Math.round(Math.min(w, h) * 0.135);
  return shell(w, h, `
    <div class="ground"></div>
    <div class="glow"></div>
    ${photo ? `<div style="position:absolute;inset:0;background:url('${showroom}') center/cover;opacity:.18;mix-blend-mode:luminosity"></div>` : ''}
    <div class="wrap" style="padding:${pad}px;justify-content:center;gap:${Math.round(pad * 0.55)}px">
      <div style="font-family:'Bahnschrift',sans-serif;font-size:${Math.round(display * 0.2)}px;letter-spacing:.2em;color:${GOLD}">${esc(kicker)}</div>
      <div class="display" style="font-size:${display}px">${lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>
      <div class="selvedge" style="width:${Math.round(w * 0.28)}px"></div>
      ${support ? `<div style="font-size:${Math.round(display * 0.26)}px;line-height:1.45;opacity:.88;max-width:${Math.round(w * 0.86)}px">${esc(support)}</div>` : ''}
    </div>
    <img src="${logoDark}" style="position:absolute;left:${pad}px;bottom:${pad}px;height:${Math.round(h * 0.033)}px" />`, { warm: light, weaveScale: 3 });
};

/* ------------------------------------------------------------------ content */

const SELLER = [
  { kicker: 'FOR MILLS AND TRADERS', lines: ['Sell your', 'fabric', 'across India.'], support: 'List once. Reach buyers sourcing by the metre and by the bolt.' },
  { kicker: 'YOUR SHARE', lines: ['You keep', '90% of', 'every payment.'], support: 'FabricTrad takes 10%, and covers payment processing and commission tax out of it.', light: true, photo: true },
  { kicker: 'PAPERWORK', lines: ['GST invoices,', 'raised', 'for you.'], support: 'Every paid order issues a compliant tax invoice with HSN and the correct CGST, SGST or IGST split.', photo: true },
  { kicker: 'LISTING', lines: ['List from', 'WhatsApp.'], support: 'Send the product details and photographs from your registered number, then review the draft before it goes live.', light: true },
];

const BUYER = [
  { kicker: 'BEFORE YOU BUY', lines: ['See how it', 'drapes.'], support: 'Virtual Drape previews a fabric in the exact colour you are considering.', photo: true },
  { kicker: 'WHO YOU BUY FROM', lines: ['GST-verified', 'sellers.'], support: 'Businesses are checked against their GSTIN before they can list.', light: true },
];

const posters = [
  { name: 'instagram-feed-1080x1350-seller-share', w: 1080, h: 1350, spec: { ...SELLER[1], cta: 'Start selling' } },
  { name: 'instagram-square-1080x1080-drape', w: 1080, h: 1080, spec: { ...BUYER[0], cta: 'Try Virtual Drape' } },
  { name: 'instagram-feed-1080x1350-whatsapp', w: 1080, h: 1350, spec: { ...SELLER[3], cta: 'List from WhatsApp' } },
  { name: 'facebook-feed-1200x630-sell', w: 1200, h: 630, spec: { ...SELLER[0], cta: 'Open a seller account', photo: true } },
  { name: 'facebook-square-1080x1080-gst', w: 1080, h: 1080, spec: { ...SELLER[2], cta: 'See how invoicing works' } },
  { name: 'youtube-thumbnail-1280x720', w: 1280, h: 720, spec: { ...SELLER[0], cta: 'Watch the seller walkthrough', photo: true } },
];

const videos = [
  { name: 'reel-shorts-1080x1920-seller', w: 1080, h: 1920, scenes: [...SELLER, BUYER[1]], hold: 3.0 },
  { name: 'youtube-1920x1080-overview', w: 1920, h: 1080, scenes: [...SELLER, ...BUYER], hold: 4.0 },
  { name: 'square-1080x1080-seller', w: 1080, h: 1080, scenes: SELLER.slice(0, 3), hold: 3.0 },
];

/* ------------------------------------------------------------------- render */

const browser = await chromium.launch({ headless: true });
const shoot = async (html, w, h, file) => {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(140);
  await page.screenshot({ path: file });
  await page.close();
  return file;
};

for (const p of posters) {
  const file = path.join(outDir, `${p.name}.png`);
  await shoot(poster(p.w, p.h, p.spec), p.w, p.h, file);
  console.log('IMAGE', p.name, `${p.w}x${p.h}`);
}

for (const v of videos) {
  const stills = [];
  for (const [i, s] of v.scenes.entries()) {
    const file = path.join(framesDir, `${v.name}-${String(i).padStart(2, '0')}.png`);
    await shoot(scene(v.w, v.h, s), v.w, v.h, file);
    stills.push(file);
  }
  // Slow push-in on each still, cross-dissolved. Motion stays under the message:
  // social video is watched with sound off, so the type has to do the work and
  // the movement only has to keep the frame alive.
  const zoom = `zoompan=z='min(1.06,1+0.06*on/${Math.round(v.hold * 30)})':d=${Math.round(v.hold * 30)}:s=${v.w}x${v.h}:fps=30`;
  // One input frame per scene, not a looped stream: zoompan emits `d` frames for
  // EVERY frame it is given, so `-loop 1 -t 3` (90 frames) with d=90 produced
  // 8100 frames a scene and turned a 15s reel into 1125s.
  const inputs = stills.flatMap((f) => ['-i', f]);
  const filters = stills
    .map((_, i) => `[${i}:v]${zoom},format=yuv420p,setsar=1[v${i}]`)
    .concat([`${stills.map((_, i) => `[v${i}]`).join('')}concat=n=${stills.length}:v=1:a=0[out]`])
    .join(';');
  const dest = path.join(outDir, `${v.name}.mp4`);
  execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', filters, '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-tune', 'stillimage',
    '-maxrate', '6M', '-bufsize', '12M', '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p', '-r', '30', dest],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  // Assert the duration rather than trusting it: the file existed and was named
  // like a 15s reel while actually running 18 minutes.
  const actual = Number(execFileSync('ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dest]).toString().trim());
  const expected = v.scenes.length * v.hold;
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1.0) {
    throw new Error(`${v.name}: expected ~${expected}s, encoded ${actual}s`);
  }
  console.log('VIDEO', v.name, `${v.w}x${v.h}`, `${actual.toFixed(1)}s`);
}

await browser.close();
writeFileSync(path.join(outDir, 'MANIFEST.txt'),
  [...posters.map((p) => `${p.name}.png  ${p.w}x${p.h}`),
   ...videos.map((v) => `${v.name}.mp4  ${v.w}x${v.h}  ${(v.scenes.length * v.hold).toFixed(0)}s`)].join('\n') + '\n');
console.log('DONE ->', outDir);
