# StoreOps MCP

![StoreOps MCP thumbnail](./assets/storeops-mcp-thumbnail.jpg)

Agent-operated App Store and monetization operations for Codex and other MCP clients.

StoreOps MCP gives an AI agent a controlled operating layer for the work that normally lives across App Store Connect and RevenueCat: App Store metadata, ASO fields, localization, screenshots and preview assets, in-app purchases, subscriptions, subscription groups, RevenueCat products, entitlements, offerings, paywalls, customers, and monetization metrics.

It is built for the uncomfortable middle ground where most mobile teams still work manually: checking catalog drift, filling localized metadata, auditing subscriptions, preparing IAP copy, comparing App Store setup against RevenueCat, and turning store/paywall observations into concrete launch tasks.

StoreOps MCP contains two separate local MCP servers:

- [`appstoreconnect-mcp`](./appstoreconnect-mcp): App Store Connect API tools for apps, builds, app versions, metadata, screenshots, in-app purchases, subscriptions, pricing, customer reviews, and Analytics Reports for ASO-style analysis.
- [`revenuecat-mcp`](./revenuecat-mcp): RevenueCat API tools for projects, apps, products, entitlements, offerings, customers, customer subresources, paywalls, metrics overview, and monetization analysis.

The servers are intentionally split because App Store Connect and RevenueCat have different auth models, permissions, APIs, and failure modes. Together, they let an agent inspect and coordinate the full store-to-purchase path.

Use it as a store growth command layer: audit App Store listings, localizations, screenshots, IAPs, subscriptions, reviews, Sales and Trends, and Analytics Reports; edit supported metadata/localization resources with explicit writes; then connect that store picture to RevenueCat products, entitlements, offerings, customers, paywalls, and metrics. Use Superwall's hosted OAuth MCP alongside StoreOps when you want to coordinate paywall campaigns, templates, placements, and experiments with the App Store and RevenueCat catalog.

## What You Can Manage

StoreOps is not just a reader. It includes read-first tools plus explicit production write tools for the App Store Connect resources that are safe to target by ID.

- App Store app records, app info, app versions, builds, supported locales, and version localizations.
- App Store marketing fields including name/subtitle-style app info fields, promotional text, description, keywords, support/marketing URLs, and localized release metadata where Apple's API allows updates.
- IAP and subscription catalog inspection, including IAPs, IAP localizations, subscription groups, subscriptions, subscription localizations, and subscription group localizations.
- IAP/subscription localization updates, so an agent can help prepare product names, descriptions, and localized purchase copy.
- Screenshot and preview asset inspection through localization visuals, plus screenshot set creation for supported display types.
- Custom product pages, promoted purchases, and customer reviews for launch and conversion audits.
- Sales and Trends reports plus Analytics Reports for ASO-style analysis when the account has reporting permissions and generated report instances.
- RevenueCat projects, apps, products, entitlements, entitlement-product mappings, offerings, customers, customer subresources, paywalls, and metrics overview.
- Cross-system audits that compare App Store product setup against RevenueCat products, entitlements, offerings, paywalls, and monetization state.

## Why It Matters

Mobile growth work breaks when store metadata, subscriptions, paywalls, and purchase infrastructure drift apart. StoreOps gives an agent enough context to find and explain those gaps before launch:

- A subscription exists in App Store Connect but is missing from RevenueCat.
- RevenueCat has a product that no longer maps cleanly to App Store catalog state.
- A promoted purchase exists but the localized product copy is weak or incomplete.
- App Store metadata is localized, but IAP/subscription copy is not.
- A paywall emphasizes an offer that does not match the live product catalog.
- Analytics Reports exist, but no generated instances are available yet.
- Sales/report permissions are missing, so the operator knows which App Store role to fix.

The result is an agent workflow that can audit, draft, localize, compare, and safely prepare changes across the store and monetization stack without hiding the production risk.

## What It Does Not Do

