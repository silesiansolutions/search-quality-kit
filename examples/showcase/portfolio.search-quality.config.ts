import { definePortfolioConfig } from "@silesiansolutions/search-quality-kit";

export default definePortfolioConfig({
  outputDir: "search-quality-reports",
  sites: [
    {
      name: "dawidrylko",
      config: "sites/dawidrylko.config.ts",
    },
    {
      name: "silesiansolutions",
      config: "sites/silesiansolutions.config.ts",
    },
    {
      name: "cyberkatalog",
      config: "sites/cyberkatalog.config.ts",
    },
    {
      name: "dawiddev",
      config: "sites/dawiddev.config.ts",
    },
  ],
  portfolio: {
    failOn: ["error"],
    failOnNew: false,
    continueOnSiteFailure: true,
    reportOnly: true,
  },
});
