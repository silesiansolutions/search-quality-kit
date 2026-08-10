import { describe, expect, it } from "vitest";
import { statusIsTrustworthy, urlGraph } from "../src/crawler/graph.js";
import { context, page } from "./helpers.js";

function findMaps(value: unknown, seen = new Set<unknown>()): boolean {
  if (!value || typeof value !== "object") return false;
  if (value instanceof Map) return true;
  if (seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((child) => findMaps(child, seen));
}

describe("urlGraph provenance", () => {
  it("marks every static-mode page node assumed and untrustworthy", () => {
    const html = '<a href="/other">link</a>';
    const { crawl } = context({
      pages: [
        page(html, "https://example.com/"),
        page(html, "https://example.com/other"),
      ],
    });
    const graph = urlGraph(crawl);
    const pageNodes = graph.nodes.filter((n) => n.kind === "page");
    expect(pageNodes).toHaveLength(2);
    for (const node of pageNodes) {
      expect(node.statusProvenance).toBe("assumed");
      expect(statusIsTrustworthy(node)).toBe(false);
    }
  });

  it("trusts no node of any kind in static mode", () => {
    const { crawl } = context({
      pages: [page('<a href="/other">link</a>', "https://example.com/")],
    });
    const graph = urlGraph(crawl);
    expect(graph.nodes.map((n) => n.kind)).toContain("sitemap");
    for (const node of graph.nodes) {
      expect(node.statusProvenance).not.toBe("observed");
      expect(statusIsTrustworthy(node)).toBe(false);
    }
  });

  it("marks every http-mode page node observed and trustworthy", () => {
    const html = '<a href="/other">link</a>';
    const { crawl } = context({
      mode: "http",
      pages: [
        page(html, "https://example.com/"),
        page(html, "https://example.com/other"),
      ],
    });
    const graph = urlGraph(crawl);
    const pageNodes = graph.nodes.filter((n) => n.kind === "page");
    expect(pageNodes).toHaveLength(2);
    for (const node of pageNodes) {
      expect(node.statusProvenance).toBe("observed");
      expect(statusIsTrustworthy(node)).toBe(true);
    }
  });

  it("marks a link target absent from pages as unresolved with no status", () => {
    const html = '<a href="/missing">link</a>';
    const { crawl } = context({ pages: [page(html)] });
    const graph = urlGraph(crawl);
    const target = graph.node("https://example.com/missing");
    expect(target).toBeDefined();
    expect(target?.statusProvenance).toBe("unresolved");
    expect(target?.status).toBeUndefined();
  });
});

describe("urlGraph memoization", () => {
  it("returns the same object identity for the same crawl", () => {
    const { crawl } = context({ pages: [page("<html></html>")] });
    expect(urlGraph(crawl)).toBe(urlGraph(crawl));
  });

  it("returns distinct graphs for distinct crawl objects", () => {
    const a = context({ pages: [page("<html></html>")] }).crawl;
    const b = context({ pages: [page("<html></html>")] }).crawl;
    expect(urlGraph(a)).not.toBe(urlGraph(b));
  });
});

describe("unresolvable link edges", () => {
  it("keeps rawTarget with to absent for an empty href", () => {
    const html = '<a href="">empty</a>';
    const { crawl } = context({ pages: [page(html)] });
    const graph = urlGraph(crawl);
    const edge = graph.outgoing("link", "https://example.com/")[0];
    expect(edge).toBeDefined();
    expect(edge?.rawTarget).toBe("");
    expect(edge?.to).toBeUndefined();
  });

  it("keeps rawTarget with to absent for a malformed href", () => {
    const html = '<a href="https://:::">malformed</a>';
    const { crawl } = context({ pages: [page(html)] });
    const graph = urlGraph(crawl);
    const edge = graph.outgoing("link", "https://example.com/")[0];
    expect(edge).toBeDefined();
    expect(edge?.rawTarget).toBe("https://:::");
    expect(edge?.to).toBeUndefined();
  });
});

describe("sitemap edges", () => {
  it("records the source sitemap file per edge", () => {
    const sitemap = {
      url: "https://example.com/sitemap.xml",
      status: 200,
      content:
        "<urlset><url><loc>https://example.com/a</loc><lastmod>2026-01-01</lastmod></url></urlset>",
    };
    const { crawl } = context({ sitemap, sitemaps: [sitemap] });
    const graph = urlGraph(crawl);
    const edge = graph.outgoing("sitemap", sitemap.url)[0];
    expect(edge).toBeDefined();
    expect(edge?.kind).toBe("sitemap");
    if (edge?.kind === "sitemap") {
      expect(edge.sitemapUrl).toBe(sitemap.url);
      expect(edge.lastmod).toBe("2026-01-01");
    }
    expect(edge?.to).toBe("https://example.com/a");
  });

  it("attributes edges from a sitemap index to each child sitemap", () => {
    const index = {
      url: "https://example.com/sitemap-index.xml",
      status: 200,
      content:
        "<sitemapindex><sitemap><loc>https://example.com/sitemap-a.xml</loc></sitemap><sitemap><loc>https://example.com/sitemap-b.xml</loc></sitemap></sitemapindex>",
    };
    const childA = {
      url: "https://example.com/sitemap-a.xml",
      status: 200,
      content: "<urlset><url><loc>https://example.com/a</loc></url></urlset>",
    };
    const childB = {
      url: "https://example.com/sitemap-b.xml",
      status: 200,
      content: "<urlset><url><loc>https://example.com/b</loc></url></urlset>",
    };
    const { crawl } = context({
      sitemap: index,
      sitemaps: [index, childA, childB],
    });
    const graph = urlGraph(crawl);
    const edgeA = graph.outgoing("sitemap", childA.url)[0];
    const edgeB = graph.outgoing("sitemap", childB.url)[0];
    expect(edgeA?.to).toBe("https://example.com/a");
    expect(edgeB?.to).toBe("https://example.com/b");
    if (edgeA?.kind === "sitemap") expect(edgeA.sitemapUrl).toBe(childA.url);
    if (edgeB?.kind === "sitemap") expect(edgeB.sitemapUrl).toBe(childB.url);
  });
});

describe("redirect edges", () => {
  it("appears only when the normalized initial and final URLs differ", () => {
    const redirected = page("<html></html>", "https://example.com/final");
    redirected.initialUrl = "https://example.com/initial";
    const { crawl } = context({ pages: [redirected] });
    const graph = urlGraph(crawl);
    expect(graph.edges.filter((e) => e.kind === "redirect")).toHaveLength(1);
  });

  it("does not appear for a trailing-slash-only difference", () => {
    const same = page("<html></html>", "https://example.com/page");
    same.initialUrl = "https://example.com/page/";
    const { crawl } = context({ pages: [same] });
    const graph = urlGraph(crawl);
    expect(graph.edges.filter((e) => e.kind === "redirect")).toHaveLength(0);
  });
});

describe("alternate edges", () => {
  it("preserves the raw hreflang string including case", () => {
    const html =
      '<link rel="alternate" hreflang="En-US" href="https://example.com/en">';
    const { crawl } = context({ pages: [page(html)] });
    const graph = urlGraph(crawl);
    const edge = graph.outgoing("alternate", "https://example.com/")[0];
    expect(edge?.kind).toBe("alternate");
    if (edge?.kind === "alternate") expect(edge.hreflang).toBe("En-US");
  });

  it("ignores a multi-token rel that marks an alternate stylesheet", () => {
    const html =
      '<link rel="alternate stylesheet" hreflang="en" href="/style.css">';
    const { crawl } = context({ pages: [page(html)] });
    const graph = urlGraph(crawl);
    expect(graph.outgoing("alternate", "https://example.com/")).toHaveLength(0);
  });
});

describe("robustness", () => {
  it("does not throw for a crawl with zero pages", () => {
    const { crawl } = context({ pages: [] });
    expect(() => urlGraph(crawl)).not.toThrow();
  });

  it("does not throw for a page with malformed HTML", () => {
    const html = "<html><body><div><a href=broken<<</a>";
    const { crawl } = context({ pages: [page(html)] });
    expect(() => urlGraph(crawl)).not.toThrow();
  });

  it("does not throw for a sitemap artifact with no content", () => {
    const sitemap = {
      url: "https://example.com/sitemap.xml",
      status: 404,
    };
    const { crawl } = context({ sitemap, sitemaps: [sitemap] });
    expect(() => urlGraph(crawl)).not.toThrow();
  });
});

describe("no Maps on the public surface", () => {
  it("exposes no Map instance anywhere on the UrlGraph", () => {
    const { crawl } = context({ pages: [page('<a href="/x">x</a>')] });
    const graph = urlGraph(crawl);
    expect(findMaps(graph.nodes)).toBe(false);
    expect(findMaps(graph.edges)).toBe(false);
  });
});
