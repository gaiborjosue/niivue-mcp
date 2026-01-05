export function hybridSearch(
  bm25Results: Array<{ id: string; score: number }>,
  vectorResults: Array<{ id: string; score: number }>,
  k = 60
): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();

  bm25Results.forEach((result, rank) => {
    const rrf = 1 / (k + rank + 1);
    scores.set(result.id, (scores.get(result.id) ?? 0) + rrf);
  });

  vectorResults.forEach((result, rank) => {
    const rrf = 1 / (k + rank + 1);
    scores.set(result.id, (scores.get(result.id) ?? 0) + rrf);
  });

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
