import type { APIEntry } from "./types.js";

export function searchAPI(
  query: string,
  entries: APIEntry[],
  limit = 5
): APIEntry[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }
  const terms = trimmed.split(/\s+/).filter(Boolean);
  const results = entries
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, trimmed, terms),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.entry.name.localeCompare(b.entry.name);
    })
    .slice(0, limit)
    .map((item) => item.entry);

  return results;
}

function scoreEntry(entry: APIEntry, query: string, terms: string[]): number {
  let score = 0;
  const name = entry.name.toLowerCase();
  const description = entry.description?.toLowerCase() ?? "";
  const params = entry.params.map((param) => param.name.toLowerCase()).join(" ");

  score += matchScore(name, query, terms, 3);
  score += matchScore(description, query, terms, 2);
  score += matchScore(params, query, terms, 1);

  return score;
}

function matchScore(
  text: string,
  query: string,
  terms: string[],
  weight: number
): number {
  if (!text) {
    return 0;
  }
  if (text.includes(query)) {
    return weight * 2;
  }
  let score = 0;
  for (const term of terms) {
    if (text.includes(term)) {
      score += weight;
    }
  }
  return score;
}
