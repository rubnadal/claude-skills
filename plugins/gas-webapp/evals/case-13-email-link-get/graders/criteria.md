---
type: llm
weight: 1
---
Judge what the answer recommends and the code does, not its wording. PASS only if ALL of the following hold in the final answer:
1. States that a GET must not modify data (mail scanners and link previews prefetch URLs).
2. Proposes a confirmation page with a button that performs the change through google.script.run or a POST.
