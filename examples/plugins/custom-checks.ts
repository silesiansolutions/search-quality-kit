import {
  defineCheck,
  definePlugin,
} from "@silesiansolutions/search-quality-kit";

const noPlaceholderCompany = defineCheck({
  id: "custom.no-placeholder-company",
  title: "No placeholder company name",
  category: "brand",
  classification: "local-heuristic",
  defaultSeverity: "warning",
  run(ctx) {
    return ctx.pages.flatMap((page) =>
      /\b(?:demo company|example company)\b/i.test(page.visibleText)
        ? [
            {
              code: "custom.no-placeholder-company",
              url: page.url,
              message: "Page contains a placeholder company name.",
              remediation:
                "Replace the placeholder with the approved production company name.",
            },
          ]
        : [],
    );
  },
});

const noStagingBrandCopy = defineCheck({
  id: "custom.no-staging-brand-copy",
  title: "No staging brand copy",
  category: "brand",
  classification: "local-heuristic",
  defaultSeverity: "error",
  run(ctx) {
    return ctx.pages.flatMap((page) =>
      /\b(?:staging brand|temporary brand)\b/i.test(page.visibleText)
        ? [
            {
              code: "custom.no-staging-brand-copy",
              url: page.url,
              message: "Page exposes staging-only brand copy.",
              remediation:
                "Replace staging copy with the approved production wording before deployment.",
            },
          ]
        : [],
    );
  },
});

const requireContactLink = defineCheck({
  id: "custom.require-contact-link-on-company-site",
  title: "Require a contact link on company pages",
  category: "company-site",
  classification: "profile-expectation",
  defaultSeverity: "warning",
  run(ctx) {
    return ctx.pages.flatMap((page) => {
      const hasContactLink = page.links.some((link) => {
        if (!link.url) return false;
        const pathname = new URL(link.url).pathname.toLowerCase();
        return pathname === "/contact" || pathname === "/kontakt";
      });
      return hasContactLink
        ? []
        : [
            {
              code: "custom.require-contact-link-on-company-site",
              url: page.url,
              message: "Page does not link to the primary contact route.",
              remediation:
                "Add a crawlable link to /contact or /kontakt in the shared company-site navigation.",
            },
          ];
    });
  },
});

export const internalBrandRules = definePlugin({
  name: "internal-brand-rules",
  checks: [noPlaceholderCompany, noStagingBrandCopy, requireContactLink],
});
