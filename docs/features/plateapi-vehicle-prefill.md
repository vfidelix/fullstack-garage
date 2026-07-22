# PlateAPI Vehicle Prefill Feature

Status: PLATEAPI-PLAN-003 approved for implementation
Date: 2026-07-22
Current plan revision: PLATEAPI-PLAN-003
Architecture: [Fullstack Garage Architecture](../architecture/fullstack-garage-architecture.md)
Product: [Product Scope and Language](../product/fullstack-garage-product.md)
Related features: [Vehicles](vehicles.md), [Service Records](service-records.md)
External reference: [PlateAPI API Reference](https://plateapi.com.au/docs/)
Provider terms: [PlateAPI Terms of Service](https://plateapi.com.au/terms/)
Provider privacy: [PlateAPI Privacy Policy](https://plateapi.com.au/privacy/)

## 1. Purpose

The PlateAPI Vehicle Prefill feature helps the authenticated Garage Admin create
a Vehicle faster by looking up Australian registration details through PlateAPI.
The Vehicle creation flow should recommend starting with registration lookup
before manual entry. When lookup succeeds, the application fills supported
Vehicle form fields from the lookup result. Provider-filled Make, Model, Engine,
and Body remain locked until the lookup is cleared; Year and Notes follow the
editable rules in this specification. The Garage Admin remains in control of
whether to use lookup or create the Vehicle manually.

This feature is an optional assistant to the existing manual Vehicle workflow.
It must never make PlateAPI authoritative for Vehicle records, prevent manual
entry, or submit a Vehicle automatically.

This document owns PlateAPI lookup scope, supported state behavior, suggestion
rules, privacy requirements, and acceptance criteria. The Vehicle feature remains
authoritative for saved Vehicle fields, validation, lifecycle, duplicate
warnings, and persistence.

## 2. Feature Decisions

1. PlateAPI lookup is available while creating a Vehicle.
2. Manual Vehicle creation remains fully available.
3. The Garage Admin must provide a registration and an Australian state or
   territory code before lookup.
4. All Australian state and territory codes supported by PlateAPI are available:
   `ACT`, `NSW`, `NT`, `QLD`, `SA`, `TAS`, `VIC`, and `WA`.
5. The Vehicle creation flow recommends registration lookup as the first path,
   while still allowing manual entry.
6. Lookup results are suggestions only, even when they prefill and lock form
   fields.
7. Successful lookup may fill supported Vehicle form fields on the page.
8. Prefilling fields must not submit or save the Vehicle.
9. The user may ignore lookup and use manual entry instead.
10. The user may clear a lookup result and return to manual editing before
    saving.
11. Existing Vehicle domain validation remains authoritative for all saved
   fields.
12. The selected registration state is persisted on the Vehicle as
    `registrationState`.
13. PlateAPI metadata is not persisted in the Vehicle record.
14. VIN lookup, vehicle database dropdowns, owner lookup, images, document
    storage, and Service Record behavior are outside this feature.
15. PlateAPI calls must pass through an authenticated server-side proxy. The
    PlateAPI key must never be sent to or configured in the SPA.
16. When alternatives are returned, no match is applied until the Garage Admin
    explicitly selects from the primary match and all alternatives.
17. A lookup result is valid only for the registration and state used by that
    request. Changing either input invalidates the result.
18. Vehicle `year` is optional persisted text so an untouched PlateAPI year
    range can be saved without inventing an exact year.
19. PlateAPI `year_range` is the preferred Year suggestion. Equal valid
    `lowest_year` and `highest_year` values remain the fallback when
    `year_range` is absent.
20. Vehicle `body` is optional persisted text and PlateAPI `body` may prefill it.
21. PlateAPI `detailed_description` may be appended to editable Vehicle Notes
    under the duplicate-prevention rules in Section 5.
22. Lookup-filled Make, Model, Engine, and Body are read-only until lookup is
    cleared. Lookup-filled Year remains editable and Notes are always editable.
23. An untouched provider Year is valid provider-supplied text. The first user
    edit changes Year to manual mode, where it must be exactly four decimal
    digits and numerically between 1900 and 9999 inclusive.
24. Clearing lookup restores the pre-lookup Make, Model, Engine, Year, and Body
    values. It never removes or rewrites Notes.

## 3. MVP Scope

The MVP includes:

- Entering a registration and selecting one of the eight Australian state or
  territory codes before lookup.
- Calling PlateAPI's registration lookup endpoint through an authenticated
  server-side proxy.
- Showing a lookup loading state, found state, not-found state, validation
  failure state, authentication/configuration failure state, quota/rate-limit
  state, and temporary failure state.
- Prefilling supported Vehicle form fields from a usable primary match when no
  alternatives exist, or from the match explicitly selected when they do.
- Presenting Make, Model, Engine, and Body as locked recommendations while
  keeping Year and Notes editable under their specific rules.
- Letting the Garage Admin clear a lookup result and return to manual entry.
- Preserving all existing manual Vehicle creation behavior when lookup is unused,
  unavailable, unsuccessful, or ignored.
- Handling PlateAPI alternative matches without silently applying the provider's
  primary match or any alternative.

The MVP does not include:

- Plate lookup on the Vehicle edit screen.
- Persisting PlateAPI source, duration, sandbox, quota, rate-limit, lookup
  timestamp, general description, or alternatives. Body, Year, and the approved
  detailed-description text become ordinary Vehicle data after the Garage Admin
  saves the form; no provider provenance or metadata is persisted.
- VIN lookup.
- PlateAPI's paid vehicle database endpoint for make, model, and year dropdowns.
- Automated Vehicle creation after lookup.
- Automated Service Record creation or Service Record field suggestions.
- Customer, legal owner, finance, insurance, or government registration status
  data.

## 4. PlateAPI Contract

The integration uses PlateAPI's current `GET /api/v1/lookup` endpoint at:

```text
https://api.plateapi.com.au/api/v1/lookup
```

Each lookup requires:

| Input | Required | Notes |
| --- | --- | --- |
| `plate` | Yes | Registration plate text. PlateAPI accepts letters, numbers, spaces, and dashes; lookup is case-insensitive and the provider strips spaces and dashes. |
| `state` | Yes | One of `ACT`, `NSW`, `NT`, `QLD`, `SA`, `TAS`, `VIC`, or `WA`. |
| `X-API-Key` | Yes | PlateAPI API key supplied by the approved integration boundary. |
| `detailed` | Yes for this integration | The proxy supplies `true` so the approved detailed-description suggestion can be returned; callers cannot choose or forward this provider option. |

PlateAPI successful lookup data may include:

| PlateAPI field | Use in this feature |
| --- | --- |
| `vehicle.make` | May be suggested for Vehicle `make`. |
| `vehicle.model` | May be suggested for Vehicle `model`. |
| `vehicle.lowest_year` | Exact-year fallback when `year_range` is absent and both bounds are the same valid year. |
| `vehicle.highest_year` | Exact-year fallback when `year_range` is absent and both bounds are the same valid year. |
| `vehicle.year_range` | Preferred Vehicle `year` suggestion after external-boundary validation. |
| `vehicle.engine` | May be suggested for Vehicle `engine` when present. |
| `vehicle.description` | Displayed as suggestion context only. |
| `vehicle.body` | May be suggested for Vehicle `body` when present. |
| `vehicle.detailed_description` | May be appended to editable Vehicle `notes` under Section 5. |
| `alternatives` | Displayed as separate variant suggestions when present. |
| `source`, `duration_ms`, `sandbox` | Operational metadata; not persisted. |

The adapter must tolerate unknown additional response fields because PlateAPI may
add fields without a version change. It must still reject missing, mistyped, or
otherwise unusable required fields before returning an app-owned suggestion.

The sandbox plate `TEST123` may be used for development or an explicitly enabled
smoke test. PlateAPI documents that it does not consume quota or plan rate limit,
but it still requires a valid API key; normal automated tests must use mocked
responses and must not require a provider account or network access.

## 5. Suggestion Mapping

PlateAPI data maps into the existing Vehicle form conservatively:

| Vehicle field | Suggestion rule |
| --- | --- |
| `registration` | Preserve the user's trimmed form value for Vehicle persistence. Lookup normalization may uppercase it for the request but must not silently remove internal spaces or dashes from the saved form value. |
| `registrationState` | Fill with the state or territory selected for lookup and persist it with the Vehicle. |
| `make` | Fill with `vehicle.make` when present and within Vehicle text limits. |
| `model` | Fill with `vehicle.model` when present and within Vehicle text limits. |
| `year` | Fill from trimmed `year_range` when present and valid. When it is absent, fill equal valid `lowest_year`/`highest_year` as exact-year text. Provider-filled text remains valid until the Garage Admin first edits it; manual edits require exactly four digits and the inclusive numeric range 1900-9999. |
| `engine` | Fill with `vehicle.engine` when present and within Vehicle text limits. |
| `body` | Fill with `vehicle.body` when present and within Vehicle text limits. |
| `vin` | Never suggested by PlateAPI lookup in the MVP. |
| `currentOdometer` | Never suggested by PlateAPI lookup. |
| `odometerUnit` | Never changed by PlateAPI lookup. |
| `notes` | Trim `vehicle.detailed_description`. Do nothing when empty or when the trimmed text already appears anywhere in Notes under a case-insensitive comparison. Otherwise append it to existing Notes with one blank-line separator, or use it as Notes when Notes are empty. Do not truncate or silently rewrite Notes; normal Vehicle notes validation remains authoritative. |

If a PlateAPI value exceeds existing Vehicle field limits, the UI must not fill
it into the form. It may show a safe message that the value cannot be used.

When `alternatives` is empty, the valid primary `vehicle` match may be applied
after lookup. When `alternatives` is non-empty, the UI must present
`[vehicle, ...alternatives]` as one explicit selection set and must not fill any
provider fields until the Garage Admin selects a match. Only the selected match
is mapped into the form.

## 6. User Experience Rules

- The create-Vehicle screen should make registration lookup the recommended
  starting flow.
- Lookup is initiated by an explicit user action after registration and state are
  entered.
- The user must be able to save a Vehicle without running lookup.
- The user must be able to save a Vehicle after lookup fails, subject to normal
  Vehicle validation.
- Successful lookup fills supported fields on the page. Only provider-filled
  Make, Model, Engine, and Body are read-only while the lookup result is in use.
  Their read-only state must have a clear disabled appearance using existing
  design tokens while retaining readable contrast.
- Provider-filled Year remains editable. Before the first user edit, the exact
  provider text is accepted, including a range such as `2018-2021`. The first
  user edit permanently switches that applied Year value to strict manual
  validation for the current lookup application.
- Notes remain editable in every lookup state. Applying the same detailed
  description repeatedly, including after case-only changes, must not duplicate
  it. User changes to Notes are preserved, and clearing lookup never removes or
  rewrites Notes.
- Prefilled values should be visually understandable as recommendations from
  lookup, not as user-entered manual values.
- Clearing a lookup result restores the exact pre-lookup Make, Model, Engine,
  Year, and Body values and returns those fields to manual editing. Registration
  and state remain as entered unless the user changes them. Notes remain exactly
  as currently edited.
- Lookup should not overwrite a field the user has already manually edited unless
  the user clearly confirms replacement. Rerunning lookup alone is not consent to
  discard unrelated manual values.
- When alternatives exist, the provider primary match and every alternative must
  be presented as peer options. The application must not fill any match before an
  explicit selection.
- Changing registration or state after a result is applied must immediately clear
  that result and unlock or restore affected fields. A late response for an older
  registration/state pair must be ignored and must not overwrite the current
  form.
- Only one lookup action may be pending for the current input pair. The UI and
  application layer must not automatically retry failed or timed-out lookups,
  because completed and not-found requests consume quota. Retry requires an
  explicit user action.
- A no-match response should use neutral language and keep the manual fields
  available.
- A rate-limit or quota response should explain that lookup is temporarily
  unavailable without exposing provider internals or private lookup input.
- The UI must use "Vehicle", "Registration", and "Service Record" product
  language and must not introduce invoice, payment, tax, or amount-due language.

Detailed layout and styling must follow the root `DESIGN.md` when UI work
begins.

## 7. Authorization, Configuration, and Privacy

- Only the authenticated Garage Admin can use PlateAPI lookup.
- Unauthenticated or unauthorized identities must not receive lookup results.
- The server-side proxy must validate the caller's current application session
  and Garage Admin authorization before calling PlateAPI. Browser visibility,
  CORS, and hidden UI are not authorization controls.
- The SPA must not expose a Supabase service-role key.
- A PlateAPI API key must not be committed to source control.
- The PlateAPI key must stay in server-side secret configuration and must not be
  returned in responses, error details, logs, source maps, or build output.
- The proxy must accept only the app-owned lookup input, construct the upstream
  request itself, enforce a timeout and response-size limit, and return only the
  app-owned suggestion or error contract. It must not act as a general-purpose
  forwarding proxy.
- Registration, state, VIN, location, notes, and provider response payloads are
  private data and must not be logged by Fullstack Garage infrastructure by
  default. Proxy and hosting access logs must be configured not to capture lookup
  request bodies, query strings, or provider payloads.
- PlateAPI's published privacy policy says it logs submitted registration and
  state, returned vehicle data, request timestamp, status, response time, API-key
  identifier, and source IP, and retains API usage logs for 12 months. Production
  enablement requires explicit product/privacy acceptance of that disclosure and
  a user-facing privacy notice appropriate to the deployment.
- Provider errors must be mapped to app-owned, privacy-safe error categories
  before reaching feature UI.
- PlateAPI response metadata must not be persisted unless a later feature
  explicitly approves storage and retention rules.

## 8. Application and Architecture Boundary

The implementation should follow the existing dependency direction:

```text
Vehicle form
  -> application lookup use case
    -> app-owned PlateAPI lookup port
      -> selected proxy client adapter
        -> authenticated server-side proxy
          -> PlateAPI
```

Domain and application code must not import React, Supabase SDK types, or
PlateAPI vendor response types. Infrastructure adapters must validate external
JSON from `unknown` and map it into app-owned lookup models.

Vehicle persistence remains owned by existing Vehicle create and update use
cases. `Vehicle.year`, create/update inputs, form output, repository rows, and
writes use optional text; `Vehicle.body` follows the same app-owned path as other
optional Vehicle text. Lookup must not bypass Vehicle validation, duplicate
warning behavior, or Supabase Vehicle persistence. Provider-specific field names
remain inside the Cloudflare/PlateAPI adapter, which validates all external
strings from `unknown` before returning `year`, `body`, or
`detailedDescription` in the normalized suggestion.

The exact proxy runtime is an implementation-plan decision. It may be a
Cloudflare Pages Function/Worker, Supabase Edge Function, or another approved
server runtime, but it must enforce the authorization, secret-handling, input
validation, privacy, timeout, and response-mapping rules in this document.

## 9. Error Handling

The application should map PlateAPI and network outcomes into app-owned
categories:

| Condition | User-facing behavior |
| --- | --- |
| Missing registration or state | Prompt for the missing lookup input. |
| Invalid registration format | Ask the user to check the registration. |
| No vehicle found | Keep manual entry available and report that no suggestion was found. |
| Invalid or missing API key | Report that lookup is not configured. |
| Rate limit or quota exceeded | Report that lookup is temporarily unavailable. |
| Network timeout or provider failure | Report that lookup is temporarily unavailable. |
| Unexpected response shape | Treat as temporary lookup failure. |

Lookup errors must not create Vehicle validation errors unless the user tries to
save invalid Vehicle form values.

The application must not automatically retry provider failures, timeouts, or
`429` responses. It may use a valid `Retry-After` value to disable the explicit
retry action for the indicated interval without exposing provider headers or plan
details.

## 10. Verification Strategy

Unit tests should cover:

- Australian state and territory code validation.
- Vehicle `registrationState` mapping and persistence input.
- Registration lookup input normalization.
- PlateAPI response mapping from `unknown` into app-owned suggestion models.
- Forward-compatible handling of unknown additional response fields and rejection
  of invalid required fields.
- Preferred `year_range` mapping, exact-year fallback when it is absent, Body,
  and detailed-description mapping.
- Manual Year acceptance for `1900`, `2026`, and `9999`, and rejection of short,
  long, decimal, signed, alphabetic, range, and below-minimum manual values.
- Field-length rejection for suggestions that exceed Vehicle limits.
- Error-category mapping for not-found, invalid request, unauthorized,
  rate-limit, temporary failure, and unexpected response shapes.
- Garage Admin authorization for lookup use cases.
- Stale-response rejection and no automatic retry behavior.

Component tests should cover:

- Manual Vehicle creation still works without lookup.
- Lookup requires registration and state before submission.
- All eight Australian state and territory codes are available.
- The create flow recommends registration lookup before manual entry.
- Successful lookup fills only supported Vehicle fields.
- Only lookup-filled Make, Model, Engine, and Body are read-only and receive the
  approved disabled visual state while the lookup result is in use.
- Lookup ranges remain valid until Year is edited, then strict manual Year
  validation applies.
- Notes coverage includes empty Notes, existing Notes, case-insensitive
  duplicate prevention, repeated application, user edits, and lookup clearing.
- Clearing lookup returns affected fields to manual editing.
- Alternative matches require an explicit variant choice before filling fields.
- Changing registration or state invalidates an applied or pending lookup result.
- Clearing a result removes provider values and restores replaced manual values.
- Lookup failure leaves manual form entry available.

Integration or adapter tests should cover:

- Correct request construction for `GET /api/v1/lookup`.
- Safe handling of `success: false` not-found responses.
- Safe handling of 400, 401, 429, and temporary network failures.
- `Retry-After` handling where available.
- No committed secrets and configuration validation for the selected boundary.
- Server-side authentication/authorization, input allowlisting, response
  sanitization, timeout, response-size limit, and privacy-safe logging behavior.
- Vehicle repository, row mapper, forward migration, column grants, RLS, and
  pgTAP behavior for text Year and optional Body.

Until a live PlateAPI smoke test is explicitly enabled, repository verification
must use mocked HTTP responses or adapter contracts and the normal gates:

```text
npm test
npm run typecheck
npm run lint
npm run build
npm run test:db
git diff --check
```

## 11. Acceptance Criteria

The feature is complete when:

1. A Garage Admin can optionally look up Vehicle suggestions from registration
   and any supported Australian state or territory.
2. The lookup supports `ACT`, `NSW`, `NT`, `QLD`, `SA`, `TAS`, `VIC`, and `WA`.
3. The Vehicle creation flow recommends registration lookup before manual entry.
4. Successful lookup fills supported fields on the page without saving the
   Vehicle.
5. The selected registration state is saved as Vehicle `registrationState` when
   the Vehicle is saved.
6. Lookup-filled Make, Model, Engine, and Body are read-only and visibly disabled
   while the lookup result is in use; Year and Notes remain editable.
7. The Garage Admin can ignore lookup or clear the lookup result and return to
   manual entry before saving.
8. Manual Vehicle creation remains available in every lookup state.
9. Vehicle save behavior continues through existing Vehicle validation,
   duplicate warning, and persistence rules.
10. Alternatives are not silently selected.
11. Provider failures and quota errors are privacy-safe and do not block manual
   Vehicle entry.
12. No PlateAPI secret is committed or exposed beyond the approved integration
   boundary.
13. Required typecheck, lint, build, and relevant tests pass.
14. Changing registration or state cannot leave provider fields from an older
    lookup applied, and late responses cannot overwrite newer form state.
15. The integration does not automatically retry quota-consuming lookups.
16. Production enablement records acceptance of PlateAPI's disclosed lookup-data
    logging and retention and provides the required privacy notice.
17. Vehicle Year persists as optional bounded text and accepts an untouched
    provider range; once edited, Year accepts only exactly four digits from 1900
    through 9999 inclusive.
18. Vehicle Body is available in create, edit, and detail views and persists as
    optional text, without changing compact Vehicle labels.
19. Detailed description is appended to Notes at most once under a
    case-insensitive comparison, and Notes survive lookup clearing unchanged.
20. Clearing lookup restores pre-lookup Make, Model, Engine, Year, and Body.

## 12. Resolved Decisions

Resolved on 2026-07-21:

1. PlateAPI lookup is an optional Vehicle creation aid.
2. Manual Vehicle creation remains authoritative and fully supported.
3. All Australian PlateAPI state and territory codes are supported: `ACT`,
   `NSW`, `NT`, `QLD`, `SA`, `TAS`, `VIC`, and `WA`.
4. The prior plan established lookup fill-and-lock recommendations without
   automatic save. PLATEAPI-PLAN-003 narrows the current locked-field set in
   Decision 16 below.
5. Registration state is persisted on Vehicle records as `registrationState`.
6. PlateAPI metadata is not persisted in the MVP.
7. Vehicle edit-screen lookup is deferred from the MVP.
8. PlateAPI's paid vehicle database endpoint is outside the MVP.
9. PlateAPI lookup uses an authenticated server-side proxy; a browser-exposed
   provider key is not permitted.
10. When alternatives exist, the primary match and alternatives require explicit
    selection before any provider fields are filled.
11. Lookup results are bound to their registration/state input pair and are
    invalidated when either input changes.

Resolved and explicitly approved as PLATEAPI-PLAN-003 on 2026-07-22:

12. Persist Vehicle Year as optional text so provider year ranges can be saved.
13. Prefer `year_range` and retain equal numeric bounds as the exact-year
    fallback only when `year_range` is absent.
14. Persist optional Body and prefill it from PlateAPI.
15. Append trimmed `detailed_description` to editable Notes only when a
    case-insensitive match is not already present; clearing lookup never changes
    Notes.
16. Lock only provider-filled Make, Model, Engine, and Body. Year remains
    editable with provider-until-edited validation, and Notes are always
    editable.
17. Restore Make, Model, Engine, Year, and Body when lookup is cleared and keep
    compact Vehicle labels unchanged.

## 13. Plan Approval

The user explicitly approved plan revision `PLATEAPI-PLAN-003` and task IDs
`PLATEAPI-06` through `PLATEAPI-11` on 2026-07-22 by directing implementation of
the supplied PlateAPI Vehicle Prefill Extension plan. The canonical task
definitions, dependencies, validation requirements, progress, and review
findings are recorded in
[the controlled task breakdown](plateapi-vehicle-prefill.task-breakdown.md).

Any change to approved scope, task dependencies, or acceptance criteria requires
a new plan revision and a new approval record. Progress updates, validation
outcomes, and review-finding dispositions do not change the approved revision.

## 14. Previously Open Implementation Decisions

The prior PlateAPI delivery required the following implementation decisions
before its code changes began:

1. Whether the required proxy is implemented as a Cloudflare Pages
   Function/Worker, Supabase Edge Function, or another approved backend.
2. How the selected proxy runtime validates the existing Supabase-backed Garage
   Admin session without introducing a second authentication model.
3. Whether alternatives fill fields through a variant picker, individual variant
   buttons, or another explicit interaction that satisfies the suggestion rules.
4. Where the production privacy acceptance and user-facing disclosure are
   recorded before lookup is enabled.

These prior implementation decisions were resolved by the existing
implementation and runbook before PLATEAPI-PLAN-003. There are no unresolved
product or architecture decisions for the approved PLATEAPI-PLAN-003 extension.
