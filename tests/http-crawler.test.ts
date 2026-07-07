import { createServer, type RequestListener, type Server } from "node:http";
import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { canonicalCheck } from "../src/checks/canonical.js";
import { indexabilityCheck } from "../src/checks/indexability.js";
import { internalLinksCheck } from "../src/checks/internalLinks.js";
import { configSchema } from "../src/config/schema.js";
import { crawlHttp } from "../src/crawler/crawlSite.js";

const servers: Server[] = [];

async function listen(
  handler: RequestListener,
): Promise<{ server: Server; base: string }> {
  const server = createServer(handler);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

describe("HTTP crawl redirects", () => {
  it("uses the final trailing-slash URL for links and canonical checks", async () => {
    let base = "";
    ({ base } = await listen((request, response) => {
      if (request.url === "/") {
        response.writeHead(301, { location: "/section" }).end();
        return;
      }
      if (request.url === "/section") {
        response.writeHead(308, { location: "/section/" }).end();
        return;
      }
      if (request.url === "/section/") {
        response
          .writeHead(200, { "content-type": "text/html" })
          .end(
            `<link rel="canonical" href="${base}/section/"><a href="child">Child</a>`,
          );
        return;
      }
      if (request.url === "/section/child") {
        response.writeHead(200, { "content-type": "text/html" }).end("Child");
        return;
      }
      if (request.url === "/robots.txt") {
        response.writeHead(200).end("User-agent: *\nAllow: /");
        return;
      }
      if (request.url === "/sitemap.xml") {
        response
          .writeHead(200)
          .end(`<urlset><url><loc>${base}/section/</loc></url></urlset>`);
        return;
      }
      response.writeHead(404).end();
    }));
    const config = configSchema.parse({ site: { baseUrl: base } });
    const crawl = await crawlHttp(base, config);

    expect(crawl.pages[0]).toEqual(
      expect.objectContaining({
        initialUrl: `${base}/`,
        finalUrl: `${base}/section/`,
        url: `${base}/section/`,
      }),
    );
    expect(crawl.pages.map((page) => page.url)).toContain(
      `${base}/section/child`,
    );
    expect(await canonicalCheck.run({ config, crawl })).not.toContainEqual(
      expect.objectContaining({ code: "not-self-referencing" }),
    );
    expect(await indexabilityCheck.run({ config, crawl })).not.toContainEqual(
      expect.objectContaining({ code: "redirect-outside-origin" }),
    );
  });
});

describe("HTTP orphan detection", () => {
  it("combines recursive sitemap URLs with links, entrypoints, and exclusions", async () => {
    let base = "";
    ({ base } = await listen((request, response) => {
      if (request.url === "/") {
        response.writeHead(200).end('<a href="/linked">Linked</a>');
        return;
      }
      if (request.url === "/linked") {
        response.writeHead(200).end("Linked page");
        return;
      }
      if (request.url === "/robots.txt") {
        response
          .writeHead(200)
          .end(`User-agent: *\nSitemap: ${base}/sitemap-index.xml`);
        return;
      }
      if (request.url === "/sitemap-index.xml") {
        response
          .writeHead(200)
          .end(
            `<sitemapindex><sitemap><loc>${base}/pages.xml</loc></sitemap></sitemapindex>`,
          );
        return;
      }
      if (request.url === "/pages.xml") {
        response.writeHead(200).end(
          `<urlset>
            <url><loc>${base}/</loc></url>
            <url><loc>${base}/linked</loc></url>
            <url><loc>${base}/orphan</loc></url>
            <url><loc>${base}/excluded</loc></url>
          </urlset>`,
        );
        return;
      }
      response.writeHead(404).end();
    }));
    const config = configSchema.parse({
      site: { baseUrl: base },
      crawl: { exclude: ["/excluded"] },
    });
    const crawl = await crawlHttp(base, config);
    const findings = await internalLinksCheck.run({ config, crawl });

    expect(crawl.sitemaps).toHaveLength(2);
    expect(
      findings.filter((finding) => finding.code === "orphan-page"),
    ).toEqual([expect.objectContaining({ url: `${base}/orphan` })]);
  });
});
