---
type: llm
weight: 1
---
Judge what the answer recommends and the code does, not its wording. PASS only if ALL of the following hold in the final answer:
1. Identifies the privilege escalation: anyone who can call it becomes ADMIN.
2. Makes setup refuse when the app is already installed (a flag or an existing admin) and restricts any repair mode to an existing admin or the deployer, never creating users.
3. Notes that any top-level function without a trailing underscore is callable from the browser.
