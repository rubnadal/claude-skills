# Gotchas by symptom

Symptom → cause → fix. Search this file for the exact error text or behaviour you see. **Confirmed n/3** counts the three source projects where the gotcha was seen; 1/3 entries are real but less proven. When the fix is a rule that lives elsewhere, the entry points there instead of repeating it.

## Index

| Symptom | Entry |
|---|---|
| `clasp push` prints only "Skipping push." and uploads nothing | A1 |
| Changes already pushed "disappear"; `/dev` shows another branch's code | A2 |
| `clasp push`: "A file with this name already exists in the current project" | A3 |
| A file excluded in `.claspignore` (or deleted) still shows in the editor; `clasp push --force` says "Script is already up to date." | A4 |
| `clasp push`: "The caller does not have permission" | A5 |
| `clasp logs` returns nothing; `clasp run` fails with `NOT_FOUND` | A6 |
| "You do not have permission to call X. Required permissions: https://www.googleapis.com/auth/…" after adding a service; "insufficient permissions for Ui.showModalDialog" | A7 |
| Model A: a new user cannot open the app's data although they accepted the consent screen | A8 |
| A setup function works from the web but does nothing (or refuses) when run from the editor | A9 |
| After deploying, only the deployer can open the app | A10 |
| A sidebar always opens on the right | A11 |
| A field is `undefined` although the column exists | B1 |
| `'9.7'` saved as a date (9 July); later numbers read as dates (`9.5` → `8/1/1900`); `<input type="number">` reloads blank | B2 |
| `'007'` → `7`; a name `TRUE` becomes a boolean; `9:00` → `0.375`; a timestamp loses its time after rows are appended | B3 |
| A boolean flag behaves inconsistently (`true` vs `'TRUE'` vs `'true'`) | B4 |
| Dates shift by one day; the same field is a `Date` on one call and a string on the next | B5 |
| A brand-new sheet has `getLastRow()` ≈ 1000; a schema/header check fails on a fresh install | B6 |
| A manual edit in the sheet does not show in the app | B7 |
| "Not authorised" right after setup; stale data for hours after a migration or reset | B8 |
| A stored text like `=1+1` becomes a live formula after an unrelated update | B9 |
| `"2023" + 1` gives `"20231"`; a config value behaves as text | B10 |
| Two simultaneous executions both write; an execution hangs or loses its lock mid-section | B11 |
| A wizard, setup or bulk insert takes tens of seconds or minutes | B12 |
| `res is null` / "Cannot read properties of null (reading 'ok')" in a success handler; spinner hangs | C1 |
| A `null` field sent by the server does not exist on the client | C2 |
| Tab stuck on "Loading…" with an empty red error bar; a second attempt works | C3 |
| A function silently returns `null`/empty or saves an empty field, with no error | C4 |
| A context field is always `''` in production | C5 |
| "Exceeded maximum execution time"; a call dies at 6 minutes | C6 |
| The screen does not refresh after saving | C7 |
| `<?!= include('x') ?>` printed literally; blank page; all page JS dead | C8 |
| `SyntaxError: '' string literal contains an unescaped line break`, `unexpected token: keyword 'class'`, `illegal character U+274C`, `missing ) in parenthetical` | C9 |
| A screen breaks only when another screen's scripts are loaded | C10 |
| A user can do from the browser console what the UI does not allow | C11 |
| Internal link gives a blank page; JS navigation gives HTTP 403; personal-link users land on "not authorised" after a click | D1 |
| A link built from a menu, trigger or email opens a Google Drive 404 ("couldn't open the file") | D2 |
| A page opened via `/exec` links to `/dev`, which non-owners cannot open | D3 |
| After a successful push, `/exec` (phone, no owner session) still shows the old code | D4 |
| Links already emailed stop working after re-creating a deployment | D5 |
| Cannot tell which parameters reached `doGet`; `window.location.search` is empty or wrong | D6 |
| `<a href="#x">` reloads the app instead of scrolling | D7 |
| A "back" button (`history.back()`) does nothing | D8 |
| A trigger fires twice; emails sent twice | E1 |
| A bulk email stops half-way; admin alerts cannot be sent later that day | E2 |
| An action runs by itself when an email is received | E3 |
| An hourly reminder is sent twice or skipped | E4 |
| A sheet fills itself before setup; a trigger or menu fails on a sheet a migration should have added | E5 |
| Export to `.docx` does not work | E6 |
| `doc.removeFooter is not a function` | E7 |
| `Can't remove the last paragraph in the section` | E8 |
| Every exported PDF has the first document's content; Docs creation quota exhausted | E9 |
| QR code returns 404 or does not load on the target network | E10 |
| `node --check File.gs` rejects the file | F1 |
| `assert.deepStrictEqual` fails on identical-looking objects; `instanceof Date` is false in tests | F2 |
| A code graph or linter shows no `.gs` files or no cross-file calls | F3 |
| A file "never arrives" at the remote and `git status` shows nothing pending | F4 |
| Folders disappear from the working tree after merging a branch | F5 |
| A "non-admin cannot run X" test passes although the guard is missing | F6 |
| QA shows "pending" aggregates that look like a regression | F7 |

