# Sharing StoreOps RevenueCat MCP

This folder is safe to share as source code. It does not include your RevenueCat API key.

## Recipient Setup

```sh
cd revenuecat-mcp
cp .env.example .env
npm install
npm run build
```

Then edit `.env` and set:

```sh
REVENUECAT_API_KEY=...
```

Use a RevenueCat secret API key for write actions. Do not use a public SDK key for server-side write operations.

## Manual MCP Run

```sh
set -a
source .env
set +a
node dist/index.js
```

## Codex Plugin Use

Install/register this folder as a local Codex plugin. The `.mcp.json` starts `node dist/index.js`; make sure `npm install` and `npm run build` have been run first, and launch Codex with the required environment variables available.
