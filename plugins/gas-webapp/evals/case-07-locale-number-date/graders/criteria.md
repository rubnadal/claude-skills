---
type: llm
weight: 1
---
Judge what the answer recommends and the code does, not its wording. PASS only if ALL of the following hold in the final answer:
1. Explains that the locale parses the text as a date (the decimal separator is a comma) and that the cell format changes as a result.
2. Recommends storing numeric config values as a Number (and reading them back as numbers), not as text.
3. Does not present setting the cell format to plain text alone as a reliable fix (it notes that it is not reliable, or does not rely on it).
