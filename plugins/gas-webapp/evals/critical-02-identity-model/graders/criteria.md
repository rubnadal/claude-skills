---
type: llm
weight: 1
---
PASS only if ALL of the following hold in the final answer:
1. Recommends Execute as: me (the deploying account) with access for anyone with a Google account.
2. Explains that the signed-in email is only available for users in the deployer's domain, so external users need a personal link with a token (or equivalent server-verified token).
3. Does not recommend anonymous access; if it mentions `ANYONE_ANONYMOUS`, it advises against it.
4. States that the spreadsheet is not shared with users under this model.
