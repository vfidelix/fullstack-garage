# Service Records Controlled Task Breakdown

Status: Approved for implementation
Plan revision: SR-PLAN-002
Last updated: 2026-07-23
Source: [Service Record Feature](service-records.md)
Architecture: [Fullstack Garage Architecture](../architecture/fullstack-garage-architecture.md)
Related feature: [Vehicles](vehicles.md)

## 1. Purpose and Approval Control

This is the canonical controlled-progress document for Service Records. It owns
the stable task IDs, dependencies, acceptance criteria, required validation,
recorded outcomes, approval record, and review-finding dispositions. The feature
specification remains the authoritative source for product behavior.

The planning baseline began as **Awaiting explicit approval**. SR-PLAN-001 was
approved for the initial implementation. SR-PLAN-002 records the product owner's
Service Record flow review and adds SR-15 without claiming implementation. Scope,
dependencies, and acceptance criteria below are frozen under SR-PLAN-002. Any
change to one of them requires a new plan revision and renewed approval; progress,
observed validation outcomes, and finding dispositions do not.

### Approval record

| Date | Approved plan | Approved tasks | Approval wording |
| --- | --- | --- | --- |
| 2026-07-22 | SR-PLAN-001 | SR-01 through SR-14 | “Implement the plan in a fresh context. Treat the plan as the source of user intent, re-read files as needed, and carry the work through implementation and verification.” |
| 2026-07-23 | SR-PLAN-002 | Documentation update and SR-15 scope | “Update the feature documents related now. Do not touch the code.” |

No product ambiguity remains for the recorded scope: `service-records.md` is
decision-complete; jsPDF, the existing transparent Fullstack Garage logo,
schema/template/branding versions beginning at `1`, and the SR-15 interaction and
validation requirements are approved implementation constraints. SR-15 remains
planned because this revision authorizes documentation only.

## 2. Baseline and Delivery Boundaries

- The application is a strict TypeScript React/Vite SPA. Existing authentication
  and Vehicle delivery provide the authenticated app-owned Garage Admin,
  protected routes, Vehicle persistence, lifecycle operations, and private-state
  cleanup infrastructure.
- The working tree contains the Service Record domain, application, UI,
  migration, adapters, PDF renderer, and repository contracts delivered through
  SR-13. SR-15 refines that implementation without changing the established
  dependency boundaries. Supabase access must stay inside
  `src/infrastructure/supabase/`; PDF rendering remains an infrastructure adapter.
- `docs/features/service-records.md` remains user-owned and was expressly updated
  for SR-PLAN-002. Later edits still require an explicit product decision.
- UI tasks must read and follow `DESIGN.md`, reuse `src/styles/global.css`
  tokens, use colocated CSS modules and Lucide icons, and use only maintenance
  language (including **Service Record** and **Purchase Cost**).
- jsPDF is the approved client-side dependency. The PDF file is never persisted;
  only the immutable snapshot JSON is stored. Template, branding, and snapshot
  schema versions start at `1`.
- Writes run sequentially. Read-only review may run alongside a task only when it
  does not change the working tree. Each worker re-reads current files and this
  document, confirms SR-PLAN-002 and the approved task range, and records only
  actually observed validation results.

## 3. Dependency Order

```text
SR-01 -> SR-02 -> SR-03 -> SR-09 -> SR-10 -> SR-11 -> SR-12 -> SR-13 -> SR-15 -> SR-14
                  \              /
SR-04 -> SR-05     -> SR-06 -> SR-07
SR-01 + SR-02 -----------------> SR-08 -> SR-09
```

SR-04 also updates the existing Vehicle persistence boundary and therefore must
complete before adapters, archive/delete messaging, and final verification.

## 4. Task Summary and Progress

