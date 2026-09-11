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

/** A ruled list of capabilities. Sixteen posters sharing one composition reads as
 *  a template; this carries several features at once and gives the set a second
 *  rhythm. The rules are selvedge-derived, so it stays in the same family. */
const featureList = (w, h, { kicker, title, items, cta, light, photo }) => {
  const pad = Math.round(Math.min(w, h) * 0.08);
  const titleSize = Math.round(Math.min(w, h) * 0.072);
  const itemSize = Math.round(Math.min(w, h) * 0.038);
  const noteSize = Math.round(Math.min(w, h) * 0.028);
  return shell(w, h, `
    <div class="ground"></div>
    <div class="glow"></div>
    ${photo ? `<div style="position:absolute;inset:0;background:url('${showroom}') center/cover;opacity:.16;mix-blend-mode:luminosity"></div>` : ''}
    <div class="wrap" style="padding:${pad}px">
      <img class="logo" src="${logoDark}" style="align-self:flex-start" />
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
        <div style="font-family:'Bahnschrift',sans-serif;font-size:${Math.round(noteSize)}px;letter-spacing:.18em;color:${GOLD};margin-bottom:${Math.round(pad * 0.3)}px">${esc(kicker)}</div>
        <div class="display" style="font-size:${titleSize}px;margin-bottom:${Math.round(pad * 0.55)}px">${esc(title)}</div>
        ${items.map((it) => `
          <div style="border-top:2px solid ${SAFFRON};padding:${Math.round(pad * 0.38)}px 0 ${Math.round(pad * 0.3)}px">
            <div style="font-family:'Bahnschrift',sans-serif;font-size:${itemSize}px;font-weight:700;letter-spacing:-.01em;margin-bottom:${Math.round(itemSize * 0.22)}px">${esc(it.h)}</div>
            <div style="font-size:${noteSize}px;line-height:1.45;opacity:.85;max-width:${Math.round(w * 0.86)}px">${esc(it.d)}</div>
          </div>`).join('')}
      </div>
      <div class="foot" style="font-size:${Math.round(noteSize * 0.95)}px;border-top:2px solid ${GOLD};padding-top:${Math.round(pad * 0.3)}px">
        <div>${esc(cta)}</div><div class="url">FABRICTRAD.COM</div>
      </div>
    </div>`, { warm: light });
};

/** One fact, set as large as the format allows. For the single strongest number
 *  or guarantee in a set -- used sparingly, or it stops being emphatic. */
const statCard = (w, h, { kicker, value, label, support, cta, light, photo }) => {
  const pad = Math.round(Math.min(w, h) * 0.085);
  const valueSize = Math.round(Math.min(w, h) * 0.26);
  const labelSize = Math.round(Math.min(w, h) * 0.062);
  const noteSize = Math.round(Math.min(w, h) * 0.032);
  return shell(w, h, `
    <div class="ground"></div>
    <div class="glow"></div>
    ${photo ? `<div style="position:absolute;inset:0;background:url('${showroom}') center/cover;opacity:.18;mix-blend-mode:luminosity"></div>` : ''}
    <div class="wrap" style="padding:${pad}px">
      <img class="logo" src="${logoDark}" style="align-self:flex-start" />
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(pad * 0.2)}px">
        <div style="font-family:'Bahnschrift',sans-serif;font-size:${noteSize}px;letter-spacing:.2em;color:${GOLD}">${esc(kicker)}</div>
        <div class="display" style="font-size:${valueSize}px;color:${SAFFRON};line-height:.86">${esc(value)}</div>
        <div class="display" style="font-size:${labelSize}px">${esc(label)}</div>
        <div class="selvedge" style="width:${Math.round(w * 0.2)}px;margin-top:${Math.round(pad * 0.3)}px"></div>
        <div style="font-size:${noteSize}px;line-height:1.5;opacity:.88;max-width:${Math.round(w * 0.8)}px;margin-top:${Math.round(pad * 0.35)}px">${esc(support)}</div>
      </div>
      <div class="foot" style="font-size:${Math.round(noteSize * 0.95)}px">
        <div>${esc(cta)}</div><div class="url">FABRICTRAD.COM</div>
      </div>
    </div>`, { warm: light });
};

