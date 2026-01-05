import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getNiivueDoc,
  getNiivueOverview,
  getNiivueApi,
  initializeSearch,
  listNiivueDocs,
  searchNiivueApi,
  searchNiivueDocs,
} from "./tools.js";

const args = process.argv.slice(2);
const forceEmbeddings = args.includes("--use-embeddings");
const disableEmbeddings = args.includes("--no-embeddings");
let useEmbeddings = !disableEmbeddings;

if (useEmbeddings) {
  try {
    await import("@xenova/transformers");
  } catch (error) {
    if (forceEmbeddings) {
      console.error("Embeddings requested but @xenova/transformers not installed.");
      console.error("Run: npm install @xenova/transformers");
      process.exit(1);
    }
    console.warn("Embeddings not available; falling back to BM25 only.");
    useEmbeddings = false;
  }
}

initializeSearch({ useEmbeddings });

const server = new Server(
  {
    name: "niivue-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_niivue_overview",
      description: "Return the CLAUDE.md overview for Niivue.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "search_niivue_docs",
      description: "Search Niivue documentation with BM25.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_niivue_doc",
      description: "Fetch full content for a Niivue doc page.",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "string" },
        },
        required: ["page"],
      },
    },
    {
      name: "list_niivue_docs",
      description: "List available Niivue docs and metadata.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "search_niivue_api",
      description: "Search Niivue API methods by name or description.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_niivue_api",
      description: "Fetch full details for a specific Niivue API method.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "get_niivue_overview": {
      const result = await getNiivueOverview();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    case "search_niivue_docs": {
      const result = await searchNiivueDocs({
        query: String(args?.query ?? ""),
        limit: args?.limit ? Number(args.limit) : undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    case "get_niivue_doc": {
      const result = await getNiivueDoc({ page: String(args?.page ?? "") });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    case "list_niivue_docs": {
      const result = await listNiivueDocs();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    case "search_niivue_api": {
      const result = await searchNiivueApi({
        query: String(args?.query ?? ""),
        limit: args?.limit ? Number(args.limit) : undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    case "get_niivue_api": {
      const result = await getNiivueApi({ name: String(args?.name ?? "") });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