- It does not include, upload, or sync your credentials.
- It does not silently submit apps, metadata, IAPs, subscriptions, screenshots, or paywalls for review.
- It does not mutate production data unless you call a write tool with explicit target IDs and payloads.
- It does not replace App Store Connect, RevenueCat, or Superwall dashboards for final human review.
- It does not bundle Superwall access. Superwall is a separate hosted OAuth MCP that can be installed next to these local servers.

## Security

This repo does not include credentials.

Never commit:

- `.env`
- RevenueCat secret API keys
- Apple `.p8` private key files
- App Store Connect issuer IDs if your organization treats them as sensitive
- App Store shared secrets

Each plugin includes a `.env.example`. Copy it to `.env` locally and fill in your own credentials.

For step-by-step instructions on where to get each key, see [`CREDENTIALS.md`](./CREDENTIALS.md).

For an LLM-ready copy-paste briefing that covers tools, credentials, abilities, workflows, safety rules, and known limitations, see [`LLM_CONTEXT.md`](./LLM_CONTEXT.md).

## Safety Model

- Local credentials: keep `.env`, `.p8` files, API keys, shared secrets, JWTs, bearer tokens, and downloaded private reports on your machine and out of Git.
- Read first: start with auth status, list, get, and audit tools before update tools.
- Explicit writes: production writes should name exact app IDs, product IDs, localization IDs, offering IDs, customer IDs, or paywall IDs.
- No secret logging: tools should report whether credentials are configured, not print credential values.
- Human review: treat App Store Connect, RevenueCat, and Superwall as production systems and review payloads before mutation.

## Requirements

- Node.js 20 or newer
- npm
- A Codex/MCP client that can launch stdio MCP servers

## Quick Start

Build each plugin:

```sh
cd appstoreconnect-mcp
npm install
npm run build

cd ../revenuecat-mcp
npm install
npm run build
```

Configure credentials:

```sh
cp appstoreconnect-mcp/.env.example appstoreconnect-mcp/.env
cp revenuecat-mcp/.env.example revenuecat-mcp/.env
```

Then edit each `.env`.

Credential source details are documented in [`CREDENTIALS.md`](./CREDENTIALS.md).

## Optional Superwall MCP

Superwall is not bundled in this repo because it uses a hosted OAuth MCP instead of a local stdio server. Install it separately when you want an agent to inspect or manage Superwall organizations, projects, applications, products, entitlements, templates, paywalls, campaigns, and webhooks.

```sh
codex mcp add superwall --url https://superwall-mcp.superwall.com/mcp
codex mcp login superwall
```

After login, start with Superwall `whoami`, then read organization/project/paywall data before writing.

## App Store Connect Credentials

`appstoreconnect-mcp` needs:

```sh
ASC_KEY_ID=
ASC_ISSUER_ID=
ASC_PRIVATE_KEY_PATH=/absolute/path/AuthKey_XXXXXXXXXX.p8
```

As of June 2026, App Store Connect API keys are created under **Users and Access -> Integrations -> App Store Connect API**. Apple supports team API keys and individual API keys:

- Team API keys require Account Holder or Admin access to create and can be assigned a role such as Admin, App Manager, Sales and Reports, or Finance.
- Individual API keys are created from the signed-in user's profile and inherit that user's App Store Connect permissions. Each user can have one active individual key.
- Apple private `.p8` keys are one-time downloads. If the file is lost, revoke the key and create a new one.

Recommended role:

- `Admin` for broad automation.
- `App Manager` for many app metadata, IAP, and subscription workflows.
- `Sales and Reports` or `Finance` for downloading already-requested Analytics Reports. `Admin` is required when requesting a new Analytics Report type for the first time.

Optional credentials:

```sh
ASC_VENDOR_NUMBER=
APPLE_IAP_KEY_ID=
APPLE_IAP_ISSUER_ID=
APPLE_IAP_PRIVATE_KEY_PATH=/absolute/path/SubscriptionKey_XXXXXXXXXX.p8
APPLE_SHARED_SECRET=
```

