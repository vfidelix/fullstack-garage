# Service Record Feature

Status: Approved
Date: 2026-07-23
Architecture: [Fullstack Garage Architecture](../architecture/fullstack-garage-architecture.md)
Product: [Product Scope and Language](../product/fullstack-garage-product.md)
Related features: [Authentication and Access](authentication-access.md), [Vehicles](vehicles.md)

## 1. Purpose

The Service Record feature stores the maintenance history for a Vehicle. It
captures when and where maintenance occurred, the Vehicle odometer, who performed
the work, the work completed, inspection findings, parts and consumables used,
their actual Purchase Cost, notes, and the next recommended service.

A Service Record is a maintenance history document, not a commercial billing
document. It must provide the useful mechanical detail normally retained after a
garage visit without customer accounts, labour pricing, markups, commercial
totals, balances, or financial-settlement workflows.

Only the authenticated Garage Admin can create, view, edit, or complete Service
Records in the MVP. Friends whose Vehicles are serviced do not need accounts, and
the Service Record does not store their identity or real-world Vehicle ownership
data.

This document owns Service Record-specific scope, fields, lifecycle, business
rules, presentation behavior, and acceptance criteria. The architecture owns
cross-feature structural decisions, and the product document owns cross-feature
scope and language.

## 2. Feature Decisions

1. Every Service Record belongs to exactly one Vehicle.
2. Only the bootstrapped Garage Admin has Service Record access in the MVP.
3. Service Records have `draft` and `completed` states.
4. Drafts are editable. Completed records are read-only in the MVP so stored
   maintenance history cannot be silently rewritten.
5. Completing a record assigns one immutable Service Record display number in
   the global `SR-000001` sequence. The sequence never resets.
6. A Service Record and all its items form one aggregate and are saved in one
   transaction.
7. Work performed is stored as structured `work` items rather than as labour
   pricing.
8. Parts, fluids, and consumables may record their actual Purchase Cost. Purchase
   Cost is never presented as a charge to another person.
9. Inspection findings may be recorded without a Purchase Cost.
10. Item order is meaningful and must be preserved.
11. The MVP currency is fixed to `AUD` at Service Record level and inherited by
    all item costs.
12. The Total Parts & Consumables value is calculated from item Purchase Costs and
    is not persisted as mutable record data.
13. Draft saves and completion use optimistic concurrency through `version`,
    with a narrowly defined idempotent completion retry.
14. Archiving a Vehicle atomically deletes all its drafts and their items while
    preserving every completed Service Record.
15. Completed Service Records are not permanently deleted in the MVP.
16. PDF previews and downloads default to a fresh snapshot built from the latest
    permitted source data, branding, and template. Stored older snapshots never
    prevent regeneration.
17. Completed-record odometers must fit the chronological range established by
    the Vehicle's earlier and later completed Service Records.
18. Draft creation and save reject values that are already known to be invalid,
    including an odometer outside the current completed-history range. Completion
    repeats authoritative validation because history may change after a draft is
    saved.

## 3. Product Language and Record Boundary

Use maintenance language throughout the feature:

- Service Record
- Service Record Number
- Work Performed
- Parts & Consumables
- Purchase Cost
- Total Parts & Consumables
- Performed By
- Inspection Findings
- Recommendations
- Next Service Due

The feature must not contain commercial billing, customer balance, labour charge,
markup, settlement, or accounts-receivable concepts. The Garage Admin's actual
out-of-pocket Purchase Cost is useful maintenance context; it is not a selling
price or a sum owed by someone else.

## 4. MVP Scope

The MVP includes:

- Creating a draft Service Record for an active Vehicle.
- Deleting a draft Service Record.
- Listing a Vehicle's Service Record history.
- Viewing a complete Service Record.
- Editing and atomically saving a draft and its ordered items.
- Recording work performed, inspections, parts, fluids, consumables, and other
  maintenance details.
- Recording optional Purchase Costs for eligible items.
- Calculating Total Parts & Consumables.
- Completing a valid draft and assigning its Service Record number.
- Validating the Service Record odometer against completed history and advancing
  the Vehicle's current odometer without reducing it.
