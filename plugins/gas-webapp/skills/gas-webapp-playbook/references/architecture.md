# Architecture

Reference architecture for a container-bound Apps Script web app that uses one Google Sheets spreadsheet as its database. Names are suggestions; keep the responsibilities. Security rules (public surface, identity, guards) live in `references/security-and-api.md`; read it before writing backend code.

## Base decisions

| Decision | Choice | Why |
|---|---|---|
| Binding | Container-bound script, `SpreadsheetApp.getActiveSpreadsheet()` | The deployer copies the sheet with the script attached; no spreadsheet id to configure. |
| Storage | One spreadsheet of normalised vertical sheets; ids from `Utilities.getUuid()` | Several spreadsheets multiply permissions and migrations. |
| Configuration | Script properties for machine state (install flag, schema version, public URL, tokens) plus an admin-editable key/value `Config` sheet | Nothing hard-coded. |
| Deletion | Soft delete for anything history points at | Historical queries stay consistent. |
| Policy | Snapshot global policy into each resource at creation | Policy changes never apply retroactively. |
| Identity model | Project decision | `references/security-and-api.md` §Identity. |

- **Soft delete:** deleting a record only sets a status column; lists hide inactive records by default and offer a toggle to show them. Delete rows physically only for disposable data (queues, logs, drafts).
- **Snapshot policy:** when a resource is created, copy the global settings it depends on (rounding mode, weights, permissions) into its own row, compute from that copy, and let only an admin edit it afterwards.

## Files

- Server: entry point (`doGet`, `include`, page serving), auth, data layer, pure logic, one file per domain area, migrations, setup.
- Client: one layout, one view plus one scripts file per screen, shared styles, an i18n core plus one dictionary per language (`references/client-sandbox.md`).
- All `.gs` files share **one global scope**, whatever folder they sit in. A function name declared twice silently keeps one of them; the public-surface test fails on duplicates (`references/testing.md` §Static checks).
- Optional subfolders (for example `server/` and `web/`), hedged — seen in one project: with clasp's `rootDir` at the repo root, remote file names keep the folder (`web/layout`), so reference templates by path (`include('web/layout')`). clasp's default script extensions include `.js`, so any Node tooling left un-ignored would be pushed as server code (a risk, not an observed incident): list tooling folders, `tests/`, `node_modules/` and `package.json` in `.claspignore`, and add a test that every `.gs` lives under the server folder and every `.html` under the client folder. See `references/gotchas.md` §clasp.

## Data layer

All sheet access goes through one file. Core rules (lowercase keys, writes by header name in batch, invalidate on every write) are top rules in `SKILL.md`; the detail:

| Function | Notes |
|---|---|
| `sheetToObjects_(sheet)` | Keys normalised to lowercase (`r.user_id`, never `r.User_Id`); dates normalised to `'YYYY-MM-DD'` at read time (`references/gotchas.md` §Sheets as a database); cached. |
| `findById_`, `findRows_(sheet, filter)` | Built on `sheetToObjects_`; return copies. |
| `appendRows_(sheet, objs)` | Row built from a header → index map; absent fields → `''`; one `setValues`. |
| `updateRows_(sheet, filter, patch)` | Whole rows, one `setValues`. |
| `deleteRows_(sheet, filter)` | Groups consecutive rows into one `deleteRows` call each. |
| `invalidateCache_(sheet)` / `invalidateAllCaches_()` | Called by every writer; the all-sheets variant by resets, seeds and migrations. |

- Never call `appendRow`/`deleteRow`/`setValue` in a loop: each costs 300–1000 ms.
- Hand-built objects whose keys are not lowercase sheet headers are an exception; document it where they are built.
- **Headers:** create header names from setup and migrations, so the exact names are known, and match them exactly after normalisation. Only when a header may have been typed or pasted by a human, match tolerantly and treat a missing optional column as empty. Hedged: the one observed mismatch had no established cause; stripping zero-width characters or NFC normalisation is a suggestion, not an observation.

### Caching

- Cache **raw sheet reads only**: each sheet's rows in `CacheService.getScriptCache()` for 6 h. Cache the empty result too. Wrap `put` in `try/catch` — a value above 100 KB throws.
- Keep cache key names in one constant table; never type a key as a string literal at a call site.
- Every data-layer write invalidates its sheet's current key. Writers that bypass the layer (setup, seed, migrations) invalidate by hand; resets and migration runs call `invalidateAllCaches_()`, because the script cache survives sheet deletion.
- **Per-execution memo:** keep a module-global `sheet → rows` map so a sheet is read from Sheets at most once per execution, even when it is above 100 KB and never fits in the cache. Read functions return copies, never the internal array; filter callbacks only compare and never mutate the row; invalidation clears the memo too.
- Do not add a cache of computed results (dashboards, aggregates) unless a measurement shows the need: invalidating it at every write point costs more than it saves. Before relying on a cache someone documented, grep for it — it may not exist.
- Measure with a realistic data volume (`Date.now()` per step) before optimising.