/** One beat of a story.
 *
 *  The earlier videos were a feature list set to motion: every scene an
 *  independent claim, identically composed, in the same place on screen. Nothing
 *  carried from one to the next, so there was no reason to keep watching past the
 *  first. These beats instead run an arc -- a situation, the friction in it, the
 *  turn where the product arrives, then what changes -- and the composition moves
 *  with the story rather than staying put.
 *
 *  kind drives everything visual, so the picture reports where you are in the arc:
 *    hook     cold open. Indigo, no photograph, type high on the frame.
 *    tension  the friction. Smaller, lower, dimmer -- the frame closing in.
 *    stakes   what it costs. Madder ground: the one moment of heat.
 *    turn     the product arrives. Cloth appears, selvedge cuts across, logo in.
 *    resolve  what changes now. Calm, centred, photograph held back.
 *    close    logo, one ask, the address.
 */
const storyBeat = (w, h, beat) => {
  const k = beat.kind;
  const pad = Math.round(Math.min(w, h) * 0.095);
  const base = Math.min(w, h);
  const size = {
    hook: 0.125, tension: 0.085, stakes: 0.125, turn: 0.135, resolve: 0.082, close: 0.07,
  }[k] || 0.1;
  const display = Math.round(base * size);
  const justify = k === 'hook' ? 'flex-start' : k === 'tension' ? 'flex-end' : 'center';
  const photoOpacity = k === 'turn' ? 0.26 : k === 'resolve' ? 0.14 : k === 'close' ? 0.1 : 0;
  const dim = k === 'tension' ? 0.62 : 1;

  const body = k === 'close'
    ? `<div class="wrap" style="padding:${pad}px;justify-content:center;align-items:center;text-align:center;gap:${Math.round(pad * 0.5)}px">
         <img src="${logoDark}" style="height:${Math.round(h * 0.062)}px" />
         <div class="selvedge" style="width:${Math.round(w * 0.3)}px;margin:${Math.round(pad * 0.35)}px 0"></div>
         <div class="display" style="font-size:${display}px">${esc(beat.text)}</div>
         <div class="url" style="font-size:${Math.round(display * 0.42)}px;margin-top:${Math.round(pad * 0.3)}px">FABRICTRAD.COM</div>
       </div>`
    : `<div class="wrap" style="padding:${pad}px;justify-content:${justify};gap:${Math.round(pad * 0.42)}px">
         ${k === 'turn' ? `<div class="selvedge" style="width:${Math.round(w * 0.55)}px"></div>` : ''}
         ${beat.kicker ? `<div style="font-family:'Bahnschrift',sans-serif;font-size:${Math.round(base * 0.026)}px;letter-spacing:.22em;color:${GOLD}">${esc(beat.kicker)}</div>` : ''}
         <div class="display" style="font-size:${display}px;opacity:${dim};max-width:${Math.round(w * 0.9)}px">${beat.text.split('\n').map((l) => `<div>${esc(l)}</div>`).join('')}</div>
         ${k === 'turn' ? `<img src="${logoDark}" style="height:${Math.round(h * 0.032)}px;margin-top:${Math.round(pad * 0.3)}px;align-self:flex-start" />` : ''}
       </div>`;

  return shell(w, h, `
    <div class="ground"></div>
    ${k === 'stakes' || k === 'turn' ? '<div class="glow"></div>' : ''}
    ${photoOpacity ? `<div style="position:absolute;inset:0;background:url('${showroom}') center/cover;opacity:${photoOpacity};mix-blend-mode:luminosity"></div>` : ''}
    ${body}`, { warm: k === 'stakes', weaveScale: 3 });
};

/* ------------------------------------------------------------------ content */

/* Every line below maps to a capability confirmed in the codebase. The buyer set
   deliberately avoids anything downstream of a completed purchase -- orders,
   tracking, invoices -- because checkout cannot complete until a seller has an
   activated Razorpay payout account and there are currently none. Browsing,
   Virtual Drape, wishlist, sourcing requests and the language switch all work
   fully today, so buyer creative runs on those, with "browse" and "post what you
   need" as the asks rather than "buy". */

