import { writeFile } from "node:fs/promises";
import { format } from "prettier";
import { argv, stdout } from "node:process";
import { fileURLToPath } from "node:url";

const repository = "ai-robots-txt/ai.robots.txt";
const ref = argv[2] ?? "main";
const target = fileURLToPath(
  new globalThis.URL("../src/data/aiRobotsRoster.ts", import.meta.url),
);

async function get(url, as = "json") {
  const response = await globalThis.fetch(url, {
    headers: { "user-agent": "search-quality-kit-roster-update" },
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return as === "json" ? response.json() : response.text();
}

const plain = (value) =>
  String(value ?? "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const respect = (value) => {
  const text = plain(value).toLowerCase();
  if (text.startsWith("yes")) return "yes";
  if (text.startsWith("no")) return "no";
  return "unclear";
};

const commit = await get(
  `https://api.github.com/repos/${repository}/commits/${ref}`,
);
const sha = commit.sha;
const raw = `https://raw.githubusercontent.com/${repository}/${sha}`;
const roster = await get(`${raw}/robots.json`);
const license = await get(`${raw}/LICENSE`, "text");
const copyright = license
  .split(/\r?\n/)
  .find((line) => /^copyright/i.test(line.trim()))
  ?.trim();
if (!copyright) throw new Error("LICENSE has no copyright line");

const entries = Object.keys(roster)
  .sort((a, b) => a.localeCompare(b, "en"))
  .map((token) => {
    const entry = roster[token];
    return `  ${JSON.stringify(token)}: {\n    operator: ${JSON.stringify(plain(entry.operator))},\n    respect: ${JSON.stringify(respect(entry.respect))},\n    function: ${JSON.stringify(plain(entry.function))},\n  },`;
  });

const source = `export interface AiRosterEntry {
  operator: string;
  respect: "yes" | "no" | "unclear";
  function: string;
}

export const aiRosterSource = {
  repository: "https://github.com/${repository}",
  commit: ${JSON.stringify(sha)},
  committedAt: ${JSON.stringify(commit.commit.committer.date)},
  license: "MIT",
  copyright: ${JSON.stringify(copyright)},
} as const;

export const aiRoster: Readonly<Record<string, AiRosterEntry>> = {
${entries.join("\n")}
};
`;

await writeFile(target, await format(source, { parser: "typescript" }));
stdout.write(
  `Wrote ${Object.keys(roster).length} agents from ${repository}@${sha.slice(0, 12)} to ${target}\n`,
);
