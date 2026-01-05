import path from "path";
import type { DocChunk, Frontmatter, ParsedDoc, RawDoc } from "./types.js";

export function parseDoc(raw: RawDoc): ParsedDoc {
  const { frontmatter, body } = extractFrontmatter(raw.content);
  const cleaned = stripMdx(body);
  const name = pageNameFromPath(raw.path);
  const title = frontmatter.title?.trim() || titleFromName(name);
  const chunks = chunkByH2(cleaned, name, raw.url, title);

  return {
    name,
    title,
    description: frontmatter.description?.trim(),
    path: raw.path,
    url: raw.url,
    content: cleaned.trim(),
    chunks,
  };
}

function extractFrontmatter(content: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  const frontmatter: Frontmatter = {};
  if (!content.startsWith("---")) {
    return { frontmatter, body: content };
  }
  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { frontmatter, body: content };
  }
  const raw = content.slice(3, endIndex).trim();
  let body = content.slice(endIndex + 4);
  if (body.startsWith("\n")) {
    body = body.slice(1);
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (!match) {
      continue;
    }
    const key = match[1];
    const value = stripQuotes(match[2].trim());
    if (key === "sidebar_position") {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        frontmatter.sidebar_position = parsed;
      }
    } else if (key === "title") {
      frontmatter.title = value;
    } else if (key === "description") {
      frontmatter.description = value;
    }
  }
  return { frontmatter, body };
}

function stripMdx(content: string): string {
  const codeBlocks: string[] = [];
  const placeholder = "__NIIVUE_CODE_BLOCK_";
  let output = content.replace(/```[\s\S]*?```/g, (match) => {
    const index = codeBlocks.length;
    codeBlocks.push(match);
    return `${placeholder}${index}__`;
  });

  output = output.replace(/^\s*import .*$/gm, "");
  output = output.replace(/<([A-Z][\w]*)\b[^>]*>[\s\S]*?<\/\1>/g, "");
  output = output.replace(/<([A-Z][\w]*)\b[^>]*\/>/g, "");

  output = output.replace(new RegExp(`${placeholder}(\\d+)__`, "g"), (_match, index) => {
    const idx = Number(index);
    return codeBlocks[idx] ?? "";
  });

  output = output.replace(/\n{3,}/g, "\n\n");
  return output;
}

function chunkByH2(
  content: string,
  page: string,
  url: string,
  fallbackTitle: string
): DocChunk[] {
  const lines = content.split(/\r?\n/);
  const chunks: DocChunk[] = [];
  let currentTitle = fallbackTitle;
  let currentLines: string[] = [];
  let index = 0;

  const pushChunk = () => {
    const chunkContent = currentLines.join("\n").trim();
    if (!chunkContent) {
      return;
    }
    chunks.push({
      id: `${page}:${index}`,
      title: currentTitle,
      content: chunkContent,
      page,
      url,
    });
    index += 1;
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      pushChunk();
      currentTitle = line.replace(/^##\s+/, "").trim() || fallbackTitle;
      currentLines = [];
      continue;
    }
    currentLines.push(line);
  }

  pushChunk();
  return chunks;
}

function pageNameFromPath(docPath: string): string {
  const base = path.basename(docPath);
  return base.replace(/\.(md|mdx)$/i, "");
}

function titleFromName(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
