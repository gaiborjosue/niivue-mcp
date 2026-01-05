import type { RawDoc } from "./types.js";

export const RAW_BASE_URL = "https://raw.githubusercontent.com/niivue/niivue/main/";
const API_URL =
  "https://api.github.com/repos/niivue/niivue/contents/packages/docs/docs";
const API_SOURCE_URL =
  "https://raw.githubusercontent.com/niivue/niivue/main/packages/niivue/src/niivue/index.ts";

const ROOT_DOCS = [
  "CLAUDE.md",
  "README.md",
  "CONTRIBUTING.md",
  "packages/niivue/DEVELOP.md",
];

const FALLBACK_DOCS = [
  "packages/docs/docs/index.mdx",
  "packages/docs/docs/loading.mdx",
  "packages/docs/docs/colormaps.mdx",
  "packages/docs/docs/ct.mdx",
  "packages/docs/docs/colormaps2.mdx",
  "packages/docs/docs/clip.mdx",
  "packages/docs/docs/layouts.mdx",
  "packages/docs/docs/bounds.mdx",
  "packages/docs/docs/options.mdx",
  "packages/docs/docs/thresholding.mdx",
  "packages/docs/docs/drawing.mdx",
  "packages/docs/docs/syncing.mdx",
  "packages/docs/docs/mesh.mdx",
  "packages/docs/docs/atlas.mdx",
  "packages/docs/docs/fonts.mdx",
  "packages/docs/docs/gestures.mdx",
  "packages/docs/docs/dicom.mdx",
  "packages/docs/docs/plugins.mdx",
  "packages/docs/docs/develop.mdx",
  "packages/docs/docs/webgl.mdx",
  "packages/docs/docs/contribute.mdx",
];

export function rawUrlForPath(path: string): string {
  return `${RAW_BASE_URL}${path}`;
}

export async function fetchAllDocs(): Promise<RawDoc[]> {
  const discovered = await fetchDocPaths();
  const paths = Array.from(new Set([...ROOT_DOCS, ...discovered]));
  const docs = await Promise.all(
    paths.map(async (docPath) => {
      try {
        return await fetchRawDoc(docPath);
      } catch (error) {
        console.warn(`Failed to fetch ${docPath}: ${String(error)}`);
        return null;
      }
    })
  );
  return docs.filter((doc): doc is RawDoc => doc !== null);
}

export async function fetchAPISource(): Promise<string> {
  const response = await fetch(API_SOURCE_URL, {
    headers: { "User-Agent": "niivue-mcp" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function fetchDocPaths(): Promise<string[]> {
  try {
    const response = await fetch(API_URL, {
      headers: {
        "User-Agent": "niivue-mcp",
        Accept: "application/vnd.github+json",
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub API responded ${response.status}`);
    }
    const data = (await response.json()) as Array<{
      name: string;
      path: string;
      type: string;
    }>;
    if (!Array.isArray(data)) {
      throw new Error("Unexpected GitHub API payload");
    }
    return data
      .filter(
        (item) =>
          item.type === "file" &&
          (item.name.endsWith(".md") || item.name.endsWith(".mdx"))
      )
      .map((item) => item.path);
  } catch (error) {
    console.warn(`Falling back to static doc list: ${String(error)}`);
    return FALLBACK_DOCS;
  }
}

async function fetchRawDoc(docPath: string): Promise<RawDoc> {
  const url = rawUrlForPath(docPath);
  const response = await fetch(url, {
    headers: { "User-Agent": "niivue-mcp" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const content = await response.text();
  return { path: docPath, url, content };
}
