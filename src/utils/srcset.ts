import { normalizeUrl } from "./urls.js";

export interface ImageCandidate {
  url: string;
  descriptor?: string;
}

function splitSrcset(value: string) {
  const candidates: { url: string; descriptor?: string }[] = [];
  let position = 0;
  while (position < value.length) {
    while (position < value.length && /[\s,]/.test(value[position]!))
      position += 1;
    if (position >= value.length) break;
    let end = position;
    while (end < value.length && !/\s/.test(value[end]!)) end += 1;
    let url = value.slice(position, end);
    position = end;
    let descriptor = "";
    if (url.endsWith(",")) url = url.replace(/,+$/, "");
    else {
      const comma = value.indexOf(",", position);
      const stop = comma < 0 ? value.length : comma;
      descriptor = value.slice(position, stop).trim();
      position = stop + 1;
    }
    if (url) candidates.push({ url, ...(descriptor ? { descriptor } : {}) });
  }
  return candidates;
}

export function srcsetCandidates(
  value: string,
  base: string,
): ImageCandidate[] {
  return splitSrcset(value).flatMap((candidate) => {
    const descriptor = candidate.descriptor?.match(/^\d+(?:\.\d+)?[wx]$/)?.[0];
    try {
      return [
        {
          url: normalizeUrl(candidate.url, base),
          ...(descriptor ? { descriptor } : {}),
        },
      ];
    } catch {
      return [];
    }
  });
}
