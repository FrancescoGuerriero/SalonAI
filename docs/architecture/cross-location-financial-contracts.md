# Cross-location stored-value and settlement contracts

Status: **design contract only** for Roadmap v3.0 issue #279. This document does not migrate production data or activate accounting behaviour.

## Purpose

Multi-location businesses must distinguish where value is sold, where it is redeemed, who legally owns the liability and whether an internal location-to-location receivable/payable is created. The same contract should support gift cards, memberships, prepaid service packages, loyalty/stored value and future wallet products.

## Core rule

Stored value is not represented by mutating a balance without evidence. Every issuance, redemption, refund, expiry, transfer or manual adjustment must create an immutable ledger event with business and location provenance.

## Canonical concepts

### StoredValueProgram

Defines the commercial product and policy.

Required concepts:
- business;
- program type: gift-card, membership, package, loyalty, wallet or future extension;
- currency;
- liability policy;
- cross-location redemption policy;
- settlement policy;
- expiry/refund policy;
- capability/plan entitlement.

### StoredValueInstrument

Represents the customer-owned instrument or entitlement.

Required concepts:
- business;
- program;
- customer/account owner;
- originating sale location when applicable;
- status;
- externally safe reference/token;
- currency;
- current derived balance or remaining entitlement as a cache only.

The authoritative balance is reconstructed from ledger entries.

### StoredValueLedgerEntry

Immutable accounting/operational evidence.

Minimum contract:
- business;
- program and instrument;
- event type;
- amount or quantity delta;
- currency;
- sale/origin location;
- redemption/service location;
- liability owner;
- source transaction/order/appointment;
- idempotency key;
- occurredAt;
- actor/system provenance;
- reversalOf when correcting a prior event;
- audit metadata.

Event types should include:
- issue;
- redeem;
- refund;
- expire;
- transfer;
- adjustment;
- reversal.

Never delete or rewrite a financially consequential ledger event after posting; correct it through a compensating/reversal event.

## Liability ownership

The platform must not assume that the location receiving cash is always the legal liability owner.

Supported policy targets:
1. **business-central** — the Business owns the liability; locations are operational dimensions.
2. **issuing-location** — the issuing location carries the internal liability until redemption/settlement.
3. **configured-entity** — reserved for future legal-entity/franchise structures.

Initial Salon AI multi-location implementation should prefer **business-central** unless accounting requirements prove otherwise. Internal location economics can still be represented through settlement entries.

## Sale vs redemption

Always retain both:
- `saleLocation`: where cash/value was originally issued;
- `redemptionLocation`: where service/product value was consumed.

If A sells a £100 gift card and B redeems £60:
- customer instrument ledger: issue +100 at A, redeem -60 at B;
- remaining customer value: £40;
- settlement engine evaluates the configured policy;
- if locations carry internal P&L, A may owe B £60 (or another configured transfer amount);
- the platform records the receivable/payable evidence rather than silently reallocating historical sales.

## Inter-location settlement event

A future `InterLocationSettlementEvent` should contain:
- business;
- fromLocation;
- toLocation;
- amount;
- currency;
- reason;
- source ledger entry;
- settlement status;
- accounting export reference;
- created/approved/settled timestamps;
- actor and audit metadata.

The event must be idempotent and reversible through explicit compensating events.

## Memberships and packages

Membership recurring revenue and prepaid packages use the same provenance rules but may settle based on:
- issuance location;
- home location;
- service-delivery location;
- central business allocation;
- configured percentage/allocation rules.

Package quantity (for example three treatments) must use an entitlement ledger rather than pretending all stored value is cash.

## Loyalty

Points may not be a financial liability in every accounting model, but the platform should still preserve:
- earning location;
- redemption location;
- rule/version applied;
- points delta;
- monetary-equivalent value when used for settlement/reporting.

## Guardrails

- Every record is tenant scoped.
- Locations referenced by one event must belong to the same Business unless a future explicit inter-business/franchise contract permits otherwise.
- Currency conversion is not implicit.
- Cross-location redemption requires an explicit program policy.
- No location may infer authorization from a client-supplied location id.
- Financially consequential AI actions remain proposal/approval/audit driven.
- Accounting export adapters consume canonical ledger/settlement events rather than re-deriving them from UI state.

## Implementation gate

Implementation starts only after:
1. BusinessMembership and Location contracts are accepted;
2. tenant/location isolation tests pass;
3. current gift-card, package, membership, loyalty and commerce schemas are mapped to this contract;
4. DEV1 confirms canonical domain integration boundaries;
5. accounting/export requirements are documented.

Create a dedicated implementation epic at that point rather than extending #279 into production financial migration.
