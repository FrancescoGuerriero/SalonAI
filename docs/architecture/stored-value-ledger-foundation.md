# Stored-value ledger and cross-location settlement foundation

Status: **implemented platform foundation** for issue #443.

This implementation turns the earlier `cross-location-financial-contracts.md` design into provider-neutral persistence and deterministic planning contracts. It does not invent accounting policy or migrate legacy gift-card/membership/package/loyalty balances.

## Canonical models

### StoredValueProgram

Business-owned policy for gift cards, memberships, packages, loyalty and wallet/future stored value. It records unit (`money`, `quantity`, `points`), currency where monetary, liability policy, cross-location redemption policy, settlement policy, explicit configured Location allowlist and lifecycle status.

### StoredValueInstrument

Business-owned customer instrument/entitlement with program, customer where applicable, origin Location, unit/currency, status and derived-balance cache plus cache revision. The cache is not authoritative. Canonical value is reconstructed from ledger entries.

### StoredValueLedgerEntry

Immutable evidence for issue, redeem, refund, expire, transfer, adjustment and reversal. Every entry has Business/program/instrument ownership, delta + unit/currency, sale and redemption Location provenance, liability-owner provenance, source evidence, idempotency key, occurrence time, actor, optional reversal reference and deterministic SHA-256 ledger fingerprint.

Mutating or deleting posted ledger entries is rejected; corrections use compensating/reversal entries.

### InterLocationSettlementEvent

Business-owned settlement evidence with from/to Location, amount/currency, source ledger entry, idempotency key, deterministic fingerprint, pending/approved/settled/reversed status, accounting-export and reversal references.

## Cross-location rules

Cross-location redemption is explicit:

- `same-location` — fails closed outside the origin Location;
- `business-wide` — allowed inside the trusted Business;
- `configured` — only explicitly configured Locations.

Location ids supplied by clients are not authority. Callers must resolve Business/Location from trusted tenant/effective context before constructing a posting.

## Liability and settlement

Supported liability policies:

- `business-central`;
- `issuing-location`;
- `configured-entity`.

Supported settlement policies:

- `none`;
- `receivable-payable`;
- `manual-review`.

Business-central liability deliberately does not invent internal receivables/payables. Under issuing-location liability, a cross-location redemption can produce deterministic settlement evidence from the sale Location to the redemption Location.

## Existing domain mapping

The current canonical operational domains remain in place: premium gift cards, membership models, service-package/customer-package entitlement models and loyalty accounts. They are not duplicated or silently migrated. Product-specific adoption can map their issue/redeem/use operations onto this shared ledger without changing canonical Business/Location authority.

No production financial data is migrated and no accounting treatment is inferred by this foundation.

## Acceptance covered by source tests

- deterministic idempotency-keyed postings;
- ledger-derived balances;
- event sign validation;
- reversal evidence;
- same-location/business-wide/configured redemption rules;
- business-central no-settlement rule;
- deterministic issuing-location settlement planning.

This completes the shared SaaS/multi-location financial foundation while keeping provider-specific accounting decisions outside source code.
