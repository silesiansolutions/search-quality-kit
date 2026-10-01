export type AiCrawlerCategory = "answer-engine" | "training" | "user-fetcher";

export interface AiCrawlerClassification {
  category: AiCrawlerCategory;
  source: string;
}

const openai = "https://developers.openai.com/api/docs/bots";
const anthropic =
  "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler";
const perplexity = "https://docs.perplexity.ai/guides/bots";

export const aiCrawlerCategories: Readonly<
  Record<string, AiCrawlerClassification>
> = {
  "OAI-SearchBot": { category: "answer-engine", source: openai },
  "Claude-SearchBot": { category: "answer-engine", source: anthropic },
  PerplexityBot: { category: "answer-engine", source: perplexity },
  GPTBot: { category: "training", source: openai },
  ClaudeBot: { category: "training", source: anthropic },
  "Google-Extended": {
    category: "training",
    source:
      "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers",
  },
  "Applebot-Extended": {
    category: "training",
    source: "https://support.apple.com/en-us/119829",
  },
  CCBot: { category: "training", source: "https://commoncrawl.org/ccbot" },
  "meta-externalagent": {
    category: "training",
    source:
      "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers",
  },
  "ChatGPT-User": { category: "user-fetcher", source: openai },
  "Claude-User": { category: "user-fetcher", source: anthropic },
  "Perplexity-User": { category: "user-fetcher", source: perplexity },
};
