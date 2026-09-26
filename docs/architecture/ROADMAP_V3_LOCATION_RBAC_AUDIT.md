# DEV3 Roadmap v3.0 — Location-scoped RBAC and management-surface audit

**Issue:** #278  
**Coordination:** #280  
**Baseline:** `main@b14f56e801ee4337cef765f1b40cb0e555ed7217`  
**Status:** Audit complete for current-main permission/management surfaces. Location-aware implementation remains blocked on DEV4 #279 trusted BusinessMembership and Location contracts.

## 1. Guardrail

This document is an audit and implementation contract only.

DEV3 does **not** introduce BusinessMembership, Location, tenant resolution, location models, tenant headers, business/location request parameters as authority, or any parallel role system in this issue.

The current RBAC model remains authoritative until DEV4 #279 publishes a trusted server-side membership/location context.

## 2. Current RBAC authority

### 2.1 User authority

Current staff authority is assembled from:

- `User.role`
- baseline permissions for that role
- `User.rolePermissions` inherited from the selected built-in/custom role
- `User.permissions` for employee-specific grants

`permissionsForRole()` is the canonical backend effective-permission calculation. `hasUserPermission()`, `requirePermissions()` and `requireAnyPermission()` enforce it server-side.

Super Admin currently bypasses individual permission checks.

### 2.2 Role registry

There is one role system and it should be extended rather than duplicated.

Current sources:

- built-in role definitions in `staffRoleRegistryService.js`
- custom/built-in overrides in `StaffRole`
- permission catalogue in `constants/permissions.js`
- matching frontend permission metadata in `frontend/src/utils/permissions.js`

Built-in staff roles:

- Super Admin
- Administrator
- Manager
- Receptionist
- Stylist

Custom roles reuse the same permission catalogue.

### 2.3 Employee/profile authority

Authentication/RBAC belongs to `User`.

Professional/operational staff data belongs to `Stylist`, linked through `Stylist.userAccount`.

This distinction must remain internal. The management UI should continue to present one Employee model with sign-in state as an account/security state.

### 2.4 Current tenant foundation

Current `main` contains:

- `Business` tenant root
- vertical registry
- fail-closed `tenantFilter()`, `stampTenant()` and `assertTenantOwnership()` primitives
- public platform configuration

It does **not** yet contain the trusted authenticated User -> Business membership resolver or Location contract required for location-aware RBAC.

Neither `User`, `Stylist` nor `StaffRole` currently carries a trusted business/location authority binding.

## 3. Scope taxonomy for future effective authority

The following scope classes should be used after DEV4 #279 contracts are available.

| Code | Scope | Meaning |
|---|---|---|
| P | Platform | Platform operator/Super Admin authority outside an individual tenant. |
| B | Business | Entire trusted Business membership. |
| L | Location | One selected/active Location inside the trusted membership. |
| A | Allowed locations | Aggregate over all Locations the membership is authorised to access. |
| H | Hybrid | Business-owned definition with location-specific operational state/override. |
| S | Self | Authenticated employee's own profile/schedule/leave only. |
| X | Cross-location financial | Business-level stored-value/liability operation that may span sale/redemption locations. |

A permission alone must never imply location authority. Future effective authority is:

`authenticated User + trusted BusinessMembership + allowed Location scope + permission + capability/entitlement + resource ownership`.

## 4. Permission catalogue: proposed future scope

