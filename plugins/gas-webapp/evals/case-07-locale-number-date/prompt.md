---
description: Config number read back as a Date in a comma-decimal locale
tags: [data]
runs: 1
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
My Google Sheet is set to the Catalan locale. My Apps Script saves a config value '9.7' as text in a Config sheet, but when I read it back it's a Date and the cell format changed. Why, and how should I store it?