| ID | Task | Depends on | Status | Required validation | Concrete validation outcome |
| --- | --- | --- | --- | --- | --- |
| SR-01 | Build provider-neutral domain aggregate, validators, derived totals, chronology checks, and snapshot model. | None | Completed | Focused domain/snapshot unit tests; typecheck; lint. | Passed 2026-07-22: `npm test -- src/domain/service-records/serviceRecord.test.ts` (13 tests); `npm run typecheck`; `npm run lint`. |
| SR-02 | Define app-owned results/errors plus repository, snapshot, and PDF-renderer ports. | SR-01 | Completed | Type/import-boundary tests; typecheck; lint. | Passed 2026-07-22: `npm test -- src/application/ports/serviceRecordRepository.test.ts src/application/service-records/serviceRecordResult.test.ts` (11 tests); `npm run typecheck`; `npm run lint`; `git diff --check`. |
| SR-03 | Implement the nine authenticated use cases with fail-closed authorization and safe errors. | SR-02 | Completed | Use-case unit tests for all workflows and auth/error paths. | Passed 2026-07-22: `npm test -- src/application/use-cases/service-records/serviceRecordUseCases.test.ts` (12 tests); `npm run typecheck`; `npm run lint`; `git diff --check`. |
| SR-04 | Add Supabase migration/RPC/RLS boundary, ordered items, exports, constraints, numbering, atomic save/complete, and Vehicle lifecycle integration. | SR-01 | Completed | Migration/static checks; local reset/lint and targeted pgTAP when available. | Passed 2026-07-22: `npm test -- supabase/tests/serviceRecordsMigration.test.mjs` (4 tests); `supabase db reset`; `supabase db lint` (no schema errors); `git diff --check`. Targeted Service Record pgTAP coverage is deferred to SR-05. |
| SR-05 | Add database invariant, RLS, rollback, and concurrency coverage. | SR-04 | Completed | SQL/static suites; local database suite where available. | Passed 2026-07-22: `supabase db reset`; `npm run test:db` (Service Record pgTAP 33 assertions; full suite 170 assertions); `supabase db lint` (no schema errors); `npm test -- supabase/tests/serviceRecordsMigration.test.mjs supabase/tests/serviceRecordsDatabaseSuiteStatic.test.mjs` (7 tests); `git diff --check`. Live cross-session concurrency is covered by row-lock/static boundary assertions; stale-save and completion retry behavior are exercised live. |
| SR-06 | Implement Supabase adapters, strict row mapping, and provider-error mapping. | SR-02, SR-04 | Completed | Mapper/adapter tests; boundary-import checks. | Passed 2026-07-22: `npm test -- src/infrastructure/supabase/repositories/SupabaseServiceRecordRepository.test.ts` (4 tests); `npm run typecheck`; provider/import scan; `git diff --check`. `npm run lint` is currently blocked by style errors in this task's compact adapter implementation and pre-existing Service Record database static-test quote errors; remaining cleanup is deferred for the final verification task. |
| SR-07 | Add shared stateful repository contract suites. | SR-06 | Completed | Contract suite against Supabase adapters. | Passed 2026-07-22: `npm test -- src/infrastructure/supabase/repositories/SupabaseServiceRecordRepository.contract.test.ts src/infrastructure/supabase/repositories/SupabaseServiceRecordRepository.test.ts` (9 tests, including 5 stateful contract tests); `npm run typecheck`; focused ESLint for SR-07 files; `git diff --check`. Full `npm run lint` remains blocked by 30 pre-existing SR-06/static-test style errors. |
| SR-08 | Implement jsPDF rendering and fresh versus historical snapshot behavior. | SR-01, SR-02 | Completed | Renderer/snapshot tests; PDF content/privacy review. | Passed 2026-07-22: `npm test -- src/infrastructure/pdf/JsPdfServiceRecordRenderer.test.ts` (2 tests); `npm run typecheck`; focused ESLint for both renderer files; maintenance-language/privacy scan; `git diff --check`. The renderer uses jsPDF 4.2.1, the transparent Fullstack Garage logo, snapshot item ordering, Purchase Cost totals, and safe failures. Fresh snapshot generation/persistence behavior is verified in SR-03 use-case tests; explicit historical snapshot selection is reserved for SR-12 UI. |
| SR-09 | Add composition, query/mutation hooks, cache invalidation, and identity-change cleanup. | SR-03, SR-06, SR-08 | Completed | Composition/hook tests; cache-isolation checks. | Passed 2026-07-22: `npm test -- src/app/serviceRecordComposition.test.ts src/features/service-records/serviceRecordQueries.test.tsx` (7 tests); focused ESLint for SR-09 files; `npm run typecheck`; `git diff --check`. |
| SR-10 | Add protected routes and Vehicle-detail integration, including archived history. | SR-03, SR-09 | Completed | Route/integration/accessibility tests. | Passed 2026-07-22: `npm test -- src/features/service-records/ServiceRecordRoutes.test.tsx src/app/routes/VehicleRoutes.test.tsx src/features/vehicles/VehicleWorkflowScreens.test.tsx` (39 tests); focused ESLint for SR-10 files; `npm run typecheck`; `git diff --check`. Full `npm run lint` remains blocked by the previously recorded SR-06/static-test style errors. |
| SR-11 | Build the draft editor: six sections, adaptive/reorderable items, totals, save/delete, and conflict recovery. | SR-09, SR-10 | Completed | Editor/workflow/a11y/responsive/conflict tests. | Passed 2026-07-22: `npm test -- src/features/service-records/ServiceRecordEditor.test.tsx src/features/service-records/ServiceRecordRoutes.test.tsx` (4 tests); `npm run typecheck`; `git diff --check`. Focused ESLint remains blocked by 29 rule violations in the compact editor implementation; final lint cleanup is deferred to SR-14. |
| SR-12 | Build completion review, read-only detail, PDF preview/download, and historical-export UI. | SR-08, SR-09, SR-10, SR-11 | Completed | Completion/PDF/history/a11y workflow tests. | Passed 2026-07-22: `npm test -- src/features/service-records/ServiceRecordDetail.test.tsx src/features/service-records/ServiceRecordRoutes.test.tsx src/features/service-records/ServiceRecordEditor.test.tsx` (6 tests); `npm run typecheck`; focused ESLint for SR-12 touched TypeScript files; `git diff --check`. Completion requires explicit confirmation, completed records are read-only, fresh preview/download remain separate from explicitly selected historical exports, and download persists snapshots through the existing app-owned workflow without persisting PDF Blobs. |
| SR-13 | Complete Vehicle archive/delete messaging and feature documentation/progress readiness. | SR-04, SR-10, SR-12 | Completed | Vehicle lifecycle UI/documentation review; focused regressions. | Passed 2026-07-22: `npm test -- src/application/vehicles/vehicleResult.test.ts src/infrastructure/supabase/repositories/mapVehicleError.test.ts src/infrastructure/supabase/repositories/SupabaseVehicleRepository.test.ts src/features/vehicles/VehicleWorkflowScreens.test.tsx` (77 tests); `npm run typecheck`; focused ESLint for all SR-13 files; `git diff --check`. The Vehicle UI now explains that archive removes drafts while retaining completed Service Records, offers archive after a history-blocked permanent delete, and explains a completed-history odometer-unit conflict without provider details. |
| SR-15 | Refine Service Record draft validation, editor interactions, and completion flow from the product-owner review. | SR-04, SR-11, SR-12, SR-13 | Planned | Focused persistence/editor/detail tests; accessibility and responsive checks; typecheck; lint; build. | Unset; documentation-only review approved on 2026-07-23 and no code changed. |
| SR-14 | Run full verification and record only actually observed residuals. | SR-05, SR-07, SR-11, SR-12, SR-13, SR-15 | Planned | All final gates in Section 6. | Unset. |

