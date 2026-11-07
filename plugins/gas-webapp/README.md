# gas-webapp

A Claude Code plugin with one skill, `gas-webapp-playbook`: a playbook for Google Apps Script web apps that use Google Sheets as their database. It covers the public server surface and identity models, architecture (data layer, cache, migrations, locks), the HtmlService client sandbox, Node testing with a `vm` harness, the development workflow with clasp, and a symptom-indexed list of gotchas. It also ships templates: a project `CLAUDE.md`, `.claspignore`, two `appsscript.json` identity models and a public-surface test.

## Contents

- `skills/gas-webapp-playbook/` — the skill (`SKILL.md`, `references/`, `templates/`).
- `evals/` — the `claude plugin eval` cases used to validate each release.
- `CHANGELOG.md` — release history.

## Install

```
/plugin marketplace add https://gitlab.com/rnadalb/claude-skills.git
/plugin install gas-webapp@claude-skills
```

Or copy `skills/gas-webapp-playbook/` into `~/.claude/skills/`. Full instructions, validation reports and licence: see the [repository README](../../README.md).