- Showing historical records for archived Vehicles.
- Previewing a freshly generated branded PDF.
- Creating a versioned snapshot and downloading a branded PDF.

The MVP does not include:

- Member accounts or member-specific Service Record behavior.
- Customer profiles, contact details, or real-world Vehicle owner information.
- Labour pricing, hourly rates, markups, or commercial financial workflows.
- Inventory, supplier catalogue, or purchase-order management.
- Images, attachments, scanned documents, or receipt storage.
- Automated maintenance schedules or reminders.
- Permanently deleting completed Service Records.
- Editing, reopening, or formally amending a completed Service Record.
- Persisting generated PDF files in object storage.
- Currency selection or multi-currency conversion.

## 5. Service Record Domain Model

A Service Record contains:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Application-owned `ServiceRecordId`. |
| `ownerId` | Yes | Garage Admin's stable app-owned authorization key; never form input. |
| `vehicleId` | Yes | References the Vehicle being serviced. |
| `displayNumber` | Completed only | Assigned once during completion as `SR-` followed by a zero-padded global sequence with at least six digits. |
| `status` | Yes | `draft` or `completed`. |
| `serviceDate` | Yes | Calendar date on which the maintenance occurred. |
| `odometer` | Yes | Non-negative whole number in the Vehicle's stored unit. |
| `performedBy` | No | Descriptive name; defaults to the Garage Admin display name; maximum 100 characters. |
| `location` | No | Private descriptive service location; maximum 200 characters. |
| `summary` | No | Concise overview of the maintenance; maximum 200 characters. |
| `notes` | No | Private record-level notes; maximum 2,000 characters. |
| `nextServiceDueDate` | No | Recommended next service date. |
| `nextServiceDueOdometer` | No | Recommended next odometer in the Vehicle's unit. |
| `currencyCode` | Yes | Fixed to the ISO 4217 code `AUD` in the MVP and used by every item Purchase Cost. |
| `items` | Yes | Ordered work, material, inspection, and other items. |
| `version` | Yes | Positive integer used for optimistic concurrency. |
| `createdAt` | Yes | System managed. |
| `updatedAt` | Yes | System managed. |
| `completedAt` | Completed only | Immutable system timestamp assigned by successful completion. |

Application input types must not accept `ownerId`, `displayNumber`, status,
version increments, or timestamps as caller-controlled values. The authenticated
workflow and transactional repository operations own those fields.

Use explicit status and item-kind unions:

```ts
export type ServiceRecordStatus = 'draft' | 'completed';

export type ServiceRecordItemKind =
  | 'work'
  | 'part'
  | 'fluid'
  | 'consumable'
  | 'inspection'
  | 'other';
```

`serviceDate` and `nextServiceDueDate` are ISO 8601 calendar-date strings in
`YYYY-MM-DD` form, not timestamps. Parsing and validation must reject normalized
or rollover values that are not real calendar dates. System-managed audit fields
remain timestamps.

## 6. Service Record Items

Every item contains:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Application-owned `ServiceRecordItemId`. |
| `kind` | Yes | One of the explicit `ServiceRecordItemKind` values. |
| `category` | No | Maintenance area such as engine, brakes, cooling, or tyres; maximum 50 characters. |
| `name` | Yes | Work, item, or inspection label after trimming; maximum 200 characters. |
| `brand` | No | Relevant for parts, fluids, and consumables; maximum 100 characters. |
| `specification` | No | Grade, size, standard, or technical specification; maximum 200 characters. |
| `partNumber` | No | Manufacturer or supplier part number; maximum 100 characters. |
| `supplier` | No | Descriptive supplier name; maximum 100 characters. |
| `quantity` | No | Positive decimal quantity. |
| `unit` | No | Unit such as `each`, `L`, or `mL`; maximum 20 characters. |
| `purchaseCostMinor` | No | Total actual Purchase Cost for the line in minor units. |
| `notes` | No | Work detail, inspection result, recommendation, or fitment note; maximum 1,000 characters. |
| `sortOrder` | Yes | Contiguous zero-based integer preserving display order. |

