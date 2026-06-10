# StoreOps MCP LLM Context

Use this file as copy-paste context for Codex, Claude, Cursor, or another LLM agent working with StoreOps MCP.

## What This Repo Is

StoreOps MCP is a local MCP toolkit for store and monetization operations. It has two separate MCP servers:

- `appstoreconnect-mcp`: App Store Connect tools for apps, builds, App Store versions, App Store listing metadata, localizations, screenshots/previews, IAPs, subscriptions, custom product pages, promoted purchases, customer reviews, Sales and Trends reports, Analytics Reports, ASO-style analysis, and generic App Store Connect API requests.
- `revenuecat-mcp`: RevenueCat tools for projects, apps, products, entitlements, offerings, customers, customer subresources, paywalls, metrics overview, paywall catalog analysis, monetization analysis, and generic RevenueCat API requests.

The servers are intentionally separate because App Store Connect and RevenueCat have different credentials, permission models, rate limits, APIs, and failure modes.

Superwall is a related but separate hosted OAuth MCP. Use it alongside StoreOps when the workflow needs Superwall organizations, projects, apps, products, entitlements, templates, paywalls, campaigns, or webhooks. Do not assume Superwall tools are available in a session until the MCP exposes them; start with Superwall `whoami`.

## What It Does Not Do

- It does not include, upload, sync, or manage user credentials.
- It does not automatically submit App Store metadata, screenshots, IAPs, subscriptions, or paywalls for review.
- It does not mutate production data unless an explicit write tool is called with exact target IDs and payloads.
- It does not replace final human review in App Store Connect, RevenueCat, or Superwall.
- It does not bundle Superwall account access. Superwall must be installed and authenticated separately through its hosted OAuth MCP.

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
- For Superwall, verify the authenticated account with `whoami` before listing or changing resources.

## Try These Prompts

```text
Audit my App Store listing and RevenueCat monetization setup for app ID 1234567890.
```

```text
Audit my RevenueCat offering against App Store subscriptions.
```

```text
List my App Store subscriptions, RevenueCat products, entitlements, offerings, and paywalls, then show mismatches.
```

```text
Check whether every App Store localization has matching subscription and IAP localization copy.
```

```text
Use Superwall whoami, then list projects and paywalls so we can compare them with RevenueCat offerings.
```

## Concrete Example Output

Prompt:

```text
Audit my RevenueCat offering against App Store subscriptions.
```

Example result:

```text
Summary
- App Store subscriptions found: monthly_pro, yearly_pro
- RevenueCat products found: monthly_pro, yearly_pro, lifetime_pro
- RevenueCat offering "default" includes: monthly_pro, yearly_pro

Issues
- lifetime_pro exists in RevenueCat but no matching App Store subscription or IAP was found.
- yearly_pro has matching product IDs, but App Store localization is missing for fr-FR.
- The default offering has no explicit lifetime package, so lifetime_pro cannot be purchased from that offering.

Recommended next steps
- Confirm whether lifetime_pro should be a non-consumable IAP in App Store Connect.
- Add missing fr-FR subscription localization before launch.
- Add lifetime_pro to the intended RevenueCat offering only after the App Store product exists and is approved.
```

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
- Webhook integrations: `project_configuration:integrations:read`
- Virtual currencies: `project_configuration:virtual_currencies:read`

If v1 subscriber tools return a compatibility error, use the v2 customer tools instead.

## App Store Connect Tools

