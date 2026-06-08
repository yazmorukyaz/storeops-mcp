# StoreOps App Store Connect MCP

StoreOps plugin containing a stdio MCP server for App Store Connect API work.

It gives agents a read-first App Store marketing surface: app metadata, localizations, screenshots, app previews, IAPs, subscriptions, custom product pages, promoted purchases, customer reviews, Sales and Trends, and Analytics Reports. It also includes explicit update tools for localized metadata where API permissions allow writes.

## Credentials

```sh
export ASC_KEY_ID="ABC123DEFG"
export ASC_ISSUER_ID="00000000-0000-0000-0000-000000000000"
export ASC_PRIVATE_KEY_PATH="/absolute/path/AuthKey_ABC123DEFG.p8"
```

You can use `ASC_PRIVATE_KEY` instead of `ASC_PRIVATE_KEY_PATH`. Escaped `\n` newlines are accepted.

Optional:

```sh
export ASC_API_BASE="https://api.appstoreconnect.apple.com/v1"
# Default vendor number for sales/downloads reports.
export ASC_VENDOR_NUMBER="12345678"
```

## Build

```sh
npm install
npm run build
```

## Tools

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

## Store Marketing Workflow

Start with:

```text
appstoreconnect_audit_store_marketing(app_id="<app_id>")
```

The audit summarizes app info, app info localizations, app version localizations, localized screenshots/previews, IAPs, subscriptions, custom product pages, promoted purchases, customer reviews, and Analytics Report readiness.

Use these tools to drill into copy and creative assets:

```text
appstoreconnect_list_supported_locales
appstoreconnect_list_app_info_localizations
appstoreconnect_list_app_store_version_localizations
appstoreconnect_get_localization_visuals
appstoreconnect_list_customer_reviews
```

Use these tools to inspect monetized store surfaces:

```text
appstoreconnect_list_iaps
appstoreconnect_get_iap
appstoreconnect_list_iap_localizations
appstoreconnect_list_subscription_groups
appstoreconnect_list_subscriptions
appstoreconnect_list_subscription_localizations
appstoreconnect_list_promoted_purchases
```

Write tools are intentionally explicit:

```text
appstoreconnect_create_app_store_version_localization
appstoreconnect_update_app_store_version_localization
appstoreconnect_update_app_info_localization
appstoreconnect_update_iap_localization
appstoreconnect_update_subscription_localization
appstoreconnect_create_screenshot_set
```

Do read-only inspection first, then use writes only with exact resource IDs and reviewed copy.

### Sales & Downloads Reports

`appstoreconnect_get_sales_reports` downloads the gzipped Sales and Trends TSV report,
unzips and parses it into JSON, and adds a units/downloads summary (`total_units`,
`app_downloads`, and `units_by_product_type`). Pass `sku` or `apple_id` to scope the
result to a single app. The tool defaults to report version `1_1` for daily/weekly
reports and `1_0` for monthly/yearly reports.

> Sales and Trends reports require an API key with **Admin**, **Finance**, or **Sales**
> access. Keys limited to App Manager/Developer roles return HTTP 403. The `vendor_number`
> is shown in App Store Connect under *Payments and Financial Reports*; set it once via the
> `ASC_VENDOR_NUMBER` environment variable so you can omit it on each call.

## Analytics / ASO Workflow

Use `appstoreconnect_analyze_aso_overview` first. It checks whether the app has Analytics Report Requests, finds ASO-relevant reports, and reports whether downloadable instances exist.

Typical flow:

```text
appstoreconnect_analyze_aso_overview(app_id="<app_id>")
```

If no report request exists, create one:

```text
appstoreconnect_create_analytics_report_request(app_id="<app_id>", access_type="ONGOING")
```

Apple usually needs 1-2 days before the first generated instances are available. Once instances exist, use:

```text
appstoreconnect_list_analytics_reports
appstoreconnect_list_analytics_report_instances
appstoreconnect_list_analytics_report_segments
appstoreconnect_download_analytics_report_segment
```

The download tool decompresses Apple report segments and parses tab- or comma-delimited rows. Keep `max_rows` small for exploration, then fetch larger batches when you know which report and date you need.