Kind-specific behavior:

- `work` records a maintenance action, such as replacing brake pads or changing
  engine oil. It has no Purchase Cost.
- `part`, `fluid`, and `consumable` record materials used and may include brand,
  specification, part number, supplier, quantity, unit, and Purchase Cost.
- `inspection` records a check and its result or recommendation. It has no
  Purchase Cost.
- `other` is a maintenance detail that does not fit another kind. It has no
  Purchase Cost; purchased materials use `part`, `fluid`, or `consumable`.

The record should use separate items when both work and materials are important.
For example, “Change engine oil” is a `work` item; the oil and filter are `fluid`
and `part` items.

Category entry uses suggested maintenance areas with custom text permitted. The
initial suggestions are engine, brakes, cooling, electrical, drivetrain,
suspension, steering, tyres, body, interior, and general. The stored value is the
trimmed text rather than a closed category union.

## 7. Purchase Cost and Totals

Purchase Costs are represented as non-negative integer AUD minor units. `7299`
represents `$72.99`. Floating-point currency values must not cross the domain or
repository boundary, and the MVP form does not expose a currency selector.

The presentation layer accepts Purchase Cost in Australian dollars, not as an
integer number of cents. The field is labelled `Purchase Cost (AUD)` and accepts
normal dollar input with up to two decimal places, such as `72.99`. It converts
that value exactly to `purchaseCostMinor` before crossing the domain boundary.
All editor totals, review details, completed records, and exports format money as
Australian currency, including the dollar symbol, thousands separators, and two
decimal places (for example, `$1,234.50`).

`purchaseCostMinor` is the total actual Purchase Cost for its line. Quantity is
descriptive and does not multiply the Purchase Cost automatically in the MVP.
This avoids ambiguity when only part of a purchased pack or fluid container was
used.

The domain calculates:

```text
Total Parts & Consumables = sum of every non-null item Purchase Cost
```

The total is derived when records are displayed or exported. It must not be stored
as a mutable column on `service_records`. A zero Purchase Cost remains distinct
from an unknown or unrecorded Purchase Cost.

## 8. Business Rules

- A new Service Record may be created only for an active Vehicle.
- Multiple drafts may exist for an active Vehicle because separate maintenance
  events can be prepared concurrently.
- A new draft starts at version `1`, with `AUD`, the current Garage Admin display
  name, an empty item set, and caller-supplied Service Date and odometer.
- Only drafts may be deleted directly.
- Archiving a Vehicle atomically deletes all its drafts and their items before
  completing the archive operation. Completed Service Records are retained.
- Historical Service Records remain readable when their Vehicle is archived.
- Service date is required.
- Odometer is required, non-negative, and a whole number.
- Draft creation and save validate the Service Date, odometer, field limits,
  entered item data, next-service values, and Purchase Costs before persistence.
  They also reject an odometer outside the completed-history bounds known at the
  time of the operation.
- A structurally valid but incomplete draft may still be saved. The
  completion-only requirement for a non-empty summary or at least one item is
  checked before the user can proceed to completion review.
- The Service Record inherits the Vehicle's odometer unit; the form does not
  select a different unit.
- `performedBy` defaults to the current Garage Admin's app-owned display name but
  remains descriptive maintenance data, not an authorization identity.
- A completed record must contain a non-empty summary or at least one item.
- Every item name is required after trimming.
- Record and item text must not exceed the field limits in Sections 5 and 6.
- Quantity, when present, must be greater than zero.
- Purchase Cost, when present, must be zero or greater and within the supported
  safe integer range.
- `work`, `inspection`, and `other` items must not contain a Purchase Cost.
- All item Purchase Costs inherit the record currency.
- Next service date, when supplied, must be after the service date.
- Next service odometer, when supplied, must be greater than the service
  odometer.
- Item `sortOrder` values must be exactly `0` through `items.length - 1` with no
  duplicates or gaps.
- Completion requires the expected current version.
- Completing a draft requires its exact current version and increments it once.
- Retrying completion against a completed record returns the existing result only
  when `expectedVersion` equals the completed version or the immediately
  preceding draft version. An older expected version returns a version conflict.
