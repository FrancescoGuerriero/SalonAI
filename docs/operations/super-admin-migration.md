# Governed Super Admin Promotion

SalonAI supports more than one active Super Admin. Promotion is intentionally kept outside the ordinary employee-role UI because `super_admin` grants unconditional application authority.

The promotion command can target one or more existing active staff accounts by immutable MongoDB User ID or by an exact, unique account name.

## Safety rules

- Customer accounts cannot be promoted.
- Inactive accounts cannot be promoted.
- Exact-name lookup is case-insensitive but must resolve to exactly one active staff account.
- If an exact name is ambiguous, the command aborts and requires `--user-id`.
- Every selector is resolved and validated before any role change is written.
- Existing Super Admin accounts are accepted and verified rather than treated as an error.
- The command supports dry-run, apply and verify modes.
- Ordinary employee management still cannot assign the protected `super_admin` role.

Do not commit production MongoDB User IDs, email addresses or other private account identifiers to source control.

## Promote Francesco and Francesco Guerriero

Run a dry-run first:

```bash
npm run superadmin:set -- \
  --user-name="Francesco" \
  --user-name="Francesco Guerriero"
```

The dry-run must resolve exactly two intended staff accounts. If either name is ambiguous, use the exact MongoDB User ID for that account instead.

Apply both promotions in one governed operation:

```bash
npm run superadmin:set -- \
  --user-name="Francesco" \
  --user-name="Francesco Guerriero" \
  --apply \
  --confirm=salonai-super-admin-promotion
```

Verify both accounts:

```bash
npm run superadmin:set -- \
  --user-name="Francesco" \
  --user-name="Francesco Guerriero" \
  --verify
```

## User-ID form

One or more immutable IDs can be supplied instead:

```bash
npm run superadmin:set -- \
  --user-id=<USER_ID_1> \
  --user-id=<USER_ID_2> \
  --apply \
  --confirm=salonai-super-admin-promotion
```

IDs and names may be mixed. Duplicate selectors that resolve to the same account are de-duplicated before application.

## Deployment note

Changing source code does not change a production MongoDB user's role. The apply command must be executed against the intended production database from the controlled production environment after the corrected script is integrated.

The backend authorization middleware loads the current User record from MongoDB for authenticated requests, so the database role is authoritative once the promotion has been applied.
