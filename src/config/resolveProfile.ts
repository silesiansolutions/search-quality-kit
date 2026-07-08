import type { SearchQualityConfig } from "./schema.js";
import {
  matchesRoutePattern,
  profileDefinition,
  type SiteProfileId,
  type StructuredDataType,
} from "./profileDefinitions.js";

export interface ResolvedProfile {
  activeProfile: SiteProfileId;
  expectedStructuredData: StructuredDataType[];
  expectedAnyOf?: StructuredDataType[];
  requiredStructuredData: StructuredDataType[];
  matchedPattern?: string;
}

function appliesByDefault(id: SiteProfileId, pathname: string) {
  const rule = profileDefinition(id).expectation;
  if (rule === "all") return true;
  if (rule === "none") return false;
  if (rule === "home") return pathname === "/";
  if (rule === "home-or-about")
    return ["/", "/about", "/about-me", "/o-mnie"].includes(
      pathname.replace(/\/$/, "") || "/",
    );
  if (rule === "content")
    return (
      pathname !== "/" &&
      !/(^|\/)(blog|articles?|posts?|category|categories|tag|tags|archive|page)(\/\d+)?\/?$/i.test(
        pathname,
      )
    );
  return false;
}

export function resolveProfile(
  url: string,
  config: SearchQualityConfig,
): ResolvedProfile {
  const pathname = new URL(url, config.site.baseUrl).pathname;
  const route = config.profiles.routes.find(({ pattern }) =>
    matchesRoutePattern(pathname, pattern),
  );
  const activeProfile = route?.profile ?? config.profiles.default;
  const definition = profileDefinition(activeProfile);
  const useProfileExpectations = route
    ? route.profile !== undefined
    : appliesByDefault(activeProfile, pathname);
  const profileExpected = useProfileExpectations
    ? definition.expectedStructuredData
    : [];
  return {
    activeProfile,
    expectedStructuredData: [
      ...new Set([
        ...profileExpected,
        ...(route?.expectedStructuredData ?? []),
      ]),
    ],
    ...(useProfileExpectations && definition.expectedAnyOf
      ? { expectedAnyOf: definition.expectedAnyOf }
      : {}),
    requiredStructuredData: [
      ...new Set([
        ...(useProfileExpectations && !definition.expectedAnyOf
          ? definition.expectedStructuredData
          : []),
        ...(route?.expectedStructuredData ?? []),
      ]),
    ],
    ...(route ? { matchedPattern: route.pattern } : {}),
  };
}