const SELLER = [
  { kicker: 'FOR MILLS AND TRADERS', lines: ['Sell your', 'fabric', 'across India.'], support: 'List once. Reach buyers sourcing by the metre and by the bolt.', cta: 'Open a seller account', photo: true },
  { kicker: 'PAPERWORK', lines: ['GST invoices,', 'raised', 'for you.'], support: 'Every paid order issues a compliant tax invoice with HSN and the right CGST, SGST or IGST split.', cta: 'See how invoicing works', photo: true },
  { kicker: 'LISTING', lines: ['List from', 'WhatsApp.'], support: 'Send product details and photographs from your registered number, then review the draft before it goes live.', cta: 'See how it works', light: true },
  { kicker: 'BEFORE YOU SELL', lines: ['Verified', 'against', 'your GSTIN.'], support: 'Businesses are checked before they can list, so buyers know who they are dealing with.', cta: 'Start verification' },
  { kicker: 'DISPATCH', lines: ['Ship it', 'your way.'], support: 'Book through Shiprocket, or enter your own courier, AWB number and tracking link for the buyer.', cta: 'See fulfilment', light: true, photo: true },
  { kicker: 'DEMAND', lines: ['See what', 'buyers are', 'sourcing.'], support: 'Buyer requests show what the market is asking for before you commit stock to it.', cta: 'View buyer requests' },
];

const BUYER = [
  { kicker: 'BEFORE YOU COMMIT', lines: ['See how it', 'drapes.'], support: 'Virtual Drape previews a fabric in the exact colour you are considering.', cta: 'Try Virtual Drape', photo: true },
  { kicker: 'WHO YOU BUY FROM', lines: ['GST-verified', 'sellers.'], support: 'Every business is checked against its GSTIN before it can list a single product.', cta: 'Browse the marketplace', light: true },
  { kicker: 'EVERY COLOUR', lines: ['Each variant,', 'photographed.'], support: 'Colours carry their own photograph, stock and minimum quantity, so you order the one you actually saw.', cta: 'Browse the marketplace' },
  { kicker: 'CANNOT FIND IT', lines: ['Post what', 'you need.'], support: 'Describe the fabric, quantity and deadline. Verified sellers come to you.', cta: 'Post a sourcing request', photo: true },
  { kicker: 'YOUR LANGUAGE', lines: ['English,', 'Hindi,', 'Gujarati.'], support: 'The whole marketplace, and the narrated walkthroughs, in all three.', cta: 'Browse the marketplace', light: true },
];

const LISTS = {
  seller: { kicker: 'THE SELLER WORKSPACE', title: 'Run the whole business in one place.', cta: 'Open a seller account', photo: true,
    items: [
      { h: 'Products, variants and GTIN', d: 'Every colour gets its own photograph, stock and minimum quantity.' },
      { h: 'Catalogues and pricing', d: 'Set MOQ and buyer pricing without re-listing anything.' },
      { h: 'Earnings and payouts', d: 'Captured payments, refunds and your allocation, shown separately.' },
    ] },
  buyer: { kicker: 'THE BUYER WORKSPACE', title: 'Source without the phone calls.', cta: 'Browse the marketplace', light: true,
    items: [
      { h: 'Wishlist', d: 'Keep the fabrics you are weighing up in one place.' },
      { h: 'Sourcing requests', d: 'Post what you need and let verified sellers answer.' },
      { h: 'Virtual Drape', d: 'See the fall of a fabric in your colour before you commit.' },
    ] },
};

const STATS = {
  share: { kicker: 'YOUR SHARE', value: '90%', label: 'of every payment is yours.', support: 'FabricTrad takes 10%, and covers payment processing and commission tax out of it.', cta: 'Open a seller account', photo: true },
};

