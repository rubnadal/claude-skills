---
name: gas-webapp-playbook
description: Use when starting, designing, reviewing or debugging a Google Apps Script web app that uses Google Sheets as its database (HtmlService pages, google.script.run, clasp, container-bound script) — bootstrapping a project and its CLAUDE.md, choosing the identity model (domain session or personal ?t= links under execute-as-deployer), adding or reviewing any server function the browser can call, protecting setup against being re-run, sending email or creating triggers, writing Node tests with a vm harness, or hitting an unexplained symptom such as a blank page, a 403 on navigation, "res is null", a SyntaxError only inside the GAS iframe, clasp push printing "Skipping push." or "already up to date" while the app stays old, stale data after editing the sheet, booleans, dates or leading zeros reading back wrong, a number turning into a date in a comma-decimal locale, slow bulk writes, colliding concurrent writes, or a personal-link user losing the session after clicking a link.
---

# GAS web app playbook

Distilled from three production Google Apps Script web apps backed by Google Sheets (an assessment platform with four roles, a booking system with email and triggers, a public catalogue with an anonymous landing page). Every rule here cost a real bug; no domain logic is included.

**Principle: GAS rarely fails loudly.** A mistyped value, a call with fewer arguments, a `null` dropped in transit, an internal function that turns out to be callable from the browser, or a push from the wrong directory throws nothing: it silently does something else. The rules are preventive, not corrective.

Marks: **(3/3)** confirmed independently in all three apps, **(2/3)** in two. Unmarked rules in the references come from one app; hedged ones say so — keep the hedge.

## What to read

| Situation | File |
|---|---|
| Choosing the identity model; adding or reviewing any server function; links, email, free text, setup | `references/security-and-api.md` (**always** before writing backend code) |
| File layout, data layer, cache, migrations, locks, context, wizards, mail and triggers | `references/architecture.md` |
| Node test harness, public-surface test, static checks on the client | `references/testing.md` |
| Writing or reviewing client JS/HTML (iframe parser, templates, navigation, model B client, mobile) | `references/client-sandbox.md` (before writing, not after) |
| A symptom you cannot explain | `references/gotchas.md` (symptom index at the top) |
| Planning a feature, worktrees, subagents, QA, deployment guides, closing a branch | `references/workflow.md` |
| Writing the project's own `CLAUDE.md` | `templates/CLAUDE.template.md` |

Read only the file the task needs.

## Top rules