- An idempotent completion retry never allocates another display number or changes
  the Vehicle odometer.
- Completed records, display numbers, and their item sets are immutable in the
  MVP.
- Successful completion assigns the database timestamp to `completedAt` and the
  next global display number. Both values are immutable.

Completion validates odometer chronology against completed Service Records for
the same Vehicle. Drafts do not establish bounds. Let the lower bound be the
greatest odometer among completed records with a `serviceDate` earlier than the
candidate date, and let the upper bound be the smallest odometer among completed
records with a `serviceDate` later than the candidate date:

- The candidate odometer must be greater than or equal to the lower bound when
  one exists.
- The candidate odometer must be less than or equal to the upper bound when one
  exists.
- Records on the same calendar date do not constrain one another because the MVP
  does not capture a service time. Equality is valid at either bound.
- A latest-dated record has no upper bound. A record with no earlier completed
  history has no lower bound beyond the general non-negative rule.

Completion advances `Vehicle.currentOdometer` to the Service Record odometer only
when it is greater than the stored Vehicle value or the stored value is absent.
It never reduces the Vehicle value. The chronological bounds are checked again
inside the completion transaction so a concurrent completion cannot create an
invalid history.

## 9. Lifecycle and Application Use Cases

The primary flow is:

1. The Garage Admin selects an active Vehicle.
2. `createServiceRecordDraft` creates a version `1` draft, or the Garage Admin
   opens an existing draft for that Vehicle.
3. The Garage Admin enters service details and ordered items.
4. The editor validates all entered values and the current completed-history
   odometer bounds. It keeps the user in the editor, highlights each invalid
   field, and explains how to correct it when validation fails.
5. `saveServiceRecordDraft` atomically saves the valid header and complete current
   item set using the expected version.
6. The application displays the derived Total Parts & Consumables.
7. Before opening completion review, the application validates completion
   eligibility and returns the user to the relevant editor fields when the draft
   is incomplete or invalid.
8. `completeServiceRecord` validates the aggregate and chronological odometer
   bounds, assigns the display number and completion timestamp, preserves item
   order, and advances the Vehicle odometer when required in one transaction.
9. The completed record appears in the Vehicle Service History and may be
   downloaded as a branded PDF.

The application layer should expose:

- `createServiceRecordDraft`
- `listServiceRecordsForVehicle`
- `getServiceRecord`
- `saveServiceRecordDraft`
- `deleteServiceRecordDraft`
- `completeServiceRecord`
- `createServiceRecordSnapshot`
- `previewServiceRecordPdf`
- `downloadServiceRecordPdf`

Use cases obtain the current Garage Admin from the application authentication
workflow. They do not accept caller-provided owner IDs, roles, display numbers, or
version increments.

## 10. Repository and Renderer Ports

The repository stays business-oriented:

```ts
export interface ServiceRecordRepository {
  getById(id: ServiceRecordId): Promise<ServiceRecord | null>;
  listForVehicle(vehicleId: VehicleId): Promise<ServiceRecordSummary[]>;
  createDraft(input: CreateServiceRecordDraft): Promise<ServiceRecord>;
  saveDraft(input: SaveServiceRecordDraft): Promise<ServiceRecord>;
  deleteDraft(id: ServiceRecordId, expectedVersion: number): Promise<void>;
  complete(id: ServiceRecordId, expectedVersion: number): Promise<ServiceRecord>;
}
```

`SaveServiceRecordDraft` contains the expected current version and the entire
ordered item set. The repository must return app-owned models and errors rather
than Supabase rows, query builders, RPC payloads, or database error codes.

PDF rendering uses a separate provider-neutral port:

```ts
export interface ServiceRecordPdfRenderer {
  render(snapshot: ServiceRecordSnapshot): Promise<Blob>;
}
```

Stored snapshot access also remains provider-neutral:

```ts
export interface ServiceRecordSnapshotRepository {
  getById(id: ServiceRecordSnapshotId): Promise<ServiceRecordSnapshot | null>;
  listForRecord(id: ServiceRecordId): Promise<ServiceRecordSnapshotSummary[]>;
  save(snapshot: ServiceRecordSnapshot): Promise<ServiceRecordSnapshot>;
}
```

Previewing a fresh snapshot does not require persisting it. Downloading persists
the exact snapshot used for the file, but persistence never forces a subsequent
preview or download to reuse that snapshot.

The composition root selects the Supabase repository and client-side PDF renderer
for the MVP. Feature code must not select adapters or inspect provider settings.

## 11. Persistence and Transaction Boundaries

The architecture's `service_records` table stores:

- The app-owned owner and Vehicle relationship.
- Draft or completed status.
- Service date, odometer, performer, location, summary, and notes.
- Next-service recommendations.
- Record-level currency.
- Immutable display number after completion.
- Optimistic concurrency version, system timestamps, and immutable completion
  timestamp.

The `service_items` table stores the ordered item set. Its `kind` constraint must
include `work`, `part`, `fluid`, `consumable`, `inspection`, and `other`.

Persistence requires:

- A composite foreign key from `(vehicle_id, owner_id)` to
  `vehicles(id, owner_id)`.
- A unique constraint on `(owner_id, display_number)` when a display number is
  present.
- A database-managed global sequence that formats values as `SR-` plus at least
  six zero-padded digits and never resets.
- An index supporting Vehicle history ordered by service date descending,
  odometer descending, completion time descending, and ID descending.
- Constraints for status, `AUD` currency, approved text lengths, non-negative
  odometers, positive versions, non-negative Purchase Costs, positive quantities,
  and non-negative item ordering.
- A unique constraint on `(service_record_id, sort_order)`.
- Atomic replacement of the exact draft item set while completed records and
  their items remain immutable.

Draft creation must validate the required Service Date and odometer, including
the completed-history range known in the same transaction, before inserting a
record. It must not persist a draft and then report that its initial values were
invalid.

`saveDraft` must execute as one PostgreSQL function called through the Supabase
adapter. It resolves the current Garage Admin, verifies the Vehicle is active,
checks the expected version, validates the aggregate and the completed-history
odometer range in the transaction, saves the record and exact contiguous item
set, increments the version, and returns the updated app-owned aggregate.

`complete` must lock the draft, resolve and verify Garage Admin authorization,
check the expected version, lock the Vehicle's relevant completed history,
validate the chronological odometer bounds and all completion rules, allocate the
display number and completion timestamp, mark the aggregate completed, increment
the version, and advance the Vehicle odometer when required in the same
transaction. The approved idempotent retry rules in Section 8 apply before any
new number or side effect is allocated.

The Vehicle archive operation must atomically delete every draft Service Record
for that Vehicle, rely on child deletion for their draft items, and archive the
Vehicle while retaining completed records and their items. A transaction failure
must leave the Vehicle and all drafts unchanged.

Downloaded snapshots are append-only rows in `service_record_exports`. Each row
stores its app-owned ID and ownership relationships, the source Service Record ID
and version, immutable snapshot JSON, schema version, template version, branding
version, creating app-user ID, and creation timestamp. The generated PDF Blob is
not persisted. Snapshot rows cannot be updated or deleted in the MVP.

## 12. Authorization, Privacy, and Errors

- Every operation requires the current Garage Admin established by the
  Authentication and Access feature.
- RLS permits the Garage Admin to manage every Service Record and its items.
- A mapped non-admin, an unmapped authenticated identity, and an unauthenticated
  user receive no Service Record data.
- Item access is authorized through the parent Service Record.
- Callers cannot choose an owner ID, role, or display number.
- Security-definer functions use a fixed safe search path and minimum privileges.
- Service location, Vehicle registration and VIN, odometer, notes, supplier, part
  number, and Purchase Cost are private data and are excluded from logs and
  analytics by default.
- Raw Supabase errors, table names, function names, and provider payloads must not
  reach feature code or the UI.

Infrastructure failures map to app-owned outcomes including not found,
unauthorized, validation, version conflict, inactive Vehicle, record not editable,
odometer history conflict, and temporarily unavailable. The UI must offer safe
reload and retry paths for recoverable failures.

