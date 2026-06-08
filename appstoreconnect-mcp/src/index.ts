#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type QueryValue = string | number | boolean | Array<string | number | boolean> | null | undefined;
type JsonApiResource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
  links?: Record<string, unknown>;
};

const DEFAULT_API_BASE = "https://api.appstoreconnect.apple.com/v1";
const JWT_AUDIENCE = "appstoreconnect-v1";
const JWT_TTL_SECONDS = 19 * 60;
const ASO_REPORT_PATTERNS = [
  /App Store Discovery and Engagement/i,
  /App Downloads/i,
  /App Store Purchases/i,
  /App Store Subscription Event/i,
  /App Store Subscription State/i,
  /App Store Installation and Deletion/i,
  /App Sessions/i,
  /App Crashes/i,
  /App Store Web Preview Engagement/i,
  /Retention Messaging/i
];

const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const responseFormatSchema = z.enum(["json", "markdown"]).default("json");
const salesFrequencySchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).default("DAILY");
const analyticsAccessTypeSchema = z.enum(["ONGOING", "ONE_TIME_SNAPSHOT"]);
const analyticsGranularitySchema = z.enum(["DAILY", "WEEKLY", "MONTHLY"]);
const querySchema = z.record(
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
    z.null()
  ])
).optional();

let jwtCache: { token: string; expiresAtMs: number } | undefined;

const server = new McpServer({
  name: "appstoreconnect-mcp-server",
  version: "0.1.0"
});

server.registerTool(
  "appstoreconnect_auth_status",
  {
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
  },
  async ({ check_jwt }) => {
    const status = {
      has_key_id: Boolean(process.env.ASC_KEY_ID),
      has_issuer_id: Boolean(process.env.ASC_ISSUER_ID),
      has_private_key: Boolean(process.env.ASC_PRIVATE_KEY || process.env.ASC_PRIVATE_KEY_PATH),
      jwt_signing_ok: null as boolean | null
    };

    if (check_jwt) {
      try {
        await getJwt();
        status.jwt_signing_ok = true;
      } catch {
        status.jwt_signing_ok = false;
      }
    }

    return result(status);
  }
);

server.registerTool(
  "appstoreconnect_request",
  {
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
  },
  async ({ method, path, query, body, response_format }) => {
    return result(await appStoreConnectRequest(method, path, query, body), response_format);
  }
);

server.registerTool(
  "appstoreconnect_list_apps",
  {
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
  },
  async ({ limit, bundle_id, sku, name, response_format }) => {
    const query: Record<string, string | number> = { limit };
    if (bundle_id) query["filter[bundleId]"] = bundle_id;
    if (sku) query["filter[sku]"] = sku;
    if (name) query["filter[name]"] = name;
    return result(await appStoreConnectRequest("GET", "/apps", query), response_format);
  }
);

