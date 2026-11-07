---
description: Emailed GET link that confirms a booking
tags: [security]
runs: 1
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
I email users a link `.../exec?action=confirm&id=123` that confirms their booking when clicked. Any problem with that?
