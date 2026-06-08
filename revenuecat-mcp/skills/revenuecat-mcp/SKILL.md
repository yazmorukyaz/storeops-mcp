---
name: revenuecat-mcp
description: Use this skill when working with RevenueCat through the StoreOps RevenueCat MCP plugin.
---

# StoreOps RevenueCat MCP

Use this MCP for RevenueCat API workflows only.

## Rules

- Never print `REVENUECAT_API_KEY`.
- Start setup diagnosis with `revenuecat_auth_status`.
- Use read-only helpers before generic requests.
- For monetization analysis, start with `revenuecat_analyze_monetization_overview`, then drill into apps, products, entitlements, offerings, paywalls, customers, and customer subresources.
- Do not assume v1 subscriber endpoints work with a v2 secret API key. If v1 returns 403, use v2 customer tools instead.
- Before write operations, state the exact method, path, and JSON body.

## Tools

- `revenuecat_auth_status`
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
- `revenuecat_request`
