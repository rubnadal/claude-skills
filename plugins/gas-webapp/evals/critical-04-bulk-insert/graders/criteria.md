---
type: llm
weight: 1
---
PASS only if ALL of the following hold in the final answer:
1. Builds a 2D array and writes it with a single `setValues` on a computed range.
2. No `appendRow`, `setValue` or `deleteRow` inside a loop.
3. Mentions invalidating any cache of that sheet after the write.
