# StoreOps RevenueCat MCP

StoreOps plugin containing a stdio MCP server for RevenueCat API work.

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
- `revenuecat_get_metrics_overview`
- `revenuecat_analyze_monetization_overview`
- `revenuecat_get_subscriber`

## Monetization Analysis Workflow

Start with:

```text
revenuecat_analyze_monetization_overview(project_id="proj...")
```

This fetches and summarizes apps, products, entitlements, offerings, customers, paywalls, metrics overview, entitlement products, expanded offering package/product data, and the first customer's purchase/subscription/entitlement subresources.

Use dedicated read tools to drill into catalog and customer state:

```text
revenuecat_list_products
revenuecat_get_offering
revenuecat_get_customer_subresource
revenuecat_get_metrics_overview
```

The v2 key used by this MCP may not be compatible with RevenueCat API v1 subscriber endpoints. Chart data, experiments, and virtual currencies require extra RevenueCat API permissions such as `charts_metrics:charts:read`, `project_configuration:experiments:read`, and `project_configuration:virtual_currencies:read`.
