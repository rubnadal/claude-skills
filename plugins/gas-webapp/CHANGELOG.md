# Changelog — gas-webapp

## 1.0.0 — 2026-11-07

First validated release, and the first one distributed as a Claude Code plugin from the `claude-skills` marketplace.

- **English.** The skill was rewritten in English (0.x was in Catalan). The skill name stays `gas-webapp-playbook`.
- **Three source projects.** The rules now come from three real apps by the author (an assessment platform, a booking system and a mobile league app) instead of two. Each rule was traced to its origin in `docs/sources/` and counts how many projects confirmed it (`confirmed n/3`); contradictions between projects became explicit decisions (for example identity model A, domain session, versus model B, execute-as-deployer plus personal `?t=` links).
- **New files.** `references/testing.md` (Node `vm` server harness, jsdom client tests, static checks, lock discipline) and `templates/`: `CLAUDE.template.md`, `claspignore.template`, `appsscript.model-a.json`, `appsscript.model-b.json` and `public-surface.test.js`.
- **Restructured references.** `security-and-api.md`, `architecture.md`, `client-sandbox.md`, `gotchas.md` (indexed by symptom) and `workflow.md`; `SKILL.md` keeps only the trigger, a "what to read" table and the top rules.
- **Validation.** Structure checks, skillspector and 16 `claude plugin eval` cases with and without the plugin, plus a one-off acceptance test with fresh agents. Reports: [`docs/validation/gas-webapp-1.0.0.md`](../../docs/validation/gas-webapp-1.0.0.md) and [`docs/validation/gas-webapp-1.0.0-acceptance.md`](../../docs/validation/gas-webapp-1.0.0-acceptance.md).

## Before 1.0.0

Unversioned standalone skill, in Catalan, copied by hand into `~/.claude/skills/`.

- **0.2.1** (2026-10-15) — From the mobile league app: `ScriptApp.getService().getUrl()` called from a menu returns a deployment that does not exist (capture the public URL in `doGet` instead), and a versioned deployment does not reflect `clasp push`. A later note (2026-11-04) added that a re-runnable setup is an escalation to admin.
- **0.2.0** (2026-10-13) — Second source, the booking system. Corrections: only a trailing `_` hides a server function from `google.script.run` (a leading `_` does not); the identity model became a choice between two models with their risks; `var` and string concatenation became a style preference; migrations run in `doGet`, with `onOpen` only behind the setup guard. Additions: public surface and its whitelist test, token identity and `rpc`, confirmation pages for email links, formula injection, script-property guards, reset risks; Node tests with `vm` and mocks, `LockService`, email and quota, triggers, soft delete, header-keyed writes, a migration runner with a log; new gotchas; rules confirmed by both projects were marked.
- **0.1.0** (2026-10-13) — First version, distilled from the assessment platform's project instructions, local skills and project memory.
