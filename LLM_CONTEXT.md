# StoreOps MCP LLM Context

Use this file as copy-paste context for Codex, Claude, Cursor, or another LLM agent working with StoreOps MCP.

## What This Repo Is

StoreOps MCP is a local MCP toolkit for store and monetization operations. It has two separate MCP servers:

- `appstoreconnect-mcp`: App Store Connect tools for apps, builds, App Store versions, Sales and Trends reports, Analytics Reports, ASO-style analysis, and generic App Store Connect API requests.
- `revenuecat-mcp`: RevenueCat tools for projects, apps, products, entitlements, offerings, customers, customer subresources, paywalls, metrics overview, monetization analysis, and generic RevenueCat API requests.

The servers are intentionally separate because App Store Connect and RevenueCat have different credentials, permission models, rate limits, APIs, and failure modes.

## Safety Rules For LLM Agents

- Never print `.env` contents.
- Never print API keys, private `.p8` key contents, JWTs, shared secrets, or bearer tokens.
- Prefer read-only tools first.
- Before any write operation, show the exact method, path, and JSON body.
- Do not create, update, delete, submit for review, or mutate production store data unless the user explicitly asks for that action.
- Treat App Store Connect and RevenueCat as production systems.
- If an endpoint returns `403`, explain the missing permission instead of retrying blindly.
- If Analytics Reports have definitions but no instances, explain that Apple has not generated report instances yet.
- Keep credentials local. Do not commit `.env`, `.p8`, generated reports, or private output data.

## Install / Build

From repo root:

```sh
cd appstoreconnect-mcp
npm install
npm run build

cd ../revenuecat-mcp
npm install
npm run build
```

Each plugin has:

- `.mcp.json`
- `.codex-plugin/plugin.json`
- `skills/.../SKILL.md`
- `.env.example`

The `.mcp.json` files run `node dist/index.js`. Build before launching.

## Credentials

Copy examples:

```sh
cp appstoreconnect-mcp/.env.example appstoreconnect-mcp/.env
cp revenuecat-mcp/.env.example revenuecat-mcp/.env
```

Never commit these `.env` files.

## App Store Connect Credentials

Required:

```sh
ASC_KEY_ID=
ASC_ISSUER_ID=
ASC_PRIVATE_KEY_PATH=/absolute/path/AuthKey_XXXXXXXXXX.p8
```

Optional:

```sh
ASC_VENDOR_NUMBER=
ASC_API_BASE=https://api.appstoreconnect.apple.com/v1
APPLE_IAP_KEY_ID=
APPLE_IAP_ISSUER_ID=
APPLE_IAP_PRIVATE_KEY_PATH=/absolute/path/SubscriptionKey_XXXXXXXXXX.p8
APPLE_SHARED_SECRET=
```

### Where To Get App Store Connect API Credentials

As of June 2026:

1. Open App Store Connect.
2. Go to `Users and Access`.
3. Open `Integrations`.
4. Open `App Store Connect API`.
5. Use `Team Keys` for account-level automation, or use an individual key from the user's profile.
6. For a team key, the Account Holder or Admin may need to request API access and accept Apple's API terms.
7. Generate an API key.
8. Copy the Key ID into `ASC_KEY_ID`.
9. Copy the Issuer ID into `ASC_ISSUER_ID`.
10. Download the `.p8` private key immediately and set its absolute path in `ASC_PRIVATE_KEY_PATH`.

Apple private keys are one-time downloads. If the `.p8` file is lost, revoke the old key and create a new one.

### App Store Connect Roles

Use the smallest role that works:

- `Admin`: broadest automation coverage; required to request a new Analytics Report type for the first time.
- `App Manager`: useful for app metadata, versions, IAP, subscriptions, builds, and review workflows.
- `Sales and Reports` or `Finance`: useful for downloading already-requested Analytics Reports and Sales/Financial reporting workflows.

### Vendor Number

