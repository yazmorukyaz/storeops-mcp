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
