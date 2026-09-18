# Initial Super Admin Migration

The initial SalonAI Super Admin must be selected by the immutable MongoDB User ID of the existing administrator account. Name and email are deliberately not accepted by the migration command.

## Why this is a deploy-time migration

The currently deployed pre-Super-Admin application does not understand the `super_admin` role. Promoting the account before deploying compatible application code could prevent that account from passing legacy role checks.

Therefore the governed sequence for the first Super Admin release is:

1. release and verify immutable application images;
2. dry-run the migration against the exact production User ID;
3. deploy the Super-Admin-capable application;
4. immediately apply the identity-bound migration during the controlled deployment window;
5. verify the selected User ID now has `role=super_admin`;
6. run authenticated RBAC/calendar acceptance;
7. complete release closeout.

Do not use the old email-based promotion command semantics.

## Commands

Dry-run:

`node scripts/promoteSuperAdmin.js --user-id=<USER_ID>`

Apply:

`node scripts/promoteSuperAdmin.js --user-id=<USER_ID> --apply --confirm=salonai-initial-super-admin`

Verify:

`node scripts/promoteSuperAdmin.js --user-id=<USER_ID> --verify`

The migration refuses `--apply` without the confirmation phrase and refuses an initial promotion if another active Super Admin already exists.

The User ID must be supplied through controlled deployment input/evidence. Do not commit a production User ID, email address or other account identity into source control.
