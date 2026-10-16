# Snippets

Simplified excerpts that illustrate techniques used in Rock&Prop.

- They are **illustrative, not the production code**: table and route names
  are generic, and anything specific to the deployment (configuration,
  environment, providers, exact policies) has been removed.
- They are not meant to compile as a project; each file stands on its own
  to be read.
- Viewing only — see the repository [LICENSE](../LICENSE).

| File | Technique |
| --- | --- |
| [`typescript/ssrf-guard.ts`](typescript/ssrf-guard.ts) | Server-side fetch of user URLs without SSRF or DNS rebinding |
| [`typescript/signed-links.ts`](typescript/signed-links.ts) | Expiring HMAC tokens, constant-time verification |
| [`typescript/web-hardening.ts`](typescript/web-hardening.ts) | Bearer secret check, open-redirect guard, CSV formula injection |
| [`typescript/error-reporting-privacy.ts`](typescript/error-reporting-privacy.ts) | Error reports with no personal data |
| [`typescript/geo.ts`](typescript/geo.ts) | Haversine distance, point-in-polygon |
| [`sql/01-atomic-state-transition.sql`](sql/01-atomic-state-transition.sql) | State changes through a definer function, not UPDATE policies |
| [`sql/02-rate-limit-inside-a-policy.sql`](sql/02-rate-limit-inside-a-policy.sql) | Rate limits enforced by Row-Level Security |
| [`sql/03-idempotent-webhook.sql`](sql/03-idempotent-webhook.sql) | Idempotent, retry-safe payment recording |
