# D-04 SEO and social metadata post-deploy validation

One-time post-deploy check, not a recurring smoke. Social crawlers do
not execute JavaScript, so the static tags in `index.html` plus the
two Open Graph cards in `public/` are the entire surface. This walk
confirms third-party crawlers parse them correctly once the build is
live at `https://astrapi69.github.io/phylax/`.

Run it once after the first deploy that contains D-04, and again only
if the metadata, the OG images, or the canonical URL change.

## Preconditions

1. The D-04 commit is deployed and `https://astrapi69.github.io/phylax/`
   serves the new `index.html` (view source, confirm the
   `og:title` / `application/ld+json` block is present and the
   `@@APP_*@@` build tokens are resolved to literal values).
2. `https://astrapi69.github.io/phylax/og-image.png` and
   `og-image-en.png` load directly in the browser (1200x630).
3. `https://astrapi69.github.io/phylax/robots.txt` and
   `sitemap.xml` load directly.

## Scenarios

1. **Facebook / Open Graph debugger**
   (https://developers.facebook.com/tools/debug/): paste the site
   URL, Scrape Again. Expect title "Phylax - Lebende Gesundheit,
   lokal verschlüsselt", the English description, and the OG card
   preview (dark brand card, Phi wordmark, tagline, four feature
   glyphs). No "missing og:image" or "could not resolve image"
   warnings. Image must resolve to an absolute https URL.

2. **Twitter / X card validator** (or https://opengraph.xyz as a
   stand-in if the official validator is gated): expect a
   `summary_large_image` card with the same title, English
   description, and the 1200x630 image. Confirm no truncation
   warning on the image aspect ratio.

3. **Google Rich Results test**
   (https://search.google.com/test/rich-results): paste the URL.
   The `WebApplication` structured-data item is detected, category
   `HealthApplication`, with no errors. `softwareVersion` matches
   the deployed `package.json` version. `offers.price` = 0,
   `license` resolves, `inLanguage` lists de and en.

4. **opengraph.xyz** (https://www.opengraph.xyz): paste the URL,
   eyeball the Facebook / LinkedIn / Twitter / WhatsApp / Slack
   preview tiles. The card text is legible at thumbnail size and
   the umlaut in "verschlüsselt" / "Verschlüsselt" renders, no mojibake.

5. **Canonical and robots**: confirm the rendered page exposes
   `<link rel="canonical" href="https://astrapi69.github.io/phylax/">`
   and `<meta name="robots" content="index, follow">`.

## Known caveat: GitHub Pages project-site robots.txt scope

GitHub Pages serves this repo under the `/phylax/` path, so
`public/robots.txt` deploys to
`https://astrapi69.github.io/phylax/robots.txt`. Crawlers fetch the
robots directive only from the host root
(`https://astrapi69.github.io/robots.txt`), which belongs to the
user GitHub Pages site, not this repo. The shipped `robots.txt` and
its `Sitemap:` line therefore only take effect under a custom domain
(D-02) where Phylax owns the host root. Until then they are correct
and harmless but not authoritative. Submitting the sitemap URL
directly in Google Search Console is the interim path. Note this
when checking indexing status.

## Sign-off

- [ ] Scenario 1 (Facebook OG debugger) clean
- [ ] Scenario 2 (Twitter card) clean
- [ ] Scenario 3 (Google rich results, WebApplication detected) clean
- [ ] Scenario 4 (opengraph.xyz tiles, umlaut renders) clean
- [ ] Scenario 5 (canonical + robots meta present) clean
- [ ] Caveat understood (host-root robots scope under GitHub Pages)

Walked by: **\_\_** Date: **\_\_** Result: **\_\_**