| Permission | Proposed scope | Notes |
|---|---|---|
| dashboard:view | L/A | Location dashboard or aggregate over allowed locations. |
| appointment:read/create/update/cancel/payment:manage | L | Appointment location must be inside allowed scope. |
| customer:read/create/update/archive/delete | B/A | Customer is business-owned; operational history must be filtered to allowed locations for location-limited staff. |
| employee:read | A/L | Business owner may aggregate; location managers see employees assigned to allowed locations. |
| employee:create | B | Account creation belongs to business membership; location assignment is separate trusted scope. |
| employee:update/deactivate | A/L | Target employee must be manageable within membership/location authority. |
| employee:role:update | B | High-risk business-wide authority; remains non-delegable by default. |
| employee:permissions:update | B | High-risk business-wide authority; remains non-delegable by default. |
| employee:schedule:update | L/A | Schedule assignment is location operational authority. |
| employee:services:update | L/H | Service capability may be business-defined but location offering is operational. |
| staff-role:read/create/update/activate/delete | B | Role templates are business-wide; do not create per-location role registries. |
| profile:own:read/update | S | Self only. |
| profile:all:read/update | A/L | Limited to employees visible in allowed locations unless membership grants business-wide access. |
| schedule:own:read/update | S | Self only; server derives employee identity. |
| leave:own:request | S | Self only. |
| service:read/create/update/publish/delete | H | Business catalogue plus location availability/pricing/override contract. |
| product:read/create/update/publish/delete | H | Business catalogue; location stock/availability remains separate. |
| product:inventory:update | L | Stock belongs to location. |
| product:cost:read | B/A | Cost visibility may be business-wide or restricted by allowed locations. |
| communications:read/manage | B/A | Campaign/template definitions may be business-wide; audiences/delivery must respect location scope. |
| loyalty:manage | X | Cross-location stored value; liability contract required before rollout. |
| gift-card:manage | X | Same as above. |
| referral:manage | B | Business programme, potentially location-attributed. |
| notification:manage/push:manage | B | Business communications configuration. |
| email-campaign:manage/sms-reminder:manage | B/A | Business policy; recipients and events scoped to allowed locations. |
| whatsapp:manage | A/L | Conversation/booking authority must follow allowed business/location context. |
| retention-automation:manage | B/A | Rules business-wide; data/actions limited to allowed scope. |
| premium-analytics:read | A | Aggregate only across allowed locations. |
| inventory:read/manage | L/A | Location stock/purchasing; aggregate only where membership allows. |
| reports:read/manage | A | Reports must never aggregate unauthorised locations. |
| ai:use | A/L | AI context/tool calls inherit the caller's effective data/action scope. |
| feature-control:read/update | B/P | Tenant controls at Business; platform safety locks remain platform authority. |
| data-import:manage | B | High-risk tenant-wide import; imported records must be stamped from trusted context. |
| data-export:manage | B/A | Export scope cannot exceed effective read scope. |

## 5. Management-route map

This maps the current canonical frontend management registry to its existing route permission and the proposed future location scope.

### Run the salon

| Route | Current permission | Future scope |
|---|---|---|
| /dashboard | dashboard:view | L/A |
| /appointments | appointment:read | L |
| /calendar | appointment:read | L |
| /waitlist | appointment:read | L |
| /daily-close | reports:read | L |
| /booking-demand | appointment:read | A |
| /booking-loss | appointment:read | A |
| /smart-appointments | ai:use | L/A |
| /capacity-planning | ai:use | A |
| /dynamic-pricing | ai:use | L/H |

### Customers and retention

| Route | Current permission | Future scope |
|---|---|---|
| /customers | customer:read | B/A |
| /customer-follow-ups | customer:read | B/A |
| /retention-actions | customer:read | B/A |
| /customer-segments | customer:read | B/A |
| /customer-value | customer:read | B/A |
| /retention-predictions | customer:read | B/A |
| /rebooking-opportunities | customer:read | B/A |
| /customer-experience-management | customer:read | B/A |
| /loyalty | loyalty:manage | X |
| /gift-cards | gift-card:manage | X |
| /referrals | referral:manage | B |

### Team

| Route | Current permission | Future scope |
|---|---|---|
| /staff/self-service | schedule:own:read | S |
| /team-availability | employee:read | L/A |
| /admin/employees | employee:read | L/A |
| /staff/profile | profile:own:read (or profile:all:read in management presentation) | S or L/A |
| /staff-rota | employee:read | L |
| /admin/staff-roles | staff-role:read | B |
| /staff-performance | reports:read | A |

### Catalogue, products and stock

| Route | Current permission | Future scope |
|---|---|---|
| /manage/services | service:read | H |
| /manage/service-packages | service:read | B/H |
| /manage/products | product:read | H |
| /manage/inventory | inventory:read | L |
| /manage/orders | product:read | L/A |
| /suppliers | inventory:read | B |
| /purchase-orders | inventory:read | L |
| /reorder-recommendations | inventory:read | L |
| /inventory-forecasting | inventory:read | L/A |
| /service-performance | reports:read | L/A |
| /data-imports | data-import:manage | B |

### Communications and growth

