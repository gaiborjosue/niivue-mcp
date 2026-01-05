export type Frontmatter = {
  title?: string;
  description?: string;
  sidebar_position?: number;
};

export type DocSource = {
  path: string;
  url: string;
};

export type RawDoc = {
  path: string;
  url: string;
  content: string;
};

export type ParsedDoc = {
  name: string;
  title: string;
  description?: string;
  path: string;
  url: string;
  content: string;
  chunks: DocChunk[];
};

export type DocChunk = {
  id: string;
  title: string;
  content: string;
  page: string;
  url: string;
};

export type DocListItem = {
  name: string;
  title: string;
  description?: string;
  path: string;
};

export type BM25Document = {
  id: string;
  title: string;
  page: string;
  url: string;
  content: string;
  length: number;
};

export type BM25Index = {
  docs: BM25Document[];
  docFreq: Record<string, number>;
  termFreqs: Record<string, Record<string, number>>;
  avgDocLength: number;
};

export type SearchResult = {
  title: string;
  snippet: string;
  page: string;
  url: string;
  score: number;
};

export type CacheMeta = {
  lastUpdated: number;
  version: string;
  useEmbeddings?: boolean;
};

export type APIParam = {
  name: string;
  type: string;
  description: string;
};

export type APIReturn = {
  type: string;
  description: string;
};

export type APIEntry = {
  name: string;
  signature: string;
  description: string;
  params: APIParam[];
  returns?: APIReturn;
  example?: string;
  see?: string[];
};

export type APICache = CacheMeta & {
  entries: APIEntry[];
};

export type VectorEntry = {
  id: string;
  embedding: number[];
};

export type VectorIndex = {
  entries: VectorEntry[];
  dimension: number;
};

export type CachedVectorIndex = VectorIndex & {
  model: string;
};