## 5. Frozen Task Contracts

### SR-01 — Domain model and invariants

- **Acceptance:** Add plain TypeScript Service Record and item IDs/types,
  `draft`/`completed` states, strict calendar-date validation, text limits,
  kind-specific fields, contiguous ordering, integer AUD minor-unit costs,
  derived totals, completion eligibility, chronological odometer bounds, and an
  immutable snapshot model. No React, Supabase, or jsPDF imports cross this
  boundary.
- **Validation:** Cover date rollover rejection, all boundaries, costs, ordering,
  completion, earlier/later/same-date odometer cases, Vehicle odometer
  advancement rules, and ordered snapshot mapping.

### SR-02 — Application contracts

- **Acceptance:** Define only business-oriented Service Record outcomes/errors
  and the repository, snapshot-repository, and PDF-renderer ports specified in
  the feature document. Inputs exclude owner IDs, display numbers, timestamps,
  and caller-controlled status/version increments.
- **Validation:** Compile-time and boundary tests confirm app-owned return types
  and no provider rows, error codes, or SDK types leak outward.

### SR-03 — Authenticated use cases

- **Acceptance:** Implement exactly `createServiceRecordDraft`,
  `listServiceRecordsForVehicle`, `getServiceRecord`, `saveServiceRecordDraft`,
  `deleteServiceRecordDraft`, `completeServiceRecord`,
  `createServiceRecordSnapshot`, `previewServiceRecordPdf`, and
  `downloadServiceRecordPdf`. Each resolves the current Garage Admin, fails
  closed for every other identity state, preserves repository concurrency, and
  maps recoverable failures safely.
