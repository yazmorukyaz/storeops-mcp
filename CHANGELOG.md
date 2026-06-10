# Changelog

## v0.1.0 - 2026-06-10

Initial public release of StoreOps MCP.

### Included

- Local App Store Connect MCP server for apps, builds, app versions, listing metadata, localizations, screenshots, IAPs, subscriptions, custom product pages, promoted purchases, reviews, Sales and Trends reports, Analytics Reports, and ASO-oriented audits.
- Local RevenueCat MCP server for projects, apps, products, entitlements, offerings, customers, customer subresources, paywalls, metrics overview, paywall catalog audits, and monetization analysis.
- Credential guide for App Store Connect, Apple In-App Purchase keys, App Store shared secrets, RevenueCat secret API keys, and report vendor numbers.
- Install guide for local development and default Codex plugin discovery.
- LLM context file for sharing StoreOps capabilities and safety rules with AI agents.

### Safety Model

- Credentials are local-only and excluded from the repo.
- Read-first workflows are the default.
- Production writes require explicit tool calls and target resource IDs.
- Secrets should never be logged in tool output, examples, issues, or pull requests.
