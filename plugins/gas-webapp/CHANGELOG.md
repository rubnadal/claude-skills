# Changelog — gas-webapp

## Unreleased (1.1.1)

One correction, from a second source app, and one new gotcha.

- **`clasp push` and stray remote files** (`SKILL.md` "Starting a new project" step 3; `references/gotchas.md` A4). `SKILL.md` said "`clasp push` never deletes remote files", which contradicted A4: a push that uploads anything replaces the whole project, and stray remote files survive only while every uploaded file already matches. Step 3 now says so and points to A4; A4 adds the other direction (files that exist only on another branch disappear with the next real push from the main branch, so verify with a temporary `clasp pull`) and goes from 1/3 to 2/3.
- **Blank icons** (`references/gotchas.md` E11, new; `references/client-sandbox.md` §Assets and networks; `references/testing.md` §Static checks). An icon web component such as `<iconify-icon>` renders an unknown name as nothing, with no console error; check every icon name against the provider's API in a test that skips when offline. The component also fetches icons at runtime from the provider's domain, which belongs on the list of domains to confirm with the network (hedged: inferred, not observed). 1/3.
- **Sources.** `docs/sources/ateca.md` ATECA-53 and ATECA-54; `docs/sources/inventory.md` R-129 retitled and now 2/3 (MPRO-42, ATECA-53), new R-167 (ATECA-54).

## 1.1.0 — 2026-11-10

New area: latency. The lessons come from measuring one source app (an assessment platform) before and after cutting its round trips; all of them are 1/3 so far.

- **Round trips** (`references/architecture.md` §Round trips, new section; `SKILL.md` top rule 21). Each `google.script.run` call costs about 1.7 s and each `?page=` navigation about 2.5 s regardless of the server code (measured on a versioned `/exec`), so screens are designed by the number of calls. "Save all" is one batch call: prepare each item in its own `try/catch`, write once under the lock, return per-item results and the refreshed data so no reload call follows (10 rows: ~38 s → ~3.7 s).
- **Contradiction resolved as a decision.** The 1.0.x client convention "bulk saves run as a sequential queue" (`references/client-sandbox.md` §State and feedback) is now inventory decision D-14: one batch call by default, a sequential queue only for long per-item jobs.
- **First-load data in the page** (`references/client-sandbox.md` §Templates). The page-serving function injects the responses of the same APIs the client calls on load (only `ok: true` ones, with `null` object properties stripped as `google.script.run` would); the client reads each once and falls back to the call. Dashboard: ~6 s → ~2.9 s. The point about `null` inside arrays stays hedged.
- **Concurrency** (`references/architecture.md` §Concurrency). Every writer to a sheet that a batch rewrites whole takes the same lock, single-row writers included; inside the lock, read straight from Sheets, because an unlocked reader can put a stale cache entry back after an invalidation.
- **Input validation** (`references/security-and-api.md` §Input and output). Maps of allowed ids are built with `Object.create(null)`: with `{}`, an id of `toString` passed.
- **Client** (`references/client-sandbox.md` §State and feedback). If an automatic save before navigating fails as a whole, stay on the screen.
- **Measuring latency** (`references/testing.md`, new section). An instrumentation branch that is never merged: timed calls and navigations on the client, timed reads and writes and a timing field on the server.
- **Sources.** `docs/sources/mpro.md` MPRO-51 to MPRO-57; `docs/sources/inventory.md` R-158 to R-166 and D-14 (R-97 points to D-14).
- **Eval.** New case `case-17-save-all-round-trips`.

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
