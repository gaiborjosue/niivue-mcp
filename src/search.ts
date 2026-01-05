import type { BM25Index, ParsedDoc, SearchResult, VectorIndex } from "./types.js";
import { embed } from "./embeddings.js";
import { hybridSearch } from "./hybrid-search.js";
import { searchVectors } from "./vector-store.js";

const K1 = 1.5;
const B = 0.75;

export type SearchOptions = {
  useEmbeddings: boolean;
  vectorIndex?: VectorIndex | null;
};

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function buildIndex(docs: ParsedDoc[]): BM25Index {
  const chunks = docs.flatMap((doc) => doc.chunks);
  const docFreq: Record<string, number> = {};
  const termFreqs: Record<string, Record<string, number>> = {};
  const indexedDocs = [];
  let totalLength = 0;

  for (const chunk of chunks) {
    const tokens = tokenize(chunk.content);
    const length = tokens.length;
    totalLength += length;
    const tf: Record<string, number> = {};
    for (const token of tokens) {
      tf[token] = (tf[token] ?? 0) + 1;
    }
    termFreqs[chunk.id] = tf;
    for (const token of Object.keys(tf)) {
      docFreq[token] = (docFreq[token] ?? 0) + 1;
    }
    indexedDocs.push({
      id: chunk.id,
      title: chunk.title,
      page: chunk.page,
      url: chunk.url,
      content: chunk.content,
      length,
    });
  }

  const avgDocLength = indexedDocs.length ? totalLength / indexedDocs.length : 0;
  return { docs: indexedDocs, docFreq, termFreqs, avgDocLength };
}

export function bm25Search(
  index: BM25Index,
  query: string,
  limit = 5
): Array<{ id: string; score: number }> {
  const tokens = Array.from(new Set(tokenize(query)));
  if (!tokens.length) {
    return [];
  }
  const results: Array<{ id: string; score: number }> = [];
  const totalDocs = index.docs.length;
  const avgDocLength = index.avgDocLength || 1;

  for (const doc of index.docs) {
    const tf = index.termFreqs[doc.id] ?? {};
    let score = 0;
    for (const token of tokens) {
      const freq = tf[token] ?? 0;
      if (!freq) {
        continue;
      }
      const df = index.docFreq[token] ?? 0;
      const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
      const denom = freq + K1 * (1 - B + (B * doc.length) / avgDocLength);
      score += idf * ((freq * (K1 + 1)) / denom);
    }
    if (score > 0) {
      results.push({ id: doc.id, score });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function searchDocs(
  index: BM25Index,
  query: string,
  options: SearchOptions,
  limit = 5
): Promise<SearchResult[]> {
  const bm25Results = bm25Search(index, query, limit * 2);
  const queryTokens = tokenize(query);
  const snippetTokens =
    queryTokens.length > 0
      ? queryTokens
      : query
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter(Boolean);

  if (!options.useEmbeddings || !options.vectorIndex) {
    return bm25Results
      .slice(0, limit)
      .map((result) => buildResult(index, result.id, result.score, snippetTokens));
  }

  try {
    const queryEmbedding = await embed(query);
    const vectorResults = searchVectors(queryEmbedding, options.vectorIndex, limit * 2);
    const hybridResults = hybridSearch(bm25Results, vectorResults)
      .slice(0, limit)
      .map((result) => buildResult(index, result.id, result.score, snippetTokens));

    return hybridResults;
  } catch (error) {
    console.error(`Embedding query failed: ${String(error)}`);
    return bm25Results
      .slice(0, limit)
      .map((result) => buildResult(index, result.id, result.score, snippetTokens));
  }
}

function buildResult(
  index: BM25Index,
  id: string,
  score: number,
  queryTokens: string[]
): SearchResult {
  const doc = index.docs.find((entry) => entry.id === id);
  if (!doc) {
    return {
      title: "",
      snippet: "",
      page: "",
      url: "",
      score,
    };
  }
  return {
    title: doc.title,
    snippet: buildSnippet(doc.content, queryTokens),
    page: doc.page,
    url: doc.url,
    score,
  };
}

function buildSnippet(content: string, tokens: string[]): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "";
  }
  const lower = clean.toLowerCase();
  let index = -1;
  for (const token of tokens) {
    const found = lower.indexOf(token);
    if (found !== -1) {
      index = found;
      break;
    }
  }
  const windowSize = 200;
  if (index === -1) {
    return clean.length > windowSize ? `${clean.slice(0, windowSize)}...` : clean;
  }
  const start = Math.max(0, index - 80);
  const end = Math.min(clean.length, index + 120);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < clean.length ? "..." : "";
  return `${prefix}${clean.slice(start, end)}${suffix}`;
}
