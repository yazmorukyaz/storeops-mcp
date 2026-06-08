#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";
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
const screenshotDisplayTypeSchema = z.enum([
    "APP_IPHONE_65",
    "APP_IPHONE_67",
    "APP_IPHONE_61",
    "APP_IPHONE_58",
    "APP_IPHONE_55",
    "APP_IPHONE_47",
    "APP_IPHONE_40",
    "APP_IPHONE_35",
    "APP_IPAD_PRO_3GEN_129",
    "APP_IPAD_PRO_3GEN_11",
    "APP_IPAD_PRO_129",
    "APP_IPAD_105",
    "APP_IPAD_97",
    "APP_DESKTOP",
    "APP_WATCH_ULTRA",
    "APP_WATCH_SERIES_7",
    "APP_WATCH_SERIES_4",
    "APP_WATCH_SERIES_3",
    "APP_APPLE_TV",
    "APP_VISION_PRO"
]);
const appStoreLocales = [
    "ar-SA",
    "ca",
    "cs",
    "da",
    "de-DE",
    "el",
    "en-AU",
    "en-CA",
    "en-GB",
    "en-US",
    "es-ES",
    "es-MX",
    "fi",
    "fr-CA",
    "fr-FR",
    "he",
    "hi",
    "hr",
    "hu",
    "id",
    "it",
    "ja",
    "ko",
    "ms",
    "nl-NL",
    "no",
    "pl",
    "pt-BR",
    "pt-PT",
    "ro",
    "ru",
    "sk",
    "sv",
    "th",
    "tr",
    "uk",
    "vi",
    "zh-Hans",
    "zh-Hant",
    "bn",
    "gu",
    "kn",
    "ml",
    "mr",
    "or",
    "pa",
    "sl",
    "ta",
    "te",
    "ur"
];
const versionLocalizationAttributesSchema = z.object({
    description: z.string().optional(),
    keywords: z.string().optional(),
    marketingUrl: z.string().url().nullable().optional(),
    promotionalText: z.string().optional(),
    supportUrl: z.string().url().nullable().optional(),
    whatsNew: z.string().optional()
}).strict();
const displayLocalizationAttributesSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional()
}).strict();
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
server.registerTool("appstoreconnect_list_supported_locales", {
    title: "List App Store Supported Locales",
    description: "Returns App Store metadata locale shortcodes supported as of the June 2026 App Store localization expansion.",
    inputSchema: {
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
    }
}, async ({ response_format }) => result({
    count: appStoreLocales.length,
    locales: appStoreLocales
}, response_format));
server.registerTool("appstoreconnect_get_app", {
    title: "Get App Store Connect App",
    description: "Reads one app and can include related App Store metadata resources.",
    inputSchema: {
        app_id: z.string().min(1).describe("App Store Connect app resource ID."),
        include: z.array(z.string()).default(["appInfos", "appStoreVersions", "inAppPurchasesV2", "subscriptionGroups", "appCustomProductPages", "promotedPurchases"]).describe("Related resources to include."),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ app_id, include, response_format }) => {
    const query = {};
    if (include.length > 0)
        query.include = include.join(",");
    return result(await appStoreConnectRequest("GET", `/apps/${encodeURIComponent(app_id)}`, query), response_format);
});
server.registerTool("appstoreconnect_list_app_infos", {
    title: "List App Info Records",
    description: "Lists app-level metadata records for an app, including category and age-rating relationships.",
    inputSchema: {
        app_id: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(50),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ app_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/apps/${encodeURIComponent(app_id)}/appInfos`, {
        limit,
        include: "appInfoLocalizations,primaryCategory,primarySubcategoryOne,primarySubcategoryTwo,secondaryCategory,secondarySubcategoryOne,secondarySubcategoryTwo"
    }), response_format);
});
server.registerTool("appstoreconnect_list_app_info_localizations", {
    title: "List App Info Localizations",
    description: "Lists localized app-level information such as app name, subtitle, privacy policy URL, and privacy choices URL.",
    inputSchema: {
        app_info_id: z.string().min(1),
        locale: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(200),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ app_info_id, locale, limit, response_format }) => {
    const query = { limit };
    if (locale)
        query["filter[locale]"] = locale;
    return result(await appStoreConnectRequest("GET", `/appInfos/${encodeURIComponent(app_info_id)}/appInfoLocalizations`, query), response_format);
});
server.registerTool("appstoreconnect_list_app_store_version_localizations", {
    title: "List App Store Version Localizations",
    description: "Lists localized version-level metadata: description, keywords, promotional text, what's new, support URL, and marketing URL.",
    inputSchema: {
        app_store_version_id: z.string().min(1),
        locale: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(200),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ app_store_version_id, locale, limit, response_format }) => {
    const query = {
        limit,
        include: "appScreenshotSets,appPreviewSets,searchKeywords"
    };
    if (locale)
        query["filter[locale]"] = locale;
    return result(await appStoreConnectRequest("GET", `/appStoreVersions/${encodeURIComponent(app_store_version_id)}/appStoreVersionLocalizations`, query), response_format);
});
server.registerTool("appstoreconnect_get_localization_visuals", {
    title: "Get Localization Visuals",
    description: "Lists screenshot sets, screenshots, app preview sets, app previews, and search keyword resources for a version localization.",
    inputSchema: {
        localization_id: z.string().min(1).describe("App Store Version Localization ID."),
        limit: z.number().int().min(1).max(200).default(100),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ localization_id, limit, response_format }) => {
    return result(await getLocalizationVisuals(localization_id, limit), response_format);
});
server.registerTool("appstoreconnect_create_screenshot_set", {
    title: "Create Screenshot Set",
    description: "Creates an App Store screenshot set for a version localization and display type. Use before uploading screenshots.",
    inputSchema: {
        localization_id: z.string().min(1),
        screenshot_display_type: screenshotDisplayTypeSchema.describe("Apple screenshot display type."),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
    }
}, async ({ localization_id, screenshot_display_type, response_format }) => {
    return result(await appStoreConnectRequest("POST", "/appScreenshotSets", undefined, {
        data: {
            type: "appScreenshotSets",
            attributes: { screenshotDisplayType: screenshot_display_type },
            relationships: {
                appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: localization_id } }
            }
        }
    }), response_format);
});
server.registerTool("appstoreconnect_create_app_store_version_localization", {
    title: "Create App Store Version Localization",
    description: "Creates localized version-level metadata for a locale. Use this to add translated ASO copy for a new App Store locale.",
    inputSchema: {
        app_store_version_id: z.string().min(1),
        locale: z.string().min(2).describe("App Store locale shortcode, for example en-US or tr."),
        attributes: versionLocalizationAttributesSchema.describe("Localized version metadata to create."),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
    }
}, async ({ app_store_version_id, locale, attributes, response_format }) => {
    return result(await appStoreConnectRequest("POST", "/appStoreVersionLocalizations", undefined, {
        data: {
            type: "appStoreVersionLocalizations",
            attributes: { locale, ...attributes },
            relationships: {
                appStoreVersion: { data: { type: "appStoreVersions", id: app_store_version_id } }
            }
        }
    }), response_format);
});
server.registerTool("appstoreconnect_update_app_store_version_localization", {
    title: "Update App Store Version Localization",
    description: "Updates localized ASO metadata for an existing App Store version localization: description, keywords, promo text, what's new, support URL, and marketing URL.",
    inputSchema: {
        localization_id: z.string().min(1),
        attributes: versionLocalizationAttributesSchema.describe("Only supplied fields are updated."),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ localization_id, attributes, response_format }) => {
    return result(await patchResource("appStoreVersionLocalizations", localization_id, attributes), response_format);
});
server.registerTool("appstoreconnect_update_app_info_localization", {
    title: "Update App Info Localization",
    description: "Updates app-level localized metadata such as app name, subtitle, privacy policy URL, and privacy choices URL.",
    inputSchema: {
        localization_id: z.string().min(1),
        attributes: z.object({
            name: z.string().optional(),
            subtitle: z.string().optional(),
            privacyPolicyUrl: z.string().url().nullable().optional(),
            privacyChoicesUrl: z.string().url().nullable().optional()
        }).strict(),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ localization_id, attributes, response_format }) => {
    return result(await patchResource("appInfoLocalizations", localization_id, attributes), response_format);
});
server.registerTool("appstoreconnect_list_iaps", {
    title: "List In-App Purchases",
    description: "Lists in-app purchases for an app. Defaults to the newer v2 relationship where supported.",
    inputSchema: {
        app_id: z.string().min(1),
        api_version: z.enum(["v1", "v2"]).default("v2"),
        limit: z.number().int().min(1).max(200).default(100),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ app_id, api_version, limit, response_format }) => {
    const relationship = api_version === "v2" ? "inAppPurchasesV2" : "inAppPurchases";
    return result(await appStoreConnectRequest("GET", `/apps/${encodeURIComponent(app_id)}/${relationship}`, { limit }), response_format);
});
server.registerTool("appstoreconnect_get_iap", {
    title: "Get In-App Purchase",
    description: "Reads one in-app purchase and includes localizations, price schedule, and review screenshot relationships where available.",
    inputSchema: {
        iap_id: z.string().min(1),
        api_version: z.enum(["v1", "v2"]).default("v2"),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ iap_id, api_version, response_format }) => {
    const path = api_version === "v2" ? `/v2/inAppPurchases/${encodeURIComponent(iap_id)}` : `/inAppPurchases/${encodeURIComponent(iap_id)}`;
    return result(await appStoreConnectRequest("GET", path, {
        include: api_version === "v2"
            ? "inAppPurchaseLocalizations,pricePoints,content,appStoreReviewScreenshot,promotedPurchase,iapPriceSchedule,inAppPurchaseAvailability,images,offerCodes"
            : "inAppPurchaseLocalizations,pricePoints,appStoreReviewScreenshot,promotedPurchase"
    }), response_format);
});
server.registerTool("appstoreconnect_list_iap_localizations", {
    title: "List In-App Purchase Localizations",
    description: "Lists localized display name and description for an in-app purchase.",
    inputSchema: {
        iap_id: z.string().min(1),
        api_version: z.enum(["v1", "v2"]).default("v2"),
        limit: z.number().int().min(1).max(200).default(200),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ iap_id, api_version, limit, response_format }) => {
    const path = api_version === "v2"
        ? `/v2/inAppPurchases/${encodeURIComponent(iap_id)}/inAppPurchaseLocalizations`
        : `/inAppPurchases/${encodeURIComponent(iap_id)}/inAppPurchaseLocalizations`;
    return result(await appStoreConnectRequest("GET", path, { limit }), response_format);
});
server.registerTool("appstoreconnect_update_iap_localization", {
    title: "Update In-App Purchase Localization",
    description: "Updates an IAP localization display name and/or description.",
    inputSchema: {
        localization_id: z.string().min(1),
        attributes: displayLocalizationAttributesSchema,
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ localization_id, attributes, response_format }) => {
    return result(await patchResource("inAppPurchaseLocalizations", localization_id, attributes), response_format);
});
server.registerTool("appstoreconnect_list_subscription_groups", {
    title: "List Subscription Groups",
    description: "Lists auto-renewable subscription groups for an app.",
    inputSchema: {
        app_id: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(100),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ app_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/apps/${encodeURIComponent(app_id)}/subscriptionGroups`, { limit }), response_format);
});
server.registerTool("appstoreconnect_list_subscriptions", {
    title: "List Subscriptions",
    description: "Lists subscriptions in a subscription group.",
    inputSchema: {
        subscription_group_id: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(100),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ subscription_group_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/subscriptionGroups/${encodeURIComponent(subscription_group_id)}/subscriptions`, { limit }), response_format);
});
server.registerTool("appstoreconnect_list_subscription_localizations", {
    title: "List Subscription Localizations",
    description: "Lists localized display name and description for a subscription.",
    inputSchema: {
        subscription_id: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(200),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ subscription_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/subscriptions/${encodeURIComponent(subscription_id)}/subscriptionLocalizations`, { limit }), response_format);
});
server.registerTool("appstoreconnect_update_subscription_localization", {
    title: "Update Subscription Localization",
    description: "Updates a subscription localization display name and/or description.",
    inputSchema: {
        localization_id: z.string().min(1),
        attributes: displayLocalizationAttributesSchema,
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ localization_id, attributes, response_format }) => {
    return result(await patchResource("subscriptionLocalizations", localization_id, attributes), response_format);
});
server.registerTool("appstoreconnect_list_subscription_group_localizations", {
    title: "List Subscription Group Localizations",
    description: "Lists localized subscription group names.",
    inputSchema: {
        subscription_group_id: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(200),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ subscription_group_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/subscriptionGroups/${encodeURIComponent(subscription_group_id)}/subscriptionGroupLocalizations`, { limit }), response_format);
});
server.registerTool("appstoreconnect_list_custom_product_pages", {
    title: "List Custom Product Pages",
    description: "Lists custom product pages for an app for campaign-specific ASO surfaces.",
    inputSchema: {
        app_id: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(100),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ app_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/apps/${encodeURIComponent(app_id)}/appCustomProductPages`, { limit }), response_format);
});
server.registerTool("appstoreconnect_list_promoted_purchases", {
    title: "List Promoted Purchases",
    description: "Lists promoted in-app purchases and subscriptions configured for App Store visibility.",
    inputSchema: {
        app_id: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(100),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ app_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/apps/${encodeURIComponent(app_id)}/promotedPurchases`, { limit }), response_format);
});
server.registerTool("appstoreconnect_list_customer_reviews", {
    title: "List Customer Reviews",
    description: "Lists App Store customer reviews for reputation and keyword-mining analysis.",
    inputSchema: {
        app_id: z.string().min(1),
        territory: z.string().optional().describe("Optional territory filter, for example USA."),
        limit: z.number().int().min(1).max(200).default(100),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ app_id, territory, limit, response_format }) => {
    const query = { limit };
    if (territory)
        query["filter[territory]"] = territory;
    return result(await appStoreConnectRequest("GET", `/apps/${encodeURIComponent(app_id)}/customerReviews`, query), response_format);
});
server.registerTool("appstoreconnect_audit_store_marketing", {
    title: "Audit App Store Marketing Surface",
    description: "Fetches and summarizes listing metadata, localizations, keywords, screenshot coverage, custom product pages, IAPs, subscriptions, promoted purchases, reviews, and analytics readiness.",
    inputSchema: {
        app_id: z.string().min(1),
        version_limit: z.number().int().min(1).max(20).default(5),
        response_format: responseFormatSchema
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ app_id, version_limit, response_format }) => {
    return result(await auditStoreMarketing(app_id, version_limit), response_format);
});
server.registerTool("appstoreconnect_get_sales_reports", {
    title: "Get App Store Connect Sales & Downloads Reports",
    description: "Downloads and parses Sales and Trends reports (gzipped TSV) into JSON, with a units/downloads summary. Useful for app download counts. Requires an API key with Admin, Finance, or Sales access.",
    inputSchema: {
        vendor_number: z.string().optional().describe("App Store Connect vendor number (Payments and Financial Reports). Defaults to the ASC_VENDOR_NUMBER environment variable."),
        frequency: salesFrequencySchema.describe("Report frequency. DAILY/WEEKLY use a date inside the period; MONTHLY uses YYYY-MM; YEARLY uses YYYY."),
        report_date: z.string().min(1).describe("Report date. DAILY/WEEKLY: YYYY-MM-DD; MONTHLY: YYYY-MM; YEARLY: YYYY."),
        report_type: z.string().default("SALES").describe("Apple reportType (e.g. SALES, SUBSCRIPTION, SUBSCRIPTION_EVENT)."),
        report_sub_type: z.string().default("SUMMARY").describe("Apple reportSubType (e.g. SUMMARY, DETAILED)."),
        version: z.string().optional().describe("Apple report version. Defaults to 1_1 for DAILY/WEEKLY and 1_0 for MONTHLY/YEARLY."),
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
}, async ({ vendor_number, frequency, report_date, report_type, report_sub_type, version, sku, apple_id, include_rows, response_format }) => {
    const resolvedVendorNumber = vendor_number ?? process.env.ASC_VENDOR_NUMBER;
    if (!resolvedVendorNumber) {
        throw new Error("Missing vendor number. Pass vendor_number or set ASC_VENDOR_NUMBER.");
    }
    const resolvedVersion = version ?? (frequency === "MONTHLY" || frequency === "YEARLY" ? "1_0" : "1_1");
    const report = await getSalesReport({ vendor_number: resolvedVendorNumber, frequency, report_date, report_type, report_sub_type, version: resolvedVersion });
    if (!report.available) {
        return result({ vendor_number: resolvedVendorNumber, frequency, report_date, report_type, report_sub_type, version: resolvedVersion, available: false, message: report.message }, response_format);
    }
    let rows = report.rows;
    if (sku)
        rows = rows.filter((row) => row["SKU"] === sku);
    if (apple_id)
        rows = rows.filter((row) => row["Apple Identifier"] === apple_id);
    const summary = summarizeUnits(rows);
    return result({
        vendor_number: resolvedVendorNumber,
        frequency,
        report_date,
        report_type,
        report_sub_type,
        version: resolvedVersion,
        available: true,
        row_count: rows.length,
        summary,
        ...(include_rows ? { rows } : {})
    }, response_format);
});
server.registerTool("appstoreconnect_create_analytics_report_request", {
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
}, async ({ app_id, access_type, response_format }) => {
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
});
server.registerTool("appstoreconnect_list_analytics_report_requests", {
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
}, async ({ app_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/apps/${encodeURIComponent(app_id)}/analyticsReportRequests`, { limit }), response_format);
});
server.registerTool("appstoreconnect_list_analytics_reports", {
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
}, async ({ request_id, category, limit, all_pages, max_pages, response_format }) => {
    const query = { limit };
    if (category)
        query["filter[category]"] = category;
    const data = all_pages
        ? await appStoreConnectPaginated(`/analyticsReportRequests/${encodeURIComponent(request_id)}/reports`, query, max_pages)
        : await appStoreConnectRequest("GET", `/analyticsReportRequests/${encodeURIComponent(request_id)}/reports`, query);
    return result(data, response_format);
});
server.registerTool("appstoreconnect_list_analytics_report_instances", {
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
}, async ({ report_id, granularity, processing_date, limit, response_format }) => {
    const query = { limit };
    if (granularity)
        query["filter[granularity]"] = granularity;
    if (processing_date)
        query["filter[processingDate]"] = processing_date;
    return result(await appStoreConnectRequest("GET", `/analyticsReports/${encodeURIComponent(report_id)}/instances`, query), response_format);
});
server.registerTool("appstoreconnect_list_analytics_report_segments", {
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
}, async ({ instance_id, limit, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/analyticsReportInstances/${encodeURIComponent(instance_id)}/segments`, { limit }), response_format);
});
server.registerTool("appstoreconnect_get_analytics_report_segment", {
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
}, async ({ segment_id, response_format }) => {
    return result(await appStoreConnectRequest("GET", `/analyticsReportSegments/${encodeURIComponent(segment_id)}`, {
        "fields[analyticsReportSegments]": "checksum,sizeInBytes,url"
    }), response_format);
});
server.registerTool("appstoreconnect_download_analytics_report_segment", {
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
}, async ({ segment_id, max_rows, include_rows, response_format }) => {
    const segment = await appStoreConnectRequest("GET", `/analyticsReportSegments/${encodeURIComponent(segment_id)}`, {
        "fields[analyticsReportSegments]": "checksum,sizeInBytes,url"
    });
    return result(await downloadAnalyticsSegment(segment, max_rows, include_rows), response_format);
});
server.registerTool("appstoreconnect_analyze_aso_overview", {
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
}, async ({ app_id, request_id, granularity, processing_date, max_report_rows, response_format }) => {
    return result(await analyzeAsoOverview(app_id, request_id, granularity, processing_date, max_report_rows), response_format);
});
async function appStoreConnectRequest(method, path, query, body) {
    const configuredBase = process.env.ASC_API_BASE ?? DEFAULT_API_BASE;
    const base = path.startsWith("/v2/")
        ? configuredBase.replace(/\/v1\/?$/, "")
        : configuredBase;
    return requestJson(base, method, path, query, body, {
        Authorization: `Bearer ${await getJwt()}`
    });
}
async function patchResource(type, id, attributes) {
    return appStoreConnectRequest("PATCH", `/${type}/${encodeURIComponent(id)}`, undefined, {
        data: {
            type,
            id,
            attributes
        }
    });
}
async function getLocalizationVisuals(localizationId, limit) {
    const [screenshotSets, previewSets, searchKeywords] = await Promise.all([
        safeAppStoreConnectRequest("GET", `/appStoreVersionLocalizations/${encodeURIComponent(localizationId)}/appScreenshotSets`, { limit }),
        safeAppStoreConnectRequest("GET", `/appStoreVersionLocalizations/${encodeURIComponent(localizationId)}/appPreviewSets`, { limit }),
        safeAppStoreConnectRequest("GET", `/appStoreVersionLocalizations/${encodeURIComponent(localizationId)}/searchKeywords`, { limit })
    ]);
    const screenshotSetItems = screenshotSets.ok ? getResources(screenshotSets.response) : [];
    const previewSetItems = previewSets.ok ? getResources(previewSets.response) : [];
    const screenshots = await Promise.all(screenshotSetItems.map((set) => safeAppStoreConnectRequest("GET", `/appScreenshotSets/${encodeURIComponent(set.id)}/appScreenshots`, { limit })));
    const previews = await Promise.all(previewSetItems.map((set) => safeAppStoreConnectRequest("GET", `/appPreviewSets/${encodeURIComponent(set.id)}/appPreviews`, { limit })));
    return {
        localization_id: localizationId,
        screenshot_sets: summarizeSafeResponse(screenshotSets),
        screenshots_by_set: screenshotSetItems.map((set, index) => ({
            set: summarizeResource(set),
            screenshots: summarizeSafeResponse(screenshots[index])
        })),
        preview_sets: summarizeSafeResponse(previewSets),
        previews_by_set: previewSetItems.map((set, index) => ({
            set: summarizeResource(set),
            previews: summarizeSafeResponse(previews[index])
        })),
        search_keywords: summarizeSafeResponse(searchKeywords)
    };
}
async function auditStoreMarketing(appId, versionLimit) {
    const [app, appInfos, versions, iaps, subscriptionGroups, customProductPages, promotedPurchases, reviews, analyticsRequests] = await Promise.all([
        safeAppStoreConnectRequest("GET", `/apps/${encodeURIComponent(appId)}`, {
            include: "appInfos,appStoreVersions,inAppPurchasesV2,subscriptionGroups,appCustomProductPages,promotedPurchases"
        }),
        safeAppStoreConnectRequest("GET", `/apps/${encodeURIComponent(appId)}/appInfos`, { limit: 50 }),
        safeAppStoreConnectRequest("GET", `/apps/${encodeURIComponent(appId)}/appStoreVersions`, { limit: versionLimit }),
        safeAppStoreConnectRequest("GET", `/apps/${encodeURIComponent(appId)}/inAppPurchasesV2`, { limit: 200 }),
        safeAppStoreConnectRequest("GET", `/apps/${encodeURIComponent(appId)}/subscriptionGroups`, { limit: 200 }),
        safeAppStoreConnectRequest("GET", `/apps/${encodeURIComponent(appId)}/appCustomProductPages`, { limit: 200 }),
        safeAppStoreConnectRequest("GET", `/apps/${encodeURIComponent(appId)}/promotedPurchases`, { limit: 200 }),
        safeAppStoreConnectRequest("GET", `/apps/${encodeURIComponent(appId)}/customerReviews`, { limit: 100 }),
        safeAppStoreConnectRequest("GET", `/apps/${encodeURIComponent(appId)}/analyticsReportRequests`, { limit: 200 })
    ]);
    const versionItems = versions.ok ? getResources(versions.response) : [];
    const appInfoItems = appInfos.ok ? getResources(appInfos.response) : [];
    const appInfoLocalizations = await Promise.all(appInfoItems.map((item) => safeAppStoreConnectRequest("GET", `/appInfos/${encodeURIComponent(item.id)}/appInfoLocalizations`, { limit: 200 })));
    const versionLocalizations = await Promise.all(versionItems.map((version) => safeAppStoreConnectRequest("GET", `/appStoreVersions/${encodeURIComponent(version.id)}/appStoreVersionLocalizations`, {
        limit: 200,
        include: "appScreenshotSets,appPreviewSets,searchKeywords"
    })));
    const subscriptionGroupItems = subscriptionGroups.ok ? getResources(subscriptionGroups.response) : [];
    const subscriptionsByGroup = await Promise.all(subscriptionGroupItems.map((group) => safeAppStoreConnectRequest("GET", `/subscriptionGroups/${encodeURIComponent(group.id)}/subscriptions`, { limit: 200 })));
    const versionLocalizationItems = versionLocalizations.flatMap((entry) => entry.ok ? getResources(entry.response) : []);
    const localesPresent = uniqueStrings(versionLocalizationItems.map((item) => item.attributes?.locale));
    const missingCommonLocales = ["en-US", "en-GB", "tr", "de-DE", "fr-FR", "es-ES", "ja", "ko", "zh-Hans", "pt-BR"]
        .filter((locale) => !localesPresent.includes(locale));
    return {
        app_id: appId,
        app: summarizeSafeResponse(app),
        counts: {
            app_infos: appInfoItems.length,
            app_info_localizations: appInfoLocalizations.reduce((sum, entry) => sum + countSafeResources(entry), 0),
            app_store_versions: versionItems.length,
            app_store_version_localizations: versionLocalizationItems.length,
            iaps: countSafeResources(iaps),
            subscription_groups: subscriptionGroupItems.length,
            subscriptions: subscriptionsByGroup.reduce((sum, entry) => sum + countSafeResources(entry), 0),
            custom_product_pages: countSafeResources(customProductPages),
            promoted_purchases: countSafeResources(promotedPurchases),
            customer_reviews_returned: countSafeResources(reviews),
            analytics_report_requests: countSafeResources(analyticsRequests)
        },
        localization_coverage: {
            supported_locale_count: appStoreLocales.length,
            present_version_locales: localesPresent,
            missing_common_growth_locales: missingCommonLocales
        },
        samples: {
            latest_version: summarizeResource(versionItems[0]),
            first_version_localization: summarizeResource(versionLocalizationItems[0]),
            first_iap: summarizeResource(iaps.ok ? getResources(iaps.response)[0] : undefined),
            first_subscription_group: summarizeResource(subscriptionGroupItems[0]),
            first_subscription: summarizeResource(subscriptionsByGroup.flatMap((entry) => entry.ok ? getResources(entry.response) : [])[0]),
            first_custom_product_page: summarizeResource(customProductPages.ok ? getResources(customProductPages.response)[0] : undefined),
            first_review: summarizeResource(reviews.ok ? getResources(reviews.response)[0] : undefined)
        },
        fetchability: {
            app: app.ok,
            app_infos: appInfos.ok,
            app_store_versions: versions.ok,
            iaps_v2: iaps.ok,
            subscription_groups: subscriptionGroups.ok,
            custom_product_pages: customProductPages.ok,
            promoted_purchases: promotedPurchases.ok,
            customer_reviews: reviews.ok,
            analytics_report_requests: analyticsRequests.ok
        },
        failures: Object.fromEntries(Object.entries({ app, appInfos, versions, iaps, subscriptionGroups, customProductPages, promotedPurchases, reviews, analyticsRequests })
            .filter(([, entry]) => !entry.ok)
            .map(([key, entry]) => [key, entry.ok ? undefined : entry.error])),
        next_best_actions: buildMarketingActions({
            versionLocalizationCount: versionLocalizationItems.length,
            missingCommonLocales,
            iapCount: countSafeResources(iaps),
            subscriptionCount: subscriptionsByGroup.reduce((sum, entry) => sum + countSafeResources(entry), 0),
            customProductPageCount: countSafeResources(customProductPages),
            promotedPurchaseCount: countSafeResources(promotedPurchases),
            reviewCount: countSafeResources(reviews)
        })
    };
}
async function getSalesReport(opts) {
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
        let data = text;
        try {
            data = JSON.parse(text);
        }
        catch {
            // keep raw text
        }
        throw new Error(formatApiError(response.status, data));
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const tsv = gunzipSync(buffer).toString("utf8");
    const { header, rows } = parseTsv(tsv);
    return { available: true, header, rows };
}
function parseTsv(tsv) {
    const lines = tsv.split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length === 0)
        return { header: [], rows: [] };
    const header = lines[0].split("\t");
    const rows = lines.slice(1).map((line) => {
        const cols = line.split("\t");
        const row = {};
        header.forEach((key, index) => {
            row[key] = cols[index] ?? "";
        });
        return row;
    });
    return { header, rows };
}
function summarizeUnits(rows) {
    let totalUnits = 0;
    let appDownloads = 0;
    const unitsByProductType = {};
    for (const row of rows) {
        const units = Number.parseInt(row["Units"] ?? "", 10);
        if (Number.isNaN(units))
            continue;
        totalUnits += units;
        const productType = row["Product Type Identifier"] ?? "";
        unitsByProductType[productType] = (unitsByProductType[productType] ?? 0) + units;
        const isUpdate = productType.startsWith("7");
        const isInAppPurchase = productType.startsWith("IA");
        if (!isUpdate && !isInAppPurchase)
            appDownloads += units;
    }
    return {
        total_units: totalUnits,
        app_downloads: appDownloads,
        units_by_product_type: unitsByProductType
    };
}
async function appStoreConnectPaginated(path, query, maxPages) {
    const pages = [];
    const items = [];
    let nextPath = path;
    let nextQuery = query;
    for (let page = 0; nextPath && page < maxPages; page += 1) {
        const response = await appStoreConnectRequest("GET", nextPath, nextQuery);
        const data = response.data;
        if (Array.isArray(data.data))
            items.push(...data.data);
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
async function downloadAnalyticsSegment(segmentResponse, maxRows, includeRows) {
    const segment = segmentResponse.data?.data;
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
async function analyzeAsoOverview(appId, requestId, granularity, processingDate, maxReportRows) {
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
    const reportsResponse = await appStoreConnectPaginated(`/analyticsReportRequests/${encodeURIComponent(selectedRequest.id)}/reports`, { limit: 200 }, 5);
    const reports = getResources(reportsResponse).filter((report) => {
        const name = String(report.attributes?.name ?? "");
        return ASO_REPORT_PATTERNS.some((pattern) => pattern.test(name));
    });
    const reportSummaries = [];
    for (const report of reports) {
        const query = { limit: 3, "filter[granularity]": granularity };
        if (processingDate)
            query["filter[processingDate]"] = processingDate;
        const instancesResponse = await appStoreConnectRequest("GET", `/analyticsReports/${encodeURIComponent(report.id)}/instances`, query);
        const instances = getResources(instancesResponse);
        const summary = {
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
                }
                catch (error) {
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
function getResources(response) {
    const data = response.data?.data;
    return Array.isArray(data) ? data : [];
}
async function safeAppStoreConnectRequest(method, path, query, body) {
    try {
        return { ok: true, response: await appStoreConnectRequest(method, path, query, body) };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}
function countSafeResources(entry) {
    return entry.ok ? getResources(entry.response).length : 0;
}
function summarizeSafeResponse(entry) {
    if (!entry.ok)
        return { ok: false, error: entry.error };
    const resources = getResources(entry.response);
    return {
        ok: true,
        status: entry.response.status,
        count: resources.length,
        data: resources.map(summarizeResource)
    };
}
function uniqueStrings(values) {
    return [...new Set(values.filter((value) => typeof value === "string"))].sort();
}
function buildMarketingActions(input) {
    const actions = [];
    if (input.versionLocalizationCount === 0) {
        actions.push("Create App Store version localizations before attempting ASO translation work.");
    }
    if (input.missingCommonLocales.length > 0) {
        actions.push(`Expand localized metadata for growth locales: ${input.missingCommonLocales.join(", ")}.`);
    }
    if (input.iapCount > 0 || input.subscriptionCount > 0) {
        actions.push("Audit IAP/subscription names, descriptions, screenshots, and promoted purchase visibility for conversion quality.");
    }
    if (input.customProductPageCount === 0) {
        actions.push("Create custom product pages for paid campaigns, keyword clusters, and audience-specific screenshots.");
    }
    if (input.promotedPurchaseCount === 0 && (input.iapCount > 0 || input.subscriptionCount > 0)) {
        actions.push("Consider promoted purchases for high-intent IAPs/subscriptions that should appear on the App Store.");
    }
    if (input.reviewCount > 0) {
        actions.push("Mine recent customer reviews for keyword ideas, objection handling, and localization priorities.");
    }
    return actions;
}
function summarizeResource(resource) {
    if (!resource)
        return null;
    return {
        id: resource.id,
        type: resource.type,
        attributes: resource.attributes
    };
}
function parseDelimited(text, maxRows) {
    const trimmed = text.replace(/^\uFEFF/, "");
    const lines = trimmed.split(/\r?\n/).filter((line) => line.length > 0);
    const delimiter = detectDelimiter(lines[0] ?? "");
    const columns = splitDelimitedLine(lines[0] ?? "", delimiter);
    const rows = [];
    for (const line of lines.slice(1)) {
        if (rows.length >= maxRows)
            break;
        const values = splitDelimitedLine(line, delimiter);
        const row = {};
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
function detectDelimiter(header) {
    return (header.match(/\t/g)?.length ?? 0) >= (header.match(/,/g)?.length ?? 0) ? "\t" : ",";
}
function splitDelimitedLine(line, delimiter) {
    if (delimiter === "\t")
        return line.split("\t");
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '"' && inQuotes && next === '"') {
            current += '"';
            index += 1;
        }
        else if (char === '"') {
            inQuotes = !inQuotes;
        }
        else if (char === "," && !inQuotes) {
            values.push(current);
            current = "";
        }
        else {
            current += char;
        }
    }
    values.push(current);
    return values;
}
function summarizeNumericColumns(rows) {
    const totals = {};
    for (const row of rows) {
        for (const [key, rawValue] of Object.entries(row)) {
            const normalized = rawValue.replace(/[$,%]/g, "").trim();
            if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized))
                continue;
            totals[key] = (totals[key] ?? 0) + Number(normalized);
        }
    }
    return Object.fromEntries(Object.entries(totals)
        .filter(([, value]) => Number.isFinite(value))
        .sort(([a], [b]) => a.localeCompare(b)));
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