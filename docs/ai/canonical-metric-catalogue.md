# Canonical metric catalogue

## Purpose

AIIBP uses one versioned operational metric contract across dashboards, reports and AI consumers. A metric definition is part of the product contract: changing its meaning requires a new definition version rather than silently changing historical semantics.

The first catalogue increment is the Appointment domain used by Management Copilot and the A0 Business Adviser.

## Trusted scope

Metric calculation is performed only after trusted Business/Location scope has been resolved. The Management Copilot consumer uses the existing tenant-aware AI scope and applies the resulting Business/Location filter to the Appointment query before aggregation.

Client-supplied Business or Location identifiers are not treated as authority by this layer.

## Time semantics

Version `1.0.0` uses **inclusive UTC calendar-day windows**. `startsAt` is the preferred occurrence timestamp and `appointmentDate` is the compatibility fallback. The current window ends at `23:59:59.999Z` on the as-of date. The previous comparison window is the immediately preceding window of equal length.

This removes dependence on the Node process local timezone. A future Business-timezone contract must be introduced through a new metric-definition version if it changes historical day-boundary semantics.

## Appointment metric definitions — v1.0.0

| Key | Meaning | Unit | Aggregation / status rule |
| --- | --- | --- | --- |
| `bookings` | Appointments occurring in the period | count | Count all Appointment statuses |
| `completed` | Completed appointments occurring in the period | count | Count `completed` |
| `revenue` | Completed Appointment revenue | GBP | Sum price only for `completed` appointments |
| `no-show-rate` | No-show appointments as a share of all bookings | percent | `no-show`, `no_show`, `noshow` / `bookings`; zero when denominator is zero |
| `cancellation-rate` | Cancelled appointments as a share of all bookings | percent | `cancelled`, `canceled` / `bookings`; zero when denominator is zero |

All five definitions require canonical `appointment:read` authority for an interactive consumer.

## Evidence and AI use

Each calculated metric carries its stable `key`, definition `version`, aggregation semantics, status policy and source-field evidence. Business Adviser evidence retains the metric key/version pair so an explanation can be traced back to the exact metric definition used.

The extended evidence object is not sent blindly to the Python Management Copilot schema. Node converts the canonical metric result to the established strict FastAPI request contract before making the microservice call. This keeps Python intelligence downstream of the canonical Node/MongoDB metric authority while avoiding schema drift.

## Change policy

- Do not silently edit historical metric meaning under the same version.
- Do not calculate a competing version inside a dashboard, report or AI service.
- Add new domains only after their Business/Location ownership is production-safe.
- Keep direct identifiers out of aggregate metric evidence.
- Preserve deterministic zero-denominator behaviour.
- Record a new metric-definition version when time basis, status inclusion, source field or aggregation semantics materially change.
