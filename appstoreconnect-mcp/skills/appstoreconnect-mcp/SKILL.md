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
- For ASO or analytics work, start with `appstoreconnect_analyze_aso_overview` for the app ID, then drill into report requests, reports, instances, segments, and segment downloads.
- Analytics report instances may be empty until Apple has generated them. If definitions exist but instances are empty, create or resume an `ONGOING` report request and wait 1-2 days.
- Before write operations, state the exact method, path, and JSON:API body.

## Tools

- `appstoreconnect_auth_status`
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
- `appstoreconnect_request`