/* Format table. One composition set, rendered at every size a feed asks for. */
const posters = [
  { n: 'ig-feed-seller-sell',      w: 1080, h: 1350, layout: 'poster', spec: SELLER[0] },
  { n: 'ig-feed-seller-gst',       w: 1080, h: 1350, layout: 'poster', spec: SELLER[1] },
  { n: 'ig-feed-seller-whatsapp',  w: 1080, h: 1350, layout: 'poster', spec: SELLER[2] },
  { n: 'ig-feed-seller-share',     w: 1080, h: 1350, layout: 'stat',   spec: STATS.share },
  { n: 'ig-feed-buyer-drape',      w: 1080, h: 1350, layout: 'poster', spec: BUYER[0] },
  { n: 'ig-feed-buyer-sourcing',   w: 1080, h: 1350, layout: 'poster', spec: BUYER[3] },
  { n: 'ig-feed-seller-toolkit',   w: 1080, h: 1350, layout: 'list',   spec: LISTS.seller },
  { n: 'ig-feed-buyer-toolkit',    w: 1080, h: 1350, layout: 'list',   spec: LISTS.buyer },
  { n: 'square-seller-verified',   w: 1080, h: 1080, layout: 'poster', spec: SELLER[3] },
  { n: 'square-seller-shipping',   w: 1080, h: 1080, layout: 'poster', spec: SELLER[4] },
  { n: 'square-buyer-verified',    w: 1080, h: 1080, layout: 'poster', spec: BUYER[1] },
  { n: 'square-buyer-variants',    w: 1080, h: 1080, layout: 'poster', spec: BUYER[2] },
  { n: 'story-seller-share',       w: 1080, h: 1920, layout: 'stat',   spec: STATS.share },
  { n: 'story-buyer-drape',        w: 1080, h: 1920, layout: 'poster', spec: BUYER[0] },
  { n: 'story-seller-demand',      w: 1080, h: 1920, layout: 'poster', spec: SELLER[5] },
  { n: 'story-buyer-languages',    w: 1080, h: 1920, layout: 'poster', spec: BUYER[4] },
  { n: 'fb-link-seller',           w: 1200, h: 630,  layout: 'poster', spec: SELLER[0] },
  { n: 'fb-link-buyer',            w: 1200, h: 630,  layout: 'poster', spec: BUYER[3] },
  { n: 'linkedin-seller-toolkit',  w: 1200, h: 627,  layout: 'list',   spec: LISTS.seller },
  { n: 'linkedin-buyer-sourcing',  w: 1200, h: 627,  layout: 'poster', spec: BUYER[3] },
  { n: 'pinterest-buyer-drape',    w: 1000, h: 1500, layout: 'poster', spec: BUYER[0] },
  { n: 'pinterest-buyer-variants', w: 1000, h: 1500, layout: 'poster', spec: BUYER[2] },
  { n: 'yt-thumb-seller',          w: 1280, h: 720,  layout: 'poster', spec: SELLER[0] },
  { n: 'yt-thumb-buyer',           w: 1280, h: 720,  layout: 'poster', spec: BUYER[3] },
];

/* Two stories. Each is one person's problem, told in their own second person,
   resolved by something the platform genuinely does. Beat lengths are uneven on
   purpose: the hook is quick, the friction gets quicker still, the turn is given
   air, and the close holds long enough to read the address. Uniform three-second
   scenes are what made the first set feel like a slideshow. */

const SELLER_STORY = [
  { kind: 'hook',    text: 'Your cloth\nis good.', hold: 2.0 },
  { kind: 'tension', text: 'Your market is the three traders who visit.', hold: 2.6 },
  { kind: 'tension', text: 'A new buyer means a phone call,', hold: 2.0 },
  { kind: 'tension', text: 'a sample by courier,', hold: 1.8 },
  { kind: 'stakes',  text: 'and a week\nof waiting.', hold: 2.4 },
  { kind: 'turn',    kicker: 'FABRICTRAD', text: 'List it\nonce.', hold: 2.8 },
  { kind: 'resolve', text: 'Buyers sourcing across India see it.', hold: 2.6 },
  { kind: 'resolve', text: 'GST invoice raised. Ninety percent yours. Courier booked.', hold: 3.2 },
  { kind: 'close',   text: 'Open a seller account', hold: 3.0 },
];

const BUYER_STORY = [
  { kind: 'hook',    text: 'The photo\nlooked right.', hold: 2.2 },
  { kind: 'tension', text: 'Forty metres arrived.', hold: 2.0 },
  { kind: 'tension', text: 'A shade off.', hold: 1.8 },
  { kind: 'stakes',  text: 'Mid-season.\nNo time to\nreorder.', hold: 2.8 },
  { kind: 'turn',    kicker: 'FABRICTRAD', text: 'See it before\nyou commit.', hold: 2.8 },
  { kind: 'resolve', text: 'Virtual Drape shows the fall in your colour.', hold: 2.8 },
  { kind: 'resolve', text: 'Every variant photographed, with its own stock.', hold: 2.8 },
  { kind: 'resolve', text: 'Every seller checked against their GSTIN.', hold: 2.4 },
  { kind: 'close',   text: 'Browse the marketplace', hold: 3.0 },
];

const stories = [
  { n: 'story-seller-reel-1080x1920',   w: 1080, h: 1920, beats: SELLER_STORY },
  { n: 'story-buyer-reel-1080x1920',    w: 1080, h: 1920, beats: BUYER_STORY },
  { n: 'story-seller-square-1080x1080', w: 1080, h: 1080, beats: SELLER_STORY },
  { n: 'story-buyer-square-1080x1080',  w: 1080, h: 1080, beats: BUYER_STORY },
  { n: 'story-seller-yt-1920x1080',     w: 1920, h: 1080, beats: SELLER_STORY },
  { n: 'story-buyer-yt-1920x1080',      w: 1920, h: 1080, beats: BUYER_STORY },
];

