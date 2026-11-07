---
type: llm
weight: 1
---
Judge what the answer recommends and the code does, not its wording. PASS only if ALL of the following hold in the final answer:
1. Forces the cells to text before writing (for example the `@` number format on the range before the write, or a leading apostrophe) and explains that Sheets converts the value to a number.
2. Reads the ids back as strings (does not treat them as numbers).
