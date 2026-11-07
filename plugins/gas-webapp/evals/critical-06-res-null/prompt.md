---
description: google.script.run drops null properties and can deliver a null result
tags: [critical, client]
runs: 2
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
My google.script.run success handler sometimes crashes with `TypeError: res is null`, and a field that my server function sets to null is missing on the client. What's going on and how do I fix it?