- `appstoreconnect_auth_status`
- `appstoreconnect_request`
- `appstoreconnect_list_apps`
- `appstoreconnect_get_app_store_versions`
- `appstoreconnect_list_builds`
- `appstoreconnect_list_supported_locales`
- `appstoreconnect_get_app`
- `appstoreconnect_list_app_infos`
- `appstoreconnect_list_app_info_localizations`
- `appstoreconnect_list_app_store_version_localizations`
- `appstoreconnect_get_localization_visuals`
- `appstoreconnect_create_screenshot_set`
- `appstoreconnect_create_app_store_version_localization`
- `appstoreconnect_update_app_store_version_localization`
- `appstoreconnect_update_app_info_localization`
- `appstoreconnect_list_iaps`
- `appstoreconnect_get_iap`
- `appstoreconnect_list_iap_localizations`
- `appstoreconnect_update_iap_localization`
- `appstoreconnect_list_subscription_groups`
- `appstoreconnect_list_subscriptions`
- `appstoreconnect_list_subscription_localizations`
- `appstoreconnect_update_subscription_localization`
- `appstoreconnect_list_subscription_group_localizations`
- `appstoreconnect_list_custom_product_pages`
- `appstoreconnect_list_promoted_purchases`
- `appstoreconnect_list_customer_reviews`
- `appstoreconnect_audit_store_marketing`
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
- `revenuecat_get_paywall`
- `revenuecat_get_metrics_overview`
- `revenuecat_audit_paywall_catalog`
- `revenuecat_analyze_monetization_overview`
- `revenuecat_get_subscriber`

## Ability Matrix

This section explains what StoreOps MCP can actually help an LLM do.

### App Store Connect Abilities

`appstoreconnect-mcp` can:

- Verify App Store Connect credentials without printing secrets.
- Sign and validate App Store Connect JWTs.
- List App Store Connect apps visible to the API key.
- List App Store supported metadata locales.
- Fetch an app with related App Store metadata resources.
- Fetch App Store versions for an app.
- List builds for an app or account.
- List app info records and app info localizations.
- List App Store version localizations.
- List localized screenshot sets, screenshots, preview sets, app previews, and search keywords.
- Create screenshot sets.
- Create and update App Store version localizations.
- Update app info localizations.
- List IAPs, fetch one IAP, and list/update IAP localizations.
- List subscription groups, subscriptions, subscription localizations, and subscription group localizations.
- Update subscription localizations.
- List custom product pages.
- List promoted purchases.
- List customer reviews.
- Run a store marketing audit across metadata, localizations, creative, IAPs, subscriptions, reviews, and analytics readiness.
- Make generic authenticated App Store Connect REST API requests.
- Download and parse Sales and Trends reports.
- Summarize Sales and Trends totals:
  - row count
  - total units
  - app downloads
  - units by product type
  - optional raw rows
- List Analytics Report Requests for an app.
- List Analytics Report definitions.
- List generated Analytics Report instances.
- List generated Analytics Report segments.
- Fetch Analytics Report segment metadata and temporary download URL.
- Download, decompress, and parse Analytics Report segment rows when segments exist.
- Run an ASO readiness overview:
  - check report request availability
  - identify ASO-relevant report definitions
  - check generated instance availability
  - check downloadable segment availability
  - explain the next action

### App Store Connect Analysis It Enables

Use App Store Connect data for:

- Store visibility and funnel analysis.
- First-time downloads and redownloads.
- App Store impressions and product page views through Analytics Reports when instances are generated.
- App Store conversion analysis.
- Sales and Trends download/unit reports.
- Product-type breakdowns for free downloads, paid downloads, updates, and IAP-related rows.
- Build/version inventory.
- Store metadata and localization coverage audit.
- Screenshot/app preview coverage audit by locale.
- IAP/subscription naming and description audit.
- Custom product page and promoted purchase inventory.
- Customer review mining for keyword and positioning ideas.
- ASO readiness checks.
- Store analytics export readiness.
- Reconciliation against RevenueCat monetization data.

### App Store Connect Confirmed Working In Local Verification

These were verified with local credentials during development:

