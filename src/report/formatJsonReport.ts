import type { SearchQualityReport } from "./types.js";
export const formatJsonReport = (r: SearchQualityReport) =>
  JSON.stringify(r, null, 2);
