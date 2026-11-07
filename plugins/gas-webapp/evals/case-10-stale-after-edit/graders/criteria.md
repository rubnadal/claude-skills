---
type: llm
weight: 1
---
Judge what the answer recommends and the code does, not its wording. PASS only if ALL of the following hold in the final answer:
1. Identifies a cache (CacheService) of sheet reads as the likely cause.
2. Proposes a way to refresh it: invalidating that sheet's cache key, a manual invalidate-all entry point, or invalidating on write paths.
