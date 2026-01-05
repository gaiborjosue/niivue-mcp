import type { DocChunk, VectorEntry, VectorIndex } from "./types.js";
import { cosineSimilarity } from "./embeddings.js";

export async function buildVectorIndex(
  chunks: DocChunk[],
  embedFn: (text: string) => Promise<number[]>,
  options?: { batchSize?: number }
): Promise<VectorIndex> {
  const entries: VectorEntry[] = [];
  const batchSize = options?.batchSize ?? 8;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((chunk) => `${chunk.title}\n${chunk.content}`.slice(0, 512));
    const embeddings = await Promise.all(texts.map((text) => embedFn(text)));
    embeddings.forEach((embedding, index) => {
      const chunk = batch[index];
      if (chunk) {
        entries.push({ id: chunk.id, embedding });
      }
    });
  }

  return {
    entries,
    dimension: entries[0]?.embedding.length || 384,
  };
}

export function searchVectors(
  queryEmbedding: number[],
  index: VectorIndex,
  limit: number
): Array<{ id: string; score: number }> {
  const scores = index.entries.map((entry) => ({
    id: entry.id,
    score: cosineSimilarity(queryEmbedding, entry.embedding),
  }));

  return scores.sort((a, b) => b.score - a.score).slice(0, limit);
}