## 13. Presentation Behavior

The editor is organized into clear maintenance sections:

1. Vehicle and Service Details
2. Work Performed
3. Parts & Consumables
4. Inspections and Recommendations
5. Next Service Due
6. Notes

Presentation requirements:

- The selected Vehicle identity and odometer unit remain visible while editing.
- Draft and completed states use compact status badges.
- The Service Date field has a small adjacent `Today` button. Activating it sets
  the field to the current calendar date in the user's local time zone without
  submitting or saving the form.
- The item editor supports add, edit, remove, and reorder actions for drafts.
- Adding an item immediately moves keyboard focus to that new item's Name field.
- Pressing Enter in any editable item field adds a new item to the same section,
  preserves the current item, and moves focus to the new Name field. It never
  saves or submits the Service Record. Multiline fields retain their normal
  newline behavior, and record-level fields do not create an arbitrary item.
- An item's kind remains consistent with the area where it was added. Work items
  are fixed to `work`, and inspection items are fixed to `inspection`; neither
  exposes a Kind selector. Parts & Consumables may offer only `part`, `fluid`, and
  `consumable` as a `Type` choice. An `other` item must use its own explicitly
  labelled add action rather than being reached by reclassifying an item from a
  different area.
- Item fields adapt to their permitted kind so irrelevant cost or part fields are
  not shown.
- Purchase Cost is entered and displayed as Australian dollars, never as a raw
  cents value. The UI converts between dollar input and integer minor-unit domain
  values without floating-point rounding.
- Total Parts & Consumables is visible near the item list and completion action.
- Completion presents a clear review step and warns that the record becomes
  read-only.
- The completion confirmation uses a clearly visible checkbox of at least 24 by
  24 CSS pixels inside a labelled hit area of at least 44 by 44 CSS pixels. The
  whole label is clickable and states: `I have reviewed these details and
  understand this Service Record will become read-only.`
- The editor shows the nearest earlier and later completed Service Record dates
  and odometers as the permitted range. It uses user-facing dates, the Vehicle's
  odometer unit, and Australian number formatting (for example, `27 July 2026`
  and `351,000 km`); it never exposes internal wording such as `no earlier bound`
  or a semicolon-delimited rule dump. The copy uses these cases:
  - Both bounds: `Enter between {lower} and {upper} {unit}. The previous completed
    Service Record was {lower} {unit} on {earlierDate}; the next is {upper} {unit}
    on {laterDate}.`
  - Earlier bound only: `Enter {lower} {unit} or higher. The previous completed
    Service Record was {lower} {unit} on {earlierDate}.`
  - Later bound only: `Enter up to {upper} {unit}. The next completed Service
    Record is {upper} {unit} on {laterDate}.`
  - No bounds: `No completed Service Records limit the odometer for this date.`
- An out-of-range value blocks draft creation/save and completion with a direct,
  field-level explanation of the violated bound. If an already-saved draft becomes
  invalid because completed history changed, completion review provides an Edit
  Service Record action and does not rely only on a generic validation alert.
- Completed records emphasize maintenance history and technical details rather
  than financial totals.
- Archived Vehicles expose their history but do not offer a new-record action.
- Vehicle archival warns that all drafts for that Vehicle will be permanently
  deleted while completed history will remain.
- A completed record offers PDF preview and download actions. Preview creates a
  fresh in-memory snapshot using the current Vehicle details, branding, and PDF
  template, then renders the same document that will be downloaded if the Garage
  Admin proceeds without requesting a refresh.
- Previous snapshots may be rendered for historical reproduction, but the
  default preview and download actions always offer fresh generation.
- On narrow screens, item rows collapse into readable stacked sections while
  retaining their order and primary actions.

UI implementation must use tokens from `src/styles/global.css` and follow
`DESIGN.md`: near-black and light editorial surfaces, sharp card and button
geometry, the named spacing ladder, FerrariSans typography, and scarce Rosso
Corsa reserved for the primary action. Lucide icons accompany icon-only actions.