| Route | Current permission | Future scope |
|---|---|---|
| /communications | communications:read | B/A |
| /communication-templates | communications:read | B |
| /scheduled-communications | communications:read | B/A |
| /communication-campaigns | communications:read | B/A |
| /message-delivery | communications:read | B/A |
| /rebooking-campaigns | communications:read | B/A |
| /marketing-attribution | ai:use | A |
| /notification-centre | notification:manage | B |
| /push-notifications | push:manage | B |
| /email-campaigns | email-campaign:manage | B/A |
| /sms-reminders | sms-reminder:manage | B/A |
| /whatsapp-booking | whatsapp:manage | L/A |
| /retention-automation | retention-automation:manage | B/A |

### Performance

| Route | Current permission | Future scope |
|---|---|---|
| /reports | reports:read | A |
| /revenue-forecast | reports:read | A |
| /feedback-analytics | ai:use | A |
| /executive-command-centre | ai:use | B/A |
| /data-export-audit | reports:read | B/A |
| /premium-analytics | premium-analytics:read | A |

### AI and automation

| Route | Current permission | Future scope |
|---|---|---|
| /ai/haircare | ai:use | L/A |
| /ai/customer-summaries | ai:use | B/A |
| /ai/customer-segmentation | ai:use | B/A |
| /ai/demand-forecasting | ai:use | L/A |
| /ai/marketing-insights | ai:use | B/A |
| /ai/no-show-predictions | ai:use | L/A |
| /ai/sales-forecasting | ai:use | L/A |
| /management-copilot | ai:use | B/A |

### Administration

| Route | Current guard | Future scope |
|---|---|---|
| /admin | AdminRoute + dashboard:view metadata | B/A |
| /admin/privacy-requests | AdminRoute | B |
| /admin/system | feature-control:read | B/P |

## 6. Server-side route/guard audit

### Strong current patterns to preserve

1. `/api/auth/admin/staff*` uses granular employee permissions, including field-sensitive permission checks for role/permission/settings changes.
2. `/api/staff-roles` uses dedicated staff-role permissions.
3. `/api/customers`, customer profile/contact/note APIs, service management, dashboard and most communication APIs use `requirePermissions()` / `requireAnyPermission()`.
4. `/api/future/*` now maps most dashboard workspaces to the same permission used by the frontend route.
5. Frontend `PermissionRoute` and management navigation use the same permission vocabulary; the server remains authoritative.
6. Self-profile and self-schedule permissions are already distinct from all-staff management permissions.

### Duplicate/legacy access paths identified

These are not changed by this audit.

1. **Role-only middleware still exists**
   - `adminOnly`
   - `superAdminOnly`
   - `managementOnly`
   - `AdminRoute`
   - `ManagementRoute`

   These must not become a second location-aware role system. Where a route is a normal delegated business function, future implementation should converge on effective permissions + trusted membership/location context.

2. **Stylist legacy CRUD**
   - `POST /api/stylists` and `DELETE /api/stylists/:id` are `superAdminOnly`.
   - read/update management paths use profile permissions.
   - This is a mixed role/permission boundary and should be rationalised after trusted membership exists.

3. **Privacy management**
   - `/api/privacy-requests/management*` uses `adminOnly`, not a dedicated privacy permission.
   - Privacy is business-wide legal authority and should not be inferred from location selection alone.

4. **Future security route**
   - `/api/future/security` is mounted behind `managementOnly`, then the nested router applies `adminOnly`.
   - Effective access is Admin/Super Admin, but the double role gate is legacy/redundant.

5. **Message-delivery scheduler**
   - `/api/message-delivery-scheduler/*` currently uses `managementOnly`.
   - This includes run/start/stop/restart operations that can trigger outbound processing.
   - Because `managementOnly` includes stylist/receptionist/manager, this is a **high-priority RBAC review item**. It requires a dedicated permission/business scope before multi-location implementation; do not copy this role gate into the future scope model.

6. **Admin overview/privacy frontend**
   - `/admin` and `/admin/privacy-requests` use role-based `AdminRoute` instead of `PermissionRoute`.
   - The backend still protects the corresponding APIs, but the UI access model is not uniformly capability-based.

7. **Redirect aliases**
   - `/admin/services -> /manage/services`
   - `/admin/stylists -> /staff/profile`
   - `/admin/staff-accounts -> /admin/employees`
   - `/admin/appointments -> /appointments`
   - `/admin/customers -> /customers`
   - `/staff-management -> /team-availability`

   These should remain redirects only. Do not reintroduce parallel permission/location implementations behind the aliases.

## 7. Current blockers to location-aware enforcement

