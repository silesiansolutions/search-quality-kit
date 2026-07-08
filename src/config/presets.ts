import type { SearchQualityConfigInput } from "./schema.js";

const commonExcludedRoutes = [
  "/admin",
  "/preview",
  "/api",
  "/404",
  "/404.html",
];

const staticPreset = (
  distDir: string,
  extraExcludedRoutes: string[] = [],
): SearchQualityConfigInput => ({
  build: { distDir },
  crawl: {
    mode: "static",
    entrypoints: ["/"],
    exclude: [...commonExcludedRoutes, ...extraExcludedRoutes],
  },
});

export const presets = {
  astro: (): SearchQualityConfigInput => staticPreset("dist"),
  nextStatic: (): SearchQualityConfigInput => staticPreset("out"),
  nextHybrid: (): SearchQualityConfigInput => ({
    site: { localUrl: "http://localhost:3000" },
    build: { distDir: ".next" },
    crawl: {
      mode: "http",
      entrypoints: ["/"],
      exclude: [...commonExcludedRoutes],
    },
  }),
  gatsby: (): SearchQualityConfigInput =>
    staticPreset("public", [
      "/dev-404-page",
      "/offline-plugin-app-shell-fallback",
    ]),
  viteSpa: (): SearchQualityConfigInput => staticPreset("dist"),
  genericStatic: (): SearchQualityConfigInput => staticPreset("dist"),
};

export const presetNames = [
  "astro",
  "next-static",
  "next-hybrid",
  "gatsby",
  "vite-spa",
  "generic-static",
] as const;

export type PresetName = (typeof presetNames)[number];

const presetFactories: Record<PresetName, () => SearchQualityConfigInput> = {
  astro: presets.astro,
  "next-static": presets.nextStatic,
  "next-hybrid": presets.nextHybrid,
  gatsby: presets.gatsby,
  "vite-spa": presets.viteSpa,
  "generic-static": presets.genericStatic,
};

export function presetByName(name: string): SearchQualityConfigInput {
  const factory = presetFactories[name as PresetName];
  if (!factory)
    throw new Error(
      `Unknown preset "${name}". Choose one of: ${presetNames.join(", ")}.`,
    );
  return factory();
}

const presetAccessors: Record<PresetName, keyof typeof presets> = {
  astro: "astro",
  "next-static": "nextStatic",
  "next-hybrid": "nextHybrid",
  gatsby: "gatsby",
  "vite-spa": "viteSpa",
  "generic-static": "genericStatic",
};

export function configTemplate(name: PresetName) {
  const accessor = presetAccessors[name];
  return `import { defineConfig, presets } from "@silesiansolutions/search-quality-kit";

const preset = presets.${accessor}();

export default defineConfig({
  ...preset,
  site: {
    ...preset.site,
    // TODO: replace with the production origin for this site.
    baseUrl: "https://example.com",
  },
});
`;
}
