# SalonAI Phase 8.4 R2 — Stylist Account Index Repair

## Problem corrected

The first Phase 8.4 acceptance run failed with:

`E11000 duplicate key error ... index: userAccount_1 dup key: { userAccount: null }`

The original Phase 8.4 schema used `unique: true`, `sparse: true`, and `default: null` on `Stylist.userAccount`.

A sparse unique index does not solve this case when the field is explicitly stored as `null`: the null value still participates in the index, so only one unlinked stylist could exist.

## Fix

R2 changes `Stylist.userAccount` to:

- no default `null`;
- no path-level unique/sparse index;
- one explicit **partial unique index**;
- only real MongoDB ObjectId values participate in uniqueness.

This preserves the business invariant:

**one User account may link to at most one stylist**

while allowing any number of stylist profiles that are not yet linked to User accounts.

## Database repair

`backend/scripts/repairStylistUserAccountIndex.js`:

1. connects using the existing `MONGODB_URI`;
2. refuses to proceed if duplicate real User links exist;
3. removes the legacy `userAccount` index;
4. unsets explicit null `userAccount` values;
5. creates the safe partial unique index;
6. verifies the resulting index.

Run this in the local/test environment before reseeding.

The included R2 acceptance runner performs the repair automatically before the five fictional development profiles are seeded.

## Production

Do not run this migration on production yet. It belongs in the later controlled release/migration plan after local acceptance and Git synchronisation.