---

## A. clasp and deployment

### clasp

**A1 — "Skipping push."**
- **Symptom:** `clasp push` prints only `Skipping push.` and uploads nothing, without an error.
- **Cause:** when `appsscript.json` is among the changes clasp asks for confirmation; a non-interactive terminal answers no and the whole push is abandoned.
- **Fix:** always `clasp push --force` (top rule).
- **Confirmed:** 3/3

**A2 — Pushed changes "disappear"**
- **Symptom:** features already pushed vanish from the app; `/dev` shows code from another branch.
- **Cause:** the main checkout and every worktree share the same `scriptId`; a push from the directory without the recent changes overwrites the project, and `/dev` serves it at once. There is no isolated test environment.
- **Fix:** before every push run `pwd`, `git branch --show-current`, `cat .clasp.json`. Who pushes and to which script: `references/workflow.md §External actions`.
- **Confirmed:** 3/3

**A3 — "A file with this name already exists in the current project"**
- **Symptom:** `clasp push` fails with that message, typically while a git worktree exists inside the repo; or a fresh worktree cannot push at all.
- **Cause:** pushing from the root also finds the worktree's copy of `appsscript.json`. And `.clasp.json` is git-ignored, so a new worktree has none.
- **Fix:** `.claspignore` excludes every worktree and tool folder (`**/.worktrees/**`, `**/worktrees/**`, `**/.claude/**`); diagnose with `find . -maxdepth 4 -name appsscript.json`. Copy `.clasp.json` into each worktree before its first push. A branch can only be deployed by pushing from its own worktree.
- **Confirmed:** 1/3

**A4 — Remote files that never go away**
- **Symptom:** a file added to `.claspignore` (or deleted locally) still appears in the Apps Script editor; `clasp push --force` answers `Script is already up to date.` A tool's generated `.html` shows up as a project file.
- **Cause:** clasp compares only the files it would upload; if they all match it uploads nothing and never replaces the project. `clasp status` lists only local files. Any `.html` in the tree is uploaded by default.
- **Fix:** diagnose with `clasp pull` into a temporary folder (copy `.clasp.json` there and make sure its `rootDir` points inside that folder). Make one remote file differ (from the temp folder delete the stray file, add a newline to `appsscript.json`, `clasp push --force`), then push from the repo: a real push replaces the whole project. Verify with another temporary pull. Exclude every tool output folder and every `.html` you do not ship in `.claspignore` before the first push.
- **Confirmed:** 1/3

**A5 — "The caller does not have permission"**
- **Symptom:** `clasp push` fails with `The caller does not have permission`.
- **Cause:** clasp is logged in with another account, or the session expired.
- **Fix:** `clasp show-authorized-user` before pushing; compare with the account that owns the script; `clasp login` again if needed.
- **Confirmed:** 1/3

**A6 — `clasp logs` / `clasp run` unavailable**
- **Symptom:** `clasp logs` returns nothing; `clasp run` fails with `NOT_FOUND` for any function.
- **Cause:** both need a standard GCP project (and the Execution API); a container-bound script has neither by default.
- **Fix:** do not spend time on it. Run the function from the editor and read the editor's Executions view, or ask someone with access to do it.
- **Confirmed:** 1/3

