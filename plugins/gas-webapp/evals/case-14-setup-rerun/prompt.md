---
description: Public setup function that makes the caller ADMIN
tags: [security]
runs: 1
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
My Apps Script app has a public `setup()` function that creates the sheets and makes the caller ADMIN. It's handy to re-run it if something breaks. Is that OK?
