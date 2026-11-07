---
description: Student ids with leading zeros lose them when written to the sheet
tags: [data]
runs: 1
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
Student ids like 00731 lose their leading zeros when my Apps Script writes them to the sheet. Fix it.
