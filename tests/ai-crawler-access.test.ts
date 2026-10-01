import { describe, expect, it } from "vitest";
import { robotsCheck } from "../src/checks/robots.js";
import { configSchema } from "../src/config/schema.js";
import { aiCrawlerCategories } from "../src/data/aiCrawlerCategories.js";
import { aiRoster, aiRosterSource } from "../src/data/aiRobotsRoster.js";
import type { Finding } from "../src/report/types.js";
import { context, page } from "./helpers.js";

const robots = (content: string) => ({
  url: "https://example.com/robots.txt",
  status: 200,
  content,
});

const pages = [
  page("<html><body><main>Home</main></body></html>"),
  page(
    "<html><body><main>Post</main></body></html>",
    "https://example.com/blog/post",
  ),
];

async function run(content: string, input: Record<string, unknown> = {}) {
  const config = configSchema.parse({
    site: { baseUrl: "https://example.com" },
    ...input,
  });
  const { crawl } = context({ robots: robots(content), pages }, config);
  return robotsCheck.run({ config, crawl });
}

const ai = (findings: Finding[]) =>
  findings
    .filter((f) => f.code.startsWith("ai-"))
    .map((f) => [f.code, f.severity, f.message.split(" (")[0]]);

describe("AI crawler access audit", () => {
  it("ships a roster with its source and classifies only roster tokens", () => {
    expect(aiRosterSource.license).toBe("MIT");
    expect(aiRosterSource.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(aiRosterSource.copyright).toMatch(/^Copyright/);
    for (const token of Object.keys(aiCrawlerCategories))
      expect(aiRoster[token], token).toBeDefined();
  });

  it("reports nothing when every agent may fetch every page", async () => {
    expect(ai(await run("User-agent: *\nAllow: /"))).toEqual([]);
  });

  it("warns for answer engines and informs for training crawlers", async () => {
    const found = await run(
      "User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nUser-agent: GPTBot\nDisallow: /",
    );
    expect(ai(found)).toEqual([
      ["ai-search-blocked", "warning", "robots.txt blocks OAI-SearchBot"],
      ["ai-crawler-blocked", "info", "robots.txt blocks GPTBot"],
    ]);
    const search = found.find((f) => f.code === "ai-search-blocked")!;
    expect(search.message).toContain(
      "(answer engine) from every crawled indexable page.",
    );
    expect(search.message).not.toContain("OpenAI");
    expect(search.suggestion).toContain("OAI-SearchBot is operated by OpenAI.");
    expect(search.url).toBe("https://example.com/robots.txt");
    expect(search.classification).toEqual(["local-heuristic"]);
    expect(search.googleDocs).toBeUndefined();
    expect(search.relatedUrls).toEqual([
      "https://example.com/",
      "https://example.com/blog/post",
    ]);
  });

  it("separates partial blocks and keeps counts out of the message", async () => {
    const found = await run(
      "User-agent: *\nAllow: /\n\nUser-agent: Claude-SearchBot\nDisallow: /blog",
    );
    const search = found.find((f) => f.code === "ai-search-blocked")!;
    expect(search.message).toContain("from some crawled indexable pages.");
    expect(search.message).not.toMatch(/\d/);
    expect(search.relatedUrls).toEqual(["https://example.com/blog/post"]);
  });

  it("evaluates unnamed classified agents only when Googlebot has its own group", async () => {
    const own = await run(
      "User-agent: *\nDisallow: /blog\n\nUser-agent: Googlebot\nAllow: /",
    );
    expect(ai(own).map(([, , subject]) => subject)).toContain(
      "robots.txt blocks PerplexityBot",
    );
    const shared = await run("User-agent: *\nDisallow: /blog");
    expect(ai(shared)).toEqual([]);
    expect(shared.some((f) => f.code === "indexable-url-blocked")).toBe(true);
  });

  it("stays silent when * blocks the whole site, which disallow-all reports", async () => {
    const found = await run("User-agent: *\nDisallow: /");
    expect(ai(found)).toEqual([]);
    expect(found.some((f) => f.code === "disallow-all")).toBe(true);
  });

  it("reports other roster agents only when robots.txt names them", async () => {
    const found = await run(
      "User-agent: *\nAllow: /\n\nUser-agent: Bytespider\nUser-agent: NotARosterBot\nDisallow: /",
    );
    const bytespider = found.find((f) =>
      f.message.startsWith("robots.txt blocks Bytespider"),
    )!;
    expect(bytespider.code).toBe("ai-crawler-blocked");
    expect(bytespider.message).toContain("Bytespider (AI agent)");
    expect(bytespider.suggestion).toContain("operated by ByteDance");
    expect(bytespider.suggestion).toContain("not honoring robots.txt");
    expect(found.some((f) => f.message.includes("NotARosterBot"))).toBe(false);
  });

  it("skips agents declared in blockedByPolicy, case-insensitively", async () => {
    const found = await run(
      "User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nUser-agent: CCBot\nDisallow: /",
      { rules: { robots: { aiCrawlers: { blockedByPolicy: ["gptbot"] } } } },
    );
    expect(ai(found)).toEqual([
      ["ai-crawler-blocked", "info", "robots.txt blocks CCBot"],
    ]);
  });
});

describe("named group trap", () => {
  it("reports a named group that drops Disallow rules from *", async () => {
    const found = (
      await run(
        "User-agent: *\nDisallow: /private\n\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nAllow: /",
      )
    ).filter((f) => f.code === "named-group-ignores-wildcard");
    expect(found.map((f) => [f.severity, f.message])).toEqual([
      [
        "info",
        "The robots.txt group for gptbot, claudebot does not inherit Disallow rules from the * group, so it may fetch /private.",
      ],
    ]);
  });

  it("reports a pattern rule the named group does not cover", async () => {
    const found = (
      await run(
        "User-agent: *\nDisallow: /*.pdf$\n\nUser-agent: GPTBot\nAllow: /",
      )
    ).filter((f) => f.code === "named-group-ignores-wildcard");
    expect(found.map((f) => f.message)).toEqual([
      "The robots.txt group for gptbot does not inherit Disallow rules from the * group, so it may fetch /*.pdf$.",
    ]);
  });

  it("stays silent when the named group repeats the rule or * has none", async () => {
    for (const content of [
      "User-agent: *\nDisallow: /private\n\nUser-agent: GPTBot\nDisallow: /private",
      "User-agent: *\nDisallow: /private\n\nUser-agent: GPTBot\nDisallow: /",
      "User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nAllow: /",
      "User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /",
      "User-agent: *\nDisallow: /*\n\nUser-agent: Googlebot\nAllow: /",
      "User-agent: *\nDisallow: /*.pdf$\n\nUser-agent: GPTBot\nDisallow: /*.pdf$",
      "User-agent: *\nDisallow: /*?sid=\n\nUser-agent: Googlebot\nDisallow: /*?sid=",
    ])
      expect(
        (await run(content)).filter(
          (f) => f.code === "named-group-ignores-wildcard",
        ),
        content,
      ).toEqual([]);
  });
});
