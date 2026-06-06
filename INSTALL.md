# Install

## Local Development

```sh
git clone https://github.com/yazmorukyaz/appstore-mcp.git
cd appstore-mcp
```

Build App Store Connect MCP:

```sh
cd appstoreconnect-mcp
npm install
npm run build
cp .env.example .env
```

Build RevenueCat MCP:

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

## Verification

Use the auth status tools first:

- `appstoreconnect_auth_status` with `check_jwt=true`
- `revenuecat_auth_status`

Then run a read-only list tool:

- `appstoreconnect_list_apps`
- `revenuecat_list_projects`
