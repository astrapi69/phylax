import { test, expect } from '@playwright/test';

/**
 * SEO foundation checks against the production build (R-06, extends
 * D-04). Asserts the head metadata, the JSON-LD structured data, the
 * crawler fallback, and that the static crawler files are served.
 * Content values must match `index.html`; the URLs deliberately keep
 * the legacy /phylax/ base path until the GitHub repo rename (see the
 * TODO in vite.config.ts and ROADMAP TD-20).
 */
test.describe('SEO metadata (production build)', () => {
  test('document title and primary meta tags carry the Befaro branding', async ({ page }) => {
    await page.goto('./');

    await expect(page).toHaveTitle('Befaro - Dein lokaler Gesundheitsbegleiter');

    const description = page.locator('head meta[name="description"]');
    await expect(description).toHaveAttribute('content', /^Befaro: dein lokaler, verschlüsselter/);

    const keywords = page.locator('head meta[name="keywords"]');
    await expect(keywords).toHaveAttribute('content', /Gesundheitsakte/);

    // Author is injected at build time from package.json (single
    // source of truth); assert the token was replaced, not its value.
    const author = page.locator('head meta[name="author"]');
    await expect(author).not.toHaveAttribute('content', /@@/);

    const canonical = page.locator('head link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', 'https://astrapi69.github.io/phylax/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });

  test('Open Graph and Twitter Card tags are present and renamed', async ({ page }) => {
    await page.goto('./');

    const og = (property: string) => page.locator(`head meta[property="${property}"]`);
    await expect(og('og:type')).toHaveAttribute('content', 'website');
    await expect(og('og:site_name')).toHaveAttribute('content', 'Befaro');
    await expect(og('og:title')).toHaveAttribute(
      'content',
      'Befaro - Dein lokaler Gesundheitsbegleiter',
    );
    await expect(og('og:url')).toHaveAttribute('content', 'https://astrapi69.github.io/phylax/');
    await expect(og('og:locale')).toHaveAttribute('content', 'de_DE');
    await expect(og('og:locale:alternate')).toHaveAttribute('content', 'en_US');
    await expect(og('og:image')).toHaveAttribute(
      'content',
      'https://astrapi69.github.io/phylax/og-image.png',
    );

    const twitter = (name: string) => page.locator(`head meta[name="${name}"]`);
    await expect(twitter('twitter:card')).toHaveAttribute('content', 'summary_large_image');
    await expect(twitter('twitter:title')).toHaveAttribute(
      'content',
      'Befaro - Dein lokaler Gesundheitsbegleiter',
    );
    await expect(twitter('twitter:description')).toHaveAttribute('content', /Ohne Cloud/);
  });

  test('JSON-LD structured data parses and describes the Befaro app', async ({ page }) => {
    await page.goto('./');

    const raw = await page.locator('head script[type="application/ld+json"]').textContent();
    expect(raw).toBeTruthy();

    const jsonLd = JSON.parse(raw ?? '{}') as Record<string, unknown>;
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('WebApplication');
    expect(jsonLd.name).toBe('Befaro');
    expect(jsonLd.applicationCategory).toBe('HealthApplication');
    expect(jsonLd.applicationSubCategory).toBe('Personal Health Record');
    expect(jsonLd.isAccessibleForFree).toBe(true);
    expect(jsonLd.permissions).toBe('none');
    expect(jsonLd.offers).toMatchObject({ price: '0', priceCurrency: 'EUR' });
    // Build-time injection replaced the @@APP_VERSION@@ / @@APP_AUTHOR@@
    // / @@APP_LICENSE@@ tokens.
    expect(raw).not.toContain('@@');
  });

  test('noscript fallback gives non-JS crawlers a text anchor', async ({ page }) => {
    // Read the raw HTML: with JS enabled the browser never renders
    // <noscript> content, so DOM-visibility assertions cannot apply.
    const response = await page.request.fetch('./');
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain('<noscript>');
    expect(html).toContain('Befaro ist ein lokaler, verschlüsselter Gesundheitsbegleiter.');
  });

  test('robots.txt and sitemap.xml are served from the build output', async ({ page }) => {
    const robots = await page.request.fetch('./robots.txt');
    expect(robots.status()).toBe(200);
    const robotsBody = await robots.text();
    expect(robotsBody).toContain('User-agent: *');
    expect(robotsBody).toContain('Allow: /');
    expect(robotsBody).toContain('Sitemap: https://astrapi69.github.io/phylax/sitemap.xml');

    const sitemap = await page.request.fetch('./sitemap.xml');
    expect(sitemap.status()).toBe(200);
    const sitemapBody = await sitemap.text();
    expect(sitemapBody).toContain('<loc>https://astrapi69.github.io/phylax/</loc>');
    expect(sitemapBody).toContain('<lastmod>');
  });
});
