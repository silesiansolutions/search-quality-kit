import { describe, expect, it } from "vitest";
import { agentReadinessCheck } from "../src/checks/agentReadiness.js";
import { configSchema } from "../src/config/schema.js";
import { context, fixture, page } from "./helpers.js";

const COMPLIANT_LLMS_TXT = `# Example Site

> A short summary of what this site offers to visitors and agents.

Visit [the homepage](https://example.com/) for more details.
`;

describe("llms.txt", () => {
  it("reports missing as info by default", async () => {
    const f = await agentReadinessCheck.run(context());
    expect(f).toContainEqual(
      expect.objectContaining({
        code: "llms-txt-missing",
        severity: "info",
      }),
    );
  });

  it("reports missing as warning when requireLlmsTxt is enabled", async () => {
    const config = configSchema.parse({
      rules: { agentReadiness: { requireLlmsTxt: true } },
    });
    const f = await agentReadinessCheck.run(context({}, config));
    expect(f).toContainEqual(
      expect.objectContaining({
        code: "llms-txt-missing",
        severity: "warning",
      }),
    );
  });

  it("reports unreadable for a server error", async () => {
    const f = await agentReadinessCheck.run(
      context({
        llmsTxt: { url: "https://example.com/llms.txt", status: 500 },
      }),
    );
    expect(f).toContainEqual(
      expect.objectContaining({
        code: "llms-txt-unreadable",
        severity: "warning",
      }),
    );
    expect(f.some((x) => x.code === "llms-txt-missing")).toBe(false);
  });

  it("reports unreadable for a network failure", async () => {
    const f = await agentReadinessCheck.run(
      context({
        llmsTxt: { url: "https://example.com/llms.txt", status: 0 },
      }),
    );
    expect(f).toContainEqual(
      expect.objectContaining({
        code: "llms-txt-unreadable",
        severity: "warning",
      }),
    );
    expect(f.some((x) => x.code === "llms-txt-missing")).toBe(false);
  });

  it("has no llms findings for a fully compliant file", async () => {
    const f = await agentReadinessCheck.run(
      context({
        llmsTxt: {
          url: "https://example.com/llms.txt",
          status: 200,
          content: COMPLIANT_LLMS_TXT,
        },
      }),
    );
    expect(f.filter((x) => x.code.startsWith("llms-txt-"))).toHaveLength(0);
  });

  it("flags a missing H1 in isolation", async () => {
    const content =
      "> A helpful summary describing this website in detail for visitors.\n\nVisit [our page](https://example.com/) today.\n";
    const f = await agentReadinessCheck.run(
      context({
        llmsTxt: {
          url: "https://example.com/llms.txt",
          status: 200,
          content,
        },
      }),
    );
    expect(f.map((x) => x.code)).toEqual(["llms-txt-missing-h1"]);
  });

  it("flags missing links in isolation", async () => {
    const content =
      "# Title\n\n> A helpful summary of what this website provides to visitors overall.\n";
    const f = await agentReadinessCheck.run(
      context({
        llmsTxt: {
          url: "https://example.com/llms.txt",
          status: 200,
          content,
        },
      }),
    );
    expect(f.map((x) => x.code)).toEqual(["llms-txt-missing-links"]);
  });

  it("flags content shorter than 50 characters in isolation", async () => {
    const content = "# T\n\n> s\n\n[l](https://example.com)\n";
    expect(content.length).toBeLessThan(50);
    const f = await agentReadinessCheck.run(
      context({
        llmsTxt: {
          url: "https://example.com/llms.txt",
          status: 200,
          content,
        },
      }),
    );
    expect(f.map((x) => x.code)).toEqual(["llms-txt-too-short"]);
  });

  it("flags a missing summary blockquote in isolation", async () => {
    const content =
      "# Title\n\nVisit [our page](https://example.com/) for more information about this fantastic website today.\n";
    const f = await agentReadinessCheck.run(
      context({
        llmsTxt: {
          url: "https://example.com/llms.txt",
          status: 200,
          content,
        },
      }),
    );
    expect(f.map((x) => x.code)).toEqual(["llms-txt-missing-summary"]);
  });
});

describe("declarative WebMCP", () => {
  it("flags a form annotated with only one of toolname/tooldescription", async () => {
    const html = await fixture("webmcp-tool-incomplete.html");
    const f = await agentReadinessCheck.run(context({ pages: [page(html)] }));
    const incomplete = f.filter(
      (x) => x.code === "webmcp-tool-annotation-incomplete",
    );
    expect(incomplete).toHaveLength(2);
    expect(incomplete.some((x) => x.message.includes("tooldescription"))).toBe(
      true,
    );
    expect(incomplete.some((x) => x.message.includes("toolname"))).toBe(true);
  });

  it("flags forms on the same page sharing a toolname", async () => {
    const html = await fixture("webmcp-duplicate-toolname.html");
    const f = await agentReadinessCheck.run(context({ pages: [page(html)] }));
    const duplicates = f.filter((x) => x.code === "webmcp-tool-name-duplicate");
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.message).toContain("search");
  });

  it("flags a named field with no description and clears described fields", async () => {
    const html = await fixture("webmcp-param-description.html");
    const f = await agentReadinessCheck.run(context({ pages: [page(html)] }));
    const missing = f.filter(
      (x) => x.code === "webmcp-param-description-missing",
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]?.message).toContain("email");
    expect(missing[0]?.message).toContain("contact");
  });

  it("flags an unannotated form with a user-facing control", async () => {
    const html = await fixture("webmcp-uncovered.html");
    const f = await agentReadinessCheck.run(context({ pages: [page(html)] }));
    const uncovered = f.filter((x) => x.code === "webmcp-form-uncovered");
    expect(uncovered).toHaveLength(1);
  });

  it("has no findings for a fully annotated, well-described form", async () => {
    const html = await fixture("webmcp-clean.html");
    const f = await agentReadinessCheck.run(context({ pages: [page(html)] }));
    expect(f.filter((x) => x.code.startsWith("webmcp-"))).toHaveLength(0);
  });
});
