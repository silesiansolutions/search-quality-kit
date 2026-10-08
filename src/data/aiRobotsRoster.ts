export interface AiRosterEntry {
  operator: string;
  respect: "yes" | "no" | "unclear";
  function: string;
}

export const aiRosterSource = {
  repository: "https://github.com/ai-robots-txt/ai.robots.txt",
  commit: "9ad8a47e23f7689ec3ea2423a47569d0bb91bdaf",
  committedAt: "2026-10-03T03:02:07Z",
  license: "MIT",
  copyright: "Copyright (c) 2024 ai.robots.txt",
} as const;

export const aiRoster: Readonly<Record<string, AiRosterEntry>> = {
  AddSearchBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Search Crawlers",
  },
  AgentDataBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Providers",
  },
  AgentTimes: {
    operator: "The Agent Times",
    respect: "unclear",
    function: "Data Scraper from RSS Feeds.",
  },
  AI2Bot: {
    operator: "Ai2",
    respect: "yes",
    function: "Content is used to train open language models.",
  },
  "AI2Bot-DeepResearchEval": {
    operator: "Ai2, a non-profit AI research institute",
    respect: "unclear",
    function: "AI Assistants",
  },
  "Ai2Bot-Dolma": {
    operator: "Ai2",
    respect: "yes",
    function: "Content is used to train open language models.",
  },
  aiHitBot: {
    operator: "aiHit",
    respect: "yes",
    function:
      "A massive, artificial intelligence/machine learning, automated system.",
  },
  AIWebIndex: {
    operator: "Lyrenth",
    respect: "yes",
    function: "AI Search Crawlers",
  },
  "amazon-kendra": {
    operator: "Amazon",
    respect: "yes",
    function: "Collects data for AI natural language search",
  },
  "amazon-QBusiness": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Assistants",
  },
  Amazonbot: {
    operator: "Amazon",
    respect: "yes",
    function: "Service improvement and enabling answers for Alexa users.",
  },
  AmazonBuyForMe: {
    operator: "Amazon",
    respect: "unclear",
    function: "AI Agents",
  },
  "Amzn-SearchBot": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Search Crawlers",
  },
  "Amzn-User": {
    operator:
      "Amazon, used for fetching web content to answer user queries through Alexa and other Amazon AI services",
    respect: "unclear",
    function: "AI Assistants",
  },
  Andibot: {
    operator: "Andi",
    respect: "unclear",
    function: "Search engine using generative AI, AI Search Assistant",
  },
  Anomura: {
    operator: "Direqt",
    respect: "yes",
    function: "Collects data for AI search",
  },
  "anthropic-ai": {
    operator: "Anthropic",
    respect: "unclear",
    function: "Scrapes data to train Anthropic's AI products.",
  },
  ApifyBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Providers",
  },
  ApifyWebsiteContentCrawler: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Providers",
  },
  Applebot: {
    operator: "Unclear at this time.",
    respect: "yes",
    function: "AI Search Crawlers",
  },
  "Applebot-Extended": {
    operator: "Apple",
    respect: "yes",
    function:
      "Powers features in Siri, Spotlight, Safari, Apple Intelligence, and others.",
  },
  "Aranet-SearchBot": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "Undocumented AI Agents",
  },
  "atlassian-bot": {
    operator: "Atlassian",
    respect: "yes",
    function: "AI search, assistants and agents",
  },
  Awario: {
    operator: "Awario",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  "AzureAI-SearchBot": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Search Crawlers",
  },
  bedrockbot: {
    operator: "Amazon",
    respect: "yes",
    function: "Data scraping for custom AI applications.",
  },
  "bigsur.ai": {
    operator:
      "Big Sur AI that fetches website content to enable AI-powered web agents, sales assistants, and content marketing solutions for busi…",
    respect: "unclear",
    function: "AI Assistants",
  },
  BixelBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Providers",
  },
  Bravebot: {
    operator: "https://safe.search.brave.com/help/brave-search-crawler",
    respect: "yes",
    function: "AI Data Providers",
  },
  Brightbot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Providers",
  },
  "Brightbot 1.0": {
    operator: "https://brightdata.com/brightbot",
    respect: "unclear",
    function: "LLM/AI training.",
  },
  BuddyBot: {
    operator: "BuddyBotLearning",
    respect: "unclear",
    function: "AI Learning Companion",
  },
  Bytespider: {
    operator: "ByteDance",
    respect: "no",
    function: "LLM training.",
  },
  CCBot: {
    operator: "Common Crawl Foundation",
    respect: "yes",
    function:
      "Provides open crawl dataset, used for many purposes, including Machine Learning/AI.",
  },
  Channel3Bot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Search Crawlers",
  },
  "ChatGLM-Spider": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  "ChatGPT Agent": {
    operator: "OpenAI",
    respect: "yes",
    function: "AI Agents",
  },
  "ChatGPT-User": {
    operator: "OpenAI",
    respect: "yes",
    function: "AI Assistants",
  },
  "Claude-Code": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Coding Agents",
  },
  "Claude-SearchBot": {
    operator: "Anthropic",
    respect: "yes",
    function:
      "Claude-SearchBot navigates the web to improve search result quality for users. It analyzes online content specifically to enhance the relevance and accuracy of search responses.",
  },
  "Claude-User": {
    operator: "Anthropic",
    respect: "yes",
    function: "AI Assistants",
  },
  "Claude-Web": {
    operator: "Anthropic",
    respect: "unclear",
    function: "Undocumented AI Agents",
  },
  ClaudeBot: {
    operator: "Anthropic",
    respect: "yes",
    function: "Scrapes data to train Anthropic's AI products.",
  },
  "Cloudflare-AutoRAG": {
    operator: "Cloudflare",
    respect: "yes",
    function: "Collects data for AI search",
  },
  CloudflareBrowserRenderingCrawler: {
    operator:
      "Cloudflare that returns rendered website content for research, monitoring, and AI data workflows",
    respect: "unclear",
    function: "AI Data Providers",
  },
  CloudVertexBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  Code: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Coding Agents",
  },
  "cohere-ai": {
    operator: "Cohere",
    respect: "unclear",
    function: "Retrieves data to provide responses to user-initiated prompts.",
  },
  "cohere-training-data-crawler": {
    operator:
      "Cohere to download training data for its LLMs (Large Language Models) that power its enterprise AI products",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  Cotoyogi: {
    operator: "ROIS",
    respect: "yes",
    function: "AI LLM Scraper.",
  },
  CragCrawler: {
    operator:
      "CragSoftware, a Brazil-based software company specializing in data engineering and AI web scraping services",
    respect: "unclear",
    function: "AI Data Providers",
  },
  Crawl4AI: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "Undocumented AI Agents",
  },
  Crawlspace: {
    operator: "Crawlspace",
    respect: "yes",
    function: "AI Data Providers",
  },
  Cursor: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Coding Agents",
  },
  "Datenbank Crawler": {
    operator: "Datenbank",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  DeepSeekBot: {
    operator: "DeepSeek",
    respect: "no",
    function: "Training language models and improving AI products",
  },
  Devin: {
    operator: "Devin AI",
    respect: "yes",
    function: "AI Coding Agents",
  },
  Diffbot: {
    operator: "Diffbot",
    respect: "unclear",
    function: "AI Data Providers",
  },
  "Diffbot-User": {
    operator: "Diffbot",
    respect: "yes",
    function: "AI Assistants",
  },
  DoubaoBot: {
    operator: "ByteDance",
    respect: "unclear",
    function: "AI crawler for ByteDance's Doubao AI assistant.",
  },
  DuckAssistBot: {
    operator: "Unclear at this time.",
    respect: "yes",
    function: "AI Assistants",
  },
  "Echobot Bot": {
    operator: "Echobox",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  EchoboxBot: {
    operator: "Echobox",
    respect: "unclear",
    function: "Data collection to support AI-powered products.",
  },
  ERNIEBot: {
    operator: "Baidu",
    respect: "unclear",
    function:
      "Collects public web content for Baidu's ERNIE large language models.",
  },
  ExaBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Providers",
  },
  ExaSearchBot: {
    operator: "Exa",
    respect: "unclear",
    function: "AI Search Crawlers",
  },
  FacebookBot: {
    operator: "Meta/Facebook",
    respect: "yes",
    function: "Training language models",
  },
  facebookexternalhit: {
    operator: "Meta/Facebook",
    respect: "no",
    function:
      "Ostensibly only for sharing, but likely used as an AI crawler as well",
  },
  Factset_spyderbot: {
    operator: "Factset",
    respect: "unclear",
    function: "AI model training.",
  },
  FirecrawlAgent: {
    operator:
      "Firecrawl that extracts web content and converts it into structured data for use in LLM and AI applications",
    respect: "yes",
    function: "AI Data Providers",
  },
  FriendlyCrawler: {
    operator: "Unknown",
    respect: "yes",
    function:
      "We are using the data from the crawler to build datasets for machine learning experiments.",
  },
  "GeistHaus-PageFetcher": {
    operator:
      "GeistHaus, a company developing AI systems for therapy and psychological assessment",
    respect: "unclear",
    function: "AI Assistants",
  },
  "Gemini-Deep-Research": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Assistants",
  },
  "Google-Agent": {
    operator: "Unclear at this time.",
    respect: "yes",
    function: "AI Agents",
  },
  "Google-CloudVertexBot": {
    operator: "Google",
    respect: "yes",
    function: "Build and manage AI models for businesses employing Vertex AI",
  },
  "Google-Extended": {
    operator: "Google",
    respect: "yes",
    function: "LLM training.",
  },
  "Google-Firebase": {
    operator: "Google",
    respect: "unclear",
    function:
      "Used as part of AI apps developed by users of Google's Firebase AI products.",
  },
  "Google-Gemini-CLI": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Coding Agents",
  },
  "Google-NotebookLM": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Assistants",
  },
  "GoogleAgent-Mariner": {
    operator: "Google",
    respect: "unclear",
    function: "AI Agents",
  },
  "GoogleAgent-URLContext": {
    operator: "Google that retrieves web content on behalf of Gemini API users",
    respect: "unclear",
    function: "AI Assistants",
  },
  GoogleOther: {
    operator: "Google",
    respect: "yes",
    function: "Scrapes data.",
  },
  "GoogleOther-Image": {
    operator: "Google",
    respect: "yes",
    function: "Scrapes data.",
  },
  "GoogleOther-Video": {
    operator: "Google",
    respect: "yes",
    function: "Scrapes data.",
  },
  GPTBot: {
    operator: "OpenAI",
    respect: "yes",
    function: "Scrapes data to train OpenAI's products.",
  },
  HenkBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Providers",
  },
  iAskBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "Undocumented AI Agents",
  },
  iaskspider: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "Undocumented AI Agents",
  },
  "iaskspider/2.0": {
    operator: "iAsk",
    respect: "no",
    function: "Crawls sites to provide answers to user queries.",
  },
  "ICC-Crawler": {
    operator: "NICT",
    respect: "yes",
    function: "Scrapes data to train and support AI technologies.",
  },
  ImagesiftBot: {
    operator: "ImageSift",
    respect: "yes",
    function:
      "ImageSiftBot is a web crawler that scrapes the internet for publicly available images to support their suite of web intelligence products",
  },
  imageSpider: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  img2dataset: {
    operator: "img2dataset",
    respect: "unclear",
    function: "Scrapes images for use in LLMs.",
  },
  ISSCyberRiskCrawler: {
    operator: "ISS-Corporate",
    respect: "no",
    function: "Scrapes data to train machine learning models.",
  },
  "kagi-fetcher": {
    operator:
      "Kagi that fetches web content to answer user queries through Kagi AI, their suite of AI-powered tools including Assistant, Res…",
    respect: "unclear",
    function: "AI Assistants",
  },
  "Kangaroo Bot": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  KeenableBot: {
    operator: "Keenable",
    respect: "unclear",
    function: "AI Search Crawlers",
  },
  "Kimi-Agent": {
    operator:
      "Moonshot AI that browses websites while carrying out user-directed research and other tasks",
    respect: "unclear",
    function: "AI Agents",
  },
  "Kimi-SearchBot": {
    operator: "Moonshot AI",
    respect: "yes",
    function: "AI Search Crawlers",
  },
  "Kimi-User": {
    operator:
      "Moonshot AI that fetches web content on behalf of users interacting with Kimi",
    respect: "unclear",
    function: "AI Assistants",
  },
  KimiBot: {
    operator: "Moonshot AI",
    respect: "yes",
    function: "AI Data Scrapers",
  },
  KlaviyoAIBot: {
    operator: "Klaviyo",
    respect: "yes",
    function: "AI Assistants",
  },
  KunatoCrawler: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "Undocumented AI Agents",
  },
  "laion-huggingface-processor": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  LAIONDownloader: {
    operator: "Large-scale Artificial Intelligence Open Network",
    respect: "no",
    function: "AI tools and models for machine learning research.",
  },
  LCC: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  Lightpanda: {
    operator:
      "Anyone who downloads the Lightpanda client. Possibly being used by a Grok-adjacent organization's botnet.",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  LinerBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Assistants",
  },
  "Linguee Bot": {
    operator: "Linguee",
    respect: "no",
    function: "AI powered translation service",
  },
  LinkupBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Search Crawlers",
  },
  "Manus-User": {
    operator: "Butterfly Effect, a company based in China",
    respect: "unclear",
    function: "AI Agents",
  },
  "meta-externalagent": {
    operator: "Meta",
    respect: "yes",
    function: "Used to train models and improve products.",
  },
  "Meta-ExternalAgent": {
    operator: "Unclear at this time.",
    respect: "yes",
    function: "AI Data Scrapers",
  },
  "meta-externalfetcher": {
    operator: "Unclear at this time.",
    respect: "no",
    function: "AI Assistants",
  },
  "Meta-ExternalFetcher": {
    operator: "Unclear at this time.",
    respect: "no",
    function: "AI Assistants",
  },
  "meta-webindexer": {
    operator: "Meta",
    respect: "unclear",
    function: "AI Assistants",
  },
  "MistralAI-Index": {
    operator: "Mistral AI",
    respect: "yes",
    function:
      "Indexes web content for Mistral AI's search, used to answer questions in Le Chat. Per Mistral, not used for model training.",
  },
  "MistralAI-Training": {
    operator: "Mistral AI",
    respect: "yes",
    function: "AI Data Scrapers",
  },
  "MistralAI-User": {
    operator: "Mistral",
    respect: "unclear",
    function: "AI Assistants",
  },
  "MistralAI-User/1.0": {
    operator: "Mistral AI",
    respect: "yes",
    function: "Takes action based on user prompts.",
  },
  "Mozilla-Tabstack": {
    operator:
      "Mozilla that performs programmatic, AI-driven interactions with web content through Tabstack",
    respect: "yes",
    function: "AI Data Providers",
  },
  MyCentralAIScraperBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI data scraper",
  },
  NagetBot: {
    operator:
      "Naget Inc (founded by Chris Samarinas, headquarter in Amherst, Massachusetts)",
    respect: "unclear",
    function: "AI data scraper",
  },
  "netEstate Imprint Crawler": {
    operator: "netEstate",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  newsai: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI data scraper",
  },
  NotebookLM: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Assistants",
  },
  NovaAct: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Agents",
  },
  "OAI-AdsBot": {
    operator: "OpenAI",
    respect: "unclear",
    function: "Validates and targets ads on ChatGPT.",
  },
  "OAI-SearchBot": {
    operator: "OpenAI",
    respect: "yes",
    function: "Search result generation.",
  },
  omgili: {
    operator: "Webz.io",
    respect: "yes",
    function: "Data is sold.",
  },
  omgilibot: {
    operator: "Webz.io",
    respect: "yes",
    function: "Data is sold.",
  },
  OpenAI: {
    operator: "OpenAI",
    respect: "yes",
    function: "Unclear at this time.",
  },
  opencode: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Coding Agents",
  },
  Operator: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Agents",
  },
  PanguBot: {
    operator: "the Chinese company Huawei",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  Panscient: {
    operator: "Panscient",
    respect: "yes",
    function: "Data collection and analysis using machine learning and AI.",
  },
  "panscient.com": {
    operator: "Panscient",
    respect: "yes",
    function: "Data collection and analysis using machine learning and AI.",
  },
  "Perplexity-User": {
    operator: "Perplexity",
    respect: "no",
    function: "AI Assistants",
  },
  PerplexityBot: {
    operator: "Perplexity",
    respect: "yes",
    function: "Search result generation.",
  },
  PetalBot: {
    operator: "Huawei",
    respect: "yes",
    function:
      "Used to provide recommendations in Hauwei assistant and AI search services.",
  },
  PhindBot: {
    operator: "phind",
    respect: "unclear",
    function: "AI Assistants",
  },
  "Poggio-Citations": {
    operator:
      "Poggio, a company that provides AI sales enablement tools for creating tailored narratives, business cases, and account plan…",
    respect: "unclear",
    function: "AI Assistants",
  },
  "Poseidon Research Crawler": {
    operator: "Poseidon Research",
    respect: "unclear",
    function: "AI research crawler",
  },
  qodercli: {
    operator:
      "Qoder that helps developers build, debug, and modify software from the terminal",
    respect: "unclear",
    function: "AI Coding Agents",
  },
  QualifiedBot: {
    operator: "Qualified",
    respect: "unclear",
    function: "AI Assistants",
  },
  "Querit-SearchBot": {
    operator:
      "Querit that indexes web content for their search API service, which is designed to provide real-time search results for larg…",
    respect: "unclear",
    function: "AI Data Providers",
  },
  QueritBot: {
    operator:
      "Querit, a company providing a search API for large language model integration",
    respect: "unclear",
    function: "AI Data Providers",
  },
  QuillBot: {
    operator: "Quillbot",
    respect: "unclear",
    function: "Company offers AI detection, writing tools and other services.",
  },
  "quillbot.com": {
    operator: "Quillbot",
    respect: "unclear",
    function: "Company offers AI detection, writing tools and other services.",
  },
  QwenBot: {
    operator: "Alibaba",
    respect: "unclear",
    function:
      "Collects public web content for Alibaba's Qwen (Tongyi Qianwen) large language models.",
  },
  Reflectionbot: {
    operator: "Reflection",
    respect: "unclear",
    function: "Undocumented AI Agents",
  },
  SBIntuitionsBot: {
    operator: "SB Intuitions",
    respect: "yes",
    function: "Uses data gathered in AI development and information analysis.",
  },
  Scrapy: {
    operator: "Zyte",
    respect: "unclear",
    function: "Scrapes data for a variety of uses including training AI.",
  },
  "SemrushBot-OCOB": {
    operator: "Semrush",
    respect: "yes",
    function: "Crawls your site for ContentShake AI tool.",
  },
  "SemrushBot-SWA": {
    operator: "Semrush",
    respect: "yes",
    function: "Checks URLs on your site for SEO Writing Assistant.",
  },
  "Shap-User": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Assistants",
  },
  ShapBot: {
    operator: "Parallel",
    respect: "yes",
    function: "AI Data Providers",
  },
  "Sidetrade indexer bot": {
    operator: "Sidetrade",
    respect: "unclear",
    function: "Extracts data for a variety of uses including training AI.",
  },
  Spider: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  TavilyBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Providers",
  },
  "Terra Cotta": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Providers",
  },
  TerraCotta: {
    operator: "Ceramic AI",
    respect: "yes",
    function: "AI Data Providers",
  },
  Thinkbot: {
    operator: "Thinkbot",
    respect: "no",
    function: "Insights on AI integration and automation.",
  },
  TikTokSpider: {
    operator: "ByteDance",
    respect: "unclear",
    function: "LLM training.",
  },
  Timpibot: {
    operator: "Timpi",
    respect: "unclear",
    function: "Scrapes data for use in training LLMs.",
  },
  TongyiBot: {
    operator:
      "Alibaba that fetches web content for the Tongyi Qianwen assistant and related Qwen-generated answers",
    respect: "unclear",
    function: "AI Assistants",
  },
  Trae: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Coding Agents",
  },
  TwinAgent: {
    operator:
      "Twin, a platform that creates automated workers to perform tasks by integrating with APIs and controlling web applications through browser automa…",
    respect: "unclear",
    function: "AI Agents",
  },
  UseAI: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Assistants",
  },
  VelenPublicWebCrawler: {
    operator: "Velen Crawler",
    respect: "yes",
    function:
      "Scrapes data for business data sets and machine learning models.",
  },
  WARDBot: {
    operator: "WEBSPARK",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  "webzio-extended": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  "Webzio-Extended": {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Data Scrapers",
  },
  wpbot: {
    operator: "QuantumCloud",
    respect: "unclear",
    function: "Live chat support and lead generation.",
  },
  WRTNBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "Undocumented AI Agents",
  },
  YaK: {
    operator: "Meltwater",
    respect: "unclear",
    function:
      "According to the Meltwater Consumer Intelligence page 'By applying AI, data science, and market research expertise to a live feed of global data sources, we transform unstructured data into actionable insights allowing better decision-making'.",
  },
  YandexAdditional: {
    operator: "Yandex",
    respect: "yes",
    function: "Scrapes/analyzes data for the YandexGPT LLM.",
  },
  YandexAdditionalBot: {
    operator: "Yandex",
    respect: "yes",
    function: "Scrapes/analyzes data for the YandexGPT LLM.",
  },
  YiyanBot: {
    operator: "Baidu that fetches web content for the yiyan",
    respect: "unclear",
    function: "AI Assistants",
  },
  YouBot: {
    operator: "You",
    respect: "yes",
    function: "Scrapes data for search engine and LLMs.",
  },
  ZanistaBot: {
    operator: "Unclear at this time.",
    respect: "unclear",
    function: "AI Search Crawlers",
  },
};