- Auth/JWT signing works.
- App listing works.
- App Store version listing works.
- Build listing works.
- Supported locale listing works.
- App detail fetch works.
- App info and app info localization listing work.
- App Store version localization listing works.
- Localization visuals inspection works.
- IAP listing, single IAP fetch, and IAP localization listing work.
- Subscription group, subscription, subscription group localization, and subscription localization listing work.
- Custom product page listing works.
- Promoted purchase listing works.
- Customer review listing works.
- Store marketing audit works.
- Sales and Trends daily reports work with `ASC_VENDOR_NUMBER`.
- Sales and Trends monthly reports work with `ASC_VENDOR_NUMBER`.
- Analytics Report Requests list successfully.
- Analytics Report definitions list successfully.
- ASO overview runs successfully.

Observed caveat:

- Analytics Report definitions existed, but generated instances/segments were not yet available. Segment listing/downloading tools are implemented, but need Apple to generate report instances first.

### App Store Connect Write / Mutation Abilities

The generic `appstoreconnect_request` tool can technically call write endpoints if the key has permission. Dedicated write tools currently include:

- `appstoreconnect_create_screenshot_set`
- `appstoreconnect_create_app_store_version_localization`
- `appstoreconnect_update_app_store_version_localization`
- `appstoreconnect_update_app_info_localization`
- `appstoreconnect_update_iap_localization`
- `appstoreconnect_update_subscription_localization`
- `appstoreconnect_create_analytics_report_request`

Treat all of these as production write actions. Ask for explicit user approval before running them. Use generic requests carefully with exact method/path/body confirmation for write flows that do not yet have dedicated tools, such as pricing, availability, full screenshot upload flows, app previews upload, review submissions, and destructive deletes.

### RevenueCat Abilities

`revenuecat-mcp` can:

- Verify that a RevenueCat API key is present without printing it.
- Make generic authenticated RevenueCat REST API requests.
- List RevenueCat projects.
- List apps in a project.
- Fetch a single app.
- List products in a project.
- Fetch a single product.
- List entitlements.
- Fetch a single entitlement.
- List products attached to an entitlement.
- List offerings.
- Fetch an offering with expanded package and product data.
- List customers.
- Fetch a single customer.
- Fetch customer subresources:
  - active entitlements
  - aliases
  - attributes
  - subscriptions
  - purchases
  - invoices
- List paywalls.
- Fetch a paywall.
- Fetch metrics overview.
- Run a paywall catalog audit:
  - count apps, products, entitlements, offerings, paywalls, and customers
  - verify entitlement product attachment
  - verify expanded offering package/product fetchability
  - report permission-dependent surfaces without failing the whole audit
- Run a monetization overview:
  - count apps, products, entitlements, offerings, customers, paywalls
  - fetch entitlement products
  - fetch expanded offering data
  - fetch first customer purchase/subscription/entitlement state
  - fetch metrics overview
  - summarize fetchability

### RevenueCat Analysis It Enables

Use RevenueCat data for:

- Product catalog audit.
- Entitlement coverage audit.
- Offering and package audit.
- Paywall inventory.
- Paywall catalog health audit.
- Customer purchase/subscription state.
- Customer entitlement state.
- RevenueCat-side monetization health.
- Checking whether products are attached to entitlements.
- Checking whether offerings expose the expected products/packages.
- Reconciliation against App Store Connect Sales and Trends.
- Diagnosing mismatches between App Store purchases and RevenueCat customer state.

### RevenueCat Confirmed Working In Local Verification

These were verified with local credentials during development:

- Project listing works.
- App listing and single-app fetch work.
- Product listing and single-product fetch work.
- Entitlement listing and single-entitlement fetch work.
- Entitlement products listing works.
- Offering listing and expanded offering fetch work.
- Customer listing and single-customer fetch work.
- Customer active entitlements, aliases, attributes, subscriptions, purchases, and invoices fetch work.
- Paywall listing works.
- Single paywall fetch works.
- Metrics overview works.
- Paywall catalog audit works.
- Monetization overview works.

Observed local counts from the verified project included:

- apps: `3`
- products: `14`
- entitlements: `1`
- offerings: `2`
- paywalls: `2`
- first entitlement products: `8`

These counts are examples from one account and can change.

### RevenueCat Permission-Dependent Abilities