## 14. PDF Preview, Snapshot, and Download

Only a completed Service Record may be previewed or downloaded as the canonical
branded PDF. A fresh preview converts the immutable completed aggregate, the
latest accessible Vehicle descriptive data, and the current branding and template
versions into an in-memory `ServiceRecordSnapshot` before rendering.

The snapshot contains:

- Snapshot UUID, snapshot schema version, PDF template version, and branding
  version.
- Service Record UUID, display number, status, and record version.
- Service and generation dates.
- Vehicle make, model, year, registration, registration state, VIN, engine, and
  odometer unit as available at generation time.
- Service odometer, performer, location, summary, notes, and next-service details.
- Ordered work, material, inspection, and other items.
- Each recorded Purchase Cost, derived Total Parts & Consumables, and currency.
- Creating app-user ID and generation timestamp.

The PDF title and number identify it as a Service Record. It uses maintenance
language and does not present customer identity, labour pricing, commercial
totals, balances, or settlement instructions.

Preview renders the fresh snapshot in the browser without persisting it. Download
persists the exact previewed snapshot as an immutable historical export and then
downloads the client-rendered PDF without storing the file. A direct download
without an existing preview first creates and persists a fresh snapshot.
Requesting a new preview or download creates a new snapshot from the latest
permitted source data, current branding, and current template; an older snapshot
is never selected implicitly and never blocks regeneration.

Stored snapshots preserve what a previous download contained. When its recorded
template and branding versions remain supported, the user may explicitly render
a stored snapshot to reproduce that historical document. Regenerating with a new
logo, design, current Vehicle details, or a future permitted Service Record
version creates a new snapshot and leaves the older snapshot unchanged. In the
MVP, completed Service Record fields themselves remain immutable; correcting them
depends on the deferred amendment model.

## 15. Verification Strategy

Unit tests should cover:

- Required service date and odometer validation.
- Local-date behavior of the Service Date `Today` action.
- Strict ISO 8601 `YYYY-MM-DD` calendar-date parsing.
- Approved record and item field-length boundaries.
- Draft and completed state rules.
- Completion requiring a summary or item.
- Item-kind narrowing and kind-specific Purchase Cost rules.
- Item name, quantity, cost, and ordering validation.
- Integer minor-unit Purchase Cost totals.
- Australian dollar input parsing, exact minor-unit conversion, and `en-AU`
  currency formatting throughout the editor, review, detail, and export views.
- Same-section Enter-to-add behavior, focus placement after every add action, and
  prevention of accidental form submission.
- Section-consistent item kinds, including the restricted Parts & Consumables
  `Type` options and the explicit `other` action.
- Friendly earlier-only, later-only, both-bound, and no-bound odometer guidance.
- Draft create/save rejection of known invalid values and chronology conflicts,
  plus pre-review completion-eligibility validation.
- Next-service date and odometer validation.
- Earlier-only, later-only, bounded backdated, equal-bound, same-date, and
  out-of-range odometer chronology cases.
- Vehicle odometer advancement without reduction.
- Snapshot mapping and preservation of item order.
- Fresh snapshot selection and explicit historical snapshot rendering.

Repository contract tests should cover:

- Draft creation and updates with the complete aggregate, including rejection of
  invalid initial values and completed-history odometer conflicts before
  persistence.
- Draft deletion and atomic draft cleanup during Vehicle archival.
- Atomic replacement of ordered items.
- Version increments and stale-version conflicts.
- Completion validation and display-number allocation.
- Global non-resetting display-number allocation.
- Accepted immediately preceding/current-version completion retries and rejected
  older-version retries.
- Completed-record immutability.
- Completion timestamp immutability.
- Concurrent chronological odometer validation.
- Append-only snapshot persistence and fresh regeneration after branding,
  template, or Vehicle-detail changes.
- Active-Vehicle creation rules and archived-Vehicle history reads.
- Garage Admin access and app-owned error mapping.

RLS and database integration tests must exercise the Garage Admin, a mapped
non-admin identity, an authenticated but unmapped identity where supported, and
an unauthenticated user. They must also test transaction rollback, concurrent
draft saves, concurrent completion, composite Vehicle ownership, and item access
through the parent record.

