import fs from "fs/promises";
import path from "path";
import os from "os";
import type {
  APICache,
  APIEntry,
  BM25Index,
  CachedVectorIndex,
  CacheMeta,
  RawDoc,
  VectorIndex,
} from "./types.js";

const CACHE_DIR = path.join(os.homedir(), ".niivue-mcp");
const DOCS_DIR = path.join(CACHE_DIR, "docs");
const INDEX_PATH = path.join(CACHE_DIR, "index.json");
const API_INDEX_PATH = path.join(CACHE_DIR, "api-index.json");
const VECTOR_INDEX_PATH = path.join(CACHE_DIR, "vectors.json");
const META_PATH = path.join(CACHE_DIR, "meta.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type CachedDoc = {
  path: string;
  content: string;
};

export async function ensureCacheDirs(): Promise<void> {
  await fs.mkdir(DOCS_DIR, { recursive: true });
}

export async function readMeta(): Promise<CacheMeta | null> {
  try {
    const raw = await fs.readFile(META_PATH, "utf8");
    const parsed = JSON.parse(raw) as CacheMeta;
    if (typeof parsed.lastUpdated !== "number" || typeof parsed.version !== "string") {
      return null;
    }
    if (
      typeof parsed.useEmbeddings !== "undefined" &&
      typeof parsed.useEmbeddings !== "boolean"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isCacheFresh(
  meta: CacheMeta | null,
  version: string,
  options?: { useEmbeddings?: boolean }
): boolean {
  if (!meta) {
    return false;
  }
  if (meta.version !== version) {
    return false;
  }
  if (typeof options?.useEmbeddings === "boolean") {
    if (meta.useEmbeddings !== options.useEmbeddings) {
      return false;
    }
  }
  return Date.now() - meta.lastUpdated < CACHE_TTL_MS;
}

export async function readIndex(): Promise<BM25Index | null> {
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf8");
    return JSON.parse(raw) as BM25Index;
  } catch {
    return null;
  }
}

export async function readApiIndex(): Promise<APICache | null> {
  try {
    const raw = await fs.readFile(API_INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw) as APICache;
    if (
      !parsed ||
      typeof parsed.lastUpdated !== "number" ||
      typeof parsed.version !== "string" ||
      !Array.isArray(parsed.entries)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function readVectorIndex(): Promise<CachedVectorIndex | null> {
  try {
    const raw = await fs.readFile(VECTOR_INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw) as CachedVectorIndex;
    if (
      !parsed ||
      typeof parsed.model !== "string" ||
      typeof parsed.dimension !== "number" ||
      !Array.isArray(parsed.entries)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeIndex(index: BM25Index): Promise<void> {
  await ensureCacheDirs();
  await fs.writeFile(INDEX_PATH, JSON.stringify(index), "utf8");
}

export async function writeVectorIndex(index: VectorIndex, model: string): Promise<void> {
  const payload: CachedVectorIndex = {
    ...index,
    model,
  };
  await ensureCacheDirs();
  await fs.writeFile(VECTOR_INDEX_PATH, JSON.stringify(payload), "utf8");
}

export async function writeApiIndex(entries: APIEntry[], version: string): Promise<void> {
  const cache: APICache = {
    entries,
    lastUpdated: Date.now(),
    version,
  };
  await ensureCacheDirs();
  await fs.writeFile(API_INDEX_PATH, JSON.stringify(cache), "utf8");
}

export async function writeMeta(version: string, useEmbeddings: boolean): Promise<void> {
  const meta: CacheMeta = {
    lastUpdated: Date.now(),
    version,
    useEmbeddings,
  };
  await ensureCacheDirs();
  await fs.writeFile(META_PATH, JSON.stringify(meta), "utf8");
}

export async function writeDocs(docs: RawDoc[]): Promise<void> {
  await ensureCacheDirs();
  await Promise.all(
    docs.map(async (doc) => {
      const filePath = path.join(DOCS_DIR, doc.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, doc.content, "utf8");
    })
  );
}

export async function readDocs(): Promise<CachedDoc[]> {
  try {
    const files = await walkFiles(DOCS_DIR);
    const docFiles = files.filter((file) => file.endsWith(".md") || file.endsWith(".mdx"));
    return Promise.all(
      docFiles.map(async (filePath) => {
        const content = await fs.readFile(filePath, "utf8");
        const relative = normalizePath(path.relative(DOCS_DIR, filePath));
        return { path: relative, content };
      })
    );
  } catch {
    return [];
  }
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(fullPath);
      }
      if (entry.isFile()) {
        return [fullPath];
      }
      return [];
    })
  );
  return files.flat();
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}
