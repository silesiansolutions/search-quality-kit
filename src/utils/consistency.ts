const BRAND_SEPARATOR = /\s+(?:\||-|–|—|·)\s+/;

export function comparableText(value?: string) {
  const normalized = (value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
  return normalized.split(BRAND_SEPARATOR)[0]?.trim() ?? normalized;
}

function tokens(value?: string) {
  return new Set(
    comparableText(value)
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(" ")
      .filter((token) => token.length > 2),
  );
}

export function obviousDescriptionConflict(a?: string, b?: string) {
  const left = tokens(a),
    right = tokens(b);
  if (left.size < 4 || right.size < 4) return false;
  return ![...left].some((token) => right.has(token));
}

export function obviousTextConflict(a?: string, b?: string) {
  const left = comparableText(a),
    right = comparableText(b);
  if (!left || !right || left === right) return false;
  if (left.includes(right) || right.includes(left)) return false;
  const leftTokens = tokens(left),
    rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return false;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token));
  return overlap.length / Math.min(leftTokens.size, rightTokens.size) < 0.34;
}
