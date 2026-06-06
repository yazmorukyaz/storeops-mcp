# Credentials Guide

StoreOps MCP does not ship with credentials. Each user must create their own provider keys and keep them local.

## App Store Connect MCP

Used by `appstoreconnect-mcp` for App Store Connect API calls.

### Required

```sh
ASC_KEY_ID=
ASC_ISSUER_ID=
ASC_PRIVATE_KEY_PATH=/absolute/path/AuthKey_XXXXXXXXXX.p8
```

### Where To Get Them

In App Store Connect:

1. Open App Store Connect.
2. Go to **Users and Access**.
3. Open **Integrations**.
4. Open **App Store Connect API**.
5. Create a team API key or use an existing one.
6. Copy the **Issuer ID**.
7. Copy the **Key ID**.
8. Download the `.p8` private key when creating a new key.

Apple private keys are one-time downloads. If the `.p8` file is lost, create a new API key and revoke the old one if it is no longer needed.

### Recommended Role

- `Admin`: broadest automation coverage.
- `App Manager`: can cover many app metadata, in-app purchase, subscription, build, and review workflows.

Use the smallest role that supports your workflow.

### Official Docs

- App Store Connect API: https://developer.apple.com/documentation/appstoreconnectapi
- App Store Server API key creation: https://developer.apple.com/documentation/appstoreserverapi/creating-api-keys-to-authorize-api-requests
- Role permissions: https://developer.apple.com/help/app-store-connect/reference/role-permissions/

## Apple In-App Purchase Key

Used for App Store Server API and some RevenueCat Apple integration workflows.

### Optional

```sh
APPLE_IAP_KEY_ID=
APPLE_IAP_ISSUER_ID=
APPLE_IAP_PRIVATE_KEY_PATH=/absolute/path/SubscriptionKey_XXXXXXXXXX.p8
```

### Where To Get It

In App Store Connect:

1. Open **Users and Access**.
2. Open **Integrations**.
3. Open **In-App Purchase**.
4. Create an In-App Purchase key.
5. Copy the **Issuer ID**.
6. Copy the **Key ID**.
7. Download the `.p8` private key.

One In-App Purchase key can generally support server-side purchase workflows across the account/team. You do not need one key per app. The products and subscriptions themselves are still configured per app.

### Official Docs

- App Store Server API: https://developer.apple.com/documentation/appstoreserverapi
- In-App Purchase setup overview: https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/

## App Store Shared Secret

Used only for legacy auto-renewable subscription validation flows that still require it.

### Optional

```sh
APPLE_SHARED_SECRET=
```

### Where To Get It

In App Store Connect:

1. Open **Users and Access**.
2. Open **Integrations**.
3. Open **Shared Secret**.
4. Generate or copy the primary shared secret.

Prefer modern App Store Server API / In-App Purchase key workflows unless your integration explicitly requires a shared secret.

## RevenueCat MCP

Used by `revenuecat-mcp` for RevenueCat API calls.

### Required

```sh
REVENUECAT_API_KEY=
```

### Where To Get It

In RevenueCat:

1. Open the RevenueCat dashboard.
2. Select the target project.
3. Open **API keys**.
4. Create or copy a **Secret API key**.

Use a secret API key for server-side MCP operations. Do not use a public SDK key for write actions.

### Official Docs

- RevenueCat API keys and authentication: https://www.revenuecat.com/docs/projects/authentication
- RevenueCat REST API: https://www.revenuecat.com/reference/revenuecat-rest-api

## RevenueCat App Store Integration

RevenueCat may also ask for Apple credentials inside its dashboard when connecting an App Store app.

Common inputs:

- App Store Connect API key
- Apple In-App Purchase key
- App Store shared secret for legacy flows
- Vendor Number for some reporting/import workflows

Follow RevenueCat's dashboard prompts for the specific app. Store these credentials in RevenueCat only when needed, and rotate them if they are exposed.

### Official Docs

- RevenueCat Apple product setup: https://www.revenuecat.com/docs/getting-started/entitlements/ios-products
- RevenueCat authentication: https://www.revenuecat.com/docs/projects/authentication

## Local `.env` Setup

Each plugin has an `.env.example`.

```sh
cp appstoreconnect-mcp/.env.example appstoreconnect-mcp/.env
cp revenuecat-mcp/.env.example revenuecat-mcp/.env
```

Never commit `.env` files or `.p8` private keys.

## Verification

After credentials are set, call:

```text
Use appstoreconnect_auth_status with check_jwt=true.
Use revenuecat_auth_status.
```

Then make one read-only fetch:

```text
Use appstoreconnect_list_apps with limit 5.
Use revenuecat_list_projects.
```
