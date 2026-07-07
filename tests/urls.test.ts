import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/defaultConfig.js";
import {
  isHttpUrl,
  isLocalOrStaging,
  normalizeUrl,
  pathAllowed,
} from "../src/utils/urls.js";
describe("URL utilities", () => {
  it("normalizes fragments and slashes", () =>
    expect(normalizeUrl("https://EXAMPLE.com/about/#x")).toBe(
      "https://example.com/about",
    ));
  it("recognizes valid web URLs", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("/relative")).toBe(false);
  });
  it("detects non-production hosts", () =>
    expect(isLocalOrStaging("http://localhost:3000", defaultConfig)).toBe(
      true,
    ));
  it("applies exclusions", () =>
    expect(pathAllowed("/admin/users", defaultConfig)).toBe(false));
});
