# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by emailing: **hello@ferrolabs.ai**

You can expect an acknowledgement within **48 hours** and a full response within **7 days**.

## Scope

This policy covers the `ferrolabsai` npm package. For gateway-level security issues, report to the [ai-gateway repository](https://github.com/ferro-labs/ai-gateway/security).

## Secure Usage

- Never hardcode API keys. Use environment variables (`FERRO_API_KEY`).
- Always use HTTPS for non-localhost `baseUrl`.
- Rotate API keys regularly.
