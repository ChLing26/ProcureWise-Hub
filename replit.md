# ProcureFlow

Shared procurement workspace for SME buying teams, with persistent email-and-password accounts.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run migrate` — repeatable, additive procurement and account/session schema setup; also runs after task merges
- `pnpm --filter @workspace/api-server test` — account/session API checks plus isolated empty-schema bootstrap, procurement workflow, and process-restart checks (cleans up its own data)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- Authentication uses the explicitly requested local email/password accounts and PostgreSQL sessions, not an external identity provider.

## Account operation

- Run the additive migrations before starting the API against either a new or existing database. Procurement storage is bootstrapped before account/session storage; existing procurement records are never recreated or reseeded.
- Sessions have a fixed seven-day lifetime. Passwords use salted scrypt; only hashes of opaque session tokens are stored. `SESSION_SECRET` is not needed for these database-backed opaque sessions.
- Set `NODE_ENV=production` for production serving so session cookies are Secure. The API artifact already sets this. Use HTTPS for production.
- Requests must come through the same-origin app proxy. JSON mutations require `X-ProcureFlow-Request: 1`; the shared API client supplies this automatically. No cross-origin CORS access is granted.
- Password recovery, email verification, invitations, general role management, and private datasets are deliberately outside the current account scope. Tools-only administration uses a trusted operator allowlist, not public role assignment.

## Tools secrets

- See [operator setup and recovery guidance](docs/tools-secrets-setup.md) before enabling writes.
- Server configuration: `TOOLS_ADMIN_ACCOUNT_IDS` designates existing account IDs; separate `TOOLS_SECRETS_ENCRYPTION_KEY` is a Replit Secret containing 32 random bytes encoded as 64 hex characters. No designation or invalid encryption configuration means writes fail closed.
- These are encrypted application secrets, not Replit project Secrets or environment-variable administration. Storing `GEMINI_API_KEY` does not switch AI providers or activate Gemini.
- Revoke any credential pasted into chat. Only enter a newly rotated replacement through New secret after trusted setup. Preserve the encryption key separately with secure database backups; never change it casually.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
