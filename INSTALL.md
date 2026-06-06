# Install StoreOps MCP

## Local Development

```sh
git clone https://github.com/yazmorukyaz/appstore-mcp.git
cd appstore-mcp
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

## Codex

Register one or both plugin folders as local plugins:

- `appstoreconnect-mcp`
- `revenuecat-mcp`

The plugins use stdio MCP servers and start with:

```sh
node dist/index.js
```

Your Codex environment must provide the needed credentials when the MCP server starts. A simple local setup is to launch Codex from a shell where you have sourced the relevant `.env`.

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

If the tools do not appear in the current thread, start a new Codex thread or restart/refresh Codex.

## Verification

Use the auth status tools first:

- `appstoreconnect_auth_status` with `check_jwt=true`
- `revenuecat_auth_status`

Then run a read-only list tool:

- `appstoreconnect_list_apps`
- `revenuecat_list_projects`