### Install and deployment

**A7 — Missing scopes**
- **Symptom:** after adding a service the deployed app fails with `You do not have permission to call X. Required permissions: https://www.googleapis.com/auth/…`; `onOpen` or a sidebar fails with "insufficient permissions for Ui.showModalDialog".
- **Cause:** a deployment runs on the consent last given; new services add scopes that consent does not cover. With explicit `oauthScopes` nothing is inferred, and a container-bound UI needs `https://www.googleapis.com/auth/script.container.ui`.
- **Fix:** declare `oauthScopes` explicitly and add the scope in the same commit as the new service. After pushing, run any function that uses the service from the editor as the deployer and accept the dialog; existing deployments (head and versioned) then work without redeploying.
- **Confirmed:** 2/3

**A8 — Model A: Drive permission is not OAuth consent**
- **Symptom:** under `USER_ACCESSING`, a newly created user accepted the consent screen but the app cannot read the spreadsheet as them.
- **Cause:** the script reads the file with the visitor's rights; consent does not grant file access.
- **Fix:** model A only: share the file when creating the user (`addEditor` to write, `addViewer` to read) without blocking the user creation if sharing fails. Under model B never share the file (`references/security-and-api.md §Identity`).
- **Confirmed:** 1/3

**A9 — `getUrl()` is `null` without a web-app deployment**
- **Symptom:** a guided setup refuses or does nothing when run from the editor, but works from the web.
- **Cause:** `ScriptApp.getService().getUrl()` is `null` until a web-app deployment exists; using it as a guard makes the function fail from the editor.
- **Fix:** keep an editor setup next to the guided one that does not depend on `getUrl()`, and document the difference. It is still public (editor-run functions cannot end in `_`), so it stays protected by the deployer check or the one-shot property (`references/security-and-api.md §Install and reset`).
- **Confirmed:** 1/3

**A10 — Only the deployer can open the app**
- **Symptom:** right after deploying, every other account is refused.
- **Cause:** the "New deployment" dialog defaults "Who has access" to "Only myself".
- **Fix:** set "Who has access" explicitly per the chosen model; write it in the install guide (`references/workflow.md §Deployment guides`).
- **Confirmed:** 2/3

**A11 — Sidebar on the right**
- **Symptom:** `showSidebar()` always opens on the right.
- **Cause:** not configurable.
- **Fix:** use `showModalDialog` for a centred dialog.
- **Confirmed:** 1/3

## B. Sheets as a database

**B1 — Lowercase keys**
- **Symptom:** `r.User_Id` is `undefined`, no error.
- **Cause:** the read layer normalises headers to lowercase.
- **Fix:** access `r.user_id` (top rule); document hand-built objects with other keys where they are built.
- **Confirmed:** 2/3

**B2 — A decimal written as text becomes a date**
- **Symptom:** a config value "is not saved": `<input type="number">` reloads blank; the cell holds 9 July (`'9.7'` → a date) and from then on even a number written there reads as a date (`9.5` → `8/1/1900`). Integers are unaffected, so a sibling field seems fine.
- **Cause:** in a spreadsheet whose locale uses `,` as decimal separator, `setValues` of the string `'9.7'` is parsed as a date and the cell format switches to date. A test on a real sheet (`ca_ES`, `setValues`, `@` applied before the write) kept `'9.7'` as the text `"9.7"`, which then reads back as a string, not a number; one project had earlier seen `@` fail to prevent the date, cause not established.
- **Fix:** write numbers as `Number`, never as strings; keep a list of numeric keys for key/value config and convert on every write path (save, migration helper, setup defaults). Repair cells with a numeric format (`0.####`) and reset values that became dates to their default; the original cannot be recovered reliably. Plain-text format `@` is not the fix for a number: it keeps a string, and a `Number` written into an `@` column stays a `Number`.
- **Confirmed:** 3/3

