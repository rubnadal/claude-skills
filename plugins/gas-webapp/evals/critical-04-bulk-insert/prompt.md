---
description: Rewrite a slow appendRow loop as a batch write
tags: [critical, data]
runs: 2
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
My Apps Script setup function inserts 500 demo rows into a sheet with a for loop calling sheet.appendRow(row). It takes almost a minute. Rewrite it.