Use `ASC_VENDOR_NUMBER` for Sales and Trends report downloads. You can find it in App Store Connect under **Payments and Financial Reports**.

Use an Apple In-App Purchase key for App Store Server API / RevenueCat integration workflows. Use a shared secret only for legacy subscription validation flows that still require it.

## RevenueCat Credentials

`revenuecat-mcp` needs:

```sh
REVENUECAT_API_KEY=
```

Use a RevenueCat secret API key for server-side read/write operations. Do not use a public SDK key for write actions.

Create it in the RevenueCat dashboard under the target project's API key settings. Public SDK keys are for app clients; secret keys and OAuth access tokens are for trusted server-side tools.

For full RevenueCat analytics capacity, the key also needs permissions such as `charts_metrics:charts:read`, `project_configuration:experiments:read`, and `project_configuration:virtual_currencies:read`. The included dedicated tools focus on endpoints that are fetchable with a standard v2 secret key.

## Tools

### `appstoreconnect-mcp`

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

### `revenuecat-mcp`

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

The generic request tools are included so agents can use API endpoints that do not yet have dedicated helper tools.

`appstoreconnect_audit_store_marketing` is the broad store growth entry point. It summarizes app info, app version localizations, IAPs, subscription groups/subscriptions, custom product pages, promoted purchases, customer reviews, and Analytics Reports readiness.

`revenuecat_audit_paywall_catalog` is the monetization entry point. It summarizes apps, products, entitlements, offerings, paywalls, customers, metrics, and checks whether the product-to-entitlement-to-offering chain is fetchable.

The analytics tools support Apple's bulk Analytics Reports API flow: create or inspect report requests, list report definitions, list generated instances, list/download segments, decompress report files, parse rows, and inspect ASO-relevant reports such as discovery and engagement, downloads, purchases, subscriptions, installs/deletions, sessions, crashes, web preview engagement, and retention messaging.

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

## Example Output

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

## Manual Smoke Tests

App Store Connect:

```sh
cd appstoreconnect-mcp
set -a
source .env
set +a
node dist/index.js
```

RevenueCat:

```sh
cd revenuecat-mcp
set -a
source .env
set +a
node dist/index.js
```

In a Codex/MCP client, call the corresponding `*_auth_status` tool first.

## Codex Plugin Use

Each plugin folder has:

- `.codex-plugin/plugin.json`
- `.mcp.json`
- `skills/.../SKILL.md`

Register either folder as a local Codex plugin, or copy the folder into your local plugin directory and add it to your personal marketplace.

The `.mcp.json` files launch `node dist/index.js`, so run `npm install` and `npm run build` before use.

For a setup where Codex discovers both plugins by default, see [`INSTALL.md`](./INSTALL.md#install-by-default-in-codex). That path uses `~/plugins` plus a personal `~/.agents/plugins/marketplace.json` entry with `"installation": "INSTALLED_BY_DEFAULT"`.

After the plugins are enabled in Codex, invoke them with normal language or direct tool names:

```text
Use appstoreconnect_auth_status with check_jwt=true.
```

```text
Use appstoreconnect_list_apps with limit 10.
```

```text
Use revenuecat_auth_status.
```

```text
Use revenuecat_list_projects.
```

If a current Codex thread does not see newly installed tools, start a new thread or restart/refresh Codex. MCP tools are often loaded when a session starts.

## Write Operations

These MCPs can be extended to create and edit production data. Before enabling broad write tools, keep these guardrails:

- Prefer read-only fetches first.
- Require exact resource IDs for writes.
- Show method, path, and JSON body before mutation.
- Keep destructive operations behind explicit confirmation.
- Use least-privilege API keys where practical.

## Disclaimer

StoreOps MCP is an independent project. It is not affiliated with, endorsed by, or sponsored by Apple, App Store Connect, or RevenueCat. Product names are used descriptively for API integration purposes.

## License

MIT. See [`LICENSE`](./LICENSE).