**B3 — Text that Sheets converts**
- **Symptom:** `'007'` reads back as `7`; a name `TRUE` as a boolean; `9:00` as `0.375`; a timestamp loses its time part after rows are appended past the original grid; a calendar link built from `8:10` gives `T81000`.
- **Cause:** Sheets converts number-, boolean-, date- and time-looking strings unless the column is plain text; rows added by growing the grid (`insertRowsAfter`) do not inherit the column format; `'8:10'.replace(':', '') + '00'` has 5 digits.
- **Fix:** keep a per-sheet list of columns to protect (codes with leading zeros, times, timestamps, free-text names, version strings, free config values) and apply `setNumberFormat('@')` before the first write: at creation, in each migration that adds such a column, and to new rows when the append helper grows the grid. Read such codes back as strings (`String(v)`; a cell converted earlier returns a `Number`), never compare them as numbers. Build compact times with `padStart(6, '0')`. A value already converted does not come back by itself. Do not paste by hand over text columns.
- **Confirmed:** 3/3

**B4 — Booleans**
- **Symptom:** an `active` flag is sometimes `true`, sometimes `'TRUE'` or `'true'`; filters disagree.
- **Cause:** `getValues()` returns a boolean for a boolean cell and a string for imported or text cells. Tested on a real sheet (`ca_ES`, `setValues`, `@` applied before the write): an `@` column keeps strings as written (`'true'`, `'TRUE'`) and stores a JS boolean as the string `'true'`/`'false'`; a column without `@` turns `'true'` and `'TRUE'` into the boolean `true`. An older observation of `'true'` becoming a boolean in an `@` column was not reproduced.
- **Fix:** read every boolean with one helper: `v === true || (typeof v === 'string' && v.trim().toUpperCase() === 'TRUE')`, never `!== false` or truthiness; it works either way. Make the write helper refuse a JS boolean for an `@` column. Never rely on `@` against formulas (B9).
- **Confirmed:** 1/3, plus a test on a real sheet

**B5 — Dates**
- **Symptom:** dates shift by one day; the same field is a `Date` on a cache miss and an ISO string on a cache hit; `google.script.run` returns `null` because the payload held a `Date`.
- **Cause:** the cache round-trips through JSON; `new Date('2026-01-05')` is parsed as UTC midnight; `Date` does not serialise to the client.
- **Fix:** dates are ISO strings end to end. Normalise in the read function, `Utilities.formatDate(v, tz, 'yyyy-MM-dd')` for `Date` cells; build dates with `new Date(iso + 'T12:00:00')`; use `Date` only for arithmetic at the edges. Detect dates with `Object.prototype.toString.call(v) === '[object Date]'` and arrays with `Array.isArray`, never `instanceof`: `instanceof` on built-ins lies across realms, so it fails under a Node `vm` harness while working in GAS.
- **Confirmed:** 2/3

**B6 — Checkbox validation moves `getLastRow()`**
- **Symptom:** install fails on a brand-new sheet with a header/schema check error; `getLastRow()` returns ~1000.
- **Cause:** `requireCheckbox()` validation on a whole column fills every empty validated cell with `FALSE`, and `getLastRow()` counts them (rows that are only formatted are ignored).
- **Fix:** apply checkbox validation only to the rows just written, in the append helper.
- **Confirmed:** 1/3

**B7 — Manual sheet edits and stale cache**
- **Symptom:** a value edited by hand in the sheet does not show in the app.
- **Cause:** the sheet read is cached for hours; a simple `onEdit` that invalidates helps but is not fully reliable.
- **Fix:** edit through the app. After a manual edit, clear the sheet's cache key (`CacheService.getScriptCache().remove(key)`) or wait for the TTL.
- **Confirmed:** 1/3

**B8 — Stale cache after setup, seed, migration or reset**
- **Symptom:** "not authorised" right after setup (the empty users list was cached); the app serves the pre-migration sheet for up to 6 h; a reinstall fails a lookup against a freshly seeded sheet.
- **Cause:** writers that bypass the data layer do not invalidate; `CacheService` is script-scoped and survives sheet deletion.
- **Fix:** top rule: every write invalidates, and resets, seeds and migrations invalidate all sheets (`references/architecture.md §Data layer`).
- **Confirmed:** 3/3

