import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runVerification } from "../src/engine/verify.js";
import { formatMarkdownReport } from "../src/report/formatMarkdownReport.js";

describe("report summary counts", () => {
  it("leaves reviewed suppressions out of the severity counts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "search-quality-kit-sum-"));

    try {
      await mkdir(path.join(root, "dist", "legal"), { recursive: true });
      await writeFile(
        path.join(root, "dist", "index.html"),
        '<html lang="en"><head><title>Home page title</title></head><body><a href="/legal/">Legal</a></body></html>',
      );
      await writeFile(
        path.join(root, "dist", "legal", "index.html"),
        '<html lang="en"><head></head><body><a href="/">Home</a></body></html>',
      );
      await writeFile(
        path.join(root, "search-quality.config.json"),
        JSON.stringify({
          site: { baseUrl: "https://example.com" },
          build: { distDir: "dist" },
          crawl: { mode: "static" },
          suppressions: [
            {
              code: "metadata.missing-title",
              urlPattern: "/legal/**",
              reason: "Fixture page without a title.",
              owner: "site-owner",
            },
          ],
        }),
      );

      const { report } = await runVerification({ root, skipBuild: true });
      const suppressed = report.findings.filter((f) => f.suppressed);
      const active = report.findings.filter((f) => !f.suppressed);

      expect(suppressed.map((f) => `${f.check}.${f.code}`)).toContain(
        "metadata.missing-title",
      );
      expect(report.summary).toMatchObject({
        errors: active.filter((f) => f.severity === "error").length,
        warnings: active.filter((f) => f.severity === "warning").length,
        info: active.filter((f) => f.severity === "info").length,
        suppressedFindings: suppressed.length,
      });
      expect(formatMarkdownReport(report)).toContain(
        `- Errors: ${active.filter((f) => f.severity === "error").length}`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