## Config

- Every `Config` sheet value arrives as text: parse before arithmetic (`parseInt(v, 10)`), read booleans with the tolerant helper (`references/gotchas.md` §Sheets as a database).
- Write numeric config values as `Number`, never as numeric strings: in a comma-decimal locale `'9.7'` becomes a date (`references/gotchas.md` §Sheets as a database).
- Two readers: operations use a **strict** reader that throws a coded error on a bad value; anything that renders a page uses a **tolerant** reader that falls back to the default and logs a warning, so a hand-typed bad value cannot take the app down.
- No duplicate keys: `_ensureConfigKey_(key, default)` checks existence first and never overwrites a user value. If duplicates already exist, a repair migration removes them, keeping the row that updates write to.

## Public functions

```javascript
function apiSaveItem(resourceId, payload) {
  try {
    requireRole_('EDITOR', resourceId);           // first statement
    return ok_(saveItem_(resourceId, payload));
  } catch (e) {
    console.error('apiSaveItem', e);
    return fail_(e.code || 'INTERNAL_ERROR');
  }
}
function ok_(data) { return { ok: true, data: data }; }
function fail_(code) { return { ok: false, error: code }; }
function coded_(code, message) { var e = new Error(message || code); e.code = code; return e; }  // throw coded_('NOT_AUTHORISED')
```

- Client-called functions never throw to the client. They return `{ok:true, data}` or `{ok:false, error}` where `error` is a **stable code** that exists in every i18n dictionary; log the real message on the server.
- Optional fields in returned data are `''`, not `null` (`references/gotchas.md` §google.script.run).
- An `api*` prefix helps reading but is not what makes a function public — the missing trailing `_` is (`references/security-and-api.md` §Public surface).
- **Partial success after an irreversible step:** once the main change is committed, keep it and report precisely (`{ok:true, data:{mailSent:false}}`). Run secondary cleanups and side effects outside the main `try`, each in its own `try`, with a degraded fallback instead of failing the whole operation.

## Testable logic

- Split every calculation into a pure core and a reader wrapper: `scoreCore_(rows, settings)` is pure; `score_(resourceId)` reads the sheets and calls it. Give them clearly different names: a call with the wrong arity fails silently.
- Missing input yields `null`, never `0` or `NaN`. Handle states the UI cannot produce today — a manual sheet edit can.
- One filtering rule (active records, visible rows), shared by every view, export and report.
- **Rounding:** one pure function owns the rounding policy. It first removes binary floating-point noise (`7.499999999999999` → `7.5`, e.g. `Math.round(x * 1e9) / 1e9`), then rounds. Every view, export and report calls it.

## Context

- `doGet` injects one context object (`APP_CONTEXT`: user, current resource or `null`) instead of loose globals; add new fields to it, never new globals. Injection mechanics: `references/client-sandbox.md` §Templates.
- Anything injected as text is a string: convert on the server before injecting and again on the client before arithmetic; compare booleans explicitly (`=== true`).
- Public pages: compute everything in one serialisable function and inject it in the same pass (`references/security-and-api.md` §Public pages).

## Round trips

Latency in a GAS web app is mostly a fixed cost per round trip, not your code. Measured in one app (identity model B, `/exec`): ~1.7 s per `google.script.run` call (1.2–2.0 s) while the server code ran 40–170 ms, and ~2.5 s to first byte per `?page=` navigation while `doGet` code ran 0.2–0.7 s. Count calls per user action before optimising anything else; measure with `references/testing.md` §Measuring latency.

- **One call per user action.** A screen that loads, saves or refreshes with several calls pays the fixed cost each time.
- **Save all = one batch call** (D-14 in the inventory). Split each save into `prepare_(item)` (validate and compute, no write; returns `{action: 'update', id, data}` or `{action: 'append', data}`, or throws) and a writer. The batch API prepares each item in its own `try/catch`, rejects a key repeated in the same batch, writes everything with one `updateRows_` plus one `appendRows_` under the lock (§Concurrency), and returns one result per item:

