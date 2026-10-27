import { describe, expectTypeOf, it } from "vitest";
import {
  parseBaselineReport,
  type LegacySearchQualityReport,
  type ReportSummary,
  type SearchQualityReport,
} from "../src/index.js";

describe("public type exports", () => {
  it("exposes every report type referenced by public signatures", () => {
    expectTypeOf(parseBaselineReport).returns.toEqualTypeOf<
      SearchQualityReport | LegacySearchQualityReport
    >();
    expectTypeOf<
      SearchQualityReport["summary"]
    >().toEqualTypeOf<ReportSummary>();
  });
});
