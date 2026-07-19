# Vehicle Feature

Status: Draft
Date: 2026-07-19
Architecture: [Fullstack Garage Architecture](../architecture/fullstack-garage-architecture.md)
Product: [Product Scope and Language](../product/fullstack-garage-product.md)
Related features: [Authentication and Access](authentication-access.md), [Service Records](service-records.md)

## 1. Purpose

The Vehicle feature lets the authenticated Garage Admin manage every Vehicle
serviced by the garage. A Vehicle is the ownership and history anchor for the
Service Record feature: a Service Record cannot exist without an accessible
Vehicle.

For the MVP, Fullstack Garage represents a mechanic-operated personal garage. The
Garage Admin may record work performed on their own Vehicles and on friends'
Vehicles. Friends do not need application accounts, and the application does not
store their identity or real-world Vehicle ownership details.

This document owns Vehicle-specific scope, fields, lifecycle, business rules,
presentation behavior, and acceptance criteria. The architecture owns
cross-feature structural decisions, and the product document owns cross-feature
scope and language.

## 2. Agreed Decisions

1. Each Vehicle records its odometer unit as either kilometres or miles.
2. A Vehicle without Service Records may be permanently deleted.
3. A Vehicle with Service Records must be archived instead of deleted.
4. Archived Vehicles remain available to historical Service Records but are
   excluded from normal Vehicle selection.
5. An archived Vehicle may be restored.
6. Authentication, application-user provisioning, roles, and session behavior
   are owned by the Authentication and Access feature.
7. Only the bootstrapped Garage Admin has application access in the MVP.
8. The Garage Admin may manage all Vehicles and Service Records.
9. Member accounts and member-specific behavior are outside the MVP.
10. The application does not store a Vehicle's legal or real-world owner.
11. Friends without accounts have no application access in the MVP.

## 3. Operating Model

| Actor | Vehicle access | Service Record access |
| --- | --- | --- |
| Garage Admin | Manage all Vehicles | Manage all Service Records |
| Friend without an account | No application access | No application access |
| Unauthenticated or unauthorized identity | No application access | No application access |

The Garage Admin is the mechanic and operator of this Fullstack Garage instance.
The database `owner_id` remains the application-owned authorization and data
relationship required by the architecture; it is not real-world ownership data
and is never entered through a Vehicle form. Every Vehicle created in the MVP uses
the Garage Admin's stable `AppUserId` as `owner_id`.

This is a single-garage authorization model. Multi-garage tenancy and business
accounts remain outside the MVP.

## 4. MVP Scope

The MVP includes:

- Listing all active Vehicles for the Garage Admin.
- Creating a Vehicle.
- Viewing and editing a Vehicle.
- Permanently deleting a Vehicle that has no Service Records.
- Archiving and restoring a Vehicle.
- Viewing archived Vehicles separately from the active list.
- Supplying an active Vehicle selection to the Service Record workflow.

The MVP does not include:

- Shared or jointly owned Vehicles.
- Fleet or business account management.
- Legal or real-world Vehicle owner data.
- Customer profiles, contact management, member accounts, or friend login access.
- Vehicle data lookup by registration or VIN.
- Odometer conversion between kilometres and miles.
- Vehicle images, documents, or receipt storage.
- Automated service reminders.

## 5. Domain Model

A Vehicle contains:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Application-owned `VehicleId`. |
| `ownerId` | Yes | Stable app-owned authorization key derived from the Garage Admin identity. |
| `make` | Yes | Trimmed, non-empty text. |
| `model` | Yes | Trimmed, non-empty text. |
| `year` | No | Must be within the configured supported range. |
| `registration` | No | Private data; not globally unique. |
| `vin` | No | Private data; not globally unique. |
| `currentOdometer` | No | A non-negative whole number. |
| `odometerUnit` | Yes | `km` or `mi`. |
| `engine` | No | Free-text engine description. |
| `notes` | No | Private free text. |
| `archivedAt` | No | When present, the Vehicle is archived. |
| `createdAt` | Yes | System managed. |
| `updatedAt` | Yes | System managed. |

Normal application input types must not accept `ownerId`, timestamps, or archival
state from forms. Those values are set by the authenticated workflow or the
repository. Any future reassignment workflow must be a separate, explicit use
case.

The domain should use an explicit union for the unit rather than an unrestricted
string:

```ts
export type OdometerUnit = 'km' | 'mi';
```

## 6. Business Rules

- Make and model are required after trimming whitespace.
- Current odometer, when supplied, must be zero or greater and contain no
  fractional value.
- Registration and VIN are optional and are not uniqueness keys.
- Vehicle access requires the authenticated Garage Admin established by the
  Authentication and Access feature.
- The Garage Admin may manage every Vehicle.
- Archiving does not remove or alter Service Records.
- Permanent deletion succeeds only when the Vehicle has no Service Records.
- A Vehicle must be active before a new Service Record can be created for it.
- Historical Service Records remain readable when their Vehicle is archived.
- Changing the odometer unit after Service Records exist is not allowed because
  it would change the meaning of historical readings. No automatic unit
  conversion is performed.
- A Service Record odometer must not silently reduce `currentOdometer`. The
  Service Record workflow will define the confirmation and update behavior.

## 7. Application Use Cases

The application layer should expose business workflows rather than database
operations:

- `listActiveVehicles`
- `listArchivedVehicles`
- `getVehicle`
- `createVehicle`
- `updateVehicle`
- `archiveVehicle`
- `restoreVehicle`
- `deleteVehicle`

`deleteVehicle` must return an app-owned conflict error when Service Records
exist. The UI can then offer archiving without interpreting a database foreign-key
or Supabase error.

Use cases obtain the current app-owned user from the application authentication
workflow. Owner IDs must not be accepted as untrusted authorization input.

## 8. Repository Port

The exact TypeScript types will be finalized during implementation, but the port
should have this business-oriented shape:

```ts
export interface VehicleRepository {
  listActive(): Promise<VehicleSummary[]>;
  listArchived(): Promise<VehicleSummary[]>;
  getById(id: VehicleId): Promise<Vehicle | null>;
  create(input: CreateVehicle): Promise<Vehicle>;
  update(id: VehicleId, input: UpdateVehicle): Promise<Vehicle>;
  archive(id: VehicleId): Promise<Vehicle>;
  restore(id: VehicleId): Promise<Vehicle>;
  delete(id: VehicleId): Promise<void>;
}
```

The repository returns application-owned models and errors. It must not expose
Supabase rows, query builders, error codes, table names, or arbitrary database
filters. List and mutation results contain the Vehicles authorized for the Garage
Admin by server-enforced policies.

## 9. Persistence

The Authentication and Access feature owns the `app_users`, `user_identities`,
role, and Garage Admin provisioning schema. The Vehicle feature depends only on
the stable app-owned `AppUserId` that authentication supplies.

The `vehicles` table defined by the architecture requires these additions:

- `odometer_unit text not null default 'km'`
- `archived_at timestamptz`
- A check constraint limiting `odometer_unit` to `km` or `mi`.

The table also requires:

- A non-negative check constraint for `current_odometer`.
- An index on `owner_id` for owner-scoped lists.
- An index that supports active owner-scoped lists, where `archived_at` is null.
- A uniqueness constraint on `(id, owner_id)` so Service Records can use the
  architecture's composite foreign key.

Deletion must be rejected when related Service Records exist. The foreign key
must not cascade from a Vehicle to its Service Records.

Database schema, constraints, indexes, and RLS policies must be introduced in a
versioned Supabase migration.

## 10. Authorization and Privacy

- Every repository operation requires the current Garage Admin identity supplied
  by the application authentication workflow.
- Callers never provide an owner ID for authorization.
- RLS permits a Garage Admin to manage all Vehicles and Service Records.
- Unauthenticated and unauthorized identities receive no Vehicle data.
- Registration, VIN, odometer, engine details, and notes must not be included in
  logs or analytics payloads by default.
- Archive and delete eligibility must be enforced by the database or an atomic
  database function, not only by a prior UI check.
- RLS uses the stable current-user and Garage Admin role helpers supplied by the
  Authentication and Access feature.
- Garage Admin authorization must never expose or depend on a Supabase
  service-role key in the SPA.

## 11. Presentation Behavior

- The default Vehicle list shows active Vehicles only.
- The Garage Admin sees all Vehicles across the garage.
- Archived Vehicles are presented in a separate view or explicit filter.
- Archived Vehicles cannot be selected when creating a Service Record.
- The delete action explains that it is permanent.
- If deletion is blocked by existing history, the user is offered the archive
  action.
- Changing an odometer unit is disabled once Service Records exist, with a clear
  explanation.
- Forms mirror domain validation for immediate feedback, while repositories and
  database constraints remain authoritative.

Detailed layout and styling must follow the root `DESIGN.md` when UI work begins.

## 12. Service Record Dependency

The Vehicle feature is ready to enable Service Records when it can provide:

- A stable `VehicleId` and the Garage Admin's app-owned data relationship.
- An active-Vehicle list for Service Record creation.
- Vehicle make, model, year, registration, VIN, odometer unit, and engine details
  for history displays and export snapshots.
- A database-level ownership relationship from Service Records to Vehicles.
- A lifecycle that preserves Vehicles referenced by historical records.
- Server-enforced access that lets the Garage Admin manage all Service Records.

The Service Record design must preserve the meaning of odometer readings and PDF
snapshots even if editable Vehicle details later change.

`performedBy` remains descriptive Service Record data and should default to the
Garage Admin's display name when the Garage Admin creates a record. It is not a
substitute for authorization or audit identity.

## 13. Verification Strategy

Unit tests should cover:

- Required make and model validation.
- Supported odometer units.
- Non-negative whole-number odometers.
- Unit changes being rejected after history exists.
- Active and archived state behavior.
- Vehicle creation input excluding `ownerId` and authentication data.

Repository contract tests should cover:

- Create, read, update, active list, and archived list behavior.
- Archive and restore behavior.
- Permanent deletion without Service Records.
- Rejected deletion with Service Records.
- Garage Admin access to all stored Vehicles and app-owned error mapping.

RLS integration tests must exercise the Garage Admin, a mapped non-admin identity,
an authenticated but unmapped identity where supported, and an unauthenticated
user for every operation.

## 14. Open Decisions

The following decisions remain for discussion before implementation:

1. The configured minimum and maximum supported Vehicle year.
2. Field length limits for make, model, registration, VIN, engine, and notes.
3. Whether `km` should be the form default as well as the database default.
4. The display label used when year, registration, or both are absent.
5. Whether duplicate-looking Vehicles should produce a warning or be accepted
   without comment.
