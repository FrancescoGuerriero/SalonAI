# Workforce tenant-ownership migration contract

Issue: #306  
Owner: DEV4  
Consumers: DEV3 Gate C (#298), DEV2 location UX after backend contract stability

## Purpose

Move workforce persistence from a single-salon global model to explicit Business and Location ownership without losing employees who do not yet have sign-in accounts.

The core distinction is:

```
User
  = platform authentication identity

BusinessMembership
  = tenant role + allowed management/location authority

Stylist
  = operational employee/profile record

workingLocations
  = where that employee can operationally work
```

These concepts must not be collapsed into one field.

## Additive phase

The first #306 increment adds optional ownership fields only:

- `Stylist.business`;
- `Stylist.workingLocations[]`;
- `StaffAvailability.business` / `location`;
- `StaffTimeOff.business` / optional `location`;
- `StaffShift.business` / transitional `locationRef`;
- `StaffAttendance.business` / `locationRef`.

No current field becomes required and no existing route/query is tenant-enforced yet.

The existing `StaffShift.location` string is deliberately retained during migration. It must not be reinterpreted as trusted Location authority.

## Sign-in rules

A staff record may exist without a User account.

A BusinessMembership is created only when a User link is already proven or deliberately approved.

Email-only matches are **manual-review candidates**, never automatic links. This prevents a matching email from silently attaching an employee to the wrong tenant.

A User may eventually work for more than one Business through separate BusinessMemberships and separate business-owned workforce records.

## Index transition

Current legacy constraints remain in place during the additive phase:

- `Stylist.email` is globally unique;
- `Stylist.userAccount` has a global partial unique index.

These are intentionally **not** removed in the first increment.

After canonical backfill and duplicate/ambiguity review, a later controlled index migration should move to tenant-local uniqueness where required, for example:

- `{ business, email }`;
- `{ business, userAccount }` with an appropriate partial filter.

The production index cutover must be explicit, dry-run first and rollback-aware.

## Scheduling ownership

Workforce child records must never become an unscoped side door around Stylist ownership.

Migration must eventually ensure:

- availability queries carry trusted Business and applicable Location;
- time-off is Business-owned, with Location optional when the block applies across all employee locations;
- shifts use trusted Location references rather than free-text routing;
- attendance inherits/validates the Business and Location of its shift/staff;
- appointment availability queries cannot cross tenant or Location boundaries.

## Migration sequence

1. establish/verify canonical Business and primary Location;
2. read all Stylist/User/BusinessMembership records;
3. produce a zero-write readiness plan;
4. flag cross-Business, missing-User, inactive-membership and ambiguous identity conditions;
5. preserve employees without sign-in;
6. backfill Stylist Business + current single Location;
7. create missing BusinessMembership only for proven linked Users;
8. backfill schedule/rota ownership;
9. verify counts and current nine-record production roster;
10. cut over indexes only after ownership is complete;
11. activate tenant-scoped queries incrementally with DEV3 effective authority.

No migration runs automatically on backend startup.