```javascript
function saveBatch_(sheet, items, keyOf, prepare) {
  return withLock_(function () {
    refreshFromSheets_(sheet);                 // fresh read, see §Concurrency
    var seen = Object.create(null), preps = [], results = [];
    items.forEach(function (item) {
      var r = { id: String(item.id || '') };
      try {
        var k = keyOf(item);
        if (seen[k]) throw new Error('Duplicate item in batch');
        seen[k] = true;
        preps.push(prepare(item));
        r.ok = true;
      } catch (e) { r.ok = false; r.error = e.message; }
      results.push(r);
    });
    if (preps.length) writePrepared_(sheet, preps);  // one updateRows_ + one appendRows_
    return results;
  });
}
```

  Single-record writers reuse the same `prepare` function, so the validation exists once. Measured: 10 rows saved and repainted in ~3.7 s instead of ~38 s with a per-row queue.
- **The save returns what the screen repaints** (the refreshed form and any summary it shows), built with the same internal readers as the read APIs, so the client makes no reload call. Build that part inside a `try/catch` that yields `null`: a failure after the write must not be reported as "nothing saved". Repaint only when no item failed, so rows in error keep what the user typed.
- **First-load data travels with the page** (`references/client-sandbox.md` §Templates): the page needs no call on load.
- A read that misses the cache costs 0.4–2 s even for a small sheet, and each `CacheService.get` 15–250 ms; a call that reads ten cached sheets spends a few hundred milliseconds on cache reads alone.

## Concurrency

The script-lock top rule is in `SKILL.md`. Use one helper:

```javascript
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { throw coded_('BUSY'); }  // readable "busy"
  try {
    try { return fn(); } finally { SpreadsheetApp.flush(); }
  } finally { lock.releaseLock(); }
}
```

- Flush before releasing, so the next execution never reads writes Sheets has not applied yet.
- The lock is **not reentrant**: an inner acquire/release frees the caller's lock mid-section. Document in the helper's header which functions take the lock. Functions needed both inside and outside a lock come in pairs: `xNoLock_` (body) and `x_` (wrapper that takes the lock). If a locked section needs a value from a locking function, get it before entering.
- Inside the lock, read fresh (bypass the cache for the rows you check). Invalidating the cache key is not enough: a reader that does not take the lock can put a stale copy back after the invalidation. Read the sheet straight from Sheets and store the rows in the per-execution memo, so the rest of the locked section sees them.
- **Every writer to a sheet that some path rewrites whole takes the same lock.** A batch `updateRows_` reads the whole range and writes it all back, and `appendRows_` picks its start row with `getLastRow()`; a single-row update that lands between the batch's read and write is lost without an error. Batch and single-record writers to those sheets share one lock helper (one app; found in review before release).
- **Corrections carry their base value:** the client sends the value it displayed when the edit opened; inside the lock the server compares it with the fresh row and refuses with a dedicated code (e.g. `STALE_VALUE`) if it changed; the client discards its draft and reloads.

## Bulk operations

- Before any bulk delete, `makeCopy` the spreadsheet into an archive and abort if the copy fails.
- Parse dates defensively in bulk jobs: accept `Date`, ISO strings and the local text format; keep and log rows whose date is not recognised instead of deleting them.
- Without transactions, order multi-step writes so a mid-way failure is recoverable: first write the change that makes leftovers harmless (parent → pending), then delete children; log the previous value before destroying it. For every multi-sheet write ask "what if it stops here?".
- An execution stops at 6 minutes (`references/gotchas.md` §google.script.run).

## Migrations and setup

Top rule in `SKILL.md`: setup creates exactly the schema of the latest migration.

**Runner checklist**
- [ ] `CURRENT_SCHEMA_VERSION` constant in code; `SCHEMA_VERSION` in script properties.
- [ ] One ordered, append-only `MIGRATIONS` array of `{version, description, fn}`; never prune it.
- [ ] Save the version after **each** successful migration; log with a searchable prefix (`[MIGRATION]`).
- [ ] On error: log and stop, do not block the app. If the stored version is not a number, throw instead of re-running everything.
- [ ] Installs older than the migration system are stamped as v1.
- [ ] Before adding a migration, check the real current version in code (not in docs).

**Where they run**
- [ ] On every `doGet`, behind a lock-free fast path: read the version, return if current; else take a dedicated migration lock (longer timeout), re-read, migrate, flush, release. Without the fast path every hit queues on the lock. Small single-domain apps may skip the lock.
- [ ] Time-trigger handlers and menu items that touch the schema migrate first.
- [ ] `onOpen` migrates only when `SETUP_COMPLETED` is set.

