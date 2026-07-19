# Fullstack Garage Product Scope and Language

Status: Current
Date: 2026-07-19
Architecture: [Fullstack Garage Architecture](../architecture/fullstack-garage-architecture.md)
Feature specifications: [Authentication and Access](../features/authentication-access.md), [Vehicles](../features/vehicles.md), [Service Records](../features/service-records.md)

## 1. Product Definition

Fullstack Garage is a responsive web application for recording Vehicle
maintenance history and producing branded Service Record PDFs.

The MVP supports a mechanic-operated personal garage. Only the bootstrapped
Garage Admin has application access. The Garage Admin may record maintenance for
their own Vehicles and friends' Vehicles without creating customer accounts or
storing real-world Vehicle ownership data.

Approved feature specifications define detailed behavior and acceptance criteria.
This document owns only the cross-feature product scope and language.

## 2. MVP Capabilities

The MVP allows the Garage Admin to:

1. Sign in with the configured authentication provider.
2. Add and manage one or more Vehicles.
3. Create and edit draft Service Records.
4. Record Work Performed, inspections, parts, fluids, and consumables.
5. Record the actual Purchase Cost of eligible items.
6. Complete immutable Service Records and view Vehicle Service History.
7. Preview and download branded Service Record PDFs.
8. Use the application on mobile and desktop.

## 3. MVP Non-Goals

The MVP does not include:

- Invoices, payments, tax, GST, or amounts due.
- Workshop bookings or customer management.
- Real-world Vehicle ownership records.
- Member accounts or member-specific application behavior.
- Labour pricing, hourly rates, or commercial markups.
- Public marketplaces.
- Native mobile applications.
- Automated reminders.
- Receipt OCR or attachment storage.
- Multi-tenant business accounts.

## 4. Product Language

Use:

- Service Record
- Service Record Number
- Vehicle Service History
- Work Performed
- Parts & Consumables
- Purchase Cost
- Total Parts & Consumables
- Performed By
- Inspection Findings
- Recommendations
- Next Service Due

Avoid product language that implies commercial billing, customer balances,
labour charges, taxes, or money owed. Purchase Cost means the Garage Admin's
actual out-of-pocket cost for an eligible item; it is not a selling price or a sum
owed by another person.

## 5. Document Ownership

- `docs/features/authentication-access.md` owns authentication, session,
  provisioning, and authorization behavior.
- `docs/features/vehicles.md` owns Vehicle fields, lifecycle, validation, and
  presentation behavior.
- `docs/features/service-records.md` owns Service Record fields, items, lifecycle,
  Purchase Cost rules, validation, and PDF content.
- `DESIGN.md` owns visual language, tokens, responsive patterns, and component
  geometry.
- `docs/architecture/fullstack-garage-architecture.md` owns structural system
  decisions and technology boundaries.

When documents differ, the document that owns the subject above is authoritative.
