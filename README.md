# @edziocodes/niivue-mcp

[![npm version](https://img.shields.io/npm/v/@edziocodes/niivue-mcp.svg)](https://www.npmjs.com/package/@edziocodes/niivue-mcp)

MCP server that provides Niivue documentation and API reference to LLMs with fast lexical search and optional semantic hybrid search.

## What you get
- Full text search over Niivue docs and guides (BM25 + optional embeddings).
- API lookup from JSDoc comments in the Niivue TypeScript source.
- Structured tools for overview, search, listing, and page retrieval.
- Local cache to keep startup and query latency low.

## Installation

```bash
npm install @edziocodes/niivue-mcp
```

## MCP Client Configuration

Add the following to your MCP client configuration (e.g., Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "niivue": {
      "command": "npx",
      "args": ["-y", "@edziocodes/niivue-mcp"]
    }
  }
}
```

## Development

Clone and build from source:

```bash
git clone https://github.com/gaiborjosue/niivue-mcp.git
cd niivue-mcp
npm install
npm run build
```

Run locally:

```bash
npm run dev
```

## Embeddings (hybrid search)

Hybrid search with semantic embeddings is enabled by default. The embedding model is downloaded on first use.

To disable embeddings and use BM25 search only:

```bash
npx @edziocodes/niivue-mcp --no-embeddings
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