**B9 — Formula injection through a rewrite**
- **Symptom:** a record saved as `'=1+1` becomes a live formula after an unrelated field of the same row is updated.
- **Cause:** `getValues()` returns the text without the leading apostrophe; rewriting the row writes `=1+1` raw. Plain-text format `@` does not stop formulas.
- **Fix:** top rule: neutralise on every write, including rewrites of read-back rows (`references/security-and-api.md §Input and output`).
- **Confirmed:** 2/3

**B10 — Config and injected values are text**
- **Symptom:** a year selector lists `"20231"` instead of `2024`; a numeric setting behaves as text.
- **Cause:** every `Config` value and every template-injected value is a string.
- **Fix:** parse before arithmetic, on the server and again on the client; compare injected booleans explicitly (`references/architecture.md §Config`, `§Context`).
- **Confirmed:** 2/3

**B11 — Concurrency**
- **Symptom:** two simultaneous executions both pass a "free?" check and both write; an execution hangs on a lock, or a nested call releases the caller's lock half-way.
- **Cause:** check-then-write without a lock; `LockService` is not reentrant.
- **Fix:** top rule: lock discipline, flush before release (`references/architecture.md §Concurrency`).
- **Confirmed:** 3/3

**B12 — Slow writes**
- **Symptom:** a wizard, setup or bulk insert feels frozen for tens of seconds.
- **Cause:** `appendRow`/`deleteRow`/`setValue` in a loop cost 300–1000 ms each.
- **Fix:** top rule: batch writes by header name (`references/architecture.md §Data layer`). Measure before optimising (C6).
- **Confirmed:** 3/3

## C. google.script.run and serialization

**C1 — `res` is null**
- **Symptom:** `res is null` or "Cannot read properties of null (reading 'ok')" in a success handler; the spinner hangs with no message.
- **Cause:** serialisation can deliver `null`/`undefined` (often a `Date` or class instance in the payload).
- **Fix:** check `!res || !res.ok` first (top rule; pattern in `references/client-sandbox.md §State and feedback`).
- **Confirmed:** 3/3

**C2 — `null` properties are dropped**
- **Symptom:** a field the server set to `null` is absent on the client, while the same field injected at page load is present.
- **Cause:** `google.script.run` removes properties whose value is `null`; `JSON.stringify` in `doGet` keeps them.
- **Fix:** use `''` (or another sentinel) for "present but empty"; return `''`, not `null`, for optional fields.
- **Confirmed:** 3/3

**C3 — Transport failure with an empty message**
- **Symptom:** a tab stuck on "Loading…" with an empty red error bar; a second attempt works.
- **Cause:** `withFailureHandler` fires on transport failures with an empty `e.message`, and the handler did not reset the container.
- **Fix:** every failure handler shows a translated fallback when `e.message` is empty and restores the placeholder (`references/client-sandbox.md §State and feedback`).
- **Confirmed:** 3/3

**C4 — Silent arity**
- **Symptom:** a function returns `null`/empty, or a field is saved empty for months, with no error.
- **Cause:** a call with fewer arguments does not fail; missing ones are `undefined`. Typical when a pure core and its reader wrapper have similar names.
- **Fix:** give them clearly different names (`_xCore_` / `_x_`) (`references/architecture.md §Testable logic`).
- **Confirmed:** 2/3

**C5 — Empty context placeholders**
- **Symptom:** a context field is always `''` in production although the client code that reads it looks correct.
- **Cause:** a neighbouring field was copied as a `''` literal instead of a real read; `''` is a valid falsy value, so client logic silently turns off.
- **Fix:** when adding a context field, check that every neighbour comes from a real read.
- **Confirmed:** 1/3

**C6 — Six-minute limit**
- **Symptom:** "Exceeded maximum execution time"; a dashboard call dies at 6 minutes.
- **Cause:** one execution, including one `google.script.run` call, stops at 6 minutes; often the same sheet is re-read hundreds of times.
- **Fix:** measure first: `Date.now()` per step with `Logger.log`, read the Executions view; the first hypothesis is often wrong. Then see the per-execution memo in `references/architecture.md §Data layer`.
- **Confirmed:** 1/3