`ASC_VENDOR_NUMBER` is used by `appstoreconnect_get_sales_reports` for Sales and Trends downloads.

Find it in App Store Connect under `Payments and Financial Reports`. Users can also pass `vendor_number` directly to the tool.

Sales report version defaults:

- `DAILY` / `WEEKLY`: `1_1`
- `MONTHLY` / `YEARLY`: `1_0`

### Apple In-App Purchase Key

Use this for App Store Server API and some RevenueCat Apple integration workflows:

```sh
APPLE_IAP_KEY_ID=
APPLE_IAP_ISSUER_ID=
APPLE_IAP_PRIVATE_KEY_PATH=/absolute/path/SubscriptionKey_XXXXXXXXXX.p8
```

Where to get it:

1. Open App Store Connect.
2. Go to `Users and Access`.
3. Open `Integrations`.
4. Under `Keys`, open `In-App Purchase`.
5. Generate an In-App Purchase key.
6. Copy Issuer ID and Key ID.
7. Download the `.p8` private key immediately.

One In-App Purchase key can generally support server-side purchase workflows across the account/team. Products and subscriptions are still configured per app.

### App Store Shared Secret

`APPLE_SHARED_SECRET` is only for legacy auto-renewable subscription validation flows that still require it. Prefer modern App Store Server API / In-App Purchase keys when possible.

## RevenueCat Credentials

Required:

```sh
REVENUECAT_API_KEY=
```

Optional:

```sh
REVENUECAT_API_BASE=https://api.revenuecat.com/v2
REVENUECAT_V1_API_BASE=https://api.revenuecat.com/v1
```

### Where To Get RevenueCat Credentials

1. Open the RevenueCat dashboard.
2. Select the target project.
3. Open the project's API key or authentication settings.
4. Create or copy a Secret API key.
5. Put it in `REVENUECAT_API_KEY`.

Use a secret API key or OAuth access token for server-side MCP operations. Do not use a public SDK key for write actions.

### RevenueCat Permissions

The dedicated tools work with standard RevenueCat API v2 access for:

- projects
- apps
- products
- entitlements
- offerings
- customers
- customer subresources
- paywalls
- metrics overview

Additional RevenueCat areas require extra permissions:

- Charts: `charts_metrics:charts:read`
- Experiments: `project_configuration:experiments:read`
- Virtual currencies: `project_configuration:virtual_currencies:read`

If v1 subscriber tools return a compatibility error, use the v2 customer tools instead.

## App Store Connect Tools

- `appstoreconnect_auth_status`
- `appstoreconnect_request`
- `appstoreconnect_list_apps`
- `appstoreconnect_get_app_store_versions`
- `appstoreconnect_list_builds`
- `appstoreconnect_get_sales_reports`
- `appstoreconnect_create_analytics_report_request`
- `appstoreconnect_list_analytics_report_requests`
- `appstoreconnect_list_analytics_reports`
- `appstoreconnect_list_analytics_report_instances`
- `appstoreconnect_list_analytics_report_segments`
- `appstoreconnect_get_analytics_report_segment`
- `appstoreconnect_download_analytics_report_segment`
- `appstoreconnect_analyze_aso_overview`

## RevenueCat Tools

- `revenuecat_auth_status`
- `revenuecat_request`
- `revenuecat_list_projects`
- `revenuecat_list_apps`
- `revenuecat_get_app`
- `revenuecat_list_products`
- `revenuecat_get_product`
- `revenuecat_list_entitlements`
- `revenuecat_get_entitlement`
- `revenuecat_list_entitlement_products`
- `revenuecat_list_offerings`
- `revenuecat_get_offering`
- `revenuecat_list_customers`
- `revenuecat_get_customer`
- `revenuecat_get_customer_subresource`
- `revenuecat_list_paywalls`
- `revenuecat_get_metrics_overview`
- `revenuecat_analyze_monetization_overview`
- `revenuecat_get_subscriber`