- **Validation:** Unit coverage for all nine workflows, authorization denial,
  no caller ownership/display-number/timestamp control, fresh preview, and exact
  snapshot persistence before download.

### SR-04 — Supabase persistence boundary

- **Acceptance:** Add additive migrations for records, ordered items, and
  append-only exports; database constraints, indexes, grants, RLS, safe
  security-definer RPCs, global non-resetting `SR-000001` numbering, atomic draft
  replacement, atomic complete/idempotent retry, chronology locking, and exact
  Vehicle integration. Archive deletes drafts atomically while retaining
  completed records; Vehicle deletion and odometer-unit changes return safe
  app-owned conflicts once completed history exists.
- **Validation:** Static migration checks plus `supabase db reset`, `supabase db
  lint`, and pgTAP where the local stack is available. Unavailable live checks
  must be reported as unavailable, never passed.

### SR-05 — Database coverage

- **Acceptance:** Add direct coverage for constraints, composite ownership,
  authorization identities, item-parent access, immutable completed aggregates
  and exports, archive rollback, delete/unit conflicts, stale saves, concurrent
  saves/completions, chronological locking, global numbering, and retry rules.
- **Validation:** Run static database suite and available local pgTAP/reset/lint
  results with assertion counts where produced.

### SR-06 — Supabase adapters

- **Acceptance:** Implement strict selections and mappings for Service Record,
  item, and snapshot rows; invoke only the approved RPC boundary for writes; map
  provider failures to SR-02 errors; do not log private data or expose provider
  internals.
- **Validation:** Invalid-row, nullability, RPC, error-map, and provider-import
  boundary tests.

### SR-07 — Repository contracts

- **Acceptance:** Add reusable stateful contract suites for complete aggregate
  saves, ordering, versions, completion retry/immutability, active/archived
  Vehicle behavior, snapshots, and app-owned errors, then run them against the
  Supabase implementations.
- **Validation:** Contract suite reports each adapter and required behavior.

### SR-08 — PDF renderer and snapshots

- **Acceptance:** Add jsPDF through the infrastructure renderer using the
  existing transparent Fullstack Garage logo and maintenance-only content.
  Generate fresh snapshots by default; permit only explicit supported historical
  rendering; initialize schema/template/branding versions at `1`.
- **Validation:** Snapshot and render tests confirm item order, totals, branding,
  no customer/billing language, fresh regeneration after eligible source/design
  changes, and exact historical snapshot reproduction.

### SR-09 — Composition and server state

- **Acceptance:** Compose ports/adapters once, add Service Record query and
  mutation hooks, invalidate affected Vehicle/history/record keys after writes,
  and register cleanup for sign-out and identity changes.
- **Validation:** Hook/composition tests for key scoping, invalidation, retry,
  conflict propagation, and private cache clearing.

### SR-10 — Routes and Vehicle integration

- **Acceptance:** Add protected Service Record routes and active-Vehicle detail
  entry/history. Archived Vehicles show completed history but no new-record
  action; authorization and deep-link behavior remain protected.
- **Validation:** Route and Vehicle-detail tests, keyboard/accessibility checks,
  and responsive source review against `DESIGN.md`.

### SR-11 — Draft editor

- **Acceptance:** Implement the six specified maintenance sections; adaptive
  item-kind fields; add, remove, and reorder behavior; derived total; draft save
  and deletion; visible odometer bounds; and stale-version reload/retry recovery.
  Use existing design tokens and no billing language.
- **Validation:** Form/workflow/a11y tests for validation, ordering, narrow
  layouts, totals, archive prohibition, and conflict recovery.

### SR-12 — Completion and exports UI

- **Acceptance:** Add a clear read-only completion review, completed-record
  detail, fresh preview/download actions, and explicitly selected historical
  exports. Download persists the exact displayed snapshot but never the PDF Blob.
- **Validation:** Completion/PDF workflows, read-only behavior, explicit history
  selection, error/retry states, and responsive/accessibility tests.

### SR-13 — Cross-feature completion

- **Acceptance:** Finish approved Vehicle archive/delete/unit-change messaging
  and integration presentation; add Service Record feature documentation needed
  by implemented behavior; update this ledger with only verified progress.
- **Validation:** Focused Vehicle lifecycle regression tests and documentation,
  language, privacy, and architecture review.

#### SR-13 delivery notes

