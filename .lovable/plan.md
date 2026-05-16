## SEO Fix Plan

The SEO scanner reports zero failing findings, but a manual audit shows a few gaps worth fixing.

### Issues found
1. No `sitemap.xml` — search engines have no map of the site.
2. No canonical URL or JSON-LD structured data in `index.html`.
3. No `predev`/`prebuild` generator to keep the sitemap in sync.
4. `robots.txt` does not reference the sitemap.

### Changes

**1. Create `scripts/generate-sitemap.ts`**
- Generates `public/sitemap.xml` with public routes: `/`, `/signup`. (Exclude `/admin` and `*`.)
- Base URL: `https://maseno-spatial-dashboard.lovable.app`.

**2. Wire `predev` + `prebuild` in `package.json`**
- Run `bunx tsx scripts/generate-sitemap.ts` before dev and build.

**3. Update `public/robots.txt`**
- Append `Sitemap: https://maseno-spatial-dashboard.lovable.app/sitemap.xml`.

**4. Update `index.html`**
- Add `<link rel="canonical" href="https://maseno-spatial-dashboard.lovable.app/" />`.
- Add `<meta property="og:url" content="https://maseno-spatial-dashboard.lovable.app/" />`.
- Add Organization JSON-LD for Maseno Campus Explorer.

No app behavior, routes, or UI changes — purely SEO metadata and discovery files.
