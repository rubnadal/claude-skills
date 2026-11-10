---
type: llm
weight: 1
---
PASS only if ALL of the following hold in the final answer:
1. The client sends all changed rows in a single `google.script.run` call instead of one call per row.
2. The server writes the whole batch with one bulk write (a single `setValues` on a range, or an equivalent batch helper), not one write per row.
3. The server returns a result per row (success or error for each), and the client uses it to mark the rows that failed instead of treating the batch as all-or-nothing.
4. The save call returns the refreshed data the table needs, so the client does not make a separate reload call after saving.
5. The batch write runs under `LockService` (script lock), and the answer states that any other code path writing the same sheet (for example a single-row save) must take the same lock or re-read fresh data inside it.
