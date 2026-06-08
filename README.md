# StoreOps MCP

![StoreOps MCP thumbnail](./assets/storeops-mcp-thumbnail.jpg)

Automate App Store Connect and RevenueCat workflows from Codex or any MCP client.

StoreOps MCP contains two separate local MCP servers:

- [`appstoreconnect-mcp`](./appstoreconnect-mcp): App Store Connect API tools for apps, builds, app versions, metadata, screenshots, in-app purchases, subscriptions, pricing, customer reviews, and Analytics Reports for ASO-style analysis.
- [`revenuecat-mcp`](./revenuecat-mcp): RevenueCat API tools for projects, apps, products, entitlements, offerings, customers, customer subresources, paywalls, metrics overview, and monetization analysis.

The servers are intentionally split because App Store Connect and RevenueCat have different auth models, permissions, APIs, and failure modes.

Use it to make store operations easier to inspect, script, and automate: app metadata, builds, app versions, screenshots, in-app purchases, subscriptions, Sales and Trends reports, App Store analytics reports, RevenueCat projects, apps, products, entitlements, offerings, customers, paywalls, metrics overview, and monetization health checks.

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

For an LLM-ready copy-paste briefing that covers tools, credentials, workflows, safety rules, and known limitations, see [`LLM_CONTEXT.md`](./LLM_CONTEXT.md).

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
- `revenuecat_get_subscriber`
- `revenuecat_get_customer`
- `revenuecat_get_customer_subresource`
- `revenuecat_list_paywalls`
- `revenuecat_get_metrics_overview`
- `revenuecat_analyze_monetization_overview`

The generic request tools are included so agents can use API endpoints that do not yet have dedicated helper tools.

The analytics tools support Apple's bulk Analytics Reports API flow: create or inspect report requests, list report definitions, list generated instances, list/download segments, decompress report files, parse rows, and inspect ASO-relevant reports such as discovery and engagement, downloads, purchases, subscriptions, installs/deletions, sessions, crashes, web preview engagement, and retention messaging.

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
