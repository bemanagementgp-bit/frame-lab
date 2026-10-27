# Frame Lab – Polaroid, Phone & Camera Photo Mockup Generator

Put any photo inside a real-looking frame: Polaroid-style instant prints, phone / tablet / laptop screens, a gallery frame with mat, a DSLR camera display or a 35 mm film strip. Every frame is drawn procedurally on a `<canvas>` in the user's browser (no image assets, nothing uploaded).

**Live:** https://framelab-tool.vercel.app/ (placeholder – replaced after deploy)

## Features

**Free**
- Drop / pick / paste a photo (PNG, JPG, WebP, GIF first frame, BMP). A procedurally drawn sample landscape (sunset, sun, mountain ridges) is shown until a photo is loaded.
- 8 frames: Instant print (1:1.2, caption, tilt), Instant mini, Phone (dynamic island, reflection), Tablet, Laptop (notch), Gallery frame (wood / black / white moulding, mat slider, glass), Camera display (DSLR back with editable status line + REC dot), Film strip (1–3 photos, sprocket holes, vertical on portrait sizes)
- Frame color per family (prints: white / cream / black · gallery: wood / black / white · devices: space gray / silver / gold), shadow strength, frame size
- Photo: zoom 100–300 %, pan by dragging the canvas (arrow keys when focused), tilt −20..20°, flip, center
- Backgrounds: transparent, solid color, 8 gradient presets, blurred photo, wall (noise + vignette), desk (warm wood + vignette)
- Text: caption (casual / serif / mono stack) on instant prints, stacked prints and the magazine cover; orange film-camera date stamp
- Output sizes: Square 2000², Portrait 1600×2000, Landscape 2000×1500, Story 1080×1920
- Download PNG (1x), Download JPG (q92), Copy to clipboard; Ctrl/Cmd+S and Ctrl/Cmd+C (canvas focused)
- 1 saved frame preset; all settings persisted in `localStorage`
- Free exports carry a small "Frame Lab · free" badge (`Studio.watermark`)

**Pro (one-time, price from `config.js`)**
- No watermark
- 2x PNG export
- 6 premium frames: Floating print with tape, Stacked prints, Monitor on desk, Billboard (perspective via per-slice `setTransform`), Magazine cover (masthead + barcode), Vintage CRT TV
- Batch mode: drop many photos, same frame applied to each, ZIP download (JSZip loaded lazily from jsDelivr). The film strip uses consecutive photos when several are loaded.
- Unlimited saved presets

Gates are enforced in `app.js` via `isPro()` / `Studio.gate()`; the UI listens to `pro:changed`.

## Files

```
index.html     tool page + SEO content + FAQ (JSON-LD WebApplication + FAQPage)
styles.css     _shared/base.css + app styles (incl. CSS mini previews of every frame)
app.js         rendering engine (frames, backgrounds, pan/zoom) + UI (vanilla JS, no build step)
studio.js      shared canvas / drop zone / export / ZIP helpers (copy of _shared/studio.js)
monetize.js    shared theme / toast / analytics / AdSense / Pro license helpers
config.js      window.APP_CONFIG (site URL, AdSense, GA, checkout URL, price, LICENSE, NEWSLETTER)
privacy.html   privacy policy (required for AdSense)
terms.html     terms of use
robots.txt, sitemap.xml, vercel.json, favicon.svg, .gitignore
```

## Run locally

```bash
npx serve .
```

No build step. Open the printed URL.

## Deploy

Deploy the folder as a static site on Vercel (`vercel --prod`). After the first deploy, replace the placeholder everywhere:

```bash
sed -i 's/framelab-tool.vercel.app/framelab-tool.vercel.app/g' index.html privacy.html terms.html robots.txt sitemap.xml config.js README.md
```

Then run `node _shared/apply-brand.js frame-lab` from the repo root to inject the shared header, hero, footer and lead card.

## Monetization setup

1. **AdSense** – set `ADSENSE_CLIENT: "ca-pub-XXXXXXXXXXXXXXXX"` in `config.js`. Slots: `sidebar-1`, `below-tool`. `privacy.html` already discloses advertising cookies.
2. **Analytics** – set `GA_ID: "G-XXXXXXX"`. Events: `add_files`, `sample`, `frame_select`, `bg_select`, `download` (format, scale), `copy`, `download_zip`, `preset_save`, `preset_apply`, `pro_click`, `begin_checkout`, `license_activated`.
3. **Pro checkout + licenses** – create a one-time product on Lemon Squeezy with license keys enabled, set `PRO_CHECKOUT_URL`, `PRO_PRICE` and `LICENSE.store_id` / `product_id`. Until those are set, real keys are refused and only `LICENSE.test_keys` work locally.
4. **Newsletter** – set `NEWSLETTER.url` (Formspree / ConvertKit / Beehiiv) to show the lead card that `apply-brand.js` injects.

## Notes

- The frame object is rendered to an offscreen layer, then composited with rotation and one drop shadow; film sprocket holes are punched with `destination-out` so transparent backgrounds stay transparent.
- Transparent background + JPG export falls back to a white background (JPEG has no alpha).
- The caption's "casual" look relies on system handwriting fonts (Segoe Print, Bradley Hand, Chalkboard SE, Marker Felt, Comic Sans MS); the fallback is the browser's cursive font.
- The only external requests are Google Fonts, optional GA/AdSense, the Lemon Squeezy license API when a key is entered, and JSZip on batch export.