DEV3 must not implement around these missing contracts.

Required from DEV4 #279:

1. trusted authenticated User -> BusinessMembership resolution;
2. server-derived active Business;
3. Location model owned by Business;
4. trusted allowed-location set per membership;
5. rules for business owner / organisation admin / location admin / manager / receptionist / staff authority metadata;
6. fail-closed semantics when membership/location is missing, inactive or outside the Business;
7. configuration/capability entitlement resolution and provenance;
8. a stable way to distinguish platform Super Admin authority from tenant Super Admin/business-owner authority if both concepts remain;
9. synthetic second-business and second-location fixtures for isolation testing.

Client-supplied `businessId`, `locationId`, headers, query parameters or body fields may be selectors only after the server proves they are inside the trusted membership. They can never establish authority.

## 8. Effective-authority object required by DEV3 after Gate B

This is an interface requirement, not a schema implementation.

DEV3 needs the trusted request context to provide enough information to answer:

- authenticated user id;
- trusted business id;
- membership id/status;
- membership authority/role binding;
- all allowed location ids;
- selected/effective location id when an operation is location-specific;
- whether the membership has business-wide aggregation authority;
- capability/entitlement state relevant to the operation;
- provenance/lock information for configuration when displayed to administrators.

The exact model names/fields remain owned by DEV4.

## 9. Effective-permission inspection UX contract

After implementation, administrators should be able to inspect why an employee can or cannot perform an action.

For each effective permission show:

- permission key/label;
- granted by baseline role, custom role or direct employee grant;
- business-wide vs selected/allowed location scope;
- allowed location list/count;
- self-only indicator where applicable;
- feature/capability entitlement state;
- configuration lock/override source where applicable;
- effective result: allowed/denied;
- denial reason;
- most recent relevant audit event.

Navigation visibility is informational only. Server-side authorization remains independent.

## 10. Later implementation sequence

Only after DEV4 Gate B is stable:

1. introduce a server-side effective-authority resolver that composes current permissions with trusted membership/location context;
2. keep `permissionsForRole()` as the permission vocabulary source; do not create a second role engine;
3. add scoped authorization helpers around trusted context;
4. migrate high-risk management route families first:
   - employees/profiles/roles;
   - appointments/calendar/waitlist;
   - inventory/orders/purchasing;
   - communications scheduler/delivery;
   - reports/export;
5. update frontend context/location switcher only after server contracts are authoritative;
6. add effective-permission inspection;
7. migrate remaining management domains;
8. remove/reduce legacy role-only gates where a canonical permission exists;
9. retain platform-only operations as explicitly platform-scoped controls.

## 11. Required implementation tests after Gate B

### Tenant isolation

- user in Business A cannot access Business B by changing URL/query/body/header;
- stale/inactive membership fails closed;
- resource ownership mismatch returns fail-closed/404 semantics where appropriate.

### Location isolation

- allowed Location A succeeds;
- Location B outside membership fails;
- absent location fails when operation requires L scope;
- business-wide/A authority may aggregate only the membership's allowed locations;
- location cannot cross its parent Business.

### Role/scope combinations

Cover at minimum:

- platform Super Admin;
- business owner / tenant Super Admin contract supplied by DEV4;
- organisation/business admin;
- location admin;
- manager;
- receptionist;
- staff/stylist;
- custom role;
- employee-specific grant;
- self-only profile/schedule/leave paths.

### Regression

- current single-location SalonAI behaviour remains valid;
- booking eligibility still uses active + acceptsAppointments;
- public profile publication remains independent from staff management visibility;
- permission route/navigation tests remain synchronised with backend permission catalogue;
- aliases remain redirects rather than alternate authorization paths.

## 12. Audit conclusion

The existing SalonAI permission catalogue and StaffRole registry are suitable foundations for location-aware RBAC. A second role system is neither required nor desirable.

The principal missing primitive is **trusted membership/location scope**, not more role names.

DEV3 implementation should therefore remain blocked until #279 publishes the trusted control-plane contract. Once that contract exists, the safest path is to compose location scope into the current effective-permission pipeline and migrate management domains incrementally, fail-closed, with server-side resource ownership checks.


## Concrete route-family scope matrix

This matrix is based on the current API mounts in `backend/src/app.js` and the current permission registry. It is the implementation baseline for the next DEV3 increment.