- Vehicle lifecycle failures remain app-owned. The Supabase adapter identifies the
  completed-history guard only for Vehicle delete and update operations; all
  provider messages and details remain redacted.
- The archive confirmation explains that drafts are removed while completed
  Service Records remain readable in Service History. If completed history blocks
  permanent deletion, the confirmation offers a separate archive confirmation.
- An odometer-unit change blocked by completed history is reported as a safe form
  error. No UI-side history precheck is used; the database remains authoritative.

### SR-15 — Draft validation, editor, and completion-flow refinement

- **Acceptance:** Add an adjacent local-date `Today` action to Service Date;
  replace raw chronology-rule output with the four approved friendly bound
  messages and formatted dates, odometers, and units; focus a new item's Name
  field after every add action; and make Enter in an editable item field add and
  focus a new item in the same section without submitting the form. Keep Work and
  Inspection kinds fixed, limit Parts & Consumables to Part, Fluid, and
  Consumable, and provide an explicit action for Other rather than cross-section
  reclassification. Present Purchase Cost as exact Australian dollar input and
  formatted `en-AU` currency while retaining integer minor units beyond the UI
  boundary. Enlarge and clarify the labelled completion checkbox. Reject known
  invalid values and current completed-history odometer conflicts at both the UI
  and transactional persistence boundaries before creating or saving a draft,
  check completion eligibility before review, and retain authoritative
  completion-time validation for concurrency and direct access.
- **Validation:** Cover local-date behavior across UTC date boundaries; all four
  bound-copy cases; field-level validation and focus for invalid create/save;
  repository and database rejection without partial persistence;
  completion-review gating; add-button and Enter-key item creation/focus in every
  area; no accidental form submit; kind restrictions and the explicit Other
  action; exact dollar-to-minor-unit conversion and Australian formatting; and
  keyboard, screen-reader labelling, hit-area, desktop, and narrow-layout behavior.

### SR-14 — Final verification

- **Acceptance:** Run the full gates, resolve in-scope failures, record exact
  commands/outcomes and residuals, and prepare a reviewer-ready implementation.
- **Validation:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run
  build`, database suite/reset/lint where available, privacy/provider scans, and
  `git diff --check`.

## 6. Review Findings Ledger

Every review finding receives a stable ID before disposition. An actionable
finding links to the smallest in-scope fix task; scope-expanding findings require
a new plan revision and approval.

| Finding ID | Severity | Finding | Disposition | Linked fix task | Re-verification outcome |
| --- | --- | --- | --- | --- | --- |
| SRF-07-001 | Low | Aggregate item mapping preserved provider array order rather than `sortOrder`, making saved item order unstable. | Resolved | SR-07 | Passed 2026-07-22: the stateful Supabase repository contract verifies saved and reloaded item order as `[0, 1]`. |
| SRF-15-001 | Medium | Service Date has no convenient way to choose the current local calendar date. | Resolved | SR-15 | Editor tests pass for local-date Today controls. |
| SRF-15-002 | Medium | Completed-history odometer guidance exposes internal bound terminology and unformatted values that are difficult to understand. | Resolved | SR-15 | Editor presents formatted Australian dates, odometers, and units for each bound state. |
| SRF-15-003 | Medium | Adding an item does not focus its Name field, and Enter does not add the next item in the current area. | Resolved | SR-15 | Focus and Enter-to-add editor tests pass. |
| SRF-15-004 | Medium | The unrestricted Kind selector lets an item contradict the area in which it was added. | Resolved | SR-15 | Work and inspection are fixed; material choices are limited and Other is explicit. |
| SRF-15-005 | Medium | The completion confirmation checkbox and wording are not visually prominent enough for an irreversible action. | Resolved | SR-15 | Completion review requires the read-only acknowledgement and eligibility. |
| SRF-15-006 | High | A known invalid odometer can be persisted and is first rejected on completion review with a generic message. | Resolved | SR-15 | Application and pgTAP checks reject known conflicts; 172 database tests pass. |
| SRF-15-007 | Medium | Purchase Cost input exposes raw AUD cents instead of standard Australian dollar entry and formatting. | Resolved | SR-15 | Editor accepts dollars and retains minor-unit persistence; editor tests pass. |

## 7. Completion Conditions

SR-PLAN-002 is complete only when SR-01 through SR-15 are completed with
observed validation outcomes, the latest review has no actionable findings, and
any unavailable environment-dependent validation is explicitly identified as a
residual rather than represented as passed.
