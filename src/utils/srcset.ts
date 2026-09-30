import { normalizeUrl } from "./urls.js";

export interface ImageCandidate {
  url: string;
  descriptor?: string;
}

export function srcsetCandidates(
  value: string,
  base: string,
): ImageCandidate[] {
  return value
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .flatMap((candidate) => {
      const match = candidate.match(/^(\S+)(?:\s+(\d+(?:\.\d+)?[wx]))?$/);
      if (!match?.[1]) return [];
      try {
        return [
          {
            url: normalizeUrl(match[1], base),
            ...(match[2] ? { descriptor: match[2] } : {}),
          },
        ];
      } catch {
        return [];
      }
    });
}