server.registerTool(
  "appstoreconnect_get_app_store_versions",
  {
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
  },
  async ({ app_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/apps/${encodeURIComponent(app_id)}/appStoreVersions`, { limit }), response_format);
  }
);

server.registerTool(
  "appstoreconnect_list_builds",
  {
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
  },
  async ({ limit, app_id, version, response_format }) => {
    const query: Record<string, string | number> = { limit };
    if (app_id) query["filter[app]"] = app_id;
    if (version) query["filter[preReleaseVersion.version]"] = version;
    return result(await appStoreConnectRequest("GET", "/builds", query), response_format);
  }
);

server.registerTool(
  "appstoreconnect_get_sales_reports",
  {
    title: "Get App Store Connect Sales & Downloads Reports",
    description: "Downloads and parses Sales and Trends reports (gzipped TSV) into JSON, with a units/downloads summary. Useful for app download counts. Requires an API key with Admin, Finance, or Sales access.",
    inputSchema: {
      vendor_number: z.string().optional().describe("App Store Connect vendor number (Payments and Financial Reports). Defaults to the ASC_VENDOR_NUMBER environment variable."),
      frequency: salesFrequencySchema.describe("Report frequency. DAILY/WEEKLY use a date inside the period; MONTHLY uses YYYY-MM; YEARLY uses YYYY."),
      report_date: z.string().min(1).describe("Report date. DAILY/WEEKLY: YYYY-MM-DD; MONTHLY: YYYY-MM; YEARLY: YYYY."),
      report_type: z.string().default("SALES").describe("Apple reportType (e.g. SALES, SUBSCRIPTION, SUBSCRIPTION_EVENT)."),
      report_sub_type: z.string().default("SUMMARY").describe("Apple reportSubType (e.g. SUMMARY, DETAILED)."),
      version: z.string().default("1_1").describe("Apple report version."),
      sku: z.string().optional().describe("Optional: only include rows matching this app SKU."),
      apple_id: z.string().optional().describe("Optional: only include rows matching this Apple Identifier (numeric app id)."),
      include_rows: z.boolean().default(true).describe("When false, returns only the summary and omits raw rows."),
      response_format: responseFormatSchema
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ vendor_number, frequency, report_date, report_type, report_sub_type, version, sku, apple_id, include_rows, response_format }) => {
    const resolvedVendorNumber = vendor_number ?? process.env.ASC_VENDOR_NUMBER;
    if (!resolvedVendorNumber) {
      throw new Error("Missing vendor number. Pass vendor_number or set ASC_VENDOR_NUMBER.");
    }
    const report = await getSalesReport({ vendor_number: resolvedVendorNumber, frequency, report_date, report_type, report_sub_type, version });
    if (!report.available) {
      return result({ vendor_number: resolvedVendorNumber, frequency, report_date, report_type, report_sub_type, version, available: false, message: report.message }, response_format);
    }
    let rows = report.rows;
    if (sku) rows = rows.filter((row) => row["SKU"] === sku);
    if (apple_id) rows = rows.filter((row) => row["Apple Identifier"] === apple_id);
    const summary = summarizeUnits(rows);
    return result({
      vendor_number: resolvedVendorNumber,
      frequency,
      report_date,
      report_type,
      report_sub_type,
      version,
      available: true,
      row_count: rows.length,
      summary,
      ...(include_rows ? { rows } : {})
    }, response_format);
  }
);

server.registerTool(
  "appstoreconnect_create_analytics_report_request",
  {
    title: "Create Analytics Report Request",
    description: "Requests App Store Connect Analytics reports for an app. ONGOING usually generates daily/weekly/monthly data after 1-2 days; ONE_TIME_SNAPSHOT fetches historical data once.",
    inputSchema: {
      app_id: z.string().min(1).describe("App Store Connect app resource ID."),
      access_type: analyticsAccessTypeSchema.default("ONGOING").describe("Report request type."),
      response_format: responseFormatSchema
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async ({ app_id, access_type, response_format }) => {
    const body = {
      data: {
        type: "analyticsReportRequests",
        attributes: {
          accessType: access_type
        },
        relationships: {
          app: {
            data: {
              type: "apps",
              id: app_id
            }
          }
        }
      }
    };
    return result(await appStoreConnectRequest("POST", "/analyticsReportRequests", undefined, body), response_format);
  }
);

server.registerTool(
  "appstoreconnect_list_analytics_report_requests",
  {
    title: "List Analytics Report Requests",
    description: "Lists Analytics Reports API requests for a specific app.",
    inputSchema: {
      app_id: z.string().min(1).describe("App Store Connect app resource ID."),
      limit: z.number().int().min(1).max(200).default(20),
      response_format: responseFormatSchema
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ app_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/apps/${encodeURIComponent(app_id)}/analyticsReportRequests`, { limit }), response_format);
  }
);

