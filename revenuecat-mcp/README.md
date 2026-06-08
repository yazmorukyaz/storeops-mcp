# StoreOps RevenueCat MCP

StoreOps plugin containing a stdio MCP server for RevenueCat API work.

It gives agents a monetization and paywall catalog surface: projects, apps, products, entitlements, offerings, customers, customer purchases/subscriptions/entitlements, paywalls, metrics overview, and catalog health audits.

## Credentials

```sh
export REVENUECAT_API_KEY="sk_..."
```

Optional:

```sh
export REVENUECAT_API_BASE="https://api.revenuecat.com/v2"
export REVENUECAT_V1_API_BASE="https://api.revenuecat.com/v1"
```

## Build

```sh
npm install
npm run build
```

## Tools

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

## Monetization Analysis Workflow

Start with:

```text
revenuecat_analyze_monetization_overview(project_id="proj...")
```

For a marketing-focused catalog health check, start with:

```text
revenuecat_audit_paywall_catalog(project_id="proj...")
```

This fetches and summarizes apps, products, entitlements, offerings, customers, paywalls, metrics overview, entitlement products, expanded offering package/product data, and the first customer's purchase/subscription/entitlement subresources.

Use dedicated read tools to drill into catalog and customer state:

```text
revenuecat_list_products
revenuecat_get_offering
revenuecat_get_paywall
revenuecat_get_customer_subresource
revenuecat_get_metrics_overview
```

The v2 key used by this MCP may not be compatible with RevenueCat API v1 subscriber endpoints. Chart data, experiments, webhook integrations, direct package listing, and virtual currencies can require extra RevenueCat API permissions or API surfaces that are not available to every key. The verified dedicated tools focus on projects, apps, products, entitlements, offerings, customers, paywalls, and metrics overview.