End-to-end coverage should create a Vehicle, save and refresh a draft, add and
reorder items, observe a stale-version conflict, complete the record, verify it in
Vehicle Service History, preview and download the PDF, change an eligible Vehicle
detail or PDF design version, and generate a fresh snapshot. A separate flow must
archive a Vehicle with drafts and completed history, then verify that the drafts
were deleted and completed history remains readable.

The editor flow should additionally verify the local-date shortcut, friendly
odometer-bound copy, draft validation before persistence, section-consistent item
types, add-button and Enter-key focus behavior, Australian dollar input, and the
accessible completion confirmation control on desktop and narrow viewports.

## 16. Acceptance Criteria

- The Garage Admin can create a draft for an active Vehicle.
- The Garage Admin can delete a draft, and archiving its Vehicle atomically
  deletes all remaining drafts without deleting completed history.
- A draft atomically persists its details and complete ordered item set.
- Draft creation and save reject invalid entered data and currently known
  completed-history odometer conflicts before persistence; completion repeats the
  authoritative checks.
- The editor offers a local-date `Today` action and presents completed-history
  odometer guidance in plain language with formatted values and units.
- Add actions and Enter within an item area create the correct same-section item
  and focus its Name field; item kinds cannot be changed to a kind belonging to a
  different area.
- Work performed, materials used, inspections, recommendations, and next-service
  information can be represented without commercial billing concepts.
- Eligible item Purchase Costs use integer minor units and produce the correct
  Total Parts & Consumables.
- Users enter and see Purchase Costs as standard Australian dollar values rather
  than raw cents.
- The UI never presents Purchase Cost as money owed by another person.
- Stale updates return an app-owned conflict without overwriting newer data.
- Completing a valid draft assigns one stable global `SR-000001`-style Service
  Record number and immutable completion timestamp.
- Completion applies the approved version-specific idempotency rule, and
  completed records are read-only.
- Completion review is reachable only for a completion-eligible draft and uses a
  prominent, fully labelled confirmation checkbox with an accessible hit area.
- A completed Service Record odometer falls within its earlier and later
  completed-history bounds, and completion never reduces the Vehicle odometer.
- Archived Vehicle history remains readable, but new records require an active
  Vehicle.
- The Garage Admin can access every Service Record through server-enforced
  authorization; every other identity state is denied.
- Sign-out and identity changes clear cached Service Record data.
- A completed Service Record can be freshly previewed and downloaded with current
  source data, branding, and design without being forced to use an older snapshot.
- Each download stores an immutable versioned snapshot without persisting the PDF
  file, and stored snapshots remain available for explicit historical rendering.
- Feature, domain, and application code remain independent of Supabase types and
  provider errors.

## 17. Deferred Decisions

The following decisions are outside the MVP and do not block implementation:

1. Whether location should default from a Garage Admin profile setting.
2. The amendment model for correcting a completed Service Record while preserving
   a visible audit history.
3. Whether a future release supports currencies other than `AUD` and how it
   handles currencies with different minor-unit conventions.
4. How long historical PDF template and branding versions remain renderable.

## 18. Review History

Append a new row for every approved update. Existing review entries must remain
unchanged so the decision history is preserved.

| Date | Status | Reviewed by | Summary |
| --- | --- | --- | --- |
| 2026-07-19 | Approved | Product owner | Approved the MVP Service Record design for structured maintenance history, Purchase Costs, atomic drafts, immutable completion, and branded PDF snapshots. |
| 2026-07-22 | Approved | Product owner | Resolved draft archival cleanup, completion retry concurrency, chronological odometer validation, display numbering, field limits, AUD-only costs, completion timestamps, ISO 8601 dates, and fresh versus historical PDF generation. |
| 2026-07-23 | Approved | Product owner | Clarified the Service Date shortcut, friendly odometer guidance, item creation focus and Enter behavior, section-consistent kinds, completion confirmation prominence, validation before persistence and review, and Australian dollar input/display. |
