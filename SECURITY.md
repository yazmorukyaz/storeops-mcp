# Security Policy

## Secrets

Do not commit credentials to this repository.

Blocked by convention:

- `.env`
- `*.p8`
- RevenueCat secret API keys
- App Store Connect private keys
- App Store shared secrets

If a credential is accidentally committed, revoke it immediately in the provider dashboard and rotate it before continuing development.

## Reporting

For now, open a private GitHub security advisory or contact the repository owner directly.

## Operational Guidance

- Use read-only tools before write tools.
- Use dedicated API keys with the smallest role that can complete the workflow.
- Review all App Store Connect write payloads before execution.
- Treat RevenueCat secret keys as server-side credentials only.
