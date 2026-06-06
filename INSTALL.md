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

## Codex

Register one or both plugin folders as local plugins:

- `appstoreconnect-mcp`
- `revenuecat-mcp`

The plugins use stdio MCP servers and start with:

```sh
node dist/index.js
```

Your Codex environment must provide the needed credentials when the MCP server starts. A simple local setup is to launch Codex from a shell where you have sourced the relevant `.env`.

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