**C7 — No refresh after saving**
- **Symptom:** the screen keeps old data although the reload function was called.
- **Cause:** an "already loaded" flag makes the loader return early.
- **Fix:** reset the flag or pass `force` (`references/client-sandbox.md §State and feedback`).
- **Confirmed:** 2/3

**C8 — Includes and scriptlets**
- **Symptom:** `<?!= include('x') ?>` is printed literally; a page is blank; all JS of a page is dead.
- **Cause:** `createHtmlOutputFromFile` does not run scriptlets; a conditional include breaks nested includes; a scripts file wrapped in a second `<script>`.
- **Fix:** top rule: always `createTemplateFromFile(...).evaluate()`, include scripts files bare (`references/client-sandbox.md §Templates`).
- **Confirmed:** 2/3

**C9 — Sandbox parser errors**
- **Symptom:** `SyntaxError: '' string literal contains an unescaped line break`, `unexpected token: keyword 'class'`, `illegal character U+274C` or `SyntaxError: missing ) in parenthetical` at page load, far from the cause; `node --check` passes.
- **Cause:** the iframe parser rejects nested template literals, nested function declarations and `'${x}'`, and has a size limit for inline scripts.
- **Fix:** top rule (`references/client-sandbox.md §Syntax`).
- **Confirmed:** 3/3

**C10 — Name collision between included files**
- **Symptom:** a screen breaks only when another screen's scripts are loaded on the same page.
- **Cause:** two included files declare the same top-level function; the later one wins silently.
- **Fix:** prefix helpers per screen and test for duplicates (`references/client-sandbox.md §Syntax`).
- **Confirmed:** 1/3

**C11 — Internal functions callable from the console**
- **Symptom:** a user does from the browser console what the UI does not allow.
- **Cause:** every top-level `.gs` function not ending in `_` is callable with `google.script.run`.
- **Fix:** top rule (`references/security-and-api.md §Public surface`).
- **Confirmed:** 3/3

## D. URLs and deployments

**D1 — Navigation inside the iframe**
- **Symptom:** clicking an internal link gives a blank page; a JS navigation gives HTTP 403 or the wrong page; personal-link users land on "not authorised" after clicking a button.
- **Cause:** relative links resolve against the sandbox domain; `window.location` navigates inside the iframe and drops the token.
- **Fix:** top rule: absolute `<base href>` from the stored `/exec` URL, navigate only through an `<a>` click (`references/client-sandbox.md §Navigation`).
- **Confirmed:** 3/3

**D2 — `getUrl()` outside a web request**
- **Symptom:** a link built from a sheet menu, a trigger or an email sent from them opens a Google Drive 404 ("couldn't open the file").
- **Cause:** outside a web request `ScriptApp.getService().getUrl()` returns a `…/exec` URL whose id matches no deployment. Local tests cannot see it because they stub `getUrl`.
- **Fix:** capture `/exec` inside `doGet` and read the stored value everywhere else (`references/client-sandbox.md §Navigation`).
- **Confirmed:** 3/3

**D3 — `getUrl()` returned `/dev` inside `/exec`**
- **Symptom:** opened through `/exec` on a phone, an internal link landed on `/dev`, which non-owners cannot open.
- **Cause:** observed once, with the owner's session, exact trigger not established: `getUrl()` inside `doGet` returned `/dev` and the layout used it for `<base href>`.
- **Fix:** use the stored `/exec` URL for `<base href>`; test that it wins even when `getUrl()` returns `/dev`.
- **Confirmed:** 1/3 (hedged)

**D4 — `/exec` serves an old version**
- **Symptom:** after a successful push, `/exec` (a phone, no owner session) still shows the old code; `/dev` is fine.
- **Cause:** `clasp push` updates the saved code and `/dev` (HEAD); a versioned deployment stays pinned to its version.
- **Fix:** redeploy the same deployment id: `clasp deploy -i <deploymentId> -d "<label>"` (the URL does not change), then `curl -sL <exec-url>` and grep for a string of the new view before asking for a test (behind a Google sign-in you will likely get the sign-in page instead).
- **Confirmed:** 3/3

