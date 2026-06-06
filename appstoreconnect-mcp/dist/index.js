#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";
const DEFAULT_API_BASE = "https://api.appstoreconnect.apple.com/v1";
const JWT_AUDIENCE = "appstoreconnect-v1";
const JWT_TTL_SECONDS = 19 * 60;
const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const responseFormatSchema = z.enum(["json", "markdown"]).default("json");
const querySchema = z.record(z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
    z.null()
])).optional();
let jwtCache;
const server = new McpServer({
    name: "appstoreconnect-mcp-server",
    version: "0.1.0"
});
server.registerTool("appstoreconnect_auth_status", {
    title: "Check App Store Connect Auth Status",
    description: "Reports whether App Store Connect credential variables are configured without printing secret values.",
    inputSchema: {
        check_jwt: z.boolean().default(false).describe("When true, attempts to sign a JWT to validate private key format.")
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
    }
}, async ({ check_jwt }) => {
    const status = {
        has_key_id: Boolean(process.env.ASC_KEY_ID),
        has_issuer_id: Boolean(process.env.ASC_ISSUER_ID),
        has_private_key: Boolean(process.env.ASC_PRIVATE_KEY || process.env.ASC_PRIVATE_KEY_PATH),
        jwt_signing_ok: null
    };
    if (check_jwt) {
        try {
            await getJwt();
            status.jwt_signing_ok = true;
        }
        catch {
            status.jwt_signing_ok = false;
        }
    }
    return result(status);
});
server.registerTool("appstoreconnect_request", {
    title: "App Store Connect API Request",
    description: "Makes an authenticated request to the App Store Connect API. Defaults to https://api.appstoreconnect.apple.com/v1.",
    inputSchema: {
        method: methodSchema.default("GET").describe("HTTP method."),
        path: z.string().min(1).describe("API path such as /apps."),
        query: querySchema.describe("Optional JSON:API query parameters."),
        body: z.unknown().optional().describe("JSON request body for write requests."),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
    }
}, async ({ method, path, query, body, response_format }) => {
    return result(await appStoreConnectRequest(method, path, query, body), response_format);
});
server.registerTool("appstoreconnect_list_apps", {
    title: "List App Store Connect Apps",
    description: "Lists apps in App Store Connect, with optional filters for bundle ID, SKU, or name.",
    inputSchema: {
        limit: z.number().int().min(1).max(200).default(20).describe("Maximum number of apps to return."),
        bundle_id: z.string().optional().describe("Optional exact bundle ID filter."),
        sku: z.string().optional().describe("Optional SKU filter."),
        name: z.string().optional().describe("Optional app name filter."),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ limit, bundle_id, sku, name, response_format }) => {
    const query = { limit };
    if (bundle_id)
        query["filter[bundleId]"] = bundle_id;
    if (sku)
        query["filter[sku]"] = sku;
    if (name)
        query["filter[name]"] = name;
    return result(await appStoreConnectRequest("GET", "/apps", query), response_format);
});
server.registerTool("appstoreconnect_get_app_store_versions", {
    title: "Get App Store Versions",
    description: "Lists App Store versions for an App Store Connect app ID.",
    inputSchema: {
        app_id: z.string().min(1).describe("App Store Connect app resource ID."),
        limit: z.number().int().min(1).max(200).default(20).describe("Maximum versions to return."),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ app_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/apps/${encodeURIComponent(app_id)}/appStoreVersions`, { limit }), response_format);
});
server.registerTool("appstoreconnect_list_builds", {
    title: "List App Store Connect Builds",
    description: "Lists builds, optionally filtered by app ID or version.",
    inputSchema: {
        limit: z.number().int().min(1).max(200).default(20).describe("Maximum builds to return."),
        app_id: z.string().optional().describe("Optional App Store Connect app resource ID filter."),
        version: z.string().optional().describe("Optional pre-release version filter."),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ limit, app_id, version, response_format }) => {
    const query = { limit };
    if (app_id)
        query["filter[app]"] = app_id;
    if (version)
        query["filter[preReleaseVersion.version]"] = version;
    return result(await appStoreConnectRequest("GET", "/builds", query), response_format);
});
async function appStoreConnectRequest(method, path, query, body) {
    return requestJson(process.env.ASC_API_BASE ?? DEFAULT_API_BASE, method, path, query, body, {
        Authorization: `Bearer ${await getJwt()}`
    });
}
async function getJwt() {
    const now = Date.now();
    if (jwtCache && jwtCache.expiresAtMs - now > 60_000)
        return jwtCache.token;
    const keyId = process.env.ASC_KEY_ID;
    const issuerId = process.env.ASC_ISSUER_ID;
    const privateKeyPem = await getPrivateKey();
    if (!keyId || !issuerId) {
        throw new Error("Missing ASC_KEY_ID or ASC_ISSUER_ID.");
    }
    const issuedAt = Math.floor(now / 1000);
    const expiresAt = issuedAt + JWT_TTL_SECONDS;
    const key = await importPKCS8(privateKeyPem, "ES256");
    const token = await new SignJWT({})
        .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
        .setIssuer(issuerId)
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAt)
        .sign(key);
    jwtCache = { token, expiresAtMs: expiresAt * 1000 };
    return token;
}
async function getPrivateKey() {
    if (process.env.ASC_PRIVATE_KEY) {
        return process.env.ASC_PRIVATE_KEY.includes("\\n")
            ? process.env.ASC_PRIVATE_KEY.replace(/\\n/g, "\n")
            : process.env.ASC_PRIVATE_KEY;
    }
    if (process.env.ASC_PRIVATE_KEY_PATH) {
        return readFile(process.env.ASC_PRIVATE_KEY_PATH, "utf8");
    }
    throw new Error("Missing ASC_PRIVATE_KEY or ASC_PRIVATE_KEY_PATH.");
}
async function requestJson(baseUrl, method, path, query, body, headers) {
    const url = buildUrl(baseUrl, path, query);
    const requestHeaders = {
        Accept: "application/json",
        ...headers
    };
    const init = { method, headers: requestHeaders };
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
function buildUrl(baseUrl, path, query) {
    const url = new URL(path.startsWith("/") ? path.slice(1) : path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value === undefined || value === null)
            continue;
        if (Array.isArray(value)) {
            value.forEach((item) => url.searchParams.append(key, String(item)));
        }
        else {
            url.searchParams.set(key, String(value));
        }
    }
    return url;
}
async function parseBody(response) {
    const text = await response.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
function result(data, responseFormat = "json") {
    return {
        content: [
            {
                type: "text",
                text: responseFormat === "markdown" ? markdown(data) : JSON.stringify(data, null, 2)
            }
        ],
        structuredContent: data
    };
}
function markdown(data) {
    return ["```json", JSON.stringify(data, null, 2), "```"].join("\n");
}
function formatApiError(status, data) {
    return `App Store Connect API request failed with HTTP ${status}: ${typeof data === "string" ? data.slice(0, 300) : JSON.stringify(data)}`;
}
await server.connect(new StdioServerTransport());
//# sourceMappingURL=index.js.map