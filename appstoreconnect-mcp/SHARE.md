# Sharing StoreOps App Store Connect MCP

This folder is safe to share as source code. It does not include your Apple private keys, issuer IDs, key IDs, shared secrets, or local `.p8` files.

## Recipient Setup

```sh
cd appstoreconnect-mcp
cp .env.example .env
npm install
npm run build
```

Then edit `.env` and set:

```sh
ASC_KEY_ID=...
ASC_ISSUER_ID=...
ASC_PRIVATE_KEY_PATH=/absolute/path/AuthKey_XXXXXXXXXX.p8
```

Use an App Store Connect API key with the role required for the intended operations. App Manager can cover many app metadata and IAP workflows; Admin is broader.

## Manual MCP Run

```sh
set -a
source .env
set +a
node dist/index.js
```

## Codex Plugin Use

Install/register this folder as a local Codex plugin. The `.mcp.json` starts `node dist/index.js`; make sure `npm install` and `npm run build` have been run first, and launch Codex with the required environment variables available.

Do not share `.p8` private key files.