**D5 — Re-created deployment**
- **Symptom:** links already emailed, printed or stored stop working.
- **Cause:** a new deployment gets a new `/exec` URL.
- **Fix:** never delete and re-create a deployment that links point at; publish new versions on the same id (D4).
- **Confirmed:** 1/3

**D6 — The request is invisible in the browser**
- **Symptom:** you cannot tell from the browser which parameters reached `doGet`; `window.location.search` is empty or wrong.
- **Cause:** the page runs inside a sandboxed iframe, so the client does not see the request URL. In one project the address bar showed a `script.googleusercontent.com/…/echo?user_content_key=…` URL, so it did not reveal the request either.
- **Fix:** log `JSON.stringify(e.parameter)` at the top of `doGet` and read Executions; inject parameters into the context (`references/client-sandbox.md §Navigation`).
- **Confirmed:** 2/3

**D7 — In-page anchors reload the app**
- **Symptom:** `<a href="#ranking">` reloads the app; a link to `…/exec#ranking` does not scroll on arrival.
- **Cause:** `<base target="_top">` applies to fragment links; the hash does not reach `doGet` nor `window.location`.
- **Fix:** one delegated listener with `scrollIntoView()`; read an incoming hash with `google.script.url.getLocation` (`references/client-sandbox.md §Navigation`).
- **Confirmed:** 1/3

**D8 — `history.back()` does nothing**
- **Symptom:** a back button does nothing, no error, no `setChangeHandler` callback; closing a sub-view leaves duplicate history entries.
- **Cause:** the sandboxed iframe ignores programmatic history traversal; `google.script.history` cannot remove entries.
- **Fix:** `google.script.history.push/replace` + `setChangeHandler`, `replace` on close (`references/client-sandbox.md §Navigation`).
- **Confirmed:** 1/3

## E. Email, triggers and documents

**E1 — Duplicate triggers**
- **Symptom:** a time trigger runs twice; every email arrives twice.
- **Cause:** each `ScriptApp.newTrigger()` adds one more.
- **Fix:** delete every trigger with the handler's name before creating one; reset deletes it too (`references/architecture.md §Mail and triggers`).
- **Confirmed:** 2/3

**E2 — Mail quota**
- **Symptom:** a bulk send stops half-way; admin alerts cannot go out later that day.
- **Cause:** the daily `MailApp` quota is spent by the batch.
- **Fix:** quota check, cap, per-address outcome, retry failures only, keep a reserve (`references/architecture.md §Mail and triggers`).
- **Confirmed:** 3/3

**E3 — Emailed links that act**
- **Symptom:** an action (cancel, approve) runs by itself when the email is received.
- **Cause:** mail scanners prefetch links; a GET changed data.
- **Fix:** top rule: a GET never changes data (`references/security-and-api.md §Links that change data`).
- **Confirmed:** 1/3

**E4 — Hourly trigger imprecision**
- **Symptom:** an hourly reminder is sent twice, or an item is skipped.
- **Cause:** hourly triggers fire at imprecise times.
- **Fix:** tolerance window wider than half the period plus a per-row "sent" flag (`references/architecture.md §Mail and triggers`).
- **Confirmed:** 1/3

**E5 — Migrations outside `doGet`**
- **Symptom:** opening a fresh copy of the spreadsheet creates some sheets before anyone installed; a trigger or menu fails because a sheet a migration adds does not exist yet.
- **Cause:** `onOpen` ran migrations without checking `SETUP_COMPLETED`; triggers and menus ran before any `doGet` migrated.
- **Fix:** `references/architecture.md §Migrations and setup` (where migrations run).
- **Confirmed:** 3/3

### DocumentApp and Drive

**E6 — `.docx` export**
- **Symptom:** `getAs(MimeType.MICROSOFT_WORD)` fails on a native Doc.
- **Cause:** it cannot convert native Docs.
- **Fix:** one shared helper on the Drive REST endpoint, then trash the temporary Doc:
  ```javascript
  var resp = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + docId +
    '/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  ```
