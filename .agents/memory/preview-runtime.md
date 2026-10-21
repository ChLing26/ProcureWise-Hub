---
name: Preview runtime freshness
description: Distinguishing current source from stale transformed modules in the development preview.
---

A running development preview can serve an older transformed router after task changes merge, even while navigation and the source files are current.

**Why:** A Settings 404 was traced to the served router lacking the route that was already present in source; the navigation module was current. Static type checks could not detect this runtime mismatch.

**How to apply:** When navigation recognizes a destination but its content is a 404, compare the served router module with source before changing route definitions. Confirm the running preview serves current code, not just that the source passes checks.