server.registerTool(
  "appstoreconnect_list_analytics_reports",
  {
    title: "List Analytics Reports",
    description: "Lists report definitions generated by an Analytics Report Request, optionally filtered by category.",
    inputSchema: {
      request_id: z.string().min(1).describe("Analytics report request ID."),
      category: z.enum(["APP_USAGE", "APP_STORE_ENGAGEMENT", "COMMERCE", "FRAMEWORK_USAGE", "PERFORMANCE"]).optional(),
      limit: z.number().int().min(1).max(200).default(200),
      all_pages: z.boolean().default(false).describe("Follow pagination and return all pages up to max_pages."),
      max_pages: z.number().int().min(1).max(20).default(5),
      response_format: responseFormatSchema
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ request_id, category, limit, all_pages, max_pages, response_format }) => {
    const query: Record<string, QueryValue> = { limit };
    if (category) query["filter[category]"] = category;
    const data = all_pages
      ? await appStoreConnectPaginated(`/analyticsReportRequests/${encodeURIComponent(request_id)}/reports`, query, max_pages)
      : await appStoreConnectRequest("GET", `/analyticsReportRequests/${encodeURIComponent(request_id)}/reports`, query);
    return result(data, response_format);
  }
);

server.registerTool(
  "appstoreconnect_list_analytics_report_instances",
  {
    title: "List Analytics Report Instances",
    description: "Lists generated instances for a report definition. Instances are the downloadable daily, weekly, or monthly report batches.",
    inputSchema: {
      report_id: z.string().min(1).describe("Analytics report ID, for example r14-<request-id>."),
      granularity: analyticsGranularitySchema.optional(),
      processing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional ISO date filter, YYYY-MM-DD."),
      limit: z.number().int().min(1).max(200).default(20),
      response_format: responseFormatSchema
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ report_id, granularity, processing_date, limit, response_format }) => {
    const query: Record<string, QueryValue> = { limit };
    if (granularity) query["filter[granularity]"] = granularity;
    if (processing_date) query["filter[processingDate]"] = processing_date;
    return result(await appStoreConnectRequest("GET", `/analyticsReports/${encodeURIComponent(report_id)}/instances`, query), response_format);
  }
);

server.registerTool(
  "appstoreconnect_list_analytics_report_segments",
  {
    title: "List Analytics Report Segments",
    description: "Lists segment IDs for a generated Analytics Report instance. Download every segment in an instance to reconstruct the full report.",
    inputSchema: {
      instance_id: z.string().min(1).describe("Analytics report instance ID."),
      limit: z.number().int().min(1).max(200).default(20),
      response_format: responseFormatSchema
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ instance_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/analyticsReportInstances/${encodeURIComponent(instance_id)}/segments`, { limit }), response_format);
  }
);

server.registerTool(
  "appstoreconnect_get_analytics_report_segment",
  {
    title: "Get Analytics Report Segment",
    description: "Gets checksum, size, and temporary download URL for an Analytics Report segment.",
    inputSchema: {
      segment_id: z.string().min(1).describe("Analytics report segment ID."),
      response_format: responseFormatSchema
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ segment_id, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/analyticsReportSegments/${encodeURIComponent(segment_id)}`, {
      "fields[analyticsReportSegments]": "checksum,sizeInBytes,url"
    }), response_format);
  }
);

server.registerTool(
  "appstoreconnect_download_analytics_report_segment",
  {
    title: "Download Analytics Report Segment",
    description: "Downloads, decompresses, and parses an Analytics Report segment into rows. Returns a preview by default to keep MCP responses small.",
    inputSchema: {
      segment_id: z.string().min(1).describe("Analytics report segment ID."),
      max_rows: z.number().int().min(1).max(5000).default(200),
      include_rows: z.boolean().default(true),
      response_format: responseFormatSchema
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ segment_id, max_rows, include_rows, response_format }) => {
    const segment = await appStoreConnectRequest("GET", `/analyticsReportSegments/${encodeURIComponent(segment_id)}`, {
      "fields[analyticsReportSegments]": "checksum,sizeInBytes,url"
    });
    return result(await downloadAnalyticsSegment(segment, max_rows, include_rows), response_format);
  }
);

