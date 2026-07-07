# Getting started

## Add it to another repository

1. Install `@silesiansolutions/search-quality-kit` as a dev dependency or run it directly with `npx @silesiansolutions/search-quality-kit`.
2. Run `search-quality-kit init`.
3. Replace `https://example.com` with the production `baseUrl`.
4. Set `build.command`, optional `build.startCommand` plus `site.localUrl`, and `build.distDir`.
5. Run `search-quality-kit verify --report-only` and review the baseline.
6. Fix genuine errors and tune only documented project-specific heuristics.
7. Run `search-quality-kit verify` to enable exit-code enforcement.
8. Add the GitHub Actions workflow from [ci.md](ci.md).

No validation logic is copied to the target repository. Its only durable integration is configuration and, optionally, a workflow.

## Static build mode

Use this for Astro, Gatsby, Vite static output, exported Next.js sites, plain HTML, and similar projects:

```ts
export default {
  site: { baseUrl: "https://example.com" },
  build: { command: "npm run build", distDir: "dist" },
};
```

The CLI enumerates built HTML, reads `robots.txt` and `sitemap.xml`, resolves clean internal routes, and can inspect local asset sizes without network access.

## HTTP crawl mode

Use this for SSR applications and local preview servers:

```ts
export default {
  site: {
    baseUrl: "https://example.com",
    localUrl: "http://localhost:3000",
  },
  build: {
    command: "npm run build",
    startCommand: "npm run start",
  },
};
```

Requests go to `localUrl`, while canonical, sitemap, and internal URL checks use `baseUrl`. The preview process is stopped after verification.

## Remote audit mode

If no local build or `localUrl` exists, `baseUrl` is crawled directly. This is convenient for public smoke tests but is the only mode that requires network access.
