import type { SearchQualityConfigInput } from "./schema.js";

const withDefault = (
  profile: NonNullable<SearchQualityConfigInput["profiles"]>["default"],
): SearchQualityConfigInput => ({ profiles: { default: profile } });

export const profiles = {
  personalSite: () => withDefault("personal"),
  companySite: () => withDefault("company"),
  blog: () => withDefault("blog"),
  directory: () => withDefault("directory"),
  localBusiness: () => withDefault("localBusiness"),
  generic: () => withDefault("generic"),
};
