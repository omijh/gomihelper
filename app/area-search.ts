export type SearchAreaEntry = {
  ward: string;
  aliases: string[];
  file: string;
};

export type GetAreaTerms<T extends SearchAreaEntry> = (area: T) => string[];

export function normalizeAreaText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ン]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/東京都|東京|市区町村|[\s\-ー−・.。,_]/g, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) { d[i] = [i]; }
  for (let j = 0; j <= n; j++) { d[0][j] = j; }
  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

export function fuzzyMatchAreaText(query: string, target: string): boolean {
  const q = query.toLowerCase().replace(/[ー−]/g, '');
  const t = target.toLowerCase().replace(/[ー−]/g, '');
  if (t.includes(q) || q.includes(t)) return true;
  if (q.length < 2) return false;
  return levenshtein(q, t) <= Math.max(1, Math.floor(q.length / 4));
}

export function getAreaMatchScore<T extends SearchAreaEntry>(
  area: T,
  normalizedValue: string,
  getAreaTerms: GetAreaTerms<T>,
): number | null {
  let bestScore: number | null = null;
  for (const term of getAreaTerms(area)) {
    const normalizedTerm = normalizeAreaText(term);
    if (!normalizedTerm) continue;

    let score: number | null = null;
    if (normalizedTerm === normalizedValue) score = 0;
    else if (normalizedTerm.startsWith(normalizedValue) || normalizedValue.startsWith(normalizedTerm)) score = 1;
    else if (fuzzyMatchAreaText(normalizedValue, normalizedTerm)) score = 2;

    if (score !== null && (bestScore === null || score < bestScore)) bestScore = score;
  }
  return bestScore;
}

export function areaMatches<T extends SearchAreaEntry>(
  area: T,
  value: string,
  getAreaTerms: GetAreaTerms<T>,
  exact = false,
): boolean {
  const norm = normalizeAreaText(value);
  if (exact) return getAreaTerms(area).some((term) => normalizeAreaText(term) === norm);
  return getAreaMatchScore(area, norm, getAreaTerms) !== null;
}

export function findBestAreaMatch<T extends SearchAreaEntry>(
  areas: T[],
  value: string,
  getAreaTerms: GetAreaTerms<T>,
): T | undefined {
  const norm = normalizeAreaText(value);
  let best: { area: T; score: number; index: number } | undefined;
  areas.forEach((area, index) => {
    const score = getAreaMatchScore(area, norm, getAreaTerms);
    if (score === null) return;
    if (!best || score < best.score || (score === best.score && index < best.index)) {
      best = { area, score, index };
    }
  });
  return best?.area;
}

export function rankAreaSuggestions<T extends SearchAreaEntry>(
  areas: T[],
  value: string,
  getAreaTerms: GetAreaTerms<T>,
  limit: number,
): T[] {
  const norm = normalizeAreaText(value);
  return areas
    .map((area, index) => ({ area, score: getAreaMatchScore(area, norm, getAreaTerms), index }))
    .filter((match): match is { area: T; score: number; index: number } => match.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((match) => match.area)
    .slice(0, limit);
}