**Each migration**
- [ ] Additive and idempotent: built from `_ensureColumn_`, `_ensureSheet_`, `_ensureConfigKey_`; never deletes or rewrites user data. Obsolete columns stay, documented as legacy.
- [ ] Works on `SpreadsheetApp` directly, not through business functions; never calls a function that takes the script lock.
- [ ] Invalidates the cache itself (`invalidateAllCaches_()`).
- [ ] Applies plain-text format to new text columns before the first write (`references/gotchas.md` §Sheets as a database).
- [ ] The same commit adds the column, sheet or key to setup; a fresh install stamps `SCHEMA_VERSION = CURRENT_SCHEMA_VERSION` and runs no migration.

**Setup**
- Re-run protection, deployer check and repair mode: `references/security-and-api.md` §Install and reset.
- Never touch foreign sheets with content: reuse or delete only completely empty non-schema sheets (`getLastRow() === 0 && getLastColumn() === 0`, such as the locale-named default sheet); never delete or rename a sheet with content.
- A retry after a half-finished install refuses instead of creating a second admin.

**Sheet-menu installer** (for a non-technical deployer; seen in one project)
- `onOpen` offers only "Install…" while `SETUP_COMPLETED` is missing, with a toast that explains the "unverified app" consent screen.
- After install, the menu offers maintenance items: public URL, my personal link, guide, clear cache.
- Dialogs receive everything precomputed in the template; menu handlers follow `references/security-and-api.md` §Editor-run functions.

## Wizards

**Multi-step creation checklist**
- [ ] Never re-save a completed creation step; "back" reuses "go to step N".
- [ ] A step that deletes saved items calls a real delete endpoint, looks items up by identity (not by position) and guards against double clicks.
- [ ] Anything that invalidates a later step marks that step incomplete.
- [ ] A mode that is structurally the same as an existing entity is a boolean column of that table, not a new table.
- [ ] Switching a branching option, or regenerating the rows of one mode, deletes the abandoned branch's rows (those flagged for the other mode).

**Partial save with merge**
- [ ] Three states in the payload: key with a value = set; absent key = leave unchanged; key with `null` = clear deliberately. Without the third state a saved value can never be removed.
- [ ] A correction updates the same row; never add a parallel row that would skew aggregates.

## Mail and triggers

Choose inline sending by default; use a queue when user actions trigger notifications at volume, when the deployer has a small consumer quota, or to remove the timing side channel of an anonymous "send me my link" endpoint.

**Bulk sending checklist (inline)**
- [ ] Validate and dedupe all recipients first; if any is invalid, send nothing.
- [ ] Check `MailApp.getRemainingDailyQuota()` against the batch before sending; cap recipients per call.
- [ ] Return `{sent, skipped, failed}` per address; the UI retries only the failures.
- [ ] Never regenerate credentials (tokens, codes) on a resend.
- [ ] Do not take the lock in the outer sender if per-item helpers take it.
- [ ] Escape user values in `htmlBody` (`references/security-and-api.md` §Input and output).
- [ ] Keep a reserve: bulk and anonymous senders stop at `remaining <= reserve` (a `Config` key) and report the rest as pending; only admin alerts may go below it.
- [ ] Demo people use the reserved `.invalid` TLD (addresses ending in `@demo.invalid`); every sender skips them, counting them neither as sent nor as pending.

**Queue checklist** (seen in one project)
- [ ] Actions append queue rows (`id, person, type, data JSON, created, state, sent_at, attempts`) inside their own lock, in one `setValues`.
- [ ] A 5-minute trigger groups pending rows per person into one mail, caps people per run and stops at the quota reserve.
- [ ] Recipients who cannot receive and unknown notice types are marked `skipped` — never an empty mail.
- [ ] With nothing pending, the handler returns without taking the lock.
- [ ] Classify `MailApp` errors: a recipient error increments that person's attempts and the run continues; a service or quota error stops the run without touching attempts. Log every failure with a searchable prefix.

**Time triggers**
- One `manageTrigger_(enable)` deletes every trigger whose handler has the target name before creating a new one.
- The handler keeps a stable public name (renaming it orphans the installed trigger), takes no parameters, returns nothing and is idempotent (marks each row sent) within the quota reserve, because under model B anyone signed in can call it repeatedly. Every reset deletes the trigger.
- Hourly triggers are imprecise: select items whose target time falls within a tolerance wider than half the trigger period, and mark each row as sent, so overlapping runs never send twice.

## Persona

Confirm the end user's technical level at the start of the project. For a low-tech audience: one-click direct interactions, always-visible actions, no menu for a single item, immediate feedback (spinner, confirmation, toast). See `references/workflow.md` §Designing with the user.
