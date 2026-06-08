#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const DEFAULT_API_BASE = "https://api.revenuecat.com/v2";
const DEFAULT_V1_API_BASE = "https://api.revenuecat.com/v1";
const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const responseFormatSchema = z.enum(["json", "markdown"]).default("json");
const paginationInput = {
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum items to request where supported."),
    starting_after: z.string().optional().describe("Pagination cursor where supported.")
};
const querySchema = z.record(z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
    z.null()
])).optional();
const server = new McpServer({
    name: "revenuecat-mcp-server",
    version: "0.1.0"
});
server.registerTool("revenuecat_auth_status", {
    title: "Check RevenueCat Auth Status",
    description: "Reports whether REVENUECAT_API_KEY is configured without printing the secret value.",
    inputSchema: {},
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
    }
}, async () => result({ has_api_key: Boolean(process.env.REVENUECAT_API_KEY) }));
server.registerTool("revenuecat_request", {
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
}, async ({ method, path, query, body, response_format }) => {
    return result(await revenueCatRequest(method, path, query, body), response_format);
});
server.registerTool("revenuecat_list_projects", {
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
}, async ({ limit, starting_after, response_format }) => {
    return result(await revenueCatRequest("GET", "/projects", { limit, starting_after }), response_format);
});
server.registerTool("revenuecat_list_apps", {
    title: "List RevenueCat Apps",
    description: "Lists apps in a RevenueCat project.",
    inputSchema: {
        project_id: z.string().min(1).describe("RevenueCat project ID, for example proj..."),
        ...paginationInput,
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, limit, starting_after, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/apps`, { limit, starting_after }), response_format);
});
server.registerTool("revenuecat_get_app", {
    title: "Get RevenueCat App",
    description: "Fetches one app in a RevenueCat project.",
    inputSchema: {
        project_id: z.string().min(1),
        app_id: z.string().min(1),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, app_id, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/apps/${encodeURIComponent(app_id)}`), response_format);
});
server.registerTool("revenuecat_list_products", {
    title: "List RevenueCat Products",
    description: "Lists products in a RevenueCat project, including subscriptions and one-time purchases.",
    inputSchema: {
        project_id: z.string().min(1),
        ...paginationInput,
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, limit, starting_after, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/products`, { limit, starting_after }), response_format);
});
server.registerTool("revenuecat_get_product", {
    title: "Get RevenueCat Product",
    description: "Fetches one product in a RevenueCat project.",
    inputSchema: {
        project_id: z.string().min(1),
        product_id: z.string().min(1),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, product_id, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/products/${encodeURIComponent(product_id)}`), response_format);
});
server.registerTool("revenuecat_list_entitlements", {
    title: "List RevenueCat Entitlements",
    description: "Lists entitlements in a RevenueCat project.",
    inputSchema: {
        project_id: z.string().min(1),
        ...paginationInput,
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, limit, starting_after, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/entitlements`, { limit, starting_after }), response_format);
});
server.registerTool("revenuecat_get_entitlement", {
    title: "Get RevenueCat Entitlement",
    description: "Fetches one entitlement in a RevenueCat project.",
    inputSchema: {
        project_id: z.string().min(1),
        entitlement_id: z.string().min(1),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, entitlement_id, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/entitlements/${encodeURIComponent(entitlement_id)}`), response_format);
});
server.registerTool("revenuecat_list_entitlement_products", {
    title: "List Entitlement Products",
    description: "Lists products attached to a RevenueCat entitlement.",
    inputSchema: {
        project_id: z.string().min(1),
        entitlement_id: z.string().min(1),
        ...paginationInput,
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, entitlement_id, limit, starting_after, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/entitlements/${encodeURIComponent(entitlement_id)}/products`, { limit, starting_after }), response_format);
});
server.registerTool("revenuecat_list_offerings", {
    title: "List RevenueCat Offerings",
    description: "Lists offerings in a RevenueCat project.",
    inputSchema: {
        project_id: z.string().min(1),
        ...paginationInput,
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, limit, starting_after, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/offerings`, { limit, starting_after }), response_format);
});
server.registerTool("revenuecat_get_offering", {
    title: "Get RevenueCat Offering",
    description: "Fetches one offering. Can expand package and product details.",
    inputSchema: {
        project_id: z.string().min(1),
        offering_id: z.string().min(1),
        expand_packages: z.boolean().default(true).describe("Include expand=package and expand=package.product."),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, offering_id, expand_packages, response_format }) => {
    const query = expand_packages ? { expand: ["package", "package.product"] } : undefined;
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/offerings/${encodeURIComponent(offering_id)}`, query), response_format);
});
server.registerTool("revenuecat_list_customers", {
    title: "List RevenueCat Customers",
    description: "Lists customers in a RevenueCat project.",
    inputSchema: {
        project_id: z.string().min(1),
        ...paginationInput,
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, limit, starting_after, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/customers`, { limit, starting_after }), response_format);
});
server.registerTool("revenuecat_get_customer", {
    title: "Get RevenueCat Customer",
    description: "Fetches one customer in a RevenueCat project.",
    inputSchema: {
        project_id: z.string().min(1),
        customer_id: z.string().min(1).describe("RevenueCat customer ID / app user ID."),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, customer_id, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/customers/${encodeURIComponent(customer_id)}`), response_format);
});
const customerSubresourceSchema = z.enum(["active_entitlements", "aliases", "attributes", "subscriptions", "purchases", "invoices"]);
server.registerTool("revenuecat_get_customer_subresource", {
    title: "Get RevenueCat Customer Subresource",
    description: "Fetches a customer's active entitlements, aliases, attributes, subscriptions, purchases, or invoices.",
    inputSchema: {
        project_id: z.string().min(1),
        customer_id: z.string().min(1),
        resource: customerSubresourceSchema,
        ...paginationInput,
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, customer_id, resource, limit, starting_after, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/customers/${encodeURIComponent(customer_id)}/${resource}`, { limit, starting_after }), response_format);
});
server.registerTool("revenuecat_list_paywalls", {
    title: "List RevenueCat Paywalls",
    description: "Lists paywalls in a RevenueCat project.",
    inputSchema: {
        project_id: z.string().min(1),
        ...paginationInput,
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, limit, starting_after, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/paywalls`, { limit, starting_after }), response_format);
});
server.registerTool("revenuecat_get_paywall", {
    title: "Get RevenueCat Paywall",
    description: "Fetches one RevenueCat paywall when the API key has paywall read permission.",
    inputSchema: {
        project_id: z.string().min(1),
        paywall_id: z.string().min(1),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, paywall_id, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/paywalls/${encodeURIComponent(paywall_id)}`), response_format);
});
server.registerTool("revenuecat_get_metrics_overview", {
    title: "Get RevenueCat Metrics Overview",
    description: "Fetches the RevenueCat project metrics overview endpoint when the key has access.",
    inputSchema: {
        project_id: z.string().min(1),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, response_format }) => {
    return result(await revenueCatRequest("GET", `/projects/${encodeURIComponent(project_id)}/metrics/overview`), response_format);
});
server.registerTool("revenuecat_audit_paywall_catalog", {
    title: "Audit RevenueCat Paywall Catalog",
    description: "Summarizes apps, products, packages, entitlements, offerings, paywalls, webhooks, and metrics so an agent can find paywall/catalog gaps.",
    inputSchema: {
        project_id: z.string().min(1),
        customer_limit: z.number().int().min(1).max(100).default(10),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, customer_limit, response_format }) => {
    return result(await auditPaywallCatalog(project_id, customer_limit), response_format);
});
server.registerTool("revenuecat_analyze_monetization_overview", {
    title: "Analyze RevenueCat Monetization Overview",
    description: "Fetches and summarizes project apps, products, entitlements, offerings, customers, paywalls, and metrics overview for monetization analysis.",
    inputSchema: {
        project_id: z.string().min(1),
        customer_limit: z.number().int().min(1).max(100).default(20),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ project_id, customer_limit, response_format }) => {
    return result(await analyzeMonetizationOverview(project_id, customer_limit), response_format);
});
server.registerTool("revenuecat_get_subscriber", {
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
}, async ({ app_user_id, response_format }) => {
    return result(await revenueCatRequest("GET", `/subscribers/${encodeURIComponent(app_user_id)}`, undefined, undefined, true), response_format);
});
async function auditPaywallCatalog(projectId, customerLimit) {
    const [apps, products, packages, entitlements, offerings, customers, paywalls, metrics, webhooks] = await Promise.all([
        safeRevenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/apps`, { limit: 100 }),
        safeRevenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/products`, { limit: 100 }),
        safeRevenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/packages`, { limit: 100, expand: "items.product" }),
        safeRevenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/entitlements`, { limit: 100 }),
        safeRevenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/offerings`, { limit: 100, expand: ["items.package", "items.package.product"] }),
        safeRevenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/customers`, { limit: customerLimit }),
        safeRevenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/paywalls`, { limit: 100 }),
        safeRevenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/metrics/overview`),
        safeRevenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/integrations/webhooks`, { limit: 100 })
    ]);
    const entitlementItems = safeItems(entitlements);
    const offeringItems = safeItems(offerings);
    const firstEntitlementId = getId(entitlementItems[0]);
    const firstOfferingId = getId(offeringItems[0]);
    const [firstEntitlementProducts, firstOfferingExpanded] = await Promise.all([
        firstEntitlementId
            ? safeRevenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/entitlements/${encodeURIComponent(firstEntitlementId)}/products`, { limit: 100 })
            : Promise.resolve(undefined),
        firstOfferingId
            ? safeRevenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/offerings/${encodeURIComponent(firstOfferingId)}`, { expand: ["package", "package.product"] })
            : Promise.resolve(undefined)
    ]);
    const productItems = safeItems(products);
    const packageItems = safeItems(packages);
    const paywallItems = safeItems(paywalls);
    const issues = [];
    if (productItems.length === 0)
        issues.push("No products were returned. Add or import App Store / Google Play / Stripe products before paywall optimization.");
    if (entitlementItems.length === 0)
        issues.push("No entitlements were returned. Entitlements are the access layer that turns purchases into product value.");
    if (offeringItems.length === 0)
        issues.push("No offerings were returned. Offerings are required for remotely controlled paywall product mixes.");
    if (packages.ok && packageItems.length === 0)
        issues.push("No packages were returned from the direct package endpoint. Packages connect offerings to concrete products.");
    if (paywallItems.length === 0)
        issues.push("No paywalls were returned. Add RevenueCat Paywalls to remotely change conversion UI without app releases.");
    if (firstEntitlementProducts && firstEntitlementProducts.ok && getItems(firstEntitlementProducts.response).length === 0) {
        issues.push("The first entitlement has no attached products.");
    }
    return {
        project_id: projectId,
        counts: {
            apps: safeCount(apps),
            products: productItems.length,
            direct_packages: packages.ok ? packageItems.length : null,
            entitlements: entitlementItems.length,
            offerings: offeringItems.length,
            paywalls: paywallItems.length,
            customers_returned: safeCount(customers),
            webhook_integrations: webhooks.ok ? safeCount(webhooks) : null,
            products_on_first_entitlement: firstEntitlementProducts ? safeCount(firstEntitlementProducts) : null
        },
        samples: {
            first_app: summarizeItem(safeItems(apps)[0]),
            first_product: summarizeItem(productItems[0]),
            first_package: summarizeItem(packageItems[0]),
            first_entitlement: summarizeItem(entitlementItems[0]),
            first_offering: summarizeItem(offeringItems[0]),
            first_paywall: summarizeItem(paywallItems[0]),
            first_webhook: summarizeItem(safeItems(webhooks)[0])
        },
        fetchability: {
            apps: apps.ok,
            products: products.ok,
            packages: packages.ok,
            entitlements: entitlements.ok,
            offerings: offerings.ok,
            customers: customers.ok,
            paywalls: paywalls.ok,
            metrics_overview: metrics.ok,
            webhook_integrations: webhooks.ok,
            first_entitlement_products: firstEntitlementProducts ? firstEntitlementProducts.ok : null,
            first_offering_expanded_packages_products: firstOfferingExpanded ? firstOfferingExpanded.ok : null
        },
        failures: Object.fromEntries(Object.entries({ apps, products, packages, entitlements, offerings, customers, paywalls, metrics, webhooks })
            .filter(([, entry]) => !entry.ok)
            .map(([key, entry]) => [key, entry.ok ? undefined : entry.error])),
        issues,
        marketing_value: [
            "Map every App Store product to RevenueCat products, entitlements, offerings, packages, and paywalls.",
            "Detect missing products/packages before users hit empty paywalls.",
            "Review paywall readiness, webhook lifecycle tracking, and monetization metrics from one agent workflow.",
            "Pair with App Store Connect localization tools to optimize subscription/IAP names, store copy, and paywall positioning together."
        ],
        metrics_overview: metrics.ok ? metrics.response.data : undefined
    };
}
async function analyzeMonetizationOverview(projectId, customerLimit) {
    const [apps, products, entitlements, offerings, customers, paywalls, metrics] = await Promise.all([
        revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/apps`, { limit: 100 }),
        revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/products`, { limit: 100 }),
        revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/entitlements`, { limit: 100 }),
        revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/offerings`, { limit: 100 }),
        revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/customers`, { limit: customerLimit }),
        revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/paywalls`, { limit: 100 }),
        revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/metrics/overview`)
    ]);
    const entitlementItems = getItems(entitlements);
    const offeringItems = getItems(offerings);
    const customerItems = getItems(customers);
    const firstEntitlementId = getId(entitlementItems[0]);
    const firstOfferingId = getId(offeringItems[0]);
    const firstCustomerId = getId(customerItems[0]);
    const entitlementProducts = firstEntitlementId
        ? await revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/entitlements/${encodeURIComponent(firstEntitlementId)}/products`, { limit: 100 })
        : undefined;
    const expandedOffering = firstOfferingId
        ? await revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/offerings/${encodeURIComponent(firstOfferingId)}`, { expand: ["package", "package.product"] })
        : undefined;
    const customerDetails = firstCustomerId
        ? await Promise.all([
            revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(firstCustomerId)}`),
            revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(firstCustomerId)}/active_entitlements`, { limit: 100 }),
            revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(firstCustomerId)}/subscriptions`, { limit: 100 }),
            revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(firstCustomerId)}/purchases`, { limit: 100 }),
            revenueCatRequest("GET", `/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(firstCustomerId)}/invoices`, { limit: 100 })
        ])
        : undefined;
    return {
        project_id: projectId,
        counts: {
            apps: getItems(apps).length,
            products: getItems(products).length,
            entitlements: entitlementItems.length,
            offerings: offeringItems.length,
            customers_returned: customerItems.length,
            paywalls: getItems(paywalls).length,
            entitlement_products_for_first_entitlement: entitlementProducts ? getItems(entitlementProducts).length : null
        },
        pagination: {
            customers_has_next_page: Boolean(customers.data?.next_page)
        },
        samples: {
            first_app: summarizeItem(getItems(apps)[0]),
            first_product: summarizeItem(getItems(products)[0]),
            first_entitlement: summarizeItem(entitlementItems[0]),
            first_offering: summarizeItem(offeringItems[0]),
            first_customer: summarizeItem(customerItems[0]),
            first_paywall: summarizeItem(getItems(paywalls)[0])
        },
        fetchability: {
            metrics_overview: metrics.status === 200,
            first_entitlement_products: Boolean(entitlementProducts),
            first_offering_expanded_packages_products: Boolean(expandedOffering),
            first_customer_detail: Boolean(customerDetails?.[0]),
            first_customer_active_entitlements: Boolean(customerDetails?.[1]),
            first_customer_subscriptions: Boolean(customerDetails?.[2]),
            first_customer_purchases: Boolean(customerDetails?.[3]),
            first_customer_invoices: Boolean(customerDetails?.[4])
        },
        metrics_overview: metrics.data
    };
}
async function revenueCatRequest(method, path, query, body, useV1 = false) {
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
async function safeRevenueCatRequest(method, path, query, body, useV1 = false) {
    try {
        return { ok: true, response: await revenueCatRequest(method, path, query, body, useV1) };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}
function safeItems(entry) {
    return entry.ok ? getItems(entry.response) : [];
}
function safeCount(entry) {
    return entry?.ok ? getItems(entry.response).length : 0;
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
function getItems(response) {
    const data = response.data;
    const items = Array.isArray(data.items) ? data.items : Array.isArray(data.data) ? data.data : [];
    return items.filter((item) => Boolean(item) && typeof item === "object");
}
function getId(item) {
    return typeof item?.id === "string" ? item.id : undefined;
}
function summarizeItem(item) {
    if (!item)
        return null;
    return {
        id: item.id,
        name: item.name,
        display_name: item.display_name,
        type: item.type,
        store_identifier: item.store_identifier
    };
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
    return `RevenueCat API request failed with HTTP ${status}: ${typeof data === "string" ? data.slice(0, 300) : JSON.stringify(data)}`;
}
await server.connect(new StdioServerTransport());
//# sourceMappingURL=index.js.map