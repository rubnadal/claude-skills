---
type: llm
weight: 1
---
Judge what the answer recommends and the code does, not its wording. PASS only if ALL of the following hold in the final answer:
1. Adds a versioned migration that adds the column where it is missing, with a schema version.
2. Updates the setup so a fresh install creates the latest schema directly, without running the migrations.
3. Invalidates the cache after migrating.