| Route / function family | Current permission family | Target scope | Multi-location rule |
| --- | --- | --- | --- |
| `/api/appointments` | `appointment:*` | location | appointment must belong to active Business + authorised Location |
| appointment payments | `appointment:payment:manage` | location/business-finance | payment action requires appointment location authority; settlement may be business-wide |
| `/api/customers`, profiles, notes, contacts | `customer:*` | business by default | customer identity may be visible business-wide; location-specific notes/activity remain provenance-scoped |
| `/api/admin` employee/staff surfaces | `employee:*`, `profile:*` | business + selected locations | Super Admin/Admin may manage only locations granted by membership unless platform authority explicitly applies |
| schedules / leave / staff calendar | `schedule:*`, `leave:*` | self or location | own schedule is self-scope; management changes require location authority |
| `/api/services` | `service:*` | business with location availability overlay | catalogue definition can be business-wide; publish/bookability/availability may vary by location |
| product/catalogue | `product:*` | business/location | product definition may be business-wide; stock and availability are location-scoped |
| suppliers / purchase orders / inventory | `inventory:*` | location/business-purchasing | stock ledger and purchase fulfilment must carry location; supplier master may be business-wide |
| communication templates/campaigns | `communications:*` | business | campaigns business-scoped; sender/config and audience filters may have location provenance |
| loyalty | `loyalty:manage` | business | balances business-owned initially; earning/redemption location retained |
| gift cards | `gift-card:manage` | business + financial provenance | instrument business-owned; sale/redemption locations required for settlement |
| referrals | `referral:manage` | business | location attribution optional, never authorization |
| notifications/push | `notification:manage`, `push:manage` | business | delivery policies business-scoped; operational event provenance retained |
| email campaigns | `email-campaign:manage` | business | marketing consent/suppression remains customer/business authority |
| SMS reminders | `sms-reminder:manage` | business/location source | reminder execution follows appointment/location scope |
| WhatsApp | `whatsapp:manage` | business/location source | conversation may be business-wide but booking action must use authorised location |
| retention automation | `retention-automation:manage` | business | cohort filters may include location; automation authority remains business-wide |
| premium analytics / reports | `premium-analytics:read`, `reports:*` | business or location-filtered | user sees only data for locations in effective scope unless business-wide authority |
| AI | `ai:use` | same as source domain | AI cannot expand authority beyond the records/tools the user may access |
| feature controls | `feature-control:*` | business; some platform-only | tenant feature controls cannot override platform safety locks |
| data imports/exports | `data-import:manage`, `data-export:manage` | business with explicit location mapping | import/export must declare target scope and reject cross-tenant identifiers |
| staff roles | `staff-role:*` | business | role templates are business-scoped; assignment additionally carries location scope |
| system administration | role/permission guarded | platform or business depending function | platform-only controls must remain separated from tenant administration |

## Permission semantics to preserve

The existing `permissionsForRole()` merge remains the canonical permission calculation:

`baseline role permissions + rolePermissions + direct assigned permissions`

Multi-location support adds **scope**, not a second permission list. The effective authorization decision becomes:

`authenticated user + active BusinessMembership + permitted Location + existing permission + resource ownership`

The following permissions should remain non-delegable without an explicit later security decision:

- `employee:role:update`
- `employee:permissions:update`

Location assignment itself should also be treated as a high-authority operation because expanding a membership's location set expands the data boundary.

## Required middleware composition

The future request path should compose existing and DEV4 contracts in this order:

1. authenticate the user;
2. resolve trusted BusinessMembership using DEV4 `resolveTrustedTenantContext()`;
3. resolve/validate active Location when the route is location-scoped;
4. evaluate the existing permission with `requirePermissions()` / `requireAnyPermission()`;
5. add business/location criteria to the database query itself;
6. return 404-style semantics for cross-tenant or cross-location resource misses;
7. emit audit evidence for authority-changing operations.

A frontend location selector is therefore only a selector. It never becomes authorization.

## High-risk implementation targets

Before DEV3 modifies runtime RBAC, explicit tests are required for:

- employee/profile list queries that currently assume one global salon;
- appointment reads/updates by id;
- inventory and purchase-order lookups;
- reports/analytics aggregations;
- AI context-building queries;
- staff role assignment;
- feature-control updates;
- import/export jobs;
- background jobs and provider webhooks that operate without an interactive browser session.

These are the surfaces most likely to leak data if only the UI is location-aware.
