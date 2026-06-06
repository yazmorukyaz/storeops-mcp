# StoreOps App Store Connect MCP

StoreOps plugin containing a stdio MCP server for App Store Connect API work.

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
- `appstoreconnect_get_sales_reports`

### Sales & downloads reports

`appstoreconnect_get_sales_reports` downloads the gzipped Sales and Trends TSV report,
unzips and parses it into JSON, and adds a units/downloads summary (`total_units`,
`app_downloads`, and `units_by_product_type`). Pass `sku` or `apple_id` to scope the
result to a single app.

> Sales and Trends reports require an API key with **Admin**, **Finance**, or **Sales**
> access. Keys limited to App Manager/Developer roles return HTTP 403. The `vendor_number`
> is shown in App Store Connect under *Payments and Financial Reports*; set it once via the
> `ASC_VENDOR_NUMBER` environment variable so you can omit it on each call.
