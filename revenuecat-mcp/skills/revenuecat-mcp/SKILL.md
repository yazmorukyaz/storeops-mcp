---
name: revenuecat-mcp
description: Use this skill when working with RevenueCat through the local RevenueCat MCP plugin.
---

# RevenueCat MCP

Use this MCP for RevenueCat API workflows only.

## Rules

- Never print `REVENUECAT_API_KEY`.
- Start setup diagnosis with `revenuecat_auth_status`.
- Use read-only helpers before generic requests.
- Before write operations, state the exact method, path, and JSON body.

## Tools

- `revenuecat_auth_status`
- `revenuecat_list_projects`
- `revenuecat_get_subscriber`
- `revenuecat_request`