server.registerTool(
  "appstoreconnect_analyze_aso_overview",
  {
    title: "Analyze ASO Overview",
    description: "Inspects Analytics Reports availability for ASO analysis and, when segments exist, downloads report previews for discovery, downloads, purchases, subscriptions, usage, and retention.",
    inputSchema: {
      app_id: z.string().min(1).describe("App Store Connect app resource ID."),
      request_id: z.string().optional().describe("Optional Analytics Report Request ID. Defaults to an active ONGOING request, then a snapshot request."),
      granularity: analyticsGranularitySchema.default("DAILY"),
      processing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional ISO date filter, YYYY-MM-DD."),
      max_report_rows: z.number().int().min(1).max(1000).default(100),
      response_format: responseFormatSchema
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ app_id, request_id, granularity, processing_date, max_report_rows, response_format }) => {
    return result(await analyzeAsoOverview(app_id, request_id, granularity, processing_date, max_report_rows), response_format);
  }
);

async function appStoreConnectRequest(method: HttpMethod, path: string, query?: Record<string, QueryValue>, body?: unknown) {
  return requestJson(process.env.ASC_API_BASE ?? DEFAULT_API_BASE, method, path, query, body, {
    Authorization: `Bearer ${await getJwt()}`
  });
}

type SalesReportOptions = {
  vendor_number: string;
  frequency: string;
  report_date: string;
  report_type: string;
  report_sub_type: string;
  version: string;
};

type SalesReportResult =
  | { available: true; header: string[]; rows: Array<Record<string, string>> }
  | { available: false; message: string };

async function getSalesReport(opts: SalesReportOptions): Promise<SalesReportResult> {
  const baseUrl = process.env.ASC_API_BASE ?? DEFAULT_API_BASE;
  const url = buildUrl(baseUrl, "/salesReports", {
    "filter[frequency]": opts.frequency,
    "filter[reportType]": opts.report_type,
    "filter[reportSubType]": opts.report_sub_type,
    "filter[vendorNumber]": opts.vendor_number,
    "filter[reportDate]": opts.report_date,
    "filter[version]": opts.version
  });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/a-gzip",
      Authorization: `Bearer ${await getJwt()}`
    }
  });

  if (response.status === 404) {
    return {
      available: false,
      message: `No ${opts.frequency} ${opts.report_type}/${opts.report_sub_type} report available for ${opts.report_date}.`
    };
  }

  if (!response.ok) {
    const text = await response.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // keep raw text
    }
    throw new Error(formatApiError(response.status, data));
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const tsv = gunzipSync(buffer).toString("utf8");
  const { header, rows } = parseTsv(tsv);
  return { available: true, header, rows };
}

function parseTsv(tsv: string): { header: string[]; rows: Array<Record<string, string>> } {
  const lines = tsv.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0].split("\t");
  const rows = lines.slice(1).map((line) => {
    const cols = line.split("\t");
    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      row[key] = cols[index] ?? "";
    });
    return row;
  });
  return { header, rows };
}

function summarizeUnits(rows: Array<Record<string, string>>) {
  let totalUnits = 0;
  let appDownloads = 0;
  const unitsByProductType: Record<string, number> = {};
  for (const row of rows) {
    const units = Number.parseInt(row["Units"] ?? "", 10);
    if (Number.isNaN(units)) continue;
    totalUnits += units;
    const productType = row["Product Type Identifier"] ?? "";
    unitsByProductType[productType] = (unitsByProductType[productType] ?? 0) + units;
    const isUpdate = productType.startsWith("7");
    const isInAppPurchase = productType.startsWith("IA");
    if (!isUpdate && !isInAppPurchase) appDownloads += units;
  }
  return {
    total_units: totalUnits,
    app_downloads: appDownloads,
    units_by_product_type: unitsByProductType
  };
}