RevenueCat supports more than the dedicated fetchable tools, but the API key must have permission.

These areas require extra permissions:

- Charts: `charts_metrics:charts:read`
- Experiments: `project_configuration:experiments:read`
- Virtual currencies: `project_configuration:virtual_currencies:read`
- Webhook integrations: `project_configuration:integrations:read`

The local verification key did not expose direct package listing or webhook integrations. Expanded offering package/product data did work through offering fetches.

Do not claim these are working unless the user has a key with those permissions and live checks return success.

### RevenueCat Legacy v1 Caveat

`revenuecat_get_subscriber` uses the legacy v1 subscriber endpoint. Some v2 secret keys are incompatible with v1 endpoints. If it fails or returns an empty/unsupported response, prefer the v2 customer tools:

- `revenuecat_get_customer`
- `revenuecat_get_customer_subresource`

### Combined StoreOps Abilities

Using both plugins together, an LLM can:

- Check whether App Store Connect and RevenueCat credentials work.
- Map App Store apps to RevenueCat projects/apps.
- Fetch App Store versions and builds.
- Audit App Store metadata, localizations, screenshots/previews, IAPs, subscriptions, custom product pages, promoted purchases, and reviews.
- Fetch App Store Sales and Trends reports.
- Fetch App Store Analytics Report readiness.
- Fetch RevenueCat catalog, offerings, entitlements, paywalls, and customer state.
- Audit RevenueCat paywall catalog health.
- Compare App Store download/unit data with RevenueCat monetization setup.
- Find catalog gaps:
  - product exists in App Store but not RevenueCat
  - RevenueCat product lacks entitlement
  - entitlement lacks expected products
  - offering/paywall points to unexpected products
- Find analytics gaps:
  - App Store Analytics Reports requested but not generated yet
  - RevenueCat charts unavailable due to missing permissions
  - Sales reports unavailable due to missing vendor number
- Prepare next-step recommendations for ASO, paywall, monetization, and store operations.

### What StoreOps MCP Is Not

It is not:

- A Search Ads API client.
- A keyword-rank tracker.
- A competitor ASO scraper.
- A replacement for App Store Connect UI review approval flows.
- A guarantee that every App Store Connect write endpoint is already wrapped in a dedicated tool.
- A RevenueCat dashboard replacement for permission areas not granted to the key.

For keyword rank, competitor ASO, or Search Ads performance, add a dedicated Search Ads/ASO data provider integration.

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

For the broad store marketing surface, start with:

```text
Use appstoreconnect_audit_store_marketing with app_id="<app_id>".
```

This checks listing metadata, app info localizations, version localizations, IAPs, subscriptions, custom product pages, promoted purchases, customer reviews, and analytics readiness.

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

For the paywall/catalog marketing audit, start with:

```text
Use revenuecat_audit_paywall_catalog with project_id="<project_id>".
```

This checks products, entitlements, offerings, paywalls, customer sample availability, metrics overview, and whether key catalog relationships are fetchable.

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
Use revenuecat_get_paywall.
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
- RevenueCat direct package listing and webhook integrations can be unavailable depending on API surface and permissions; use expanded offerings and audit fetchability instead of assuming those are present.
- RevenueCat API v1 subscriber tools may not work with v2-only secret keys.

## Good Starter Prompts

```text
Check both StoreOps MCP plugins. Verify App Store Connect auth, RevenueCat auth, list apps, list projects, and summarize what is available.
```

```text
Audit the App Store marketing surface for app_id="<app_id>". Summarize localization coverage, IAPs, subscriptions, screenshots/previews, custom product pages, promoted purchases, reviews, analytics readiness, and next actions.
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
Audit RevenueCat paywall catalog health for project_id="<project_id>". Tell me whether products, entitlements, offerings, paywalls, and metrics are wired enough for marketing and conversion work.
```

```text
Compare App Store Connect sales/download data with RevenueCat products, offerings, paywalls, and customer state. Identify gaps or inconsistencies.
```
