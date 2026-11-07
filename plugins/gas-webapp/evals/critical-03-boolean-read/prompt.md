---
description: Tolerant boolean read of a checkbox column with CSV-imported rows, served to the browser
tags: [critical, data]
runs: 2
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
In my Apps Script web app (Google Sheets as the database, HtmlService page, google.script.run), the admin page fills a table by calling `google.script.run.listActiveUsers()`. The Users sheet has the headers `email`, `name`, `role`, `active`; I read it with `getValues()`. The `active` column is a checkbox, but some rows were imported from CSV. Other sheets (Projects, Teams) also have `active` columns I'll need to filter later. Write `listActiveUsers` and whatever it needs in Code.gs. Answer with the code only; don't create files.
