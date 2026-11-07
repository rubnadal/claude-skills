---
description: Deployment and identity model for users from two Google domains
tags: [critical, security]
runs: 2
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
Our school deploys a Google Apps Script web app from our Workspace domain (@school.example). Teachers sign in with accounts from a different Google domain (@teachers.example). Students use @school.example accounts. How should I configure the deployment (Execute as / Who has access) and how will the app know who each user is?
