# Install StoreOps MCP

## Local Development

```sh
git clone https://github.com/yazmorukyaz/storeops-mcp.git
cd storeops-mcp
```

Build the StoreOps App Store Connect MCP:

```sh
cd appstoreconnect-mcp
npm install
npm run build
cp .env.example .env
```

Build the StoreOps RevenueCat MCP:

```sh
cd ../revenuecat-mcp
npm install
npm run build
cp .env.example .env
```

Fill in each `.env` with your own credentials.

For where to get each key, see [`CREDENTIALS.md`](./CREDENTIALS.md).

## What It Does Not Do

- It does not include your credentials or sync them to GitHub.
- It does not submit apps, metadata, screenshots, IAPs, or subscriptions for review by itself.
- It does not mutate production data unless an MCP write tool is called with explicit target IDs and inputs.
- It does not replace App Store Connect, RevenueCat, or Superwall dashboards for final human review.
- It does not bundle Superwall account access. Superwall is a hosted OAuth MCP that should be installed separately when needed.

## Codex

Register one or both plugin folders as local plugins:

- `appstoreconnect-mcp`
- `revenuecat-mcp`

The plugins use stdio MCP servers and start with:

```sh
node dist/index.js
```

Your Codex environment must provide the needed credentials when the MCP server starts. A simple local setup is to launch Codex from a shell where you have sourced the relevant `.env`.

## Optional Superwall MCP

Superwall is a separate hosted OAuth MCP, not a local stdio server in this repo. Use it alongside StoreOps when you want to inspect or manage Superwall organizations, projects, apps, products, entitlements, templates, paywalls, campaigns, and webhooks.

```sh
codex mcp add superwall --url https://superwall-mcp.superwall.com/mcp
codex mcp login superwall
```

After login, start with the Superwall `whoami` tool before fetching or changing account resources.

## Install By Default In Codex

If you want Codex to discover StoreOps MCP automatically, copy the plugin folders into your local plugin directory and add them to your personal marketplace file.

Example layout:

```text
~/plugins/appstoreconnect-mcp
~/plugins/revenuecat-mcp
~/.agents/plugins/marketplace.json
```

Copy the plugins:

```sh
mkdir -p ~/plugins ~/.agents/plugins
cp -R appstoreconnect-mcp ~/plugins/appstoreconnect-mcp
cp -R revenuecat-mcp ~/plugins/revenuecat-mcp
```

Then add entries like this to `~/.agents/plugins/marketplace.json`:

```json
{
  "name": "personal",
  "interface": {
    "displayName": "Personal"
  },
  "plugins": [
    {
      "name": "appstoreconnect-mcp",
      "source": {
        "source": "local",
        "path": "./plugins/appstoreconnect-mcp"
      },
      "policy": {
        "installation": "INSTALLED_BY_DEFAULT",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    },
    {
      "name": "revenuecat-mcp",
      "source": {
        "source": "local",
        "path": "./plugins/revenuecat-mcp"
      },
      "policy": {
        "installation": "INSTALLED_BY_DEFAULT",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

If the file already exists, append only the two plugin objects to the existing `plugins` array. Keep the existing marketplace name and interface.

Important:

- Do not commit your personal `~/.agents/plugins/marketplace.json`.
- Do not put credentials in the plugin folders.
- Keep credentials in your shell environment, `.env`, keychain, or another local secret store.
- Restart/refresh Codex or start a new thread after changing plugin installation settings. Existing threads may not hot-load new MCP tools.

Once enabled, ask Codex to use the tools directly:

```text
Use appstoreconnect_auth_status with check_jwt=true.
Use appstoreconnect_list_apps with limit 10.
Use revenuecat_auth_status.
Use revenuecat_list_projects.
```

## Try These Prompts

```text
Audit my App Store listing and RevenueCat monetization setup for app ID 1234567890.
```

```text
Audit my RevenueCat offering against App Store subscriptions.
```

```text
List my App Store subscriptions, RevenueCat products, entitlements, offerings, and paywalls, then show mismatches.
```

```text
Check whether all App Store localizations have matching subscription and IAP localization copy.
```

```text
Use Superwall whoami, then list projects and paywalls so we can compare them with RevenueCat offerings.
```

## Example Output

Prompt:

```text
Audit my RevenueCat offering against App Store subscriptions.
```

Example result:

```text
Summary
- App Store subscriptions found: monthly_pro, yearly_pro
- RevenueCat products found: monthly_pro, yearly_pro, lifetime_pro
- RevenueCat offering "default" includes: monthly_pro, yearly_pro

Issues
- lifetime_pro exists in RevenueCat but no matching App Store subscription or IAP was found.
- yearly_pro has matching product IDs, but App Store localization is missing for fr-FR.
- The default offering has no explicit lifetime package, so lifetime_pro cannot be purchased from that offering.

Recommended next steps
- Confirm whether lifetime_pro should be a non-consumable IAP in App Store Connect.
- Add missing fr-FR subscription localization before launch.
- Add lifetime_pro to the intended RevenueCat offering only after the App Store product exists and is approved.
```

## Safety

- Credentials stay local. Keep `.env`, `.p8` files, API keys, shared secrets, JWTs, bearer tokens, and downloaded private reports out of Git.
- Read first. Start with auth status and list/audit tools before making changes.
- Writes must be explicit. Use exact app IDs, product IDs, localization IDs, offering IDs, or paywall IDs before update tools.
- No secret logging. Tool output should confirm whether credentials are present, not print the secret values.
- Treat App Store Connect, RevenueCat, and Superwall as production systems. Review write payloads before running them.

If the tools do not appear in the current thread, start a new Codex thread or restart/refresh Codex.

## Verification

Use the auth status tools first:

- `appstoreconnect_auth_status` with `check_jwt=true`
- `revenuecat_auth_status`

Then run a read-only list tool:

- `appstoreconnect_list_apps`
- `revenuecat_list_projects`
