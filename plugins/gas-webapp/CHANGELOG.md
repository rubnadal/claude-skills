# Changelog — gas-webapp

## 1.0.1 — 2026-11-07

Two hedged points verified on a real sheet and template, so their hedges are gone.

- **Plain-text format `@`** (`references/gotchas.md` B2, B4). With `@` applied before the write, strings stay as written and a JS boolean is stored as the string `'true'`/`'false'`; without it, `'true'` becomes a boolean and, in a comma-decimal locale, `'9.7'` a date. `@` keeps `'9.7'` as text, so the fix for numbers is still to write a `Number`.
- **`<?= ?>` with JSON** (`references/client-sandbox.md` §Templates). Inside `<script>`, `<?= ?>` prints a quoted JavaScript string, so the value arrives as a string, not an object; the rule (raw `<?!= ?>` with `<` escaped) is unchanged, now with the reason.
- **`docs/CONTRIBUTING.md`.** No longer claims that every rule cost a bug; rules that come from a risk say so.

## 1.0.0 — 2026-11-07

First validated release, and the first one distributed as a Claude Code plugin from the `claude-skills` marketplace.

- **English.** The skill was rewritten in English (0.x was in Catalan). The skill name stays `gas-webapp-playbook`.
- **Three source projects.** The rules now come from three real apps by the author (an assessment platform, a booking system and a mobile-first app with an anonymous public landing page) instead of two. Each rule was traced to its origin in `docs/sources/` and counts how many projects confirmed it (`confirmed n/3`); contradictions between projects became explicit decisions (for example identity model A, domain session, versus model B, execute-as-deployer plus personal `?t=` links).
- **New files.** `references/testing.md` (Node `vm` server harness, jsdom client tests, static checks, lock discipline) and `templates/`: `CLAUDE.template.md`, `claspignore.template`, `appsscript.model-a.json`, `appsscript.model-b.json` and `public-surface.test.js`.
- **Restructured references.** `security-and-api.md`, `architecture.md`, `client-sandbox.md`, `gotchas.md` (indexed by symptom) and `workflow.md`; `SKILL.md` keeps only the trigger, a "what to read" table and the top rules.
- **Pre-release fixes after the acceptance test (static-check guidance, template header, wording).** Static-check guidance (`references/testing.md` §Static checks): run ban regexes on source without comments and strings, and never claim tests pass without running them. Template header: `ALLOWED` in `templates/public-surface.test.js` is a placeholder, and `references/security-and-api.md` says `getUi()` on line one is a rule to check in review, not something the template enforces. Wording: one description of the third source app (a mobile-first app with an anonymous public landing page) across `SKILL.md`, the READMEs and this changelog.
- **Final review fixes.** `templates/public-surface.test.js` accepts the guard as the first statement inside a leading `try {` (the `ok_`/`fail_` wrapper of `references/architecture.md`); `SKILL.md` rule 2 and `references/testing.md` state exactly what the template checks (`.gs` files, guards on `api*` only) and list per-category guards and client-call checks as project extensions; `references/gotchas.md` A9: the editor setup stays protected by the deployer check or one-shot property; `include` keeps a whitelist of partials and partials never read data (`references/client-sandbox.md`, `references/security-and-api.md`); trigger handlers are described as idempotent and quota-bounded, not harmless; `templates/claspignore.template` ignores `tools/`, `scripts/` and `package*.json`.
- **Validation.** Structure checks, skillspector and 16 `claude plugin eval` cases with and without the plugin, plus a one-off acceptance test with fresh agents. Reports: [`docs/validation/gas-webapp-1.0.0.md`](../../docs/validation/gas-webapp-1.0.0.md) and [`docs/validation/gas-webapp-1.0.0-acceptance.md`](../../docs/validation/gas-webapp-1.0.0-acceptance.md).

## Before 1.0.0

Unversioned standalone skill, in Catalan, copied by hand into `~/.claude/skills/`.

- **0.2.1** (2026-10-15) — From a mobile-first app with an anonymous public landing page: `ScriptApp.getService().getUrl()` called from a menu returns a deployment that does not exist (capture the public URL in `doGet` instead), and a versioned deployment does not reflect `clasp push`. A later note (2026-11-04) added that a re-runnable setup is an escalation to admin.
- **0.2.0** (2026-10-13) — Second source, the booking system. Corrections: only a trailing `_` hides a server function from `google.script.run` (a leading `_` does not); the identity model became a choice between two models with their risks; `var` and string concatenation became a style preference; migrations run in `doGet`, with `onOpen` only behind the setup guard. Additions: public surface and its whitelist test, token identity and `rpc`, confirmation pages for email links, formula injection, script-property guards, reset risks; Node tests with `vm` and mocks, `LockService`, email and quota, triggers, soft delete, header-keyed writes, a migration runner with a log; new gotchas; rules confirmed by both projects were marked.
- **0.1.0** (2026-10-13) — First version, distilled from the assessment platform's project instructions, local skills and project memory.