async function appStoreConnectPaginated(path: string, query: Record<string, QueryValue>, maxPages: number) {
  const pages = [];
  const items: unknown[] = [];
  let nextPath: string | undefined = path;
  let nextQuery: Record<string, QueryValue> | undefined = query;

  for (let page = 0; nextPath && page < maxPages; page += 1) {
    const response = await appStoreConnectRequest("GET", nextPath, nextQuery);
    const data = response.data as { data?: unknown[]; links?: { next?: string }; meta?: unknown };
    if (Array.isArray(data.data)) items.push(...data.data);
    pages.push({
      status: response.status,
      count: Array.isArray(data.data) ? data.data.length : 0,
      meta: data.meta
    });
    nextPath = data.links?.next;
    nextQuery = undefined;
  }

  return {
    status: 200,
    pages,
    data: {
      data: items,
      meta: {
        returned: items.length,
        max_pages: maxPages
      }
    }
  };
}

async function getJwt(): Promise<string> {
  const now = Date.now();
  if (jwtCache && jwtCache.expiresAtMs - now > 60_000) return jwtCache.token;

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

async function getPrivateKey(): Promise<string> {
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

async function downloadAnalyticsSegment(segmentResponse: { data: unknown }, maxRows: number, includeRows: boolean) {
  const segment = (segmentResponse.data as { data?: JsonApiResource })?.data;
  const attributes = segment?.attributes ?? {};
  const url = typeof attributes.url === "string" ? attributes.url : undefined;
  if (!url) {
    throw new Error("Analytics segment does not include a download URL. Request fields[analyticsReportSegments]=checksum,sizeInBytes,url and try again.");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Analytics segment download failed with HTTP ${response.status}. The temporary segment URL may have expired.`);
  }

  const compressed = Buffer.from(await response.arrayBuffer());
  const text = gunzipSync(compressed).toString("utf8");
  const parsed = parseDelimited(text, maxRows);
  return {
    segment: {
      id: segment?.id,
      checksum: attributes.checksum,
      size_in_bytes: attributes.sizeInBytes,
      downloaded_compressed_bytes: compressed.byteLength
    },
    report: {
      delimiter: parsed.delimiter,
      columns: parsed.columns,
      total_rows_observed: parsed.totalRows,
      returned_rows: includeRows ? parsed.rows.length : 0,
      truncated: parsed.totalRows > parsed.rows.length
    },
    rows: includeRows ? parsed.rows : undefined
  };
}

async function analyzeAsoOverview(appId: string, requestId: string | undefined, granularity: "DAILY" | "WEEKLY" | "MONTHLY", processingDate: string | undefined, maxReportRows: number) {
  const requestsResponse = await appStoreConnectRequest("GET", `/apps/${encodeURIComponent(appId)}/analyticsReportRequests`, { limit: 200 });
  const requests = getResources(requestsResponse);
  const selectedRequest = requestId
    ? requests.find((item) => item.id === requestId)
    : requests.find((item) => item.attributes?.accessType === "ONGOING" && item.attributes?.stoppedDueToInactivity !== true)
      ?? requests.find((item) => item.attributes?.stoppedDueToInactivity !== true)
      ?? requests[0];

  if (!selectedRequest) {
    return {
      ready: false,
      app_id: appId,
      next_action: "Create an ONGOING Analytics Report Request, then wait 1-2 days for Apple to generate report instances.",
      report_requests: []
    };
  }

  const reportsResponse = await appStoreConnectPaginated(
    `/analyticsReportRequests/${encodeURIComponent(selectedRequest.id)}/reports`,
    { limit: 200 },
    5
  );
  const reports = getResources(reportsResponse).filter((report) => {
    const name = String(report.attributes?.name ?? "");
    return ASO_REPORT_PATTERNS.some((pattern) => pattern.test(name));
  });

  const reportSummaries = [];
  for (const report of reports) {
    const query: Record<string, QueryValue> = { limit: 3, "filter[granularity]": granularity };
    if (processingDate) query["filter[processingDate]"] = processingDate;
    const instancesResponse = await appStoreConnectRequest("GET", `/analyticsReports/${encodeURIComponent(report.id)}/instances`, query);
    const instances = getResources(instancesResponse);
    const summary: Record<string, unknown> = {
      report_id: report.id,
      name: report.attributes?.name,
      category: report.attributes?.category,
      available_instances: instances.length,
      latest_instance: summarizeResource(instances[0])
    };

    if (instances[0]) {
      const segmentsResponse = await appStoreConnectRequest("GET", `/analyticsReportInstances/${encodeURIComponent(instances[0].id)}/segments`, { limit: 5 });
      const segments = getResources(segmentsResponse);
      summary.segment_count = segments.length;
      summary.first_segment = summarizeResource(segments[0]);
      if (segments[0]) {
        try {
          const segmentResponse = await appStoreConnectRequest("GET", `/analyticsReportSegments/${encodeURIComponent(segments[0].id)}`, {
            "fields[analyticsReportSegments]": "checksum,sizeInBytes,url"
          });
          const downloaded = await downloadAnalyticsSegment(segmentResponse, maxReportRows, true);
          summary.preview = {
            columns: downloaded.report.columns,
            total_rows_observed: downloaded.report.total_rows_observed,
            returned_rows: downloaded.report.returned_rows,
            sample_rows: downloaded.rows?.slice(0, Math.min(5, maxReportRows)),
            totals: summarizeNumericColumns(downloaded.rows ?? [])
          };
        } catch (error) {
          summary.download_error = error instanceof Error ? error.message : String(error);
        }
      }
    }
    reportSummaries.push(summary);
  }

  const readyReports = reportSummaries.filter((report) => Number(report.available_instances) > 0);
  return {
    ready: readyReports.length > 0,
    app_id: appId,
    request: summarizeResource(selectedRequest),
    granularity,
    processing_date: processingDate,
    report_count: reports.length,
    downloadable_report_count: readyReports.length,
    next_action: readyReports.length > 0
      ? "Use the segment download tool to fetch full reports, then aggregate by Date, Source Type, Page Type, Territory, Device, and product fields."
      : "Analytics report definitions exist, but no generated instances were returned. If this request is new or inactive, create/resume an ONGOING request and wait 1-2 days.",
    aso_reports: reportSummaries
  };
}

function getResources(response: { data: unknown }): JsonApiResource[] {
  const data = (response.data as { data?: unknown })?.data;
  return Array.isArray(data) ? data as JsonApiResource[] : [];
}

function summarizeResource(resource: JsonApiResource | undefined) {
  if (!resource) return null;
  return {
    id: resource.id,
    type: resource.type,
    attributes: resource.attributes
  };
}

function parseDelimited(text: string, maxRows: number) {
  const trimmed = text.replace(/^\uFEFF/, "");
  const lines = trimmed.split(/\r?\n/).filter((line) => line.length > 0);
  const delimiter = detectDelimiter(lines[0] ?? "");
  const columns = splitDelimitedLine(lines[0] ?? "", delimiter);
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    if (rows.length >= maxRows) break;
    const values = splitDelimitedLine(line, delimiter);
    const row: Record<string, string> = {};
    columns.forEach((column, index) => {
      row[column] = values[index] ?? "";
    });
    rows.push(row);
  }
  return {
    delimiter: delimiter === "\t" ? "tab" : "comma",
    columns,
    rows,
    totalRows: Math.max(0, lines.length - 1)
  };
}

function detectDelimiter(header: string) {
  return (header.match(/\t/g)?.length ?? 0) >= (header.match(/,/g)?.length ?? 0) ? "\t" : ",";
}

function splitDelimitedLine(line: string, delimiter: string) {
  if (delimiter === "\t") return line.split("\t");
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function summarizeNumericColumns(rows: Array<Record<string, string>>) {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    for (const [key, rawValue] of Object.entries(row)) {
      const normalized = rawValue.replace(/[$,%]/g, "").trim();
      if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) continue;
      totals[key] = (totals[key] ?? 0) + Number(normalized);
    }
  }
  return Object.fromEntries(
    Object.entries(totals)
      .filter(([, value]) => Number.isFinite(value))
      .sort(([a], [b]) => a.localeCompare(b))
  );
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
  return `App Store Connect API request failed with HTTP ${status}: ${typeof data === "string" ? data.slice(0, 300) : JSON.stringify(data)}`;
}

await server.connect(new StdioServerTransport());
