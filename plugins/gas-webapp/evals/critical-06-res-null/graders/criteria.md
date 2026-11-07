---
type: llm
weight: 1
---
PASS only if ALL of the following hold in the final answer:
1. Explains that google.script.run drops `null` properties when serializing (and can deliver a null/undefined result).
2. Uses a check like `!res || !res.ok` before using the result.
3. Proposes a sentinel such as `''` (or an explicit flag) instead of `null` for values the client must see.
