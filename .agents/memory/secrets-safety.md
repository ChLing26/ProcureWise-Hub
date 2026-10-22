---
name: Secrets safety constraints
description: Application secrets must remain separate from platform administration and avoid browser mutation retention.
---

Keep Tools secrets an application-only, write-only feature. Any future UI must keep credentials out of query and mutation caches, not merely out of local storage.

**Why:** React Query mutation state can retain submitted variables after a request finishes. Clearing a password input alone does not remove those copies. The security requirement covers browser persistence and caches as well as displayed values.

**How to apply:** Use transient form inputs and imperative API calls for value-bearing requests, discard values on submission/dismissal/session change, and return/cache metadata only. Do not add credential telemetry or readback endpoints. Trusted operator setup is distinct from public accounts and purchasing-manager permissions.