- **Confirmed:** 2/3

**E7 — No `removeFooter()`**
- **Symptom:** `doc.removeFooter is not a function`; `addFooter()` throws when one exists.
- **Cause:** only `removeHeader()` exists.
- **Fix:** `var footer = doc.getFooter() || doc.addFooter(); footer.clear();`
- **Confirmed:** 1/3

**E8 — `body.clear()` throws**
- **Symptom:** `Can't remove the last paragraph in the section`.
- **Cause:** the body ends in a table or image.
- **Fix:** append an empty paragraph at the end of any document you will reuse.
- **Confirmed:** 1/3

**E9 — Repeated PDF export**
- **Symptom:** every exported PDF shows the first document's content; the daily Docs creation quota runs out.
- **Cause:** exporting the same `docId` repeatedly can return a cached export; `DocumentApp.create()` per document spends quota.
- **Fix:** create one template, `makeCopy()` it per document, export each copy once.
- **Confirmed:** 1/3

**E10 — QR codes**
- **Symptom:** the QR image returns 404, or does not load on the target network.
- **Cause:** the Google Charts QR endpoint is retired; filters block third-party domains.
- **Fix:** generate on the server and return a `data:` URI (`references/client-sandbox.md §Assets and networks`).
- **Confirmed:** 2/3

## F. Tooling and tests

**F1 — `node --check` and `.gs`**
- **Symptom:** recent `node --check File.gs` rejects the file extension.
- **Cause:** Node does not recognise `.gs`.
- **Fix:** `cat File.gs | node --input-type=commonjs`; only `SyntaxError` counts (`references/testing.md §Static checks`).
- **Confirmed:** 1/3

**F2 — `vm` realm pitfalls**
- **Symptom:** `assert.deepStrictEqual` fails on objects that look identical; `instanceof Date`/`instanceof Array` is false in the harness.
- **Cause:** objects created inside a Node `vm` context have that realm's prototypes.
- **Fix:** compare through `JSON.parse(JSON.stringify(x))` (`references/testing.md §Server harness`); type checks as in B5.
- **Confirmed:** 3/3

**F3 — Static tools blind to `.gs`**
- **Symptom:** a code graph or linter shows no backend files, or no calls between `.gs` files.
- **Cause:** tools dispatch by extension; `.gs` files share one global scope without imports.
- **Fix:** check what the tool sees before trusting it (`references/testing.md §Static checks`).
- **Confirmed:** 1/3

**F4 — Broad ignore rules**
- **Symptom:** a vendored bundle returns 404 from the site, or Node tests were never committed; `git status` shows nothing pending.
- **Cause:** a `*.js` rule in `.gitignore` (meant for local `.js` copies of `.gs`) also matches them; ignored files are not listed as untracked.
- **Fix:** add explicit negations (`!tests/*.js`, `!assets/vendor.js`) and `git add -f` once; when a file "never arrives", run `git check-ignore -v <path>`.
- **Confirmed:** 1/3

**F5 — `git rm --cached` on a merged branch**
- **Symptom:** after merging a branch that untracked local-only folders, those folders vanish from the main checkout.
- **Cause:** git applies the removal to every checkout that merges the commit.
- **Fix:** back the folders up before merging, or restore them with `git archive <commit-before> <paths> | tar -x -k`; add them to `.gitignore` in the same commit.
- **Confirmed:** 1/3

**F6 — Negative tests passing for the wrong reason**
- **Symptom:** "non-admin cannot run X" passes although the guard is missing.
- **Cause:** `assert.throws(fn)` without a matcher accepts an incidental error such as `getUi()` unavailable.
- **Fix:** match the expected message and assert nothing changed (`references/testing.md §Assertions`).
- **Confirmed:** 2/3

**F7 — Fixtures missing an author**
- **Symptom:** in QA, aggregate columns show "pending" and look like a regression of a recent change.
- **Cause:** the seed data created entries for only some authors or roles.
- **Fix:** check the fixture before calling it a regression (`references/testing.md §Assertions`).
- **Confirmed:** 1/3
