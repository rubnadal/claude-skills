---
type: llm
weight: 1
---
Judge what the answer recommends and the code does, not its wording. PASS only if ALL of the following hold in the final answer:
1. Avoids the shift by keeping the date as a `YYYY-MM-DD` string, or by building any Date object at noon (for example `T12:00:00`) or with an explicit time zone, never from a bare date-only string at midnight UTC.
2. Names a time zone mismatch (the user's browser, the script time zone in `appsscript.json`, or the spreadsheet time zone) as the source of the shift.
