# niivue-mcp

MCP server that provides Niivue documentation and API reference to LLMs with fast lexical search and optional semantic hybrid search.

## What you get
- Full text search over Niivue docs and guides (BM25 + optional embeddings).
- API lookup from JSDoc comments in the Niivue TypeScript source.
- Structured tools for overview, search, listing, and page retrieval.
- Local cache to keep startup and query latency low.

## Install
```bash
npm install
npm run build
```

## Run locally
```bash
npm run dev
```

## MCP client config
```json
{
  "mcpServers": {
    "niivue": {
      "command": "npx",
      "args": ["-y", "niivue-mcp"]
    }
  }
}
```

## Embeddings (hybrid search)
Hybrid search is enabled by default when embeddings are available. The model is downloaded on first use.

Install the optional dependency:
```bash
npm install @xenova/transformers
```

Force embeddings on or off:
```bash
npx niivue-mcp --use-embeddings
npx niivue-mcp --no-embeddings
```

## Tools
- `get_niivue_overview`
- `search_niivue_docs`
- `get_niivue_doc`
- `list_niivue_docs`
- `search_niivue_api`
- `get_niivue_api`

## Cache
Stored in `~/.niivue-mcp`:
- `docs/` raw markdown
- `index.json` BM25 index
- `vectors.json` vector index (when embeddings enabled)
- `api-index.json` parsed API entries
- `meta.json` cache metadata

## Attribution
Docs and source are fetched from the Niivue repository: https://github.com/niivue/niivue/
