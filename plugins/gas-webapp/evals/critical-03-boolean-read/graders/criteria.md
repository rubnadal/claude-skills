---
type: llm
weight: 1
---
PASS only if ALL of the following hold in the final answer:
1. A row counts as active only on an explicit positive check that accepts both the boolean `true` and the string `'TRUE'` (case variants allowed); no truthy check and no `!== false`.
2. That boolean check is a single reusable helper (meant for the other sheets' `active` columns too) whose name ends in an underscore.
3. `listActiveUsers` checks the caller's identity and admin role on the server as its first statement (identity read on the server, never taken from a parameter) before returning any data.
4. Every other top-level function in the answer (helpers not meant to be called from the browser) has a name ending in an underscore.
