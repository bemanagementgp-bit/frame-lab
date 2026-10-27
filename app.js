/* Frame Lab – put a photo inside instant prints, devices and gallery frames. Vanilla JS, renders on <canvas>. */
(function () {
  'use strict';
  const C = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const FONTS = {
    casual: '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Marker Felt", "Comic Sans MS", cursive',
    serif: 'Georgia, "Times New Roman", Times, serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  };
  const STATE_KEY = 'framelab_state_v1', PRESETS_KEY = 'framelab_presets_v1';
  const SIZES = { square: [2000, 2000], portrait: [1600, 2000], landscape: [2000, 1500], story: [1080, 1920] };

  // ---------- catalogs ----------
  const GRADS = [
    { id: 'sunset', name: 'Sunset', colors: ['#ff7e5f', '#feb47b'], angle: 135 },
    { id: 'ocean', name: 'Ocean', colors: ['#2193b0', '#6dd5ed'], angle: 135 },
    { id: 'aurora', name: 'Aurora', colors: ['#00f2a8', '#6a5cff'], angle: 160 },
    { id: 'peach', name: 'Peach', colors: ['#ffecd2', '#fcb69f'], angle: 135 },
    { id: 'midnight', name: 'Midnight', colors: ['#0f2027', '#2c5364'], angle: 135 },
    { id: 'lime', name: 'Lime', colors: ['#a8ff78', '#78ffd6'], angle: 135 },
    { id: 'candy', name: 'Candy', colors: ['#ff9a9e', '#fad0c4'], angle: 135 },
    { id: 'slate', name: 'Slate', colors: ['#3a3f4b', '#1e2128'], angle: 160 }
  ];
  const BGS = [
    { id: 'transparent', name: 'Transparent', css: 'checker' },
    { id: 'solid', name: 'Solid', css: '' },
    { id: 'blur', name: 'Blurred photo', css: 'radial-gradient(at 30% 30%, rgba(255,210,140,.9), transparent 60%), linear-gradient(160deg,#5b3a63,#2b2d5e)' },
    { id: 'wall', name: 'Wall', css: 'radial-gradient(at 50% 30%, #f3efe8, #d4cec3)' },
    { id: 'desk', name: 'Desk', css: 'linear-gradient(180deg,#8a6242,#3a2314)' }
  ].concat(GRADS.map(g => ({ id: g.id, name: g.name, css: `linear-gradient(${g.angle}deg, ${g.colors.join(', ')})`, grad: g })));
  const FRAMES = [
    { id: 'instant', name: 'Instant print', colors: 'print' },
    { id: 'instantmini', name: 'Instant mini', colors: 'print' },
    { id: 'phone', name: 'Phone', colors: 'device', pad: 0.02 },
    { id: 'tablet', name: 'Tablet', colors: 'device' },
    { id: 'laptop', name: 'Laptop', colors: 'device' },
    { id: 'gallery', name: 'Gallery frame', colors: 'gallery' },
    { id: 'camera', name: 'Camera display' },
    { id: 'film', name: 'Film strip' },
    { id: 'floating', name: 'Floating print', colors: 'print', pro: true, pad: 0.1 },
    { id: 'stacked', name: 'Stacked prints', colors: 'print', pro: true, pad: 0.04 },
    { id: 'monitor', name: 'Monitor', colors: 'device', pro: true },
    { id: 'billboard', name: 'Billboard', pro: true },
    { id: 'magazine', name: 'Magazine cover', pro: true },
    { id: 'tv', name: 'Vintage TV', pro: true }
  ];
  const SIZE_FACTOR = { instantmini: 0.78, floating: 0.88, stacked: 0.98 };
  const COLOR_SETS = {
    print: [['white', '#ffffff', 'White'], ['cream', '#f3ead6', 'Cream'], ['black', '#161616', 'Black']],
    gallery: [['wood', '#7a4a22', 'Wood'], ['black', '#1a1a1a', 'Black'], ['white', '#f2f0eb', 'White']],
    device: [['spacegray', '#2c2c2f', 'Space gray'], ['silver', '#d9d9de', 'Silver'], ['gold', '#e6d2ab', 'Gold']]
  };
  const frameById = id => FRAMES.find(f => f.id === id) || FRAMES[0];
  const bgById = id => BGS.find(b => b.id === id) || BGS[0];
  const colorKeyFor = fr => fr.colors === 'print' ? 'colorPrint' : fr.colors === 'gallery' ? 'colorGallery' : fr.colors === 'device' ? 'colorDevice' : null;
  const colorHex = (set, id) => (COLOR_SETS[set].find(c => c[0] === id) || COLOR_SETS[set][0])[1];

  const DEF = {
    frame: 'instant', colorPrint: 'white', colorGallery: 'wood', colorDevice: 'spacegray', shadow: 55, frameScale: 100, mat: 10, filmCount: 3,
    zoom: 100, panX: 0, panY: 0, rotate: -4, flip: false,
    bg: 'wall', bgColor: '#f4efe6',
    caption: 'golden hour, 7:42 pm', captionFont: 'casual', dateStamp: true, camStatus: 'RAW 1/250 f/2.8 ISO 400', magTitle: 'WANDER',
    size: 'square'
  };
  const S = Studio.restore(STATE_KEY, DEF);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // Restored state and presets are untrusted (localStorage): enforce types, enums, ranges, lengths.
  const RANGES = { shadow: [0, 100], frameScale: [50, 130], mat: [0, 22], zoom: [100, 300], rotate: [-20, 20], panX: [-1, 1], panY: [-1, 1], filmCount: [1, 3] };
  function sanitizeState(o) {
    Object.keys(DEF).forEach(k => { if (typeof o[k] !== typeof DEF[k]) o[k] = DEF[k]; });
    Object.keys(RANGES).forEach(k => { o[k] = Number.isFinite(o[k]) ? clamp(o[k], RANGES[k][0], RANGES[k][1]) : DEF[k]; });
    o.filmCount = Math.round(o.filmCount);
    if (!FRAMES.some(f => f.id === o.frame)) o.frame = DEF.frame;
    if (!BGS.some(b => b.id === o.bg)) o.bg = DEF.bg;
    if (!own(SIZES, o.size)) o.size = DEF.size;
    if (!own(FONTS, o.captionFont)) o.captionFont = DEF.captionFont;
    if (!/^#[0-9a-f]{6}$/i.test(o.bgColor)) o.bgColor = DEF.bgColor;
    [['colorPrint', 'print'], ['colorGallery', 'gallery'], ['colorDevice', 'device']].forEach(([k, set]) => { if (!COLOR_SETS[set].some(c => c[0] === o[k])) o[k] = DEF[k]; });
    ['caption', 'camStatus', 'magTitle'].forEach(k => { o[k] = o[k].slice(0, 200); });
    return o;
  }
  sanitizeState(S);
  if (frameById(S.frame).pro && !isPro()) S.frame = 'instant';

  // ---------- images ----------
  let sampleImg = null, items = [], current = 0;
  const preview = $('preview'), pctx = preview.getContext('2d');
  const stage = $('stage'), drop = $('drop');
  function currentItem() { return items.length ? items[current] : { img: sampleImg, name: 'sample' }; }
  function imgAt(offset) { if (items.length < 2) return currentItem().img; return items[(current + offset) % items.length].img; }

  function makeSample() {
    const w = 1400, h = 1050, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    let g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b2d5e'); g.addColorStop(.42, '#b85a7c'); g.addColorStop(.68, '#ffb36b'); g.addColorStop(1, '#ffd9a0'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    g = x.createRadialGradient(w * 0.62, h * 0.6, 0, w * 0.62, h * 0.6, w * 0.42); g.addColorStop(0, 'rgba(255,235,180,.95)'); g.addColorStop(.3, 'rgba(255,190,120,.5)'); g.addColorStop(1, 'rgba(255,160,90,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff3cf'; x.beginPath(); x.arc(w * 0.62, h * 0.6, w * 0.07, 0, Math.PI * 2); x.fill();
    // soft clouds
    x.fillStyle = 'rgba(255,255,255,.18)'; [[0.18, 0.22, 0.16], [0.42, 0.17, 0.11], [0.8, 0.26, 0.14]].forEach(([cx, cy, r]) => { x.beginPath(); x.ellipse(w * cx, h * cy, w * r, h * 0.035, 0, 0, Math.PI * 2); x.fill(); });
    // mountain ridges, far to near
    const layers = [[0.56, '#6a4472', 0.12, 1.3], [0.66, '#4b3058', 0.1, 1.9], [0.77, '#2f1f3e', 0.08, 2.6], [0.88, '#1b1226', 0.05, 3.4]];
    layers.forEach(([base, col, amp, f], li) => {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, h);
      for (let i = 0; i <= 60; i++) { const t = i / 60; const y = h * base - h * amp * (0.5 + 0.5 * Math.sin(t * 7 * f + li) * Math.cos(t * 3.7 + li * 2)) - h * 0.015 * Math.sin(t * 29 + li * 5); x.lineTo(t * w, y); }
      x.lineTo(w, h); x.closePath(); x.fill();
    });
    // birds
    x.strokeStyle = 'rgba(35,18,40,.75)'; x.lineWidth = 3; x.lineCap = 'round';
    [[0.28, 0.3], [0.33, 0.27], [0.37, 0.32]].forEach(([bx, by]) => { x.beginPath(); x.moveTo(w * bx - 16, h * by); x.quadraticCurveTo(w * bx - 8, h * by - 10, w * bx, h * by); x.quadraticCurveTo(w * bx + 8, h * by - 10, w * bx + 16, h * by); x.stroke(); });
    return c;
  }

  // ---------- geometry helpers ----------
  function rr(ctx, x, y, w, h, r) {
    const R = Array.isArray(r) ? r : [r, r, r, r]; const m = Math.min(w, h) / 2;
    const [tl, tr, br, bl] = R.map(v => Math.max(0, Math.min(v, m)));
    ctx.beginPath(); ctx.moveTo(x + tl, y); ctx.lineTo(x + w - tr, y); if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br); if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h); if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl); if (tl) ctx.arcTo(x, y, x + tl, y, tl); ctx.closePath();
  }
  function glass(ctx, x, y, w, h, r) {
    ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
    const g = ctx.createLinearGradient(x, y, x + w, y + h * 0.8); g.addColorStop(0, 'rgba(255,255,255,.15)'); g.addColorStop(.45, 'rgba(255,255,255,.03)'); g.addColorStop(.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
  }
  function deviceColors() {
    const id = S.colorDevice;
    if (id === 'silver') return { body: '#d8d8dd', edge: '#f4f4f6', dark: '#9d9da3' };
    if (id === 'gold') return { body: '#e3cfa6', edge: '#f6ead0', dark: '#b09468' };
    return { body: '#2d2d30', edge: '#4a4a4f', dark: '#141416' };
  }
  function monthYear() { return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }

  // ---------- photo placement (zoom / pan / flip) ----------
  let capture = false, lastPhoto = null, layerDpr = 1;
  function photoSource(img, w, h) {
    const z = S.zoom / 100; const cv = Studio.cover(img.width, img.height, w, h);
    const sw = cv.sw / z, sh = cv.sh / z; const slackX = Math.max(0, img.width - sw), slackY = Math.max(0, img.height - sh);
    const px = S.flip ? S.panX : -S.panX;
    const sx = clamp(slackX / 2 + px * slackX / 2, 0, slackX), sy = clamp(slackY / 2 - S.panY * slackY / 2, 0, slackY);
    return { sx, sy, sw, sh, slackX, slackY };
  }
  function capturePhoto(ctx, w, h, p) {
    if (!capture || lastPhoto) return;
    const m = ctx.getTransform(); const sc = Math.hypot(m.a, m.b) / layerDpr;
    lastPhoto = { w: w * sc, h: h * sc, sw: p.sw, sh: p.sh, slackX: p.slackX, slackY: p.slackY };
  }
  function drawPhoto(ctx, img, x, y, w, h, r, opts) {
    const p = photoSource(img, w, h); capturePhoto(ctx, w, h, p);
    ctx.save();
    if (r > 0) { rr(ctx, x, y, w, h, r); ctx.clip(); } else { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }
    if (S.flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.translate(-x, -y); }
    ctx.drawImage(img, p.sx, p.sy, p.sw, p.sh, x, y, w, h);
    ctx.restore();
    if (S.dateStamp && !(opts && opts.noStamp)) drawDateStamp(ctx, x, y, w, h);
  }
  function drawDateStamp(ctx, x, y, w, h) {
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const t = `'${String(d.getFullYear()).slice(2)} ${pad(d.getMonth() + 1)} ${pad(d.getDate())}`;
    const fs = Math.max(9, Math.min(w, h) * 0.05), tx = x + w - fs * 0.8, ty = y + h - fs * 0.7;
    ctx.save(); ctx.font = `700 ${fs}px ${FONTS.mono}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(255,110,0,.9)'; ctx.shadowBlur = fs * 0.5; ctx.fillStyle = '#ff8c1a'; ctx.fillText(t, tx, ty);
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,222,150,.92)'; ctx.fillText(t, tx, ty);
    ctx.restore();
  }
  function drawCaption(ctx, cx, cy, maxW, fs, color, rot) {
    const t = String(S.caption || '').trim(); if (!t) return;
    const fam = FONTS[S.captionFont] || FONTS.casual, wt = S.captionFont === 'mono' ? 500 : 400;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((rot || 0) * Math.PI / 180);
    ctx.font = `${wt} ${fs}px ${fam}`; const tw = ctx.measureText(t).width; if (tw > maxW) { fs = fs * maxW / tw; ctx.font = `${wt} ${fs}px ${fam}`; }
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, 0, 0); ctx.restore();
  }

  // ---------- frames (drawn in a w×h box, origin top-left) ----------
  const DRAW = {};
  function drawPrint(ctx, w, h, img, o) {
    const colId = S.colorPrint, col = colorHex('print', colId), dark = colId === 'black';
    const side = o.mini ? w * 0.07 : w * 0.055, top = o.mini ? w * 0.07 : w * 0.065, pw = w - 2 * side, ph = pw;
    ctx.fillStyle = col; rr(ctx, 0, 0, w, h, w * 0.012); ctx.fill();
    const g = ctx.createLinearGradient(0, 0, w * 0.6, h); g.addColorStop(0, dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(0,0,0,.06)');
    ctx.fillStyle = g; rr(ctx, 0, 0, w, h, w * 0.012); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(side, top, pw, ph);
    drawPhoto(ctx, img, side, top, pw, ph, 0, { noStamp: !!o.noStamp });
    ctx.save(); ctx.beginPath(); ctx.rect(side, top, pw, ph); ctx.clip();
    const ig = ctx.createLinearGradient(side, top, side, top + ph * 0.1); ig.addColorStop(0, 'rgba(0,0,0,.28)'); ig.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = ig; ctx.fillRect(side, top, pw, ph * 0.1);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = Math.max(1, w * 0.0025); ctx.strokeRect(side, top, pw, ph);
    if (o.caption !== false) { const bh = h - top - ph; drawCaption(ctx, w / 2, top + ph + bh * 0.52, pw * 0.92, bh * 0.4, dark ? 'rgba(255,255,255,.88)' : '#2b2b2b', -2); }
  }
  DRAW.instant = (ctx, w, h, img) => drawPrint(ctx, w, h, img, {});
  DRAW.instantmini = (ctx, w, h, img) => drawPrint(ctx, w, h, img, { mini: true });

  DRAW.phone = function (ctx, w, h, img) {
    const c = deviceColors(), R = w * 0.17, bw = w * 0.012, bx = bw, bwid = w - 2 * bw;
    ctx.fillStyle = c.dark;
    rr(ctx, bx - bw, h * 0.17, bw * 1.2, h * 0.045, bw / 2); ctx.fill(); rr(ctx, bx - bw, h * 0.25, bw * 1.2, h * 0.085, bw / 2); ctx.fill();
    rr(ctx, bx - bw, h * 0.355, bw * 1.2, h * 0.085, bw / 2); ctx.fill(); rr(ctx, bx + bwid - bw * 0.2, h * 0.29, bw * 1.2, h * 0.13, bw / 2); ctx.fill();
    ctx.fillStyle = c.body; rr(ctx, bx, 0, bwid, h, R); ctx.fill();
    ctx.strokeStyle = c.edge; ctx.lineWidth = w * 0.006; rr(ctx, bx + w * 0.004, w * 0.004, bwid - w * 0.008, h - w * 0.008, R - w * 0.004); ctx.stroke();
    const b = w * 0.035; ctx.fillStyle = '#050506'; rr(ctx, bx + b, b, bwid - 2 * b, h - 2 * b, R - b); ctx.fill();
    const sb = w * 0.058, sr = R - sb, sx = bx + sb, sy = sb, sw = bwid - 2 * sb, sh = h - 2 * sb;
    drawPhoto(ctx, img, sx, sy, sw, sh, sr);
    const iw = sw * 0.32, ih = sw * 0.09; ctx.fillStyle = '#000'; rr(ctx, sx + (sw - iw) / 2, sy + sw * 0.045, iw, ih, ih / 2); ctx.fill();
    glass(ctx, sx, sy, sw, sh, sr);
  };

  DRAW.tablet = function (ctx, w, h, img) {
    const c = deviceColors(), R = w * 0.055;
    ctx.fillStyle = c.body; rr(ctx, 0, 0, w, h, R); ctx.fill();
    ctx.strokeStyle = c.edge; ctx.lineWidth = w * 0.004; rr(ctx, w * 0.003, w * 0.003, w - w * 0.006, h - w * 0.006, R); ctx.stroke();
    const b = w * 0.012; ctx.fillStyle = '#050506'; rr(ctx, b, b, w - 2 * b, h - 2 * b, R - b); ctx.fill();
    const sb = w * 0.05, sr = w * 0.018; drawPhoto(ctx, img, sb, sb, w - 2 * sb, h - 2 * sb, sr);
    ctx.fillStyle = '#1a1b20'; ctx.beginPath(); ctx.arc(w / 2, sb / 2, w * 0.006, 0, Math.PI * 2); ctx.fill();
    glass(ctx, sb, sb, w - 2 * sb, h - 2 * sb, sr);
  };

  DRAW.laptop = function (ctx, w, h, img) {
    const c = deviceColors(), lidW = w * 0.84, lidX = (w - lidW) / 2, baseH = w * 0.034, lidH = h - baseH;
    ctx.fillStyle = c.body; rr(ctx, lidX, 0, lidW, lidH, [lidW * 0.03, lidW * 0.03, 0, 0]); ctx.fill();
    const b = lidW * 0.016; ctx.fillStyle = '#060607'; rr(ctx, lidX + b, b, lidW - 2 * b, lidH - b, [lidW * 0.02, lidW * 0.02, 0, 0]); ctx.fill();
    const sb = lidW * 0.028, sx = lidX + sb, sy = sb, sw = lidW - 2 * sb, sh = lidH - sb - lidW * 0.012;
    drawPhoto(ctx, img, sx, sy, sw, sh, lidW * 0.008);
    const nw = sw * 0.14, nh = sb * 1.3; ctx.fillStyle = '#060607'; rr(ctx, sx + (sw - nw) / 2, sy, nw, nh, [0, 0, nh * 0.5, nh * 0.5]); ctx.fill();
    ctx.fillStyle = '#1e2026'; ctx.beginPath(); ctx.arc(sx + sw / 2, sy + nh * 0.5, nh * 0.18, 0, Math.PI * 2); ctx.fill();
    glass(ctx, sx, sy, sw, sh, 0);
    const by = lidH, g = ctx.createLinearGradient(0, by, 0, by + baseH); g.addColorStop(0, c.edge); g.addColorStop(.35, c.body); g.addColorStop(1, c.dark);
    ctx.fillStyle = g; rr(ctx, 0, by, w, baseH, [baseH * 0.25, baseH * 0.25, baseH * 0.8, baseH * 0.8]); ctx.fill();
    const cw = w * 0.11; ctx.fillStyle = c.dark; rr(ctx, (w - cw) / 2, by, cw, baseH * 0.35, [0, 0, baseH * 0.3, baseH * 0.3]); ctx.fill();
  };

  function grain(ctx, x, y, w, h, horiz) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const g = horiz ? ctx.createLinearGradient(x, y, x, y + h) : ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, '#8d5a2b'); g.addColorStop(.5, '#6a4120'); g.addColorStop(1, '#8a5629'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(40,20,5,.28)'; ctx.lineWidth = Math.max(1, (horiz ? h : w) * 0.02);
    const n = 9, L = horiz ? w : h, T = horiz ? h : w;
    for (let i = 0; i < n; i++) {
      const t = T * (i + 0.5) / n; ctx.beginPath();
      for (let j = 0; j <= 24; j++) { const a = L * j / 24, off = Math.sin(j * 1.3 + i * 2.1) * T * 0.05; const px = horiz ? x + a : x + t + off, py = horiz ? y + t + off : y + a; j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
    ctx.restore();
  }
  DRAW.gallery = function (ctx, w, h, img) {
    const k = Math.min(w, h), m = k * 0.055, mat = k * (S.mat / 100), col = S.colorGallery;
    if (col === 'wood') { ctx.fillStyle = '#6e4521'; ctx.fillRect(0, 0, w, h); grain(ctx, 0, 0, w, m, true); grain(ctx, 0, h - m, w, m, true); grain(ctx, 0, 0, m, h, false); grain(ctx, w - m, 0, m, h, false); }
    else { ctx.fillStyle = col === 'black' ? '#141414' : '#eeece6'; ctx.fillRect(0, 0, w, h); }
    ctx.strokeStyle = col === 'white' ? 'rgba(0,0,0,.12)' : 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, k * 0.0015);
    [[0, 0, m, m], [w, 0, w - m, m], [w, h, w - m, h - m], [0, h, m, h - m]].forEach(p => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.stroke(); });
    ctx.strokeStyle = col === 'black' ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.45)'; ctx.lineWidth = m * 0.14; ctx.strokeRect(m * 0.1, m * 0.1, w - m * 0.2, h - m * 0.2);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = m * 0.1; ctx.strokeRect(m * 0.75, m * 0.75, w - m * 1.5, h - m * 1.5);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(m, m, w - 2 * m, h - 2 * m);
    const mx = m * 1.06; ctx.fillStyle = '#f6f3ec'; ctx.fillRect(mx, mx, w - 2 * mx, h - 2 * mx);
    const px = m + mat, py = m + mat, pw = w - 2 * px, ph = h - 2 * py;
    if (mat > 0) { const bv = Math.max(2, k * 0.008); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(px - bv * 1.5, py - bv * 1.5, pw + bv * 3, ph + bv * 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(px - bv, py - bv, pw + bv * 2, ph + bv * 2); }
    drawPhoto(ctx, img, px, py, pw, ph, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    const ig = ctx.createLinearGradient(px, py, px, py + ph * 0.08); ig.addColorStop(0, 'rgba(0,0,0,.25)'); ig.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = ig; ctx.fillRect(px, py, pw, ph * 0.08);
    ctx.restore();
    glass(ctx, m, m, w - 2 * m, h - 2 * m, 0);
  };

  function dial(ctx, cx, cy, r) {
    ctx.fillStyle = '#2e2e32'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = r * 0.08;
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
  }
  DRAW.camera = function (ctx, w, h, img) {
    const k = w;
    ctx.fillStyle = '#1c1c1e'; rr(ctx, w * 0.33, 0, w * 0.34, h * 0.2, [k * 0.035, k * 0.035, 0, 0]); ctx.fill();
    ctx.fillStyle = '#0b0b0c'; rr(ctx, w * 0.42, h * 0.045, w * 0.16, h * 0.1, k * 0.012); ctx.fill();
    ctx.fillStyle = '#1f2026'; rr(ctx, w * 0.445, h * 0.06, w * 0.11, h * 0.07, k * 0.01); ctx.fill();
    ctx.fillStyle = '#3a3a3e'; ctx.fillRect(w * 0.46, 0, w * 0.08, h * 0.03);
    const by = h * 0.14, g = ctx.createLinearGradient(0, by, 0, h); g.addColorStop(0, '#2c2c2f'); g.addColorStop(1, '#19191b');
    ctx.fillStyle = g; rr(ctx, 0, by, w, h - by, [k * 0.035, k * 0.035, k * 0.05, k * 0.05]); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, 0, by, w * 0.045, h - by, [k * 0.035, 0, 0, k * 0.05]); ctx.fill();
    dial(ctx, w * 0.12, by, w * 0.065); dial(ctx, w * 0.9, by, w * 0.05);
    const lx = w * 0.075, ly = h * 0.24, lw = w * 0.6, lh = lw / 1.5;
    ctx.fillStyle = '#050506'; rr(ctx, lx - k * 0.014, ly - k * 0.014, lw + k * 0.028, lh + k * 0.028, k * 0.012); ctx.fill();
    drawPhoto(ctx, img, lx, ly, lw, lh, k * 0.004, { noStamp: true });
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(lx, ly + lh * 0.87, lw, lh * 0.13); ctx.fillRect(lx, ly, lw, lh * 0.1);
    ctx.fillStyle = '#fff'; ctx.font = `600 ${lh * 0.06}px ${FONTS.mono}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(String(S.camStatus || ''), lx + lw * 0.03, ly + lh * 0.935);
    ctx.fillText('AF-C  ⦿  35mm', lx + lw * 0.03, ly + lh * 0.05); ctx.textAlign = 'right'; ctx.fillText('[ 128 ]  ▮▮▮', lx + lw * 0.97, ly + lh * 0.05);
    ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(lx + lw * 0.955, ly + lh * 0.935, lh * 0.025, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${lh * 0.055}px ${FONTS.mono}`; ctx.fillText('REC', lx + lw * 0.925, ly + lh * 0.935);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1, lh * 0.006);
    const fx = lx + lw * 0.42, fy = ly + lh * 0.4, fw = lw * 0.16, fh = lh * 0.2, cl = fw * 0.2;
    [[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]].forEach(([cx, cy, dx, dy]) => { ctx.beginPath(); ctx.moveTo(cx + dx * cl, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * cl); ctx.stroke(); });
    const cx = w * 0.84, cy = h * 0.6;
    ctx.fillStyle = '#3a3a3f'; ctx.beginPath(); ctx.arc(cx, cy, w * 0.085, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1d'; ctx.beginPath(); ctx.arc(cx, cy, w * 0.038, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${w * 0.02}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SET', cx, cy);
    const btn = (x, y, t) => { ctx.fillStyle = '#39393d'; rr(ctx, x - w * 0.045, y - w * 0.018, w * 0.09, w * 0.036, w * 0.018); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `700 ${w * 0.017}px ${FONT}`; ctx.fillText(t, x, y); };
    btn(w * 0.77, h * 0.32, 'MENU'); btn(w * 0.91, h * 0.32, 'INFO'); btn(w * 0.77, h * 0.86, 'Q'); btn(w * 0.91, h * 0.86, '▶'); btn(w * 0.4, h * 0.93, 'DELETE');
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = `800 ${w * 0.03}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('FL-1', w * 0.73, h * 0.2);
  };

  function filmVertical() { const [W, H] = SIZES[S.size] || SIZES.square; return H > W; }
  DRAW.film = function (ctx, w, h, img) {
    const vert = filmVertical(), n = S.filmCount, L = vert ? h : w, T = vert ? w : h;
    const text = (s, a, t) => { ctx.save(); if (vert) { ctx.translate(t, a); ctx.rotate(Math.PI / 2); ctx.fillText(s, 0, 0); } else ctx.fillText(s, a, t); ctx.restore(); };
    ctx.fillStyle = '#1c1a18'; ctx.fillRect(0, 0, w, h);
    const g = vert ? ctx.createLinearGradient(0, 0, w, 0) : ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(90,60,30,.25)'); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,60,30,.25)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const fT = T * 0.62, fOff = (T - fT) / 2, margin = T * 0.1, gap = T * 0.07, fL = (L - 2 * margin - (n - 1) * gap) / n;
    for (let i = 0; i < n; i++) {
      const a = margin + i * (fL + gap), im = imgAt(i);
      if (vert) drawPhoto(ctx, im, fOff, a, fT, fL, 0); else drawPhoto(ctx, im, a, fOff, fL, fT, 0);
    }
    const sT = T * 0.075, sL = sT * 1.3, pitch = sL * 1.9;
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    for (let a = pitch * 0.4; a < L - sL; a += pitch) [T * 0.045, T - T * 0.045 - sT].forEach(t => { if (vert) rr(ctx, t, a, sT, sL, sT * 0.2); else rr(ctx, a, t, sL, sT, sT * 0.2); ctx.fill(); });
    ctx.restore();
    ctx.fillStyle = '#e4a93a'; ctx.font = `700 ${T * 0.032}px ${FONTS.mono}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (let i = 0; i < n; i++) {
      const a = margin + i * (fL + gap), num = String(12 + i);
      text(num + 'A', a, T * 0.155); text(num, a, T - T * 0.155);
      text('FRAME LAB 400  ▸', a + fL * 0.4, T * 0.155); text('▸  ▸', a + fL * 0.45, T - T * 0.155);
    }
  };

  function tape(ctx, x, y, deg, k) {
    const tw = k * 0.26, th = k * 0.07; ctx.save(); ctx.translate(x, y); ctx.rotate(deg * Math.PI / 180);
    ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = k * 0.01; ctx.shadowOffsetY = k * 0.004;
    ctx.fillStyle = 'rgba(236,222,190,.74)'; ctx.beginPath();
    for (let i = 0; i <= 6; i++) ctx.lineTo(-tw / 2 - (i % 2) * th * 0.12, -th / 2 + th * i / 6);
    for (let i = 6; i >= 0; i--) ctx.lineTo(tw / 2 + (i % 2) * th * 0.12, -th / 2 + th * i / 6);
    ctx.closePath(); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(-tw / 2, -th / 2, tw, th * 0.28);
    ctx.restore();
  }
  DRAW.floating = function (ctx, w, h, img) {
    const b = Math.min(w, h) * 0.05, col = colorHex('print', S.colorPrint), dark = S.colorPrint === 'black';
    ctx.fillStyle = col; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, dark ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(0,0,0,.05)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    drawPhoto(ctx, img, b, b, w - 2 * b, h - 2 * b, 0);
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = Math.max(1, b * 0.04); ctx.strokeRect(b, b, w - 2 * b, h - 2 * b);
    tape(ctx, b * 0.7, b * 0.7, -42, w); tape(ctx, w - b * 0.7, b * 0.7, 42, w);
  };

  DRAW.stacked = function (ctx, w, h, img) {
    const pw = w * 0.7, ph = pw / 0.82, cx = w / 2, cy = h / 2;
    [[-w * 0.1, -h * 0.03, -10, 1], [w * 0.09, -h * 0.015, 7, 2], [0, h * 0.025, 0, 0]].forEach(([dx, dy, deg, off], i) => {
      ctx.save(); ctx.translate(cx + dx, cy + dy); ctx.rotate(deg * Math.PI / 180); ctx.translate(-pw / 2, -ph / 2);
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = w * 0.03 * layerDpr; ctx.shadowOffsetY = w * 0.012 * layerDpr;
      ctx.fillStyle = colorHex('print', S.colorPrint); rr(ctx, 0, 0, pw, ph, pw * 0.012); ctx.fill(); ctx.shadowColor = 'transparent';
      drawPrint(ctx, pw, ph, imgAt(off), { caption: i === 2, noStamp: i !== 2 });
      ctx.restore();
    });
  };

  DRAW.monitor = function (ctx, w, h, img) {
    const c = deviceColors(), mw = w * 0.84, mx = (w - mw) / 2, deskH = h * 0.1, baseH = h * 0.03, neckH = h * 0.1, mh = h - deskH - baseH - neckH, R = mw * 0.012;
    const dg = ctx.createLinearGradient(0, h - deskH, 0, h); dg.addColorStop(0, '#5a4030'); dg.addColorStop(1, '#2d1d12'); ctx.fillStyle = dg; rr(ctx, 0, h - deskH, w, deskH, [h * 0.01, h * 0.01, 0, 0]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(0, h - deskH, w, h * 0.004);
    const rg = ctx.createLinearGradient(0, h - deskH, 0, h - deskH * 0.3); rg.addColorStop(0, 'rgba(255,255,255,.14)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = rg; ctx.fillRect(mx, h - deskH, mw, deskH);
    const by = h - deskH - baseH;
    ctx.fillStyle = c.dark; rr(ctx, w / 2 - mw * 0.2, by, mw * 0.4, baseH, [baseH * 0.5, baseH * 0.5, baseH * 0.3, baseH * 0.3]); ctx.fill();
    ctx.fillStyle = c.body; ctx.fillRect(w / 2 - mw * 0.05, by - neckH, mw * 0.1, neckH + baseH * 0.3);
    ctx.fillStyle = c.body; rr(ctx, mx, 0, mw, mh, R); ctx.fill();
    const chin = mh * 0.07, b = mw * 0.01; ctx.fillStyle = '#060607'; rr(ctx, mx + b, b, mw - 2 * b, mh - b - chin, R * 0.6); ctx.fill();
    const sb = mw * 0.018; drawPhoto(ctx, img, mx + sb, sb, mw - 2 * sb, mh - chin - sb * 1.3, mw * 0.004);
    glass(ctx, mx + sb, sb, mw - 2 * sb, mh - chin - sb * 1.3, 0);
    ctx.fillStyle = c.dark; ctx.beginPath(); ctx.arc(w / 2, mh - chin / 2, chin * 0.16, 0, Math.PI * 2); ctx.fill();
  };

  DRAW.billboard = function (ctx, w, h, img) {
    const bw = w * 0.92, bx = (w - bw) / 2, bh = bw * 0.5, by = h * 0.05, border = bw * 0.016, legW = bw * 0.035, legY = by + bh;
    const lg = ctx.createLinearGradient(0, legY, 0, h); lg.addColorStop(0, '#4b4b50'); lg.addColorStop(1, '#232326'); ctx.fillStyle = lg;
    ctx.fillRect(bx + bw * 0.2 - legW / 2, legY, legW, h - legY); ctx.fillRect(bx + bw * 0.8 - legW / 2, legY, legW, h - legY);
    ctx.fillStyle = '#3a3a3f'; ctx.fillRect(bx + bw * 0.05, legY - bw * 0.004, bw * 0.9, bw * 0.014);
    ctx.fillStyle = '#4a4a4f'; ctx.fillRect(bx + bw * 0.1, by * 0.3, bw * 0.8, by * 0.7);
    [0.25, 0.5, 0.75].forEach(t => { ctx.fillStyle = '#5d5d63'; rr(ctx, bx + bw * t - bw * 0.03, 0, bw * 0.06, by * 1.2, by * 0.3); ctx.fill(); });
    // perspective-skewed board: the flat board is pre-rendered, then drawn as vertical slices with their own transform
    const base = ctx.getTransform(), N = 120, pw = bw - 2 * border, ph = bh - 2 * border, skew = 0.16, cy = by + bh / 2;
    const board = document.createElement('canvas'); board.width = Math.ceil(bw * layerDpr); board.height = Math.ceil(bh * layerDpr);
    const bc = board.getContext('2d'); bc.scale(layerDpr, layerDpr);
    bc.fillStyle = '#f4f4f2'; bc.fillRect(0, 0, bw, bh);
    drawPhoto(bc, img, border, border, pw, ph, 0, { noStamp: true });
    const sliceW = bw / N;
    for (let i = 0; i < N; i++) {
      const s0 = 1 - skew * (i + 0.5) / N, sx = i * sliceW * layerDpr, sw = Math.min(board.width - sx, (sliceW + 1) * layerDpr);
      ctx.setTransform(base.translate(bx + i * sliceW, cy).scale(1, s0));
      ctx.drawImage(board, sx, 0, sw, board.height, 0, -bh / 2, sw / layerDpr, bh);
    }
    ctx.setTransform(base);
    // one continuous lighting gradient over the trapezoid (no per-slice overlaps)
    ctx.save(); ctx.beginPath(); ctx.moveTo(bx, cy - bh / 2); ctx.lineTo(bx + bw, cy - bh / 2 * (1 - skew)); ctx.lineTo(bx + bw, cy + bh / 2 * (1 - skew)); ctx.lineTo(bx, cy + bh / 2); ctx.closePath(); ctx.clip();
    const sh = ctx.createLinearGradient(bx, 0, bx + bw, 0); sh.addColorStop(0, 'rgba(0,0,0,.03)'); sh.addColorStop(1, 'rgba(0,0,0,.3)'); ctx.fillStyle = sh; ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
  };

  DRAW.magazine = function (ctx, w, h, img) {
    drawPhoto(ctx, img, 0, 0, w, h, 0, { noStamp: true });
    let g = ctx.createLinearGradient(0, 0, 0, h * 0.35); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.35);
    g = ctx.createLinearGradient(0, h * 0.55, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.62)'); ctx.fillStyle = g; ctx.fillRect(0, h * 0.55, w, h * 0.45);
    const title = String(S.magTitle || 'FRAME').toUpperCase(); let fs = w * 0.2; ctx.font = `900 ${fs}px ${FONT}`;
    const maxW = w * 0.9, tw = ctx.measureText(title).width; if (tw > maxW) { fs *= maxW / tw; ctx.font = `900 ${fs}px ${FONT}`; }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = fs * 0.1 * layerDpr;
    ctx.fillText(title, w / 2, h * 0.06 + fs * 0.78); ctx.shadowColor = 'transparent';
    ctx.font = `600 ${w * 0.025}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillText(monthYear().toUpperCase() + '  ·  ISSUE 26', w * 0.05, h * 0.045); ctx.textAlign = 'right'; ctx.fillText('$9.99', w * 0.95, h * 0.045);
    const cap = String(S.caption || '').trim() || 'The art of the frame', fam = FONTS[S.captionFont] || FONTS.casual, cfs = w * 0.085;
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `${S.captionFont === 'casual' ? 400 : 700} ${cfs}px ${fam}`;
    const lines = Studio.wrapText(ctx, cap, w * 0.8).slice(0, 3); let y = h * 0.76;
    lines.forEach(l => { ctx.fillText(l, w * 0.06, y); y += cfs * 1.08; });
    ctx.font = `500 ${w * 0.03}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('PLUS  24 pages of prints, frames & light', w * 0.06, y + w * 0.015);
    ctx.fillStyle = '#f97316'; rr(ctx, w * 0.06, h * 0.64, w * 0.3, w * 0.055, w * 0.008); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 ${w * 0.028}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText('SPECIAL EDITION', w * 0.078, h * 0.64 + w * 0.0275);
    const bx = w * 0.76, bwid = w * 0.19, byy = h * 0.905, bh = w * 0.085; ctx.fillStyle = '#fff'; ctx.fillRect(bx, byy, bwid, bh);
    ctx.fillStyle = '#111'; let x = bx + bwid * 0.06; const bars = [1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 1, 1, 3, 1, 2, 1, 2, 1, 1], unit = bwid * 0.88 / 56;
    bars.forEach((n, i) => { if (i % 2 === 0) ctx.fillRect(x, byy + bh * 0.1, unit * n, bh * 0.62); x += unit * n + unit * 0.4; });
    ctx.font = `500 ${bh * 0.2}px ${FONTS.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('7 24 26 10 26 9', bx + bwid / 2, byy + bh * 0.92);
    g = ctx.createLinearGradient(0, 0, w * 0.04, 0); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w * 0.04, h);
  };

  DRAW.tv = function (ctx, w, h, img) {
    const k = w, feetH = h * 0.05, bodyH = h - feetH;
    ctx.fillStyle = '#2b1d12'; [[0.12, 0.2], [0.8, 0.88]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(w * a, bodyH); ctx.lineTo(w * b, bodyH); ctx.lineTo(w * (b - 0.015), h); ctx.lineTo(w * (a + 0.015), h); ctx.closePath(); ctx.fill(); });
    ctx.save(); rr(ctx, 0, 0, w, bodyH, k * 0.045); ctx.clip(); grain(ctx, 0, 0, w, bodyH, true);
    const cg = ctx.createLinearGradient(0, 0, w, bodyH); cg.addColorStop(0, 'rgba(255,255,255,.12)'); cg.addColorStop(1, 'rgba(0,0,0,.25)'); ctx.fillStyle = cg; ctx.fillRect(0, 0, w, bodyH); ctx.restore();
    const px = k * 0.045, py = k * 0.045, pw = w - 2 * px, ph = bodyH - 2 * py;
    ctx.fillStyle = '#d9cfb8'; rr(ctx, px, py, pw, ph, k * 0.025); ctx.fill();
    let g = ctx.createLinearGradient(px, py, px, py + ph); g.addColorStop(0, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(0,0,0,.12)'); ctx.fillStyle = g; rr(ctx, px, py, pw, ph, k * 0.025); ctx.fill();
    const sx = px + pw * 0.035, sy = py + ph * 0.05, sw = pw * 0.7, sh = ph * 0.9, sr = Math.min(sw, sh) * 0.16;
    ctx.fillStyle = '#1b1b1d'; rr(ctx, sx - k * 0.012, sy - k * 0.012, sw + k * 0.024, sh + k * 0.024, sr + k * 0.012); ctx.fill();
    drawPhoto(ctx, img, sx, sy, sw, sh, sr, { noStamp: true });
    ctx.save(); rr(ctx, sx, sy, sw, sh, sr); ctx.clip();
    const vg = ctx.createRadialGradient(sx + sw / 2, sy + sh / 2, Math.min(sw, sh) * 0.3, sx + sw / 2, sy + sh / 2, Math.max(sw, sh) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = vg; ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = 'rgba(0,0,0,.14)'; const step = Math.max(3, sh * 0.006); for (let y = sy; y < sy + sh; y += step) ctx.fillRect(sx, y, sw, step * 0.4);
    const hx = sx + sw * 0.3, hy = sy + sh * 0.16; ctx.save(); ctx.translate(hx, hy); ctx.scale(1, 0.55); ctx.translate(-hx, -hy);
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, sw * 0.55); hg.addColorStop(0, 'rgba(255,255,255,.3)'); hg.addColorStop(.5, 'rgba(255,255,255,.07)'); hg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hg; ctx.fillRect(sx, sy - sh, sw, sh * 3); ctx.restore();
    const h2x = sx + sw * 0.8, h2y = sy + sh * 0.9; const hg2 = ctx.createRadialGradient(h2x, h2y, 0, h2x, h2y, sw * 0.3); hg2.addColorStop(0, 'rgba(255,255,255,.12)'); hg2.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hg2; ctx.fillRect(sx, sy, sw, sh);
    ctx.restore();
    if (S.dateStamp) drawDateStamp(ctx, sx + sw * 0.08, sy + sh * 0.08, sw * 0.84, sh * 0.84);
    const cx = px + pw * 0.87; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, k * 0.003);
    for (let y = py + ph * 0.08; y < py + ph * 0.42; y += k * 0.014) { ctx.beginPath(); ctx.moveTo(cx - pw * 0.09, y); ctx.lineTo(cx + pw * 0.09, y); ctx.stroke(); }
    [[0.56, 0.055], [0.74, 0.055], [0.88, 0.035]].forEach(([t, r]) => {
      const cy = py + ph * t, rad = pw * r;
      ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6a5038'; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f0e6d0'; ctx.lineWidth = rad * 0.14; ctx.beginPath(); ctx.moveTo(cx, cy - rad * 0.2); ctx.lineTo(cx, cy - rad * 0.72); ctx.stroke();
    });
    ctx.fillStyle = 'rgba(60,40,20,.7)'; ctx.font = `700 ${k * 0.02}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('LAB·VISION', cx, py + ph * 0.965);
  };

  function frameAspect(id, img) {
    const a = img ? img.width / img.height : 1.33;
    switch (id) {
      case 'instant': return 0.82; case 'instantmini': return 0.84; case 'phone': return 0.48; case 'tablet': return 1.4; case 'laptop': return 1.78;
      case 'gallery': return clamp(a, 0.72, 1.5); case 'camera': return 1.5;
      case 'film': { const r = 0.13 + S.filmCount; return filmVertical() ? 1 / r : r; }
      case 'floating': return clamp(a, 0.75, 1.4); case 'stacked': return 1.05; case 'monitor': return 1.52; case 'billboard': return 1.35; case 'magazine': return 0.77; case 'tv': return 1.22;
    }
    return 1;
  }

  // ---------- backgrounds ----------
  let noisePattern = null;
  function getNoise(ctx) {
    if (noisePattern) return noisePattern;
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const id = x.createImageData(256, 256), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.random() * 110 | 0; }
    x.putImageData(id, 0, 0); noisePattern = ctx.createPattern(c, 'repeat'); return noisePattern;
  }
  function linearGradient(ctx, w, h, angle, colors) {
    const rad = (angle - 90) * Math.PI / 180, dx = Math.cos(rad), dy = Math.sin(rad);
    const L = (Math.abs(w * dx) + Math.abs(h * dy)) / 2, cx = w / 2, cy = h / 2;
    const g = ctx.createLinearGradient(cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L);
    colors.forEach((c, i) => g.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), c)); return g;
  }
  let blurCache = { key: '', canvas: null }, imgSeq = 0;
  function blurredPhoto(img, W, H) {
    if (!img._fid) img._fid = ++imgSeq;
    const key = img._fid + '|' + W + '|' + H + '|' + S.flip;
    if (blurCache.key === key) return blurCache.canvas;
    const sw = 64, sh = Math.max(1, Math.round(64 * H / W)), small = document.createElement('canvas'); small.width = sw; small.height = sh;
    const sx = small.getContext('2d'), cv = Studio.cover(img.width, img.height, sw, sh);
    if (S.flip) { sx.translate(sw, 0); sx.scale(-1, 1); }
    sx.drawImage(img, cv.sx, cv.sy, cv.sw, cv.sh, 0, 0, sw, sh);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    if ('filter' in x) x.filter = 'blur(' + Math.round(W * 0.02) + 'px)';
    x.drawImage(small, -W * 0.1, -H * 0.1, W * 1.2, H * 1.2);
    if ('filter' in x) x.filter = 'none';
    x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, 0, W, H);
    blurCache = { key, canvas: c }; return c;
  }
  function drawBackground(ctx, W, H, opaque, img) {
    const b = bgById(S.bg);
    if (b.id === 'transparent') { if (opaque) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); } return; }
    if (b.id === 'solid') { ctx.fillStyle = S.bgColor; ctx.fillRect(0, 0, W, H); return; }
    if (b.grad) { ctx.fillStyle = linearGradient(ctx, W, H, b.grad.angle, b.grad.colors); ctx.fillRect(0, 0, W, H); return; }
    if (b.id === 'blur') { ctx.drawImage(blurredPhoto(img, W, H), 0, 0, W, H); return; }
    if (b.id === 'wall') {
      ctx.fillStyle = '#ece8e1'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = getNoise(ctx); ctx.fillRect(0, 0, W, H); ctx.restore();
      const g = ctx.createRadialGradient(W * 0.5, H * 0.35, Math.min(W, H) * 0.2, W * 0.5, H * 0.5, Math.max(W, H) * 0.8); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(60,45,30,.3)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return;
    }
    if (b.id === 'desk') {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8a6242'); g.addColorStop(.5, '#6a4529'); g.addColorStop(1, '#3a2314'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = 0.06; ctx.fillStyle = getNoise(ctx); ctx.fillRect(0, 0, W, H); ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,.09)'; ctx.lineWidth = Math.max(1, H * 0.002);
      for (let i = 0; i < 28; i++) { const y = H * (i + 0.5) / 28; ctx.beginPath(); ctx.moveTo(0, y); for (let j = 1; j <= 16; j++) ctx.lineTo(W * j / 16, y + Math.sin(j * 1.7 + i) * H * 0.006); ctx.stroke(); }
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.85); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- scene ----------
  const layerCanvas = document.createElement('canvas');
  function drawScene(ctx, W, H, item, opaque) {
    drawBackground(ctx, W, H, opaque, item.img);
    const fr = frameById(S.frame), asp = frameAspect(fr.id, item.img);
    const margin = Math.min(W, H) * 0.07, fac = (SIZE_FACTOR[fr.id] || 1) * S.frameScale / 100;
    const avW = (W - 2 * margin) * fac, avH = (H - 2 * margin) * fac;
    let ow = avW, oh = ow / asp; if (oh > avH) { oh = avH; ow = oh * asp; }
    const m = ctx.getTransform(), dpr = Math.hypot(m.a, m.b) || 1;
    const pad = (fr.pad || 0) * ow, lw = ow + 2 * pad, lh = oh + 2 * pad;
    const cw = Math.max(1, Math.ceil(lw * dpr)), ch = Math.max(1, Math.ceil(lh * dpr));
    if (layerCanvas.width !== cw || layerCanvas.height !== ch) { layerCanvas.width = cw; layerCanvas.height = ch; }
    const x = layerCanvas.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cw, ch); x.scale(dpr, dpr); x.translate(pad, pad); layerDpr = dpr;
    DRAW[fr.id](x, ow, oh, item.img);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(S.rotate * Math.PI / 180);
    if (S.shadow > 0) { const s = S.shadow / 100; ctx.shadowColor = `rgba(0,0,0,${0.18 + 0.5 * s})`; ctx.shadowBlur = Math.min(ow, oh) * 0.14 * s * dpr; ctx.shadowOffsetY = Math.min(ow, oh) * 0.05 * s * dpr; }
    ctx.drawImage(layerCanvas, -lw / 2, -lh / 2, lw, lh);
    ctx.restore();
  }

  // ---------- preview ----------
  function renderPreview() {
    const item = currentItem(); if (!item.img) return;
    const [W, H] = SIZES[S.size] || SIZES.square;
    if (preview.width !== W || preview.height !== H) { preview.width = W; preview.height = H; }
    pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, W, H);
    lastPhoto = null; capture = true;
    try { drawScene(pctx, W, H, item, false); } finally { capture = false; }
    if (!isPro()) { pctx.save(); pctx.globalAlpha = 0.6; Studio.watermark(pctx, W, H); pctx.restore(); }
    $('sizeInfo').innerHTML = `Output: <b>${W} × ${H}</b> · ${frameById(S.frame).name}${items.length > 1 ? ' · ' + items.length + ' photos' : ''}`;
  }
  const render = Studio.raf(renderPreview);
  function update() { Studio.persist(STATE_KEY, S); render(); }

  // ---------- pan (drag on the canvas) ----------
  function setupPan() {
    let drag = null;
    preview.addEventListener('pointerdown', e => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY }; try { preview.setPointerCapture(e.pointerId); } catch (err) {} preview.classList.add('dragging'); });
    preview.addEventListener('pointermove', e => {
      if (!drag || !lastPhoto) return;
      const r = preview.getBoundingClientRect(), k = preview.width / r.width;
      const dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k; drag.x = e.clientX; drag.y = e.clientY;
      const a = S.rotate * Math.PI / 180, rx = dx * Math.cos(a) + dy * Math.sin(a), ry = -dx * Math.sin(a) + dy * Math.cos(a);
      let changed = false;
      if (lastPhoto.slackX > 0 && lastPhoto.w > 0) { S.panX = clamp(S.panX + rx * (lastPhoto.sw / lastPhoto.w) * 2 / lastPhoto.slackX, -1, 1); changed = true; }
      if (lastPhoto.slackY > 0 && lastPhoto.h > 0) { S.panY = clamp(S.panY + ry * (lastPhoto.sh / lastPhoto.h) * 2 / lastPhoto.slackY, -1, 1); changed = true; }
      if (changed) update();
    });
    const end = () => { if (drag) { drag = null; preview.classList.remove('dragging'); } };
    preview.addEventListener('pointerup', end); preview.addEventListener('pointercancel', end); preview.addEventListener('lostpointercapture', end);
    preview.addEventListener('keydown', e => {
      const st = 0.06, mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key]; if (!mv) return;
      e.preventDefault(); S.panX = clamp(S.panX + mv[0], -1, 1); S.panY = clamp(S.panY + mv[1], -1, 1); update();
    });
  }

  // ---------- export ----------
  function exportCurrent(opts) {
    const item = currentItem(), [W, H] = SIZES[S.size] || SIZES.square, scale = opts.scale || 1, jpeg = opts.type === 'image/jpeg';
    const name = 'frame-lab-' + S.frame + '-' + S.size + (scale > 1 ? '@' + scale + 'x' : '');
    return Studio.exportPNG((ctx, w, h) => drawScene(ctx, w, h, item, jpeg), W, H, Object.assign({ scale, name }, opts));
  }
  async function exportBatch() {
    if (!Studio.gate('batch')) return;
    if (items.length < 2) { toast('Drop two or more photos to batch-export'); return; }
    toast('Rendering ' + items.length + ' images…');
    const [W, H] = SIZES[S.size] || SIZES.square, files = [], saved = current;
    for (let i = 0; i < items.length; i++) {
      current = i;
      const name = Studio.safeName((items[i].name || 'photo-' + (i + 1)).replace(/\.[a-z0-9]+$/i, '')) + '-' + S.frame + '.png';
      const blob = await Studio.exportPNG((ctx, w, h) => drawScene(ctx, w, h, items[i], false), W, H, { download: false, name });
      files.push({ name: files.some(f => f.name === name) ? name.replace(/\.png$/, '-' + (i + 1) + '.png') : name, blob });
    }
    current = saved; render();
    try { await Studio.zip(files, 'frame-lab-batch'); track('download_zip', { count: files.length }); toast('ZIP downloaded'); }
    catch (e) { toast('Could not build the ZIP (library failed to load)'); }
  }

  // ---------- UI: tiles ----------
  function buildFrameTiles() {
    const box = $('frameTiles'); box.innerHTML = '';
    FRAMES.forEach(f => {
      const t = document.createElement('button'); t.type = 'button'; t.className = 'tile frame-tile'; t.dataset.id = f.id; t.setAttribute('role', 'option');
      const sw = document.createElement('div'); sw.className = 'sw'; const fp = document.createElement('i'); fp.className = 'fp fp-' + f.id; fp.setAttribute('aria-hidden', 'true'); sw.appendChild(fp); t.appendChild(sw);
      const lab = document.createElement('span'); lab.textContent = f.name; t.appendChild(lab);
      if (f.pro) { const pb = document.createElement('span'); pb.className = 'pro-badge'; pb.textContent = 'PRO'; t.appendChild(pb); }
      t.addEventListener('click', () => { if (f.pro && !isPro()) { openPro('frame-premium'); return; } S.frame = f.id; track('frame_select', { id: f.id }); syncFrameUI(); update(); });
      box.appendChild(t);
    });
  }
  function syncFrameTiles() {
    $('frameTiles').querySelectorAll('.tile').forEach(t => {
      const f = frameById(t.dataset.id); t.classList.toggle('active', t.dataset.id === S.frame); t.classList.toggle('locked', !!f.pro && !isPro());
      t.setAttribute('aria-selected', t.dataset.id === S.frame ? 'true' : 'false'); const pb = t.querySelector('.pro-badge'); if (pb) pb.classList.toggle('hidden', isPro());
    });
  }
  function syncFrameUI() {
    syncFrameTiles();
    const f = frameById(S.frame), key = colorKeyFor(f);
    $('colorRow').classList.toggle('hidden', !key);
    if (key) {
      const chips = $('colorChips'); chips.innerHTML = '';
      COLOR_SETS[f.colors].forEach(([id, hex, name]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'swatch' + (S[key] === id ? ' active' : ''); b.style.background = hex; b.title = name; b.setAttribute('aria-label', name); b.setAttribute('aria-pressed', S[key] === id ? 'true' : 'false');
        b.addEventListener('click', () => { S[key] = id; syncFrameUI(); update(); }); chips.appendChild(b);
      });
    }
    $('matRow').classList.toggle('hidden', f.id !== 'gallery'); $('filmRow').classList.toggle('hidden', f.id !== 'film');
    $('camRow').classList.toggle('hidden', f.id !== 'camera'); $('magRow').classList.toggle('hidden', f.id !== 'magazine');
  }
  function buildBgTiles() {
    const box = $('bgTiles'); box.innerHTML = '';
    BGS.forEach(b => {
      const t = document.createElement('button'); t.type = 'button'; t.className = 'tile'; t.dataset.id = b.id; t.setAttribute('role', 'option');
      const sw = document.createElement('div'); sw.className = 'sw' + (b.css === 'checker' ? ' checker' : ''); if (b.css && b.css !== 'checker') sw.style.background = b.css; t.appendChild(sw);
      const lab = document.createElement('span'); lab.textContent = b.name; t.appendChild(lab);
      t.addEventListener('click', () => { S.bg = b.id; track('bg_select', { id: b.id }); syncBgUI(); update(); });
      box.appendChild(t);
    });
  }
  function syncBgUI() {
    $('bgTiles').querySelectorAll('.tile').forEach(t => { t.classList.toggle('active', t.dataset.id === S.bg); t.setAttribute('aria-selected', t.dataset.id === S.bg ? 'true' : 'false'); if (t.dataset.id === 'solid') t.querySelector('.sw').style.background = S.bgColor; });
    $('bgColorRow').classList.toggle('hidden', S.bg !== 'solid');
  }

  // ---------- UI: controls ----------
  function range(id, key, fmt) {
    const el = $(id), out = $(id + 'V'); el.value = S[key]; Studio.bindRange(el, out, fmt);
    el.addEventListener('input', () => { S[key] = Number(el.value); update(); });
  }
  const segs = {};
  function segCtl(id, key, onChange) { const sg = Studio.seg($(id), v => { S[key] = v; if (onChange) onChange(v); update(); }); sg.set(String(S[key])); return sg; }

  // ---------- presets ----------
  const STYLE_KEYS = Object.keys(DEF).filter(k => !['caption', 'camStatus', 'magTitle', 'panX', 'panY'].includes(k));
  function loadPresets() {
    const v = Studio.safeParse(localStorage.getItem(PRESETS_KEY) || '[]', []);
    if (!Array.isArray(v)) return [];
    return v.filter(p => p && typeof p === 'object' && p.style && typeof p.style === 'object').slice(0, 200)
      .map(p => ({ name: String(p.name == null ? '' : p.name).slice(0, 60), style: sanitizeState(Studio.safeAssign({}, DEF, p.style)) }));
  }
  function savePresets(p) { try { localStorage.setItem(PRESETS_KEY, JSON.stringify(p)); } catch (e) {} }
  function renderPresets() {
    const list = $('presetList'), ps = loadPresets(); list.innerHTML = '';
    if (!ps.length) { const p = document.createElement('p'); p.className = 'preset-empty'; p.textContent = 'No saved presets yet. Dial in a frame and save it to reuse later.'; list.appendChild(p); }
    ps.forEach((p, i) => {
      const row = document.createElement('div'); row.className = 'preset-item';
      const ic = document.createElement('i'); ic.className = 'fp fp-' + (frameById(p.style.frame).id) + ' fp-xs'; ic.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span'); name.className = 'name'; name.textContent = p.name; name.title = 'Apply preset'; name.tabIndex = 0;
      const apply = () => { applyPreset(p.style); toast('Preset "' + p.name + '" applied'); track('preset_apply', {}); };
      name.addEventListener('click', apply); name.addEventListener('keydown', e => { if (e.key === 'Enter') apply(); });
      const del = document.createElement('button'); del.type = 'button'; del.className = 'btn btn-ghost btn-sm'; del.textContent = '✕'; del.setAttribute('aria-label', 'Delete preset ' + p.name);
      del.addEventListener('click', () => { const all = loadPresets(); all.splice(i, 1); savePresets(all); renderPresets(); });
      row.append(ic, name, del); list.appendChild(row);
    });
    $('presetHint').textContent = isPro() ? ps.length + ' saved preset' + (ps.length === 1 ? '' : 's') + ' · unlimited with Pro' : 'Free: 1 saved preset · Pro: unlimited';
  }
  function applyPreset(style) {
    STYLE_KEYS.forEach(k => { if (own(style, k) && typeof style[k] === typeof DEF[k]) S[k] = style[k]; });
    sanitizeState(S);
    if (!FRAMES.some(f => f.id === S.frame)) S.frame = 'instant';
    if (frameById(S.frame).pro && !isPro()) S.frame = 'instant';
    if (!BGS.some(b => b.id === S.bg)) S.bg = 'wall'; if (!own(SIZES, S.size)) S.size = 'square';
    syncAll(); update();
  }
  function savePreset() {
    const ps = loadPresets();
    if (!isPro() && ps.length >= 1) { openPro('presets'); return; }
    const name = $('presetName').value.trim().slice(0, 60) || ('Frame ' + (ps.length + 1)), style = {};
    STYLE_KEYS.forEach(k => style[k] = S[k]);
    ps.push({ name, style }); savePresets(ps); $('presetName').value = ''; renderPresets(); toast('Preset saved'); track('preset_save', {});
  }

  // ---------- sync all controls from state ----------
  function syncAll() {
    syncFrameUI(); syncBgUI(); $('bgColor').value = S.bgColor;
    ['shadow', 'frameScale', 'mat', 'zoom', 'rotate'].forEach(k => { $(k).value = S[k]; $(k).dispatchEvent(new Event('input', { bubbles: false })); });
    $('flip').checked = S.flip; $('dateStamp').checked = S.dateStamp;
    $('caption').value = S.caption; $('camStatus').value = S.camStatus; $('magTitle').value = S.magTitle;
    segs.size.set(S.size); segs.film.set(String(S.filmCount)); segs.font.set(S.captionFont);
  }

  // ---------- files ----------
  let dz;
  async function onFiles(fileList) {
    const files = [...fileList].filter(f => /^image\//.test(f.type));
    if (!files.length) { toast('Please drop an image file (PNG, JPG, WebP)'); return; }
    if (files.length > 1 && !isPro()) { toast('Batch mode is a Pro feature – loading the first photo'); openPro('batch'); }
    const take = isPro() ? files.slice(0, 50) : files.slice(0, 1), loaded = [];
    for (const f of take) {
      if (f.size > 100 * 1024 * 1024) { toast('Could not read ' + f.name); continue; } // size cap
      try { const img = await Studio.readImage(f); loaded.push({ img, name: f.name }); }
      catch (e) { toast('Could not read ' + f.name + (/heic|heif/i.test(f.name) ? ' (HEIC is not supported by browsers)' : '')); }
    }
    if (!loaded.length) return;
    if (isPro() && items.length && take.length > 1) items = items.concat(loaded); else items = loaded;
    current = items.length - loaded.length; S.panX = 0; S.panY = 0;
    track('add_files', { count: loaded.length });
    syncSource(); update();
  }
  function syncSource() {
    const has = items.length > 0;
    drop.classList.toggle('has-image', has);
    $('srcInfo').innerHTML = has
      ? `<b>${bmEsc(items[current].name)}</b> · ${items[current].img.width} × ${items[current].img.height}px${items.length > 1 ? ' · ' + items.length + ' loaded' : ''}`
      : 'Showing the <b>built-in sample</b>. Drop your own photo to replace it.';
    const list = $('batchList'); list.innerHTML = '';
    if (items.length > 1) items.forEach((it, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = i === current ? 'active' : ''; b.title = it.name; b.setAttribute('aria-label', 'Show ' + it.name);
      const c = document.createElement('canvas'); c.width = 56; c.height = 40; const x = c.getContext('2d');
      const cv = Studio.cover(it.img.width, it.img.height, 56, 40); x.drawImage(it.img, cv.sx, cv.sy, cv.sw, cv.sh, 0, 0, 56, 40);
      b.appendChild(c); b.addEventListener('click', () => { current = i; syncSource(); render(); }); list.appendChild(b);
    });
  }
  function useSample() { items = []; current = 0; S.panX = 0; S.panY = 0; syncSource(); update(); track('sample', {}); }

  // ---------- init ----------
  function init() {
    sampleImg = makeSample();
    document.querySelectorAll('[data-pro-price]').forEach(el => el.textContent = C.PRO_PRICE || '$9');
    const pp = $('proPrice'); if (pp) pp.textContent = C.PRO_PRICE || '$9';

    buildFrameTiles(); buildBgTiles();
    segs.size = segCtl('sizeSeg', 'size');
    segs.film = Studio.seg($('filmSeg'), v => { S.filmCount = clamp(Number(v) || 1, 1, 3); update(); });
    segs.font = segCtl('captionFont', 'captionFont');
    range('shadow', 'shadow'); range('frameScale', 'frameScale', v => v + '%'); range('mat', 'mat');
    range('zoom', 'zoom', v => v + '%'); range('rotate', 'rotate', v => v + '°');
    $('flip').addEventListener('change', () => { S.flip = $('flip').checked; update(); });
    $('resetPan').addEventListener('click', () => { S.panX = 0; S.panY = 0; update(); });
    $('bgColor').addEventListener('input', () => { S.bgColor = $('bgColor').value; S.bg = 'solid'; syncBgUI(); update(); });
    $('caption').addEventListener('input', () => { S.caption = $('caption').value; update(); });
    $('camStatus').addEventListener('input', () => { S.camStatus = $('camStatus').value; update(); });
    $('magTitle').addEventListener('input', () => { S.magTitle = $('magTitle').value; update(); });
    $('dateStamp').addEventListener('change', () => { S.dateStamp = $('dateStamp').checked; update(); });

    $('savePreset').addEventListener('click', savePreset);
    $('presetName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); savePreset(); } });
    renderPresets();

    dz = Studio.dropzone(stage, onFiles, { accept: 'image/*', multiple: true, clickTarget: '#drop' });
    $('uploadBtn').addEventListener('click', () => dz.open());
    $('useSample').addEventListener('click', useSample);
    preview.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
    setupPan();

    $('dlPng').addEventListener('click', () => exportCurrent({ scale: 1 }));
    $('dlJpg').addEventListener('click', () => exportCurrent({ scale: 1, type: 'image/jpeg', quality: 0.92 }));
    $('dl2x').addEventListener('click', () => { if (Studio.gate('hires')) exportCurrent({ scale: 2 }); });
    $('copyBtn').addEventListener('click', () => Studio.copyCanvas(preview));
    $('zipBtn').addEventListener('click', exportBatch);
    $('resetBtn').addEventListener('click', () => { Object.assign(S, DEF); syncAll(); update(); toast('Settings reset'); });

    document.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey; if (!mod) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (e.key.toLowerCase() === 's' && !/INPUT|TEXTAREA/.test(tag)) { e.preventDefault(); exportCurrent({ scale: 1 }); }
      if (e.key.toLowerCase() === 'c' && document.activeElement === preview) { e.preventDefault(); Studio.copyCanvas(preview); }
    });

    const refreshPro = () => {
      const pro = isPro();
      document.querySelectorAll('.studio-actions .pro-badge').forEach(b => b.classList.toggle('hidden', pro));
      if (!pro && frameById(S.frame).pro) { S.frame = 'instant'; syncFrameUI(); }
      syncFrameTiles(); renderPresets(); render();
    };
    document.addEventListener('pro:changed', refreshPro);
    refreshPro();

    syncAll(); syncSource(); render();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
