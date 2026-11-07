# Acceptance test — gas-webapp 1.0.0

Date: 2026-11-07 · Claude Code 2.1.319 · plugin `gas-webapp` (skill `gas-webapp-playbook`, version 0.9.0 installed)

Run on the 0.9.0 build; 1.0.0 adds the pre-release fixes listed in the CHANGELOG (static-check guidance, template header, wording) and the version bump.

Two fresh `claude -p` agents built the same mini-app from the same literal brief, each in an empty temporary directory outside the repo:

> Build a minimal Google Apps Script web app backed by a Google Sheet, ready to push with clasp. Requirements: an `Items` sheet (id, name, active); an admin role; a page listing active items; one server function that lets an admin add an item; users come from two Google domains (the deployer's domain and an external one); a one-time setup that creates the sheets and the first admin. Put the code in this folder (`.gs`, `.html`, `appsscript.json`, `.claspignore`). Do not run clasp.

| Agent | Command flags | Duration | Turns | Cost (USD) | Files produced |
|---|---|---|---|---|---|
| With plugin | `--permission-mode acceptEdits --allowedTools "Read,Write,Edit,Glob,Grep,Skill"` | 388 s | 37 | 1.48 | 6 `.gs`, 4 `.html`, `appsscript.json`, `.claspignore`, `README.md`, 3 Node tests |
| Without plugin | `--disable-slash-commands --permission-mode acceptEdits --allowedTools "Read,Write,Edit,Glob,Grep"` | 108 s | 11 | 0.40 | `Code.gs`, `Index.html`, `appsscript.json`, `.claspignore`, `README.md` |

## Skill usage

Checked from each run's session transcript (the session id is in `run.json`):

- **With plugin:** `Skill` called once with `gas-webapp:gas-webapp-playbook`. It then read `references/security-and-api.md`, `references/client-sandbox.md`, `templates/appsscript.model-b.json`, `templates/claspignore.template` and `templates/public-surface.test.js`. It did not open `architecture.md`, `gotchas.md`, `testing.md` or `workflow.md`.
- **Without plugin:** no `Skill` call and no `Read` call. It used only Write, Edit and Bash; Bash was not permitted, so it could not run `node`.

## Mechanical checks

- **Syntax** (`cat f.gs | node --input-type=commonjs`, plus the `<script>` blocks from each `.html` with scriptlets replaced): neither folder has a `SyntaxError`. The only errors were runtime `ReferenceError`s for GAS globals.
- **Public-surface template, unmodified:** it fails on both folders, as expected, because its `ALLOWED` list is a placeholder (`doGet, doPost, include, apiExample`). With plugin: 6 unclassified functions. Without plugin: 2.
- **Public-surface template, `ALLOWED` set to each agent's documented intended surface:**
  - With plugin (`doGet, include, rpc, onOpen, menuSetup, menuPersonalLink, setup, apiAddItem`): `Public surface OK (8 public functions, 6 files)`.
  - Without plugin (`doGet, setup, addItem`): `Public surface OK (3 public functions, 1 files)`.
  - The template checks the first-statement guard only on `api*` names, so it says nothing about `addItem`. Rule 2 below was checked by hand.
- **The with-plugin agent's own tests.** It wrote them but could not run them (no Bash). On review:
  - `app.test.js`: 9 tests OK.
  - `public-surface.test.js`: OK.
  - `static.test.js`: **FAILED** (`Client.html: JS navigation is banned`). This is a false positive: the regex matches the comment `// No navega mai amb window.location` at `Client.html:3`. The agent shipped a red test.

## Checklist (15 rules × 2 agents)

✔ = complies, ✘ = does not. File:line is relative to each agent's folder.

| # | Rule | With plugin | Without plugin |
|---|---|---|---|
| 1 | Internal functions end in `_`; no unplanned public function | ✔ 8 public functions, all intended (entry points, menu handlers, editor-run `setup`, `apiAddItem`); every helper ends in `_`; classified template run OK | ✔ 3 public functions (`setup`, `doGet`, `addItem`), all intended; helpers end in `_` (`Code.gs:82,145-189`); classified template run OK |
| 2 | Public functions verify the role in their first statement | ✔ `apiAddItem` → `requireAdmin_()` (`Api.gs:8`); `setup` → `requireDeployer_()` (`Setup.gs:12`); menu handlers call `SpreadsheetApp.getUi()` on line one, then the guard (`Main.gs:70-71,77-78`), which is the menu-handler guard defined in `security-and-api.md`; `rpc` checks the name, binds the token and then delegates to the guarded `api*` (`Main.gs:47-57`) | ✘ `setup` reads properties and throws an error containing the spreadsheet id (`Code.gs:41-43`) **before** its identity check (`Code.gs:51-53`), and it is callable from the browser; `addItem` is fine (`Code.gs:115-118`) |
| 3 | Identity read on the server, never passed as a parameter | ✔ `currentEmail_()` (`Auth.gs:64-68`) is the only reader of `Session` (`Auth.gs:23,65,85`); the client sends only the opaque token (`Client.html:48`) | ✔ `currentEmail_()` (`Code.gs:170-172`); `addItem(name)` takes no identity |
| 4 | `appsscript.json` uses model B (`USER_DEPLOYING` + `ANYONE`), never `ANYONE_ANONYMOUS` | ✔ `appsscript.json:11-12` | ✘ `"executeAs": "USER_ACCESSING"` (`appsscript.json:10`); the README tells you to share the spreadsheet with every user as Viewer, so every user can read the whole sheet |
| 5 | External users identified by a token link (or a server-verified equivalent) | ✔ `?t=<32 hex>` mapped in script properties (`Auth.gs:54-62,94-104`), applied in `doGet` and `rpc` (`Main.gs:13-14,56`); an invalid token never falls back to anonymous | ✔ (equivalent) under `USER_ACCESSING` every user authorises the script, so `Session.getActiveUser()` returns the external email, checked against the two domains (`Code.gs:163-168`). This works only because of the rule 4 failure |
| 6 | Setup cannot be re-run (refuses when already installed) | ✔ installed = `SETUP_COMPLETED` or an active admin row (`Setup.gs:42-48`); on an installed system it switches to admin-only repair and never creates users (`Setup.gs:21-28`); deployer-only (`Setup.gs:12`); runs under the lock (`Setup.gs:17-18`) | ✔ refuses when the `SPREADSHEET_ID` property is set (`Code.gs:42-43`) and when a sheet already has data (`Code.gs:83-85`); runs under the lock. It does not recognise "installed" from an admin row |
| 7 | `active` read with the dual positive check | ✔ `bool_` = `v === true \|\| 'TRUE'` string (`Data.gs:82-84`), used at `Data.gs:93`, `Auth.gs:45`, `Api.gs:15` | ✘ `r[2] === true` only (`Code.gs:150`); an imported `'TRUE'` row is hidden |
| 8 | Writes in batch (no `appendRow` in a loop) | ✔ one `setValues` per batch (`Data.gs:62`); no `appendRow`/`deleteRow` | ✔ one `setValues` per item (`Code.gs:134`); a single `appendRow` in setup, not in a loop (`Code.gs:64`) |
| 9 | Columns by header name, lowercase keys | ✔ header → key map in lowercase (`Data.gs:20-37`); writes are built from the header (`Data.gs:44-53`) | ✘ positional indexes `r[0]`, `r[1]`, `r[2]`, fixed range width 3 (`Code.gs:134,149-151`) |
| 10 | Input validation (name; formula injection `=`, `+`, `-`, `@`) | ✔ type, control characters, length, and rejection of a leading `=+-@` (`Api.gs:27-32`); the data layer also prefixes `'` (`Data.gs:76-79`) | ✘ type, trim and length are checked (`Code.gs:120-123`), but formulas rely on the `@` number format (`Code.gs:60,133`), which the skill states does not stop formulas; a leading `+`, `-` or `@` is not handled |
| 11 | Client has no 3-level templates and no `'${}'` inside templates | ✔ no backticks in any `.html` | ✔ no backticks in `Index.html` |
| 12 | Navigation without `window.location` | ✔ no JS navigation; the only match is a comment (`Client.html:3`) | ✔ no JS navigation |
| 13 | Success handlers check `!res \|\| !res.ok` | ✔ `Client.html:72` | ✘ the success handler uses `item.name` directly, with no null or `ok` check (`Index.html:44-46`). The ✘ is literal: `addItem` returns an object or throws, so the missing check never misfires in this app, but the rule is not followed |
| 14 | Explicit `oauthScopes` | ✔ `spreadsheets.currentonly`, `script.container.ui`, `userinfo.email` (`appsscript.json:5-9`) | ✔ `spreadsheets`, `userinfo.email` (`appsscript.json:5-8`) |
| 15 | `.claspignore` present and consistent | ✔ derived from the template; excludes tests, `.md`, `run.json` and `package*.json` (`.claspignore:1-19`) | ✔ allow-list: ignores everything except `appsscript.json`, `*.gs` and `*.html` (`.claspignore:2-5`) |

**Totals:**
- **With plugin: 15/15.**
- **Without plugin: 9/15.** It fails rules 2, 4, 7, 9, 10 and 13.

The acceptance threshold (≥ 13/15, and more than the agent without the plugin) is met, so no skill fixes are required.

## Gaps

These are things that went wrong, or are missing, that no current eval in `plugins/gas-webapp/evals/` covers. No eval was added in this task. The proposals are for the controller.

1. **Static checks match comments, and the agent shipped a red test.** The with-plugin agent wrote `tests/static.test.js` following `references/testing.md` §Static checks ("grep sources for … `window.location`"). The test flags its own comment (`Client.html:3`). It never ran because Bash was not allowed, so the deliverable contains a failing test the agent described as "reviewed by hand".
   - Proposed skill wording: strip comments and strings before the ban regexes (reuse `strip()` from `templates/public-surface.test.js`), and when tests cannot be run, say so and do not claim they pass.
   - Proposed eval: "write a static check that bans `window.location`" with a grader that checks the ban ignores comments.
2. **No eval covers formula neutralisation.** The agent without the plugin trusted the `@` text format to block `=…`; this is rule 8 in SKILL.md. No eval prompt or grader mentions formulas.
   - Proposed eval: "an admin form saves a free-text name to the sheet; is it safe?", with a grader for rejecting or `'`-prefixing a leading `=+-@` and for stating that `@` does not stop formulas.
3. **No eval covers header-keyed, lowercase row access.** The agent without the plugin used positional indexes (rule 9). `header` appears in critical-01 and critical-03 only incidentally.
   - Proposed eval: "add a column between two existing ones in an app that reads `r[2]`".
4. **No eval covers the guard order in an editor-run `setup()`.** The agent without the plugin read properties and leaked the spreadsheet id before its identity check. case-14 covers re-running setup, not the guard order of a public `setup`.
   - Proposed: add a grader to case-14 that the deployer/admin check comes before any read.
5. **Personal-link lifecycle is not implemented, and no eval covers it.** `security-and-api.md` says to give admins a "regenerate" action and to delete the token when a user is deleted or changes email. The with-plugin agent created tokens only (`Auth.gs:94-104`) and listed regeneration as missing. This is not one of the 15 rules.
   - Proposed eval: "an external teacher forwarded their personal link; what do we do?"
6. **`oauthScopes` is not covered by any eval.** Both agents complied here, so this is low priority.
7. **The with-plugin agent read only 2 of 6 references.** It still met every rule, using SKILL.md's top rules plus `security-and-api.md` and `client-sandbox.md`. Its `bool_` helper is the one from `gotchas.md` B4, reproduced from the summary in top rule 15. No action is needed, but it shows the top-rules summary carries most of the load.

## Test limitations

- The brief's `--allowedTools` omits Bash, so neither agent could run `node`. Both said so in their final answers.
- In `-p` mode the "decide the identity model with the user first" rule (top rule 3) cannot be exercised. The with-plugin agent listed the decisions it took on the user's behalf. The agent without the plugin did not.
- Neither app was pushed or run in Apps Script. The review is static, plus the with-plugin agent's own Node harness, run by the reviewer.
