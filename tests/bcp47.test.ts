import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ISO_3166_1_ALPHA2,
  ISO_639_1,
  UN_M49_REGIONS,
  isKnownLanguage,
  isKnownRegion,
  parseHreflang,
} from "../src/utils/bcp47.js";

describe("parseHreflang", () => {
  it("classifies x-default case-insensitively before parsing", () => {
    expect(parseHreflang("x-default")).toEqual({
      raw: "x-default",
      kind: "x-default",
    });
    expect(parseHreflang("X-Default")).toEqual({
      raw: "X-Default",
      kind: "x-default",
    });
  });

  it("parses a bare known language", () => {
    expect(parseHreflang("en")).toEqual({
      raw: "en",
      kind: "tag",
      language: "en",
    });
    expect(isKnownLanguage("en")).toBe(true);
  });

  it("accepts a well-formed but unknown 3-letter language", () => {
    const parsed = parseHreflang("eng");
    expect(parsed).toEqual({ raw: "eng", kind: "tag", language: "eng" });
    expect(isKnownLanguage("eng")).toBe(false);
  });

  const malformedCases = ["en_US", "", "e", "en-", "a-b-c-d"];
  it.each(malformedCases)("treats %j as malformed", (value) => {
    expect(parseHreflang(value)).toEqual({ raw: value, kind: "malformed" });
  });

  it("parses a known region", () => {
    const parsed = parseHreflang("en-US");
    expect(parsed).toEqual({
      raw: "en-US",
      kind: "tag",
      language: "en",
      region: "US",
    });
    expect(isKnownRegion("US")).toBe(true);
  });

  it("accepts a well-formed but unknown region (UK is not a country code)", () => {
    const parsed = parseHreflang("en-UK");
    expect(parsed).toEqual({
      raw: "en-UK",
      kind: "tag",
      language: "en",
      region: "UK",
    });
    expect(isKnownRegion("UK")).toBe(false);
  });

  it("rejects EN as a region (not a country)", () => {
    const parsed = parseHreflang("en-EN");
    expect(parsed).toEqual({
      raw: "en-EN",
      kind: "tag",
      language: "en",
      region: "EN",
    });
    expect(isKnownRegion("EN")).toBe(false);
  });

  it("accepts es-419 as a known UN M.49 macro-region", () => {
    const parsed = parseHreflang("es-419");
    expect(parsed).toEqual({
      raw: "es-419",
      kind: "tag",
      language: "es",
      region: "419",
    });
    expect(isKnownRegion("419")).toBe(true);
  });

  it("parses language, script, and region together", () => {
    expect(parseHreflang("zh-Hant-TW")).toEqual({
      raw: "zh-Hant-TW",
      kind: "tag",
      language: "zh",
      script: "Hant",
      region: "TW",
    });
  });

  it("normalizes case while preserving raw exactly as authored", () => {
    expect(parseHreflang("ZH-hant-tw")).toEqual({
      raw: "ZH-hant-tw",
      kind: "tag",
      language: "zh",
      script: "Hant",
      region: "TW",
    });
  });
});

describe("subtag tables", () => {
  it("sizes are in the expected range", () => {
    expect(ISO_639_1.size).toBeGreaterThanOrEqual(170);
    expect(ISO_639_1.size).toBeLessThanOrEqual(200);
    expect(ISO_3166_1_ALPHA2.size).toBeGreaterThanOrEqual(240);
    expect(ISO_3166_1_ALPHA2.size).toBeLessThanOrEqual(260);
  });

  it("spot-checks known and unknown languages", () => {
    expect(isKnownLanguage("pl")).toBe(true);
    expect(isKnownLanguage("de")).toBe(true);
    expect(isKnownLanguage("ja")).toBe(true);
    expect(isKnownLanguage("xx")).toBe(false);
    expect(isKnownLanguage("zz")).toBe(false);
  });

  it("carries the current codes for languages that were renamed, not their withdrawn aliases", () => {
    expect(isKnownLanguage("he")).toBe(true);
    expect(isKnownLanguage("id")).toBe(true);
    expect(isKnownLanguage("yi")).toBe(true);
    expect(isKnownLanguage("iw")).toBe(false);
    expect(isKnownLanguage("in")).toBe(false);
    expect(isKnownLanguage("ji")).toBe(false);
  });

  it("spot-checks known and unknown regions", () => {
    expect(isKnownRegion("PL")).toBe(true);
    expect(isKnownRegion("DE")).toBe(true);
    expect(isKnownRegion("GB")).toBe(true);
    expect(isKnownRegion("ZZ")).toBe(false);
    expect(isKnownRegion("XX")).toBe(false);
  });

  it("includes the standard UN M.49 macro-regions used in hreflang", () => {
    for (const code of ["001", "002", "009", "019", "142", "150", "419"]) {
      expect(UN_M49_REGIONS.has(code)).toBe(true);
    }
  });
});

describe("determinism guarantee", () => {
  it("imports nothing and never references Intl", () => {
    const path = fileURLToPath(
      new URL("../src/utils/bcp47.ts", import.meta.url),
    );
    const source = readFileSync(path, "utf8");
    expect(source).not.toMatch(/^\s*import\b/m);
    expect(source).not.toMatch(/\bIntl\b/);
  });
});
