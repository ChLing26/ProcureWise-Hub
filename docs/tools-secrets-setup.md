# Application secrets: trusted operator setup

ProcureFlow **Tools → Secrets** stores application credentials encrypted in the existing PostgreSQL database. It is not a Replit project administration interface and cannot read or edit Replit Secrets, set arbitrary environment variables, or activate Gemini. The current AI provider remains unchanged.

## Before setup

Revoke any credential previously pasted into chat and issue a replacement at its provider. Do not copy the exposed credential into code, documentation, fixtures, tests, or this feature.

Run the additive schema setup before starting the API:

```sh
pnpm --filter @workspace/db run migrate
```

This creates secret and audit tables without reseeding or modifying procurement records. Setup is repeatable and included in the existing post-merge migration.

## Designate administrators

Only a trusted operator with server configuration access can designate owners/admins. Inspect existing accounts using an operator-controlled database session:

```sql
SELECT id, name, email FROM accounts ORDER BY id;
```

Verify each intended person's identity independently. Configure the server-only variable `TOOLS_ADMIN_ACCOUNT_IDS` as comma-separated existing account IDs, for example `12,34`. Do not include spaces. Both designated owners and admins have the same narrowly scoped Tools permission; this does not grant purchasing-manager authority or change shared procurement access.

No account is automatically privileged, including the first registrant. Signup fields, profiles, browser storage, and request role claims cannot grant this capability. Invalid or empty designation fails closed. Remove an ID and restart the API to revoke permission; existing sessions are checked on each request. Do not put this variable in a `VITE_` variable or client bundle.

## Provision a separate encryption key

Generate **32 cryptographically random bytes encoded as exactly 64 hexadecimal characters** with a trusted password manager or secure local cryptographic tool. Save it directly as a Replit project Secret named `TOOLS_SECRETS_ENCRYPTION_KEY`. Do not send it through chat, commit it, print it to application logs, or use a normal website form to configure it. Never reuse an API credential, session secret, password, or database password as this encryption key.

Configure the encryption Secret and admin designation for every environment where the API runs, including the published deployment's configuration. Use separate keys and databases for development and production. Restart the API after applying configuration changes. A missing or malformed key disables **all writes, including deletion**; safe metadata remains readable by signed-in users. The website shows only a generic setup requirement, not configuration contents or designated IDs.

For an authorized operator, Tools will now offer **New secret**. Enter `GEMINI_API_KEY` as the name and the **newly rotated** provider credential directly in its password-style key input. Saved values cannot be read back. Replace a value using **Replace**, then confirm; delete only after confirming. Names must start with A–Z and contain only uppercase letters, digits, or underscores (maximum 64 characters); values must be nonblank and at most 4096 UTF-8 bytes.

## Storage, backups, and key preservation

Values use AES-256-GCM with a fresh random 96-bit nonce for each write and authenticated binding to the secret name and format version. Database rows contain only encrypted values, timestamps, and minimal actor metadata. A separate transactional audit table records create/replace/delete, name, account ID, and time, never credentials. APIs return only name, configured status, and timestamps. Ordinary signed-in users can list these safe names/statuses, but cannot mutate credentials.

Back up the database securely, restrict access to encrypted rows and audit history, and preserve the matching encryption key in a separate secure backup with restricted operator access. Restore the database and its original encryption key together. Losing the key makes saved values unrecoverable. **Do not casually replace the encryption key:** existing rows require the old key, even though their safe metadata still lists as configured. There is no automatic key rotation or re-encryption feature. If the key is lost or compromised, revoke provider credentials, arrange a controlled recovery or re-entry of all values with an authorized operator, and preserve necessary audit records.

Replacing/deleting a stored value does not revoke it at the provider and does not erase older database backups. Follow the provider's revocation process and your backup-retention policy. “Configured” means a stored encrypted record exists, not that a third-party credential has been verified or activated.

## Verification

`pnpm --filter @workspace/api-server test` checks direct authenticated/anonymous/admin enforcement, rejected role claims, origin protections, validation and duplicates, encryption/name binding/tamper rejection, actor-only audit metadata, setup fail-closed behavior, and persistence through a real isolated process restart. Tests generate synthetic credentials and never call Gemini or another provider.
