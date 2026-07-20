# Authentication and Access Security Audit

Status: AUTH-27 implementation complete; reviewer gate pending  
Date: 2026-07-20  
Feature: [Authentication and Access](../features/authentication-access.md)

## Scope and method

This final repository audit covered the current authentication feature diff,
architecture and design constraints, production TypeScript/React code, Supabase
migrations, authentication tests, environment/build controls, and both
operations runbooks. It did not inspect or record real credentials, provider
subjects, callback queries, sessions, user profiles, or private product data.

Evidence came from targeted `rg` boundary/security searches, current-diff review,
the auth/controller/route/adapter/config tests, static migration tests, the pgTAP
suite source, repository-wide validation, and a marker-only scan of the built
`dist/` assets. Search results were reviewed as code context rather than treating
every dependency string as leaked data.

## Results

| Audit boundary | Result |
| --- | --- |
| Supabase SDK/API/type ownership | Pass: SDK use and API calls remain under `src/infrastructure/supabase/`; composition imports only the selected adapter classes. |
| Concrete adapter selection | Pass: gateway and session-event implementations are constructed only in `src/app/authenticationComposition.ts`. |
| Environment and public bundle | Remediated: only shared config and the Vite build guard read environment values; see the finding below. |
| Logging and sensitive values | Pass: production auth code has no console/logger/analytics path and does not propagate raw provider errors, tokens, callback data, or profiles. |
| Redirect and callback safety | Pass: return paths are local-only, repeatedly decoded for validation, reject callback loops, schemes, controls, malformed encodings, and encoded separators; callback initialization has one provider-owned path and route queries are not rendered. |
| Protected rendering | Pass: initializing, unauthenticated, unauthorized, error, and anomalous member states do not render the authenticated shell or protected outlet. |
| Client authority | Pass: browser code cannot choose owner IDs, mutate app users/identity mappings, or promote roles; only the privileged runbooks contain reviewed role/mapping SQL. |
| Database authorization | Pass by migration/static evidence: auth-owned tables enable RLS and revoke direct browser privileges; security-definer functions use empty search paths; execution grants are scoped; identity resolution derives from `auth.uid()`. |
| Provisioning | Pass: new Google users receive only the `member` default, later provider profile changes do not resynchronize app-owned data, missing-name provisioning is service-role-only, and browser execution is denied. |
| Session and cleanup ownership | Pass: one provider owns startup/session restoration; generation guards reject stale operations; sign-out and identity/access changes hide protected UI and clear registered private state. |
| UI/provider scope | Pass: Google is the only interactive sign-in action; raw provider details and alternate registration/provider controls are absent. |
| Product authorization scope | Pass: operations evidence is limited to current auth-owned route/table/RPC controls; Vehicle and Service Record row authorization is explicitly deferred to their future migrations. |
| Operations safety | Pass: runbooks isolate environments, keep secrets out of browser/history/evidence, avoid destructive hosted reset guidance, close signup on abort paths, serialize privileged operations, and require verified transactional assertions. |

## Finding and remediation

### Medium — approved public variable could embed a privileged value before runtime rejection

The Vite guard originally rejected unapproved `VITE_*` names but accepted any
value under `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_URL`. The browser
config would reject a secret key, legacy `service_role` JWT, or credential-bearing
URL at runtime, after Vite could already have embedded it in the public bundle.

Remediation: `viteEnvironmentGuard.ts` now invokes the existing fixed-message
Supabase browser-config validator whenever either approved Supabase variable is
present. Builds reject incomplete pairs, privileged/malformed keys, and unsafe
URLs before transformation. Regression tests cover a secret key prefix, legacy
service-role JWT, credential-bearing URL, and incomplete configuration without
including rejected values in error messages.

Re-audit result: no remaining high- or medium-severity actionable finding in the
Authentication and Access scope.

## Validation evidence

The controlled validation set is:

```sh
npm test -- viteEnvironmentGuard.test.ts src/shared/config \
  src/shared/validation src/application/authentication \
  src/application/use-cases/auth src/application/ports/authGateway.contract.ts \
  src/app/authenticationComposition.test.ts src/app/providers \
  src/app/routes src/features/auth src/infrastructure/supabase \
  supabase/tests
npm test
npm run typecheck
npm run lint
npm run build
npm run test:db
git diff --check
```

Targeted boundary searches also checked SDK imports/calls and adapter
construction sites; `import.meta.env`/`process.env`; unapproved `VITE_*` names;
logging/analytics; token, callback, provider-profile, VIN, registration, notes,
location, and receipt terms; redirects and callback processing; client writes
and role changes; migration RLS/grants/search paths/`auth.uid()`; UI providers;
and runbook destructive/secret guidance.

After the production build, a marker-only scan found no secret-like
`sb_secret_` value, JWT-shaped value, publishable-key value, configured
service-role variable, private test marker, raw provider-profile field, or
private Vehicle/Service Record field. The bundled Supabase dependency contains
the literal `sb_secret_` prefix and OAuth error-field names as library code; no
suffix resembling a key and no environment value accompanied them.

## Residual and manual gates

- `npm run test:db` requires the Supabase CLI and a local validation database.
  If unavailable, static migration/pgTAP checks may pass but must not be reported
  as live database execution.
- An authorized owner must configure each isolated environment, verify exact
  Google/Supabase callbacks and session settings, perform the real Google staging
  flow, execute the initial bootstrap, and confirm signup remains disabled.
- Garage Admin recovery remains an incident-authorized, two-person operation and
  has not been executed by this repository audit.
- Vehicle and Service Record migrations must later apply and test
  `is_garage_admin()` against their own tables before any product-row access is
  claimed.
