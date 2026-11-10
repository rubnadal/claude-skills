---
description: Restructure a slow per-row "Save all" into one round trip
tags: [performance, data]
runs: 2
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
My Apps Script web app (HtmlService + google.script.run, Google Sheets as the database) has a "Save all" button on a table of grades. The client loops over the changed rows and calls `google.script.run.apiSaveRow(row)` for each one, waiting for each response before sending the next, and when the loop ends it calls `apiGetTable()` to reload the table. Each `apiSaveRow` reads the sheet, finds the row and updates it; a row that fails validation is marked in red while the others still save. `apiSaveRow` is also used on its own when a teacher edits a single cell, and that stays. With 10 changed rows it takes about 40 seconds, and several teachers sometimes save at the same time. How should I restructure the client and the server? Show the key code.
