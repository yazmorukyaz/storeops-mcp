#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type QueryValue = string | number | boolean | Array<string | number | boolean> | null | undefined;

const DEFAULT_API_BASE = "https://api.revenuecat.com/v2";
const DEFAULT_V1_API_BASE = "https://api.revenuecat.com/v1";

const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const responseFormatSchema = z.enum(["json", "markdown"]).default("json");
const querySchema = z.record(
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
    z.null()
  ])
).optional();

const server = new McpServer({
  name: "revenuecat-mcp-server",
  version: "0.1.0"
});

server.registerTool(
  "revenuecat_auth_status",
  {
    title: "Check RevenueCat Auth Status",
    description: "Reports whether REVENUECAT_API_KEY is configured without printing the secret value.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async () => result({ has_api_key: Boolean(process.env.REVENUECAT_API_KEY) })
);

server.registerTool(
  "revenuecat_request",
  {
    title: "RevenueCat API Request",
    description: "Makes an authenticated request to the RevenueCat REST API. Defaults to REST API v2.",
    inputSchema: {
      method: methodSchema.default("GET").describe("HTTP method."),
      path: z.string().min(1).describe("API path such as /projects."),
      query: querySchema.describe("Optional query parameters."),
      body: z.unknown().optional().describe("JSON request body for write requests."),
      response_format: responseFormatSchema
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async ({ method, path, query, body, response_format }) => {
    return result(await revenueCatRequest(method, path, query, body), response_format);
  }
);

server.registerTool(
  "revenuecat_list_projects",
  {
    title: "List RevenueCat Projects",
    description: "Lists RevenueCat projects using the REST API v2 /projects endpoint.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).default(20).describe("Maximum projects to request where supported."),
      starting_after: z.string().optional().describe("Pagination cursor where supported."),
      response_format: responseFormatSchema
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ limit, starting_after, response_format }) => {
    return result(await revenueCatRequest("GET", "/projects", { limit, starting_after }), response_format);
  }
);

server.registerTool(
  "revenuecat_get_subscriber",
  {
    title: "Get RevenueCat Subscriber",
    description: "Fetches a RevenueCat subscriber by App User ID using the legacy /subscribers/{app_user_id} endpoint.",
    inputSchema: {
      app_user_id: z.string().min(1).describe("RevenueCat App User ID."),
      response_format: responseFormatSchema
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ app_user_id, response_format }) => {
    return result(await revenueCatRequest("GET", `/subscribers/${encodeURIComponent(app_user_id)}`, undefined, undefined, true), response_format);
  }
);

async function revenueCatRequest(method: HttpMethod, path: string, query?: Record<string, QueryValue>, body?: unknown, useV1 = false) {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) {
    throw new Error("Missing REVENUECAT_API_KEY. Set it to a RevenueCat REST API v2 key or OAuth access token.");
  }

  const base = useV1
    ? process.env.REVENUECAT_V1_API_BASE ?? DEFAULT_V1_API_BASE
    : process.env.REVENUECAT_API_BASE ?? DEFAULT_API_BASE;
  const response = await requestJson(base, method, path, query, body, {
    Authorization: `Bearer ${apiKey}`
  });
  return response;
}

async function requestJson(baseUrl: string, method: HttpMethod, path: string, query?: Record<string, QueryValue>, body?: unknown, headers?: Record<string, string>) {
  const url = buildUrl(baseUrl, path, query);
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers
  };
  const init: RequestInit = { method, headers: requestHeaders };

  if (body !== undefined && method !== "GET") {
    requestHeaders["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  const data = await parseBody(response);
  const output = {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    data
  };

  if (!response.ok) {
    throw new Error(formatApiError(response.status, data));
  }

  return output;
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): URL {
  const url = new URL(path.startsWith("/") ? path.slice(1) : path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function result(data: unknown, responseFormat: "json" | "markdown" = "json") {
  return {
    content: [
      {
        type: "text" as const,
        text: responseFormat === "markdown" ? markdown(data) : JSON.stringify(data, null, 2)
      }
    ],
    structuredContent: data as Record<string, unknown>
  };
}

function markdown(data: unknown): string {
  return ["```json", JSON.stringify(data, null, 2), "```"].join("\n");
}

function formatApiError(status: number, data: unknown): string {
  return `RevenueCat API request failed with HTTP ${status}: ${typeof data === "string" ? data.slice(0, 300) : JSON.stringify(data)}`;
}

await server.connect(new StdioServerTransport());
