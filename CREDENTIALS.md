# Credentials Guide

StoreOps MCP does not ship with credentials. Each user must create their own provider keys and keep them local.

These instructions reflect Apple's App Store Connect layout as of June 2026.

## App Store Connect MCP

Used by `appstoreconnect-mcp` for App Store Connect API calls.

### Required

```sh
ASC_KEY_ID=
ASC_ISSUER_ID=
ASC_PRIVATE_KEY_PATH=/absolute/path/AuthKey_XXXXXXXXXX.p8
```

### What These Values Mean

- `ASC_KEY_ID`: Key ID shown next to the App Store Connect API key.
- `ASC_ISSUER_ID`: Issuer ID shown on the App Store Connect API page.
- `ASC_PRIVATE_KEY_PATH`: Absolute path to the one-time downloaded `.p8` private key file.

This is the App Store Connect REST API key used for app metadata, builds, TestFlight, screenshots, IAP/subscription setup, customer reviews, Sales and Trends reports, and Analytics Reports.

### Where To Get Them: Team API Key

In App Store Connect:

1. Open App Store Connect.
2. Go to **Users and Access**.
3. Open **Integrations**.
4. Open **App Store Connect API**.
5. If API access has not been enabled yet, the Account Holder must click **Request Access** and accept Apple's API terms.
6. Open **Team Keys**.
7. Click **Generate API Key** or the add button.
8. Enter a reference name.
9. Under **Access**, choose the role.
10. Click **Generate**.
11. Copy the **Issuer ID**.
12. Copy the **Key ID**.
13. Download the `.p8` private key immediately.

Team keys can apply across all apps in the account. Apple notes that team API key app access can't be limited per app, so choose the smallest role that supports your workflow.

### Where To Get Them: Individual API Key

In App Store Connect:

1. Click your username in the top-right corner.
2. Open **Edit Profile**.
3. Under **Individual API Key**, click **Generate Key**.
4. Download the `.p8` private key immediately.

Individual API keys inherit the user's App Store Connect permissions. Each user can only have one active individual API key at a time. Admins or the Account Holder can disable a user's ability to generate individual keys.

Apple private keys are one-time downloads. If the `.p8` file is lost, create a new API key and revoke the old one if it is no longer needed.

### Recommended Role

- `Admin`: broadest automation coverage.
- `App Manager`: can cover many app metadata, in-app purchase, subscription, build, and review workflows.
- `Sales and Reports` or `Finance`: useful for downloading already-requested Analytics Reports.

Use the smallest role that supports your workflow.

For Analytics Reports, Apple requires an App Store Connect API key with `Admin`, `Sales and Reports`, or `Finance`. Requesting a new Analytics Report type for the first time requires `Admin`; after the report type exists, `Sales and Reports` or `Finance` can download generated reports.

For Sales and Trends downloads through `appstoreconnect_get_sales_reports`, use `Admin`, `Finance`, or a sales/reporting role that can access Sales and Trends data.

### Vendor Number For Sales Reports

Optional but recommended:

```sh
ASC_VENDOR_NUMBER=
```

Use this for Sales and Trends report downloads. Find it in App Store Connect under **Payments and Financial Reports**. You can also pass `vendor_number` directly to `appstoreconnect_get_sales_reports`.

### Analytics Reports Timing

Analytics Reports are not instant. `ONGOING` requests generate recurring daily, weekly, and monthly reports; Apple says the first report usually appears about 24-48 hours later. `ONE_TIME_SNAPSHOT` requests provide historical data once. Data for a specific day is considered complete two days after the reporting date.

### Official Docs

- App Store Connect API: https://developer.apple.com/documentation/appstoreconnectapi
- App Store Connect API setup: https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/
- Analytics Reports API overview: https://developer.apple.com/help/app-store-connect-analytics/overview/analytics-reports-api
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
3. In the sidebar under **Keys**, open **In-App Purchase**.
4. Click **Generate In-App Purchase Key**. If an active key already exists, use the add button to create another.
5. Enter a reference name.
6. Click **Generate**.
7. Copy the **Issuer ID**.
8. Copy the **Key ID**.
9. Download the `.p8` private key immediately.

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
3. Open the project's API key or authentication settings.
4. Create or copy a **Secret API key**.

Use a secret API key for server-side MCP operations. Do not use a public SDK key for write actions. RevenueCat also supports OAuth 2.0 access tokens for third-party tools; this MCP currently expects `REVENUECAT_API_KEY`.

The dedicated RevenueCat tools use REST API v2 endpoints for projects, apps, products, entitlements, offerings, customers, customer subresources, paywalls, and metrics overview. Additional RevenueCat areas require extra permissions:

- Charts: `charts_metrics:charts:read`
- Experiments: `project_configuration:experiments:read`
- Virtual currencies: `project_configuration:virtual_currencies:read`

Legacy API v1 subscriber endpoints may reject v2-only secret keys. If `revenuecat_get_subscriber` returns a v1 compatibility error, use the v2 customer tools instead.

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
