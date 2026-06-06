---
name: appstoreconnect-mcp
description: Use this skill when working with App Store Connect through the StoreOps App Store Connect MCP plugin.
---

# StoreOps App Store Connect MCP

Use this MCP for App Store Connect API workflows only.

## Rules

- Never print JWTs, `.p8` private key contents, `ASC_PRIVATE_KEY`, or credential IDs unless the user explicitly asks for non-secret IDs.
- Start setup diagnosis with `appstoreconnect_auth_status`.
- Use read-only helpers before generic requests.
- Before write operations, state the exact method, path, and JSON:API body.

## Tools

- `appstoreconnect_auth_status`
- `appstoreconnect_list_apps`
- `appstoreconnect_get_app_store_versions`
- `appstoreconnect_list_builds`
- `appstoreconnect_request`
