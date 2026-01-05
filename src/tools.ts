import { parseJSDoc } from "./api-parser.js";
import { searchAPI } from "./api-search.js";
import { embed, getEmbedder } from "./embeddings.js";
import { buildIndex, searchDocs } from "./search.js";
import { fetchAllDocs, fetchAPISource, rawUrlForPath } from "./fetcher.js";
import { parseDoc } from "./parser.js";
import { buildVectorIndex } from "./vector-store.js";
import {
  ensureCacheDirs,
  isCacheFresh,
  readApiIndex,
  readDocs,
  readIndex,
  readMeta,
  readVectorIndex,
  writeApiIndex,
  writeDocs,
  writeIndex,
  writeMeta,
  writeVectorIndex,
} from "./cache.js";
import type {
  APIEntry,
  BM25Index,
  CachedVectorIndex,
  ParsedDoc,
  SearchResult,
  VectorIndex,
} from "./types.js";

const VERSION = "1.0.0";
const VECTOR_MODEL = "Xenova/all-MiniLM-L6-v2";

let docsPromise: Promise<{ docs: ParsedDoc[]; index: BM25Index; vectorIndex?: VectorIndex | null }> | null = null;
let apiPromise: Promise<APIEntry[]> | null = null;
let useEmbeddings = false;

export function initializeSearch(config: { useEmbeddings: boolean }): void {
  useEmbeddings = config.useEmbeddings;
  docsPromise = null;
}

async function loadDocs(): Promise<{
  docs: ParsedDoc[];
  index: BM25Index;
  vectorIndex?: VectorIndex | null;
}> {
  if (docsPromise) {
    return docsPromise;
  }
  docsPromise = (async () => {
    await ensureCacheDirs();
    const meta = await readMeta();
    const docsFresh = isCacheFresh(meta, VERSION);
    const cachedDocs = await readDocs();
    const cachedIndex = await readIndex();
    const hasCachedDocs = cachedDocs.length > 0;
    const cachedRawDocs = cachedDocs.map((doc) => ({
      path: doc.path,
      url: rawUrlForPath(doc.path),
      content: doc.content,
    }));

    let parsedDocs: ParsedDoc[] | null = null;
    let usedCachedDocs = false;
    let fetchedDocs: Awaited<ReturnType<typeof fetchAllDocs>> | null = null;

    if (docsFresh && hasCachedDocs) {
      parsedDocs = cachedRawDocs.map(parseDoc);
      usedCachedDocs = true;
    } else {
      try {
        fetchedDocs = await fetchAllDocs();
        if (!fetchedDocs.length) {
          throw new Error("No docs fetched");
        }
        parsedDocs = fetchedDocs.map(parseDoc);
      } catch (error) {
        if (hasCachedDocs) {
          console.warn(`Doc fetch failed; using cached docs: ${String(error)}`);
          parsedDocs = cachedRawDocs.map(parseDoc);
          usedCachedDocs = true;
        } else {
          throw new Error(`Failed to fetch docs and no cache available: ${String(error)}`);
        }
      }
    }

    if (!parsedDocs) {
      throw new Error("No docs available");
    }

    let index = cachedIndex;
    if (!index || fetchedDocs) {
      index = buildIndex(parsedDocs);
      await writeIndex(index);
    }

    let vectorIndex: VectorIndex | null = null;
    if (useEmbeddings) {
      if (usedCachedDocs) {
        vectorIndex = await loadVectorIndexFromCache(parsedDocs);
      }
      if (!vectorIndex) {
        vectorIndex = await buildVectorIndexForDocs(parsedDocs);
        if (vectorIndex) {
          await writeVectorIndex(vectorIndex, VECTOR_MODEL);
        }
      }
    }

    if (fetchedDocs) {
      await writeDocs(fetchedDocs);
      await writeMeta(VERSION, useEmbeddings);
    }

    return { docs: parsedDocs, index, vectorIndex };
  })();

  return docsPromise;
}

async function loadApi(): Promise<APIEntry[]> {
  if (apiPromise) {
    return apiPromise;
  }
  apiPromise = (async () => {
    await ensureCacheDirs();
    const cached = await readApiIndex();
    if (cached && isCacheFresh(cached, VERSION) && cached.entries.length) {
      return cached.entries;
    }
    const source = await fetchAPISource();
    const entries = parseJSDoc(source);
    await writeApiIndex(entries, VERSION);
    return entries;
  })();

  return apiPromise;
}

export async function getNiivueOverview(): Promise<{ content: string }> {
  const { docs } = await loadDocs();
  const doc = docs.find((entry) => entry.name.toLowerCase() === "claude");
  if (!doc) {
    throw new Error("CLAUDE.md not found in fetched docs");
  }
  return { content: doc.content };
}

export async function searchNiivueDocs(params: {
  query: string;
  limit?: number;
}): Promise<{ results: SearchResult[] }> {
  const { index, vectorIndex } = await loadDocs();
  const limit = params.limit ?? 5;
  const results = await searchDocs(
    index,
    params.query,
    { useEmbeddings, vectorIndex },
    limit
  );
  return { results };
}

export async function getNiivueDoc(params: {
  page: string;
}): Promise<{ content: string; title: string; url: string }> {
  const { docs } = await loadDocs();
  const normalized = params.page.replace(/\.(md|mdx)$/i, "").toLowerCase();
  const doc = docs.find((entry) => entry.name.toLowerCase() === normalized);
  if (!doc) {
    throw new Error(`Doc not found: ${params.page}`);
  }
  return { content: doc.content, title: doc.title, url: doc.url };
}

export async function listNiivueDocs(): Promise<{
  docs: Array<{ name: string; title: string; description?: string; path: string }>;
}> {
  const { docs } = await loadDocs();
  return {
    docs: docs.map((doc) => ({
      name: doc.name,
      title: doc.title,
      description: doc.description,
      path: doc.path,
    })),
  };
}

function toVectorIndex(cached: CachedVectorIndex): VectorIndex {
  return { entries: cached.entries, dimension: cached.dimension };
}

async function loadVectorIndexFromCache(parsedDocs: ParsedDoc[]): Promise<VectorIndex | null> {
  const cachedVector = await readVectorIndex();
  if (cachedVector && cachedVector.model === VECTOR_MODEL && cachedVector.entries.length) {
    return toVectorIndex(cachedVector);
  }
  if (!parsedDocs.length) {
    return null;
  }
  return null;
}

async function buildVectorIndexForDocs(parsedDocs: ParsedDoc[]): Promise<VectorIndex | null> {
  if (!parsedDocs.length) {
    return null;
  }
  try {
    console.log("Loading embedding model (first run may download ~30MB)...");
    await getEmbedder();
    const chunks = parsedDocs.flatMap((doc) => doc.chunks);
    console.log(`Building vector index for ${chunks.length} chunks...`);
    return await buildVectorIndex(chunks, embed, { batchSize: 8 });
  } catch (error) {
    console.error(`Failed to build vector index: ${String(error)}`);
    return null;
  }
}

export async function searchNiivueApi(params: {
  query: string;
  limit?: number;
}): Promise<{
  results: Array<{ name: string; signature: string; description: string }>;
}> {
  const entries = await loadApi();
  const limit = params.limit ?? 5;
  const results = searchAPI(params.query, entries, limit).map((entry) => ({
    name: entry.name,
    signature: entry.signature,
    description: entry.description,
  }));
  return { results };
}

export async function getNiivueApi(params: {
  name: string;
}): Promise<APIEntry | null> {
  const entries = await loadApi();
  const normalized = params.name.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return entries.find((entry) => entry.name.toLowerCase() === normalized) ?? null;
}
