---
type: llm
weight: 1
---
PASS only if ALL of the following hold in the final answer:
1. Identifies the nested template literals (three levels) and the `'${...}'` inside a template as unsupported by the GAS iframe parser, and rewrites them with at most two levels / concatenation.
2. Replaces `window.location` navigation with a synthetic click on an `<a target="_top">` (or explains why window.location fails in the sandbox and gives that alternative).
3. Mentions an absolute base URL (`<base href>` or `ScriptApp.getService().getUrl()`) for `?page=` links.
