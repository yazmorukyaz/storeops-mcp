# Contributing to StoreOps MCP

Keep changes small and API-specific.

## Development

Run checks in the plugin you changed:

```sh
npm install
npm run build
```

## Tool Design

- Prefix tool names with the service name.
- Mark read-only tools with `readOnlyHint: true`.
- Keep generic request tools available for endpoint coverage.
- Add dedicated helper tools for common workflows.
- Do not print secrets in tool responses.

## Pull Requests

Include:

- What changed
- Why it changed
- How it was tested
- Any required credentials or permissions
