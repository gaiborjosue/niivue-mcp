import type { APIEntry, APIParam, APIReturn } from "./types.js";

type TagBuffers = {
  description?: string[];
  params: Array<{ raw: string }>; 
  returns?: string[];
  example?: string[];
  see: string[];
  preamble: string[];
};

export function parseJSDoc(source: string): APIEntry[] {
  const entries: APIEntry[] = [];
  const regex = /\/\*\*[\s\S]*?\*\//g;
  const matches = source.matchAll(regex);

  for (const match of matches) {
    const block = match[0];
    const endIndex = (match.index ?? 0) + block.length;
    const signature = extractSignature(source.slice(endIndex));
    if (!signature) {
      continue;
    }
    const name = extractName(signature);
    if (!name) {
      continue;
    }
    if (name.startsWith("_") || signature.includes(`#${name}`)) {
      continue;
    }

    const parsed = parseBlock(block);
    const description =
      (parsed.description ?? []).join(" ").trim() ||
      parsed.preamble.join(" ").trim();

    entries.push({
      name,
      signature,
      description,
      params: parsedParams(parsed.params),
      returns: parsedReturns(parsed.returns),
      example: parsedExample(parsed.example),
      see: parsed.see.length ? parsed.see : undefined,
    });
  }

  return entries;
}

function extractSignature(source: string): string | null {
  const lines = source.split(/\r?\n/);
  const collected: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (collected.length) {
        break;
      }
      continue;
    }
    if (trimmed.startsWith("@")) {
      continue;
    }
    collected.push(trimmed);
    if (trimmed.includes("{") || trimmed.includes(";")) {
      break;
    }
    if (collected.length >= 6) {
      break;
    }
  }

  if (!collected.length) {
    return null;
  }

  const joined = collected.join(" ").replace(/\s+/g, " ");
  return joined.replace(/\s*\{.*$/, "").replace(/\s*;\s*$/, "").trim();
}

function extractName(signature: string): string | null {
  const matches = Array.from(signature.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g));
  if (!matches.length) {
    return null;
  }
  return matches[matches.length - 1]?.[1] ?? null;
}

function parseBlock(block: string): TagBuffers {
  const cleaned = block
    .replace(/^\s*\/\*\*\s*/, "")
    .replace(/\*\/\s*$/, "");
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*\s?/, ""));

  const buffers: TagBuffers = {
    params: [],
    see: [],
    preamble: [],
  };

  let currentTag: string | null = null;
  let current: string[] = [];

  const flush = () => {
    if (!currentTag) {
      if (current.length) {
        buffers.preamble.push(...current);
      }
      current = [];
      return;
    }
    const content = current.join("\n").trimEnd();
    if (currentTag === "description") {
      buffers.description = buffers.description ?? [];
      buffers.description.push(content.trim());
    } else if (currentTag === "param") {
      if (content.trim()) {
        buffers.params.push({ raw: content.trim() });
      }
    } else if (currentTag === "returns" || currentTag === "return") {
      buffers.returns = buffers.returns ?? [];
      buffers.returns.push(content.trim());
    } else if (currentTag === "example") {
      buffers.example = buffers.example ?? [];
      buffers.example.push(content.replace(/^\n+/, ""));
    } else if (currentTag === "see") {
      if (content.trim()) {
        buffers.see.push(content.trim());
      }
    }
    current = [];
  };

  for (const line of lines) {
    const tagMatch = line.match(/^@(\w+)\s*(.*)$/);
    if (tagMatch) {
      flush();
      currentTag = tagMatch[1];
      current = [tagMatch[2] ?? ""];
    } else {
      current.push(line);
    }
  }

  flush();
  return buffers;
}

function parsedParams(rawParams: Array<{ raw: string }>): APIParam[] {
  return rawParams
    .map((param) => parseParam(param.raw))
    .filter((param): param is APIParam => param !== null);
}

function parseParam(raw: string): APIParam | null {
  const match = raw.match(/^\{([^}]+)\}\s*(\S+)\s*-?\s*([\s\S]*)$/);
  if (match) {
    return {
      type: match[1].trim(),
      name: match[2].trim(),
      description: match[3].trim(),
    };
  }
  const fallback = raw.match(/^(\S+)\s*-?\s*([\s\S]*)$/);
  if (!fallback) {
    return null;
  }
  return {
    type: "",
    name: fallback[1].trim(),
    description: fallback[2].trim(),
  };
}

function parsedReturns(raw?: string[]): APIReturn | undefined {
  if (!raw || !raw.length) {
    return undefined;
  }
  const combined = raw.join(" ").trim();
  if (!combined) {
    return undefined;
  }
  const match = combined.match(/^\{([^}]+)\}\s*-?\s*([\s\S]*)$/);
  if (match) {
    return { type: match[1].trim(), description: match[2].trim() };
  }
  return { type: "", description: combined };
}

function parsedExample(raw?: string[]): string | undefined {
  if (!raw || !raw.length) {
    return undefined;
  }
  const combined = raw.join("\n");
  return trimBlankLines(combined);
}

function trimBlankLines(value: string): string {
  const lines = value.split(/\r?\n/);
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start]?.trim()) {
    start += 1;
  }
  while (end > start && !lines[end - 1]?.trim()) {
    end -= 1;
  }
  return lines.slice(start, end).join("\n");
}