const videos = [
  { n: 'reel-seller-1080x1920',   w: 1080, h: 1920, scenes: SELLER,                 hold: 2.8 },
  { n: 'reel-buyer-1080x1920',    w: 1080, h: 1920, scenes: BUYER,                  hold: 2.8 },
  { n: 'square-seller-1080x1080', w: 1080, h: 1080, scenes: SELLER.slice(0, 4),     hold: 3.0 },
  { n: 'square-buyer-1080x1080',  w: 1080, h: 1080, scenes: BUYER.slice(0, 3),      hold: 3.0 },
  { n: 'yt-overview-1920x1080',   w: 1920, h: 1080, scenes: [...SELLER, ...BUYER],  hold: 3.4 },
  { n: 'story-seller-1080x1920',  w: 1080, h: 1920, scenes: SELLER.slice(0, 3),     hold: 3.0 },
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
  const file = path.join(outDir, `${p.n}.png`);
  // Three compositions, chosen per asset: a statement, a ruled capability list,
  // or a single large fact. One layout across two dozen posters reads as a template.
  const render = p.layout === 'list' ? featureList : p.layout === 'stat' ? statCard : poster;
  await shoot(render(p.w, p.h, p.spec), p.w, p.h, file);
  console.log('IMAGE', p.n, `${p.w}x${p.h}`);
}

for (const v of videos) {
  const stills = [];
  for (const [i, s] of v.scenes.entries()) {
    const file = path.join(framesDir, `${v.n}-${String(i).padStart(2, '0')}.png`);
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
  const dest = path.join(outDir, `${v.n}.mp4`);
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
    throw new Error(`${v.n}: expected ~${expected}s, encoded ${actual}s`);
  }
  console.log('VIDEO', v.n, `${v.w}x${v.h}`, `${actual.toFixed(1)}s`);
}

// Story videos. Each beat gets its own hold, so the concat has to be built from
// per-beat durations rather than one shared value.
for (const s of stories) {
  const stills = [];
  for (const [i, b] of s.beats.entries()) {
    const file = path.join(framesDir, `${s.n}-${String(i).padStart(2, '0')}.png`);
    await shoot(storyBeat(s.w, s.h, b), s.w, s.h, file);
    stills.push({ file, hold: b.hold });
  }
  const inputs = stills.flatMap((x) => ['-i', x.file]);
  const filters = stills
    .map((x, i) => {
      const frames = Math.round(x.hold * 30);
      // Push in a touch further on the turn and the close so the arc lands;
      // keep the friction beats almost still, which makes them feel stuck.
      const z = s.beats[i].kind === 'tension' ? 1.02 : s.beats[i].kind === 'turn' ? 1.09 : 1.05;
      return `[${i}:v]zoompan=z='min(${z},1+${(z - 1).toFixed(3)}*on/${frames})':d=${frames}:s=${s.w}x${s.h}:fps=30,format=yuv420p,setsar=1[v${i}]`;
    })
    .concat([`${stills.map((_, i) => `[v${i}]`).join('')}concat=n=${stills.length}:v=1:a=0[out]`])
    .join(';');
  const dest = path.join(outDir, `${s.n}.mp4`);
  execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', filters, '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-tune', 'stillimage',
    '-maxrate', '6M', '-bufsize', '12M', '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p', '-r', '30', dest], { stdio: ['ignore', 'ignore', 'pipe'] });
  const actual = Number(execFileSync('ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dest]).toString().trim());
  const expected = s.beats.reduce((a, b) => a + b.hold, 0);
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1.0) {
    throw new Error(`${s.n}: expected ~${expected}s, encoded ${actual}s`);
  }
  console.log('STORY', s.n, `${s.w}x${s.h}`, `${actual.toFixed(1)}s`, `${s.beats.length} beats`);
}

await browser.close();
writeFileSync(path.join(outDir, 'MANIFEST.txt'),
  [...posters.map((p) => `${p.n}.png  ${p.w}x${p.h}  ${p.layout}`),
   ...stories.map((s) => `${s.n}.mp4  ${s.w}x${s.h}  ${s.beats.reduce((a, b) => a + b.hold, 0).toFixed(0)}s  story`),
   ...videos.map((v) => `${v.n}.mp4  ${v.w}x${v.h}  ${(v.scenes.length * v.hold).toFixed(0)}s`)].join('\n') + '\n');
console.log('DONE ->', outDir);