1. **Only a trailing `_` hides a server function (3/3).** Every top-level `.gs` function whose name does not end in `_` is callable from any served page with `google.script.run`, whatever its parameters; a leading `_` hides nothing. Name internals `_name_()`; everything else starts with an identity/role guard and validates every input on the server.
2. **Public-surface test from the first commit (3/3).** A dependency-free Node test fails on any unclassified public function, on a guarded category missing its guard in the first lines, and on any client call to a non-public name. Adding it on day one is far cheaper than renaming dozens of functions later.
3. **Choose the identity model with the user before writing backend code (3/3).** Model A (`USER_ACCESSING` + `DOMAIN`, session identity) or model B (`USER_DEPLOYING` + `ANYONE`, or `ANYONE_ANONYMOUS` only for anonymous public pages; session plus personal `?t=` link). Under A every user with file access can read every sheet, so pick B whenever users span domains or one role must not see another's data.
4. **Identity is resolved on the server, by one function only (3/3).** The client never sends identity as an argument; `currentEmail_()` is the only reader of `Session.getActiveUser`, and a static test fails if any other file reads `Session.getActiveUser/getEffectiveUser`.
5. **A role inside a resource queries every membership source (2/3).** Creator column → staff table → member table → any future membership table, each with an active check; add a new source in the same commit that introduces it. Reject read-only roles on the server (hidden buttons are not access control) and test each screen with a user holding only that role.
6. **The installer cannot be re-run, and only the rightful deployer can run it (3/3).** "Installed" = the `SETUP_COMPLETED` property **or** an active admin row; the client-reachable installer refuses with `ALREADY_INSTALLED` under a lock; before installation it is protected by a deployer check or a menu-minted one-time code; setup on an installed system is an admin-only repair mode that never creates users.
7. **A GET never changes data** (1/3 — kept as a top rule because it is security-critical). A link that would change something opens a confirmation page whose button calls a guarded server function; mail scanners prefetch links, and an unguessable id is not authorisation.
8. **Neutralise formulas on every write (2/3).** Strings starting with `=`, `+`, `-` or `@` become formulas: reject them in short structured fields, prefix `'` in free text, and re-apply the neutraliser when a row read with `getValues()` is written back (the apostrophe is not returned). Plain-text format `@` does not stop formulas.
9. **Escape every output channel (3/3).** Escape `& < > " '` for every backend or user value in `innerHTML`, attributes, toasts, email `htmlBody` and server-built pages; values inside inline `on…="…"` handlers go through a `[0-9a-z_-]` whitelist helper (HTML escaping is decoded before the handler runs); inline JSON uses `JSON.stringify(v).replace(/</g, '\\u003c')`.
10. **Sheet rows come back with lowercase keys (2/3).** Access `r.user_id`, never `r.User_Id` — that is `undefined` without any error. Document hand-built objects with other keys where they are built.
11. **All writes go through one data-layer helper, by header name, in batch (3/3).** Build rows from a header → index map; never call `appendRow`/`deleteRow`/`setValue` in a loop (300–1000 ms each): one `setValues` per batch, consecutive deletes grouped.
12. **Every write invalidates its cache key; resets, seeds and migrations invalidate everything (3/3).** Key names live in one constant table; writers that bypass the data layer invalidate by hand, because `CacheService` is script-scoped and survives sheet deletion.
13. **Setup creates exactly the schema of the latest migration (2/3).** A fresh install stamps the current schema version and runs no migration, so every column, sheet or config key a migration adds goes into setup in the same commit.
14. **Script lock discipline (3/3).** Every check-then-write runs inside `LockService.getScriptLock()` with `waitLock`, a readable busy error, fresh uncached reads and release in `finally`. The lock is not reentrant — an inner acquire/release frees the caller's lock — so document which functions take it.
15. **Sheets converts what you write (3/3).** Write numbers as `Number` (in a comma-decimal locale the string `'9.7'` becomes a date); apply plain-text format `@` before the first write to columns holding leading-zero codes, times, timestamps, free-text names and version strings — at creation, in each migration that adds one, and on grid growth. Behaviour of `@` with booleans is unsettled. Read booleans with the tolerant helper in `references/gotchas.md`.
16. **Sandbox parser rules for client JS (3/3).** The iframe parser rejects code V8 accepts and reports errors far from the cause: never nest template literals 3+ levels, never declare functions inside a function that uses multi-line templates, never wrap `${}` in single quotes inside a template. Node does not catch these.
17. **Always evaluate HTML as a template; never double-wrap scripts (2/3).** Serve every page, dialog and include through `createTemplateFromFile(...).evaluate()`; a scripts file that already carries `<script>` is included bare.
18. **Capture `/exec` in `doGet`; navigate only through `<a>` (3/3).** Store the deployment URL in a script property only when it ends in `/exec` and use that value for `<base href="…" target="_top">`, emails, menus and triggers (`getUrl()` is wrong outside a web request, and was seen returning `/dev` inside one). Navigate from JS only with a real or synthetic `<a>` click, never `window.location` (403 in the iframe, and it drops a personal token).
19. **Handle every `google.script.run` response defensively (3/3).** Check `!res || !res.ok`; `null` properties are dropped in transit (use `''`); `Date`, classes, `undefined` and functions do not serialise; every failure handler shows a translated fallback when `e.message` is empty and restores the loading placeholder.
20. **`clasp push --force`, from a verified directory, then redeploy (3/3).** A non-interactive push silently skips everything when it would ask about `appsscript.json`; every checkout and worktree shares the `scriptId`, so check `pwd`, branch and `.clasp.json` first; `/exec` stays on its version until `clasp deploy -i <deploymentId>` — redeploy and `curl -sL` the URL before asking anyone to test.

## Starting a new project

1. **Decide with the user, before any code:**
   - Identity model A or B, and `ANYONE` vs `ANYONE_ANONYMOUS` (`references/security-and-api.md` §Identity).
   - Container-bound or standalone; one spreadsheet; UI languages.
   - Who the end user is and their technical level — it shapes the whole UI.
   - Whether the script in `.clasp.json` is a test or a production script.
   - Git preferences: worktrees or `main`, who commits, who pushes.
2. **Project `CLAUDE.md`:** start from `templates/CLAUDE.template.md` and fill the gaps with the user.
3. **`.claspignore`:** start from `templates/claspignore.template` before the first push (`clasp push` never deletes remote files).
4. **`appsscript.json`:** start from `templates/appsscript.model-a.json` or `templates/appsscript.model-b.json` — V8 runtime, explicit `oauthScopes` from day one, `executeAs`/`access` matching the chosen model.
5. **Public-surface test from the first commit:** copy `templates/public-surface.test.js` and fill its classification lists (`references/testing.md`).
6. **Build order that worked:** data layer + auth + setup → pure logic with tests → public functions → layout, i18n and one screen → the rest, one feature per branch.
7. **Model B:** finish surface hardening (renames, guards, non-re-runnable setup, tests) **before** switching the manifest, because the deployer's rights multiply the impact of any unguarded function (`references/workflow.md`).

## Out of scope

Not a general JavaScript or Google API guide. For business-logic bugs, debug normally. If a gotcha here does not match what you observe, measure (logs with `Date.now()`, the downloaded `.xlsx`, the browser console inside the iframe) before forcing the fit.

## Keeping this skill current

The skill lives in https://gitlab.com/rnadalb/claude-skills. When a project uncovers a new gotcha or contradicts a rule here, propose an update to the user with four parts: **symptom**, **cause**, **rule**, and **origin** (which kind of app, and whether it was observed or inferred). A contradiction becomes an explicit decision, never a silent overwrite.