## Recommended LLM Workflow

### 1. Check Auth

Start with:

```text
Use appstoreconnect_auth_status with check_jwt=true.
Use revenuecat_auth_status.
```

Then verify read access:

```text
Use appstoreconnect_list_apps with limit 10.
Use revenuecat_list_projects with limit 10.
```

### 2. App Store Connect ASO / Store Analytics

Use:

```text
Use appstoreconnect_analyze_aso_overview with app_id="<app_id>".
```

This checks:

- Analytics Report Requests
- ASO-relevant report definitions
- generated report instances
- downloadable report segments if available

Important limitation:

Apple Analytics Report definitions can exist while generated instances are still empty. In that case, wait for Apple to generate instances. Ongoing reports usually need 24-48 hours for the first generated report. Daily data is considered complete two days after the reporting date.

### 3. App Store Connect Sales And Trends

Use:

```text
Use appstoreconnect_get_sales_reports with frequency="DAILY" and report_date="YYYY-MM-DD".
```

or:

```text
Use appstoreconnect_get_sales_reports with frequency="MONTHLY" and report_date="YYYY-MM".
```

Requires `ASC_VENDOR_NUMBER` or a `vendor_number` argument.

The tool downloads Apple's gzipped TSV, parses it, and returns:

- row count
- total units
- app downloads
- units by product type
- optional raw rows

### 4. RevenueCat Monetization Overview

Use:

```text
Use revenuecat_analyze_monetization_overview with project_id="<project_id>".
```

This fetches:

- apps
- products
- entitlements
- entitlement products
- offerings
- expanded offering package/product data
- customers
- first customer detail
- first customer active entitlements
- first customer subscriptions
- first customer purchases
- first customer invoices
- paywalls
- metrics overview

Then drill down with:

```text
Use revenuecat_list_products.
Use revenuecat_get_offering.
Use revenuecat_get_customer_subresource.
Use revenuecat_get_metrics_overview.
```

## What Each System Answers

App Store Connect answers:

- What happened in the store?
- Which builds and App Store versions exist?
- What are Sales and Trends totals?
- What Analytics Reports are available?
- What ASO funnel data can Apple export?

RevenueCat answers:

- What products and entitlements are configured?
- Which offerings and paywalls exist?
- What customer purchase/subscription state exists?
- How does monetization look from RevenueCat?
- What did users unlock after purchase?

Use both together for reconciliation:

- App Store Connect downloads, proceeds, sales, and store funnel
- RevenueCat products, paywalls, customer state, entitlements, and monetization config

## Known Limitations

- App Store Analytics segment download tools require generated Analytics Report instances and segments. If none exist, the tools cannot download report files yet.
- `appstoreconnect_create_analytics_report_request` is a write action because it creates a report request. Do not run it without explicit user approval.
- Sales and Trends reports require `ASC_VENDOR_NUMBER` or a `vendor_number` argument.
- RevenueCat charts, experiments, and virtual currencies need extra permissions beyond a minimal v2 key.
- RevenueCat API v1 subscriber tools may not work with v2-only secret keys.

## Good Starter Prompts

```text
Check both StoreOps MCP plugins. Verify App Store Connect auth, RevenueCat auth, list apps, list projects, and summarize what is available.
```

```text
Analyze App Store Connect ASO readiness for app_id="<app_id>". Tell me which Analytics Reports exist, whether instances and segments are downloadable, and what the next action is.
```

```text
Fetch Sales and Trends for app_id="<app_id>" or SKU="<sku>" for the last available daily report. Summarize app downloads, total units, and product type breakdown.
```

```text
Analyze RevenueCat monetization for project_id="<project_id>". Summarize apps, products, entitlements, offerings, paywalls, customer sample, and missing permissions.
```

```text
Compare App Store Connect sales/download data with RevenueCat products, offerings, paywalls, and customer state. Identify gaps or inconsistencies.
```
