# Consolidated inventory — gas-webapp-playbook v1.0.0

One deduplicated rule list built from the three per-project inventories (`mpro.md`, `ateca.md`, `barra.md`) and the previous skill v0.2.1. It drives the content of the new English skill.

How to read it:
- **Confirmed** counts the three projects (MPRO, ATECA, BARRA). A rule known only from v0.2.1 cites the v0.2.1 section; v0.2.1 itself was distilled from MPRO and ATECA, so such a rule counts as 1/3 unless a project inventory confirms it again.
- For MPRO entries marked "yes — partial" (and the equivalent ATECA/BARRA entries), only the new part is treated as new; the rule text below already merges the old and the new part.
- **Hedged** in a rule means the source flagged it as unverified, inferred or seen once; the skill must keep the hedge.
- Contradictions are never resolved silently: each one is a `D-NN` in "Decisions" and the affected rules point to it.
- Domain words are generalised: "record", "resource" (the entity users are members of), "membership table".

Areas: Security and public API · Architecture · Client · Testing · Gotchas · Workflow.

---

## Security and public API

### R-01 — Only a trailing underscore hides a server function
- **Rule:** Every top-level `.gs` function whose name does not end in `_` is callable from any served page with `google.script.run`, whatever its parameters; a leading `_` hides nothing. Internal functions end in `_` (`_name_()` reads as internal on both sides), and everything else needs an identity/role guard as its first statement and validates every input on the server (ids, numbers, allowed values, business rules — R-30).
- **Confirmed:** 3/3 (MPRO-13, ATECA-01, BARRA-02, BARRA-04)
- **Destination:** SKILL.md (top rule)

### R-02 — The "harmless" public category is a near-empty exception list
- **Rule:** A public function is not harmless if it reads any sheet, config key or property, and a non-serialisable parameter is luck, not access control: rename it to `_` and fix the callers (see D-03). Re-run the public-surface review after every feature that adds server code.
- **Confirmed:** 1/3 (ATECA-02; contradicts v0.2.1 seguretat-api §1)
- **Destination:** references/security-and-api.md §Public surface

### R-03 — Classify every public function and check a guard per category
- **Rule:** Each public function belongs to one category with its own first-lines guard: client API (identity/role guard), entry point (`doGet`, `doPost`, `include`, `onOpen`, `rpc`), unauthenticated endpoint (rate-limited, identical answer), menu handler (`SpreadsheetApp.getUi()` on line one), trigger handler (0 parameters, safe if a client calls it), editor-run function (one-shot property or admin guard), sheet-dialog function (one-time code). Trigger, menu and entry-point names go in the `rpc` deny-list.
- **Confirmed:** 3/3 (MPRO-13, MPRO-34, ATECA-13, ATECA-26, ATECA-43, BARRA-03, BARRA-04)
- **Destination:** references/security-and-api.md §Public surface

### R-04 — Menu handlers call `SpreadsheetApp.getUi()` on their first line
- **Rule:** A menu handler must be public (menus call by name), and `getUi()` only throws outside the sheet when it is reached, so it goes first, before any side effect; enforce it in the surface test.
- **Confirmed:** 1/3 (BARRA-03; v0.2.1 seguretat-api §1 table)
- **Destination:** references/security-and-api.md §Public surface

### R-05 — Renaming for visibility: grep the client first, the docs after
- **Rule:** Before renaming a function to `_`, grep every client file (if the client calls it, it needs a guard, not a rename); do large renames mechanically over the AST, then review strings that name functions (`addItem('…', 'handler')`, docs, diagnostic snippets). A trailing `_` also hides the function from the editor's Run menu.
- **Confirmed:** 2/3 (MPRO-13, ATECA-01, ATECA-50)
- **Destination:** references/security-and-api.md §Public surface

### R-06 — A public-surface test from the first commit
- **Rule:** A dependency-free Node test fails on any public function that is not classified, on a guarded category without its guard in the first lines, and on any client call to a name that is not a public server function; adding it on day one is far cheaper than renaming dozens of functions later.
- **Confirmed:** 3/3 (MPRO-34, ATECA-43, BARRA-04)
- **Destination:** SKILL.md (top rule)

### R-07 — Choose the identity model with the user before writing backend code
- **Rule:** Decide model A (`USER_ACCESSING` + `DOMAIN`, session identity) or model B (`USER_DEPLOYING` + `ANYONE`/`ANYONE_ANONYMOUS`, session plus personal `?t=` link) at project start, using D-01 and D-02; under model A any user with file access can read every sheet, so pick B whenever users span domains or one role must not see another's data.
- **Confirmed:** 3/3 (MPRO-01, ATECA-03, BARRA-01)
- **Destination:** SKILL.md (top rule); also templates/appsscript.model-a.json, templates/appsscript.model-b.json

### R-08 — Identity is resolved on the server, by one function only
- **Rule:** The client never sends identity as an argument; one function (`_currentEmail_()`) is the only reader of `Session.getActiveUser`, and a static test fails if any other `.gs` file reads `Session.getActiveUser/getEffectiveUser`.
- **Confirmed:** 3/3 (MPRO-03, ATECA-03, BARRA-01)
- **Destination:** SKILL.md (top rule)

### R-09 — Per-execution identity lives in globals set at every entry point
- **Rule:** GAS re-initialises top-level globals on each execution, so a token-derived identity can live in module globals filled only by one setter (which clears them first and accepts only active users), called at the start of `doGet` and inside `rpc`. Never persist identity in cache or properties keyed by anything the client controls.
- **Confirmed:** 2/3 (MPRO-04, ATECA-03)
- **Destination:** references/security-and-api.md §Identity

### R-10 — Model B: session email exists only for the deployer's domain
- **Rule:** Under `USER_DEPLOYING`, `Session.getActiveUser().getEmail()` is `''` for accounts outside the deployer's domain, so resolution order is: session email of an active user → token fixed for this execution → raw session value (for the login screen). Derive the deployer's domain from `Session.getEffectiveUser()`; same-domain users never get a token injected.
- **Confirmed:** 2/3 (MPRO-02, ATECA-03)
- **Destination:** references/security-and-api.md §Identity

### R-11 — Under `USER_DEPLOYING`, the spreadsheet is shared with nobody
- **Rule:** The app runs with the deployer's rights, so it never calls `addEditor`/`addViewer` and the install guide says never to share the file; a static test greps `.gs` for those calls and asserts `executeAs`/`access` in `appsscript.json`.
- **Confirmed:** 1/3 (MPRO-01, MPRO-37)
- **Destination:** references/security-and-api.md §Identity; also templates/appsscript.model-b.json

### R-12 — An empty identity never reaches a comparison
- **Rule:** Every identity lookup returns "not authorised" when the trimmed email is empty, before reading any sheet; otherwise `''` matches a row with an empty email cell.
- **Confirmed:** 1/3 (ATECA-05)
- **Destination:** references/security-and-api.md §Identity

### R-13 — Normalise emails on every comparison and on write
- **Rule:** One `_normEmail_()` (`toLowerCase().trim()`) applied to the session email, token keys, user lookups, duplicate detection, bulk recipient lists and before saving; compare normalised on both sides because legacy rows may hold mixed case.
- **Confirmed:** 2/3 (MPRO-14, ATECA-25)
- **Destination:** references/security-and-api.md §Identity

### R-14 — Reusable guards that throw, with a validated role hierarchy
- **Rule:** Guards such as `_requireUser_()`, `_requireAdmin_()`, `_requireRole_([...])` or `checkAccess_(minRole, resourceId)` throw and return the email; an inactive user is not identified; the guard first throws if the requested role is not in the hierarchy array (`indexOf === -1` would let comparisons pass).
- **Confirmed:** 2/3 (MPRO-16, ATECA-16)
- **Destination:** references/security-and-api.md §Identity

### R-15 — Harden the `rpc` dispatcher like the arbitrary-call primitive it is
- **Rule:** Refuse unless the name matches `^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]$`, is not in the deny-list (`rpc`, `doGet`, `doPost`, menu and trigger handlers), is an own function of the global object and is not native (`Function.prototype.toString` without `[native code]`); non-array `args` → `[]`. A non-empty invalid token throws a stable code, never falls back to anonymous.
- **Confirmed:** 3/3 (MPRO-05, ATECA-04, BARRA-03)
- **Destination:** references/security-and-api.md §Identity

### R-16 — Personal-link tokens: format, storage, lifecycle
- **Rule:** 32 lowercase hex from `Utilities.getUuid()`, format-checked before any lookup; a two-way map in script properties (`AUTH_T_<token>` → email, `AUTH_E_<email>` → token, ~130 bytes per user against the 500 KB limit), permanent until an admin regenerates; create/regenerate/delete under the script lock and delete on user deletion or email change.
- **Confirmed:** 2/3 (MPRO-06, ATECA-03)
- **Destination:** references/security-and-api.md §Identity

### R-17 — A distributable template carries no live credentials
- **Rule:** The "prepare template" reset deletes every installation property including all token keys (iterate `getKeys()` by prefix) and every cache key, and a test asserts no token key survives.
- **Confirmed:** 1/3 (MPRO-07)
- **Destination:** references/security-and-api.md §Install and reset

### R-18 — App links: one builder, tokens only for active users, never on shared links
- **Rule:** Build every link with one helper that reads the stored base URL (R-77) and appends `t=` only for an active user; send one email per recipient when the link is personal; QR codes, printed links and group notifications never carry a token. Tell users that a URL copied from the address bar carries their link, and give admins "regenerate".
- **Confirmed:** 2/3 (ATECA-08, MPRO-06, MPRO-43)
- **Destination:** references/security-and-api.md §Identity

### R-19 — "Send me my link": the only unauthenticated API, constrained
- **Rule:** Always return the same answer (exists or not, throttled or not, invalid input or internal error); validate and length-cap the email; per-address throttle in `CacheService` and a global cap counted under the lock; send only to active users and reuse the existing token. Document the accepted residual risks (timing side channel, global-cap exhaustion) next to the code; see D-11 for removing the timing channel.
- **Confirmed:** 3/3 (MPRO-10, ATECA-09, BARRA-05)
- **Destination:** references/security-and-api.md §Identity

### R-20 — One-off emailed actions use single-use codes, not personal tokens
- **Rule:** Issue a code stored with a timestamp and a fixed expiry, keep one live code per subject, sweep expired codes when minting, and require a confirmation click; never embed the approver's personal link.
- **Confirmed:** 1/3 (ATECA-07)
- **Destination:** references/security-and-api.md §Links that change data

### R-21 — A GET never changes data
- **Rule:** A link that would change something opens a confirmation page that validates the id format, shows one generic message for "not yours / does not exist / no identity", and only for the owner offers a button that calls a guarded server function; email scanners prefetch links and an unguessable id is not authorisation.
- **Confirmed:** 1/3 (ATECA-06; v0.2.1 seguretat-api §3) — exception to the ≥2/3 preference: security-critical and a v0.2.1 top rule (mail scanners prefetch links)
- **Destination:** SKILL.md (top rule)

### R-22 — Role inside a resource: query every membership source; enforce read-only on the server
- **Rule:** The role resolver checks creator column → staff table → member table → any future membership table, each with an active check, and a new source is added in the same commit that introduces it; read-only roles and historical modes are rejected by the server, because hidden buttons are not access control. Test each screen with a user holding only that role.
- **Confirmed:** 2/3 (MPRO-15, ATECA-16)
- **Destination:** SKILL.md (top rule)

### R-23 — The installer cannot be re-run and only the rightful deployer can run it
- **Rule:** "Installed" = the `SETUP_COMPLETED` property or an active admin row; the client-reachable installer refuses with `ALREADY_INSTALLED` under a lock, and before installation it is protected by a deployer check or a menu-minted one-time code (D-10); setup in an installed system is a repair mode that requires admin and never creates users.
- **Confirmed:** 3/3 (MPRO-08, MPRO-09, ATECA-14, BARRA-02)
- **Destination:** SKILL.md (top rule)

### R-24 — Editor-run and destructive functions need a one-shot guard
- **Rule:** Functions run from the editor cannot end in `_`, so guard each with a script property set to `'true'` by hand and deleted by the function on use (or an admin guard for editor test functions); this covers template reset, demo data and repair.
- **Confirmed:** 2/3 (ATECA-13, MPRO-13)
- **Destination:** references/security-and-api.md §Editor-run functions

### R-25 — Close the install window immediately
- **Rule:** Between deploying (or a reset) and initialising, anyone who opens the URL may reach the installer: initialise immediately from the deploying account, before sharing the URL, or undeploy first.
- **Confirmed:** 2/3 (ATECA-14, MPRO-08, MPRO-46)
- **Destination:** references/security-and-api.md §Install and reset

### R-26 — Neutralise formulas on every write, including rewrites of read-back rows
- **Rule:** Strings starting with `=`, `+`, `-` or `@` become formulas: reject them in short structured fields, prefix `'` in free text, and re-apply the neutraliser to every string cell when a row read with `getValues()` is written back (the apostrophe is not returned). Plain-text format `@` does not stop formulas.
- **Confirmed:** 2/3 (ATECA-10, BARRA-08)
- **Destination:** SKILL.md (top rule)

### R-27 — Escape every output channel
- **Rule:** Escape `& < > " '` for every backend or user value placed in `innerHTML`, attributes, toasts, emails' `htmlBody` and server-built pages; values inside inline `on…="…"` handlers go through a whitelist helper (`[0-9a-z_-]` only), because HTML escaping is decoded before the handler runs; inline JSON uses `JSON.stringify(v).replace(/</g, '\\u003c')`.
- **Confirmed:** 3/3 (MPRO-30, ATECA-11, BARRA-06)
- **Destination:** SKILL.md (top rule)

### R-28 — Inline-handler values: whitelist helper plus a scanning test
- **Rule:** Every value concatenated into an `on…="…"` attribute passes through `_idJs(v)`; a test scans all such attributes and fails on any other expression, with a sanity floor on the number of handlers it saw; prefer delegated listeners with `data-*` for anything richer.
- **Confirmed:** 1/3 (BARRA-06)
- **Destination:** references/security-and-api.md §Input and output

### R-29 — Admin-configurable URLs are validated on the server
- **Rule:** A config URL that ends in an `href` is validated by the server before rendering (`http`/`https` only, no whitespace, quotes or angle brackets, bounded length; invalid → render nothing); the client check is only comfort. Extract the validator as a pure function and unit-test it.
- **Confirmed:** 1/3 (ATECA-12)
- **Destination:** references/security-and-api.md §Input and output

### R-30 — Validate every input on the server
- **Rule:** Ids are checked for format and existence (and ownership when acting on someone's record), numbers for type and range, qualitative values against the allowed list, and business rules (deadlines, limits, "only a finished period can be closed") on the server, not only in the form.
- **Confirmed:** 2/3 (MPRO via v0.2.1 seguretat-api §4, ATECA-22)
- **Destination:** references/security-and-api.md §Input and output

### R-31 — Public payloads are tested with sentinel strings
- **Rule:** Build fixtures with distinctive personal values and assert that the serialised public data contains none of them nor keys like `"email"`; strip ids the public view does not use and fail on any `null`/`undefined`.
- **Confirmed:** 1/3 (BARRA-07)
- **Destination:** references/security-and-api.md §Public pages

### R-32 — Erasing a cell does not erase Drive version history
- **Rule:** A "delete my data" feature cannot purge the spreadsheet's revision history; say so in the privacy notice or the admin's erasure procedure.
- **Confirmed:** 1/3 (BARRA-09)
- **Destination:** references/security-and-api.md §Public pages

### R-33 — Per-visitor user storage under `USER_DEPLOYING` is unproven (hedged)
- **Rule:** Hedged: one project abandoned a sign-in design built on `getUserProperties()` without recording why; do not build per-visitor state on user-scoped storage in a deployer-executed app before proving it with two accounts from different domains. The design that worked is script properties keyed by a server-resolved token (R-16).
- **Confirmed:** 1/3 (ATECA-15, cause unverified)
- **Destination:** references/security-and-api.md §Identity

---

## Architecture

### R-34 — Base decisions
- **Rule:** Container-bound script (`getActiveSpreadsheet()`), one spreadsheet of normalised vertical sheets, `Utilities.getUuid()` ids, configuration in script properties (install state, schema version, URL, tokens) plus an admin-editable key/value `Config` sheet; nothing hard-coded.
- **Confirmed:** 3/3 (MPRO, ATECA and BARRA inventory headers; v0.2.1 arquitectura §Decisions)
- **Destination:** references/architecture.md §Base decisions

### R-35 — One file per responsibility
- **Rule:** Entry point, auth, data layer, pure logic, one file per domain area, migrations, setup; on the client a layout, one view plus one scripts file per screen, styles, i18n core plus one dictionary per language. All `.gs` share one global scope regardless of folder, so a function name declared twice silently keeps one.
- **Confirmed:** 3/3 (v0.2.1 arquitectura §Files, ATECA-38, BARRA-04, BARRA-20)
- **Destination:** references/architecture.md §Files

### R-36 — Sheet rows come back with lowercase keys
- **Rule:** The read layer normalises headers to lowercase, so access `r.user_id`, never `r.User_Id` (which is `undefined` without any error); hand-built objects with other keys are documented as exceptions where they are built.
- **Confirmed:** 2/3 (ATECA-27; v0.2.1 gotchas B1 [2], MPRO)
- **Destination:** SKILL.md (top rule)

### R-37 — All writes go through one data-layer helper, by header name, in batch
- **Rule:** Build rows from a header → index map (absent fields → `''`) and route every write of a sheet through one helper; never call `appendRow`/`deleteRow`/`setValue` in a loop (300–1000 ms each): `appendRows` and `updateRows` do one `setValues`, `deleteRows` groups consecutive rows.
- **Confirmed:** 3/3 (ATECA-19, BARRA-08, BARRA-23, BARRA-25; v0.2.1 gotchas B5/B8, MPRO)
- **Destination:** SKILL.md (top rule)

### R-38 — Header names are created by code; tolerant matching only for human-typed headers (hedged)
- **Rule:** Create headers from setup/migrations so exact names are known; when a header may have been typed or pasted by a human, match tolerantly and treat a missing optional column as empty. Hedged: the cause of the one observed mismatch was not established; stripping zero-width characters or NFC normalisation is a suggestion, not an observation.
- **Confirmed:** 1/3 (ATECA-20)
- **Destination:** references/architecture.md §Data layer

### R-39 — Cache raw sheet reads only
- **Rule:** Cache each sheet's rows for 6 h, cache the empty result too, wrap `put` in `try/catch` (100 KB per value); do not add a cache of computed results unless measured, since invalidating it at every write point costs more than it saves, and grep for a documented cache before relying on it.
- **Confirmed:** 2/3 (MPRO-17, MPRO-20, BARRA-36; v0.2.1 gotchas B6)
- **Destination:** references/architecture.md §Data layer

### R-40 — Every write invalidates; resets, seeds and migrations invalidate everything
- **Rule:** Data-layer writes invalidate the current key of their sheet (key names in one constant table, never string literals); writers that bypass the layer (setup, seed, migrations) invalidate by hand, and resets and migration runs call one "invalidate all sheets" helper, because `CacheService` is script-scoped and survives sheet deletion.
- **Confirmed:** 3/3 (MPRO-18, MPRO-19, ATECA-23, BARRA-36)
- **Destination:** SKILL.md (top rule)

### R-41 — Per-execution memo for sheets that do not fit in the cache
- **Rule:** Keep a module-global `sheet → rows` map for the current execution so a sheet is read at most once per call even above 100 KB; read functions return copies, filter callbacks only compare, and invalidation clears the memo too. Measure with a realistic volume before optimising.
- **Confirmed:** 2/3 (MPRO-17, BARRA-13, BARRA-19)
- **Destination:** references/architecture.md §Data layer

### R-42 — Config readers: strict for operations, tolerant for pages
- **Rule:** Every `Config` value arrives as text: parse it before arithmetic; operations use a strict reader that throws a coded error, while anything that renders a page falls back to the default and warns, so a hand-typed bad value cannot take the app down.
- **Confirmed:** 2/3 (BARRA-18, ATECA-37)
- **Destination:** references/architecture.md §Config

### R-43 — Config key/value sheets must not hold duplicate keys
- **Rule:** Helpers that add config keys check existence first (`_ensureConfigKey_` never overwrites a user value); a repair migration removes repeated keys keeping the row updates write to.
- **Confirmed:** 1/3 (MPRO-41)
- **Destination:** references/architecture.md §Config

### R-44 — Public functions return an envelope and stable error codes
- **Rule:** Client-called functions never throw to the client: they return `{ok:true, data}` or `{ok:false, error}` with a stable code that exists in every dictionary, log the real message on the server, and use `''` (not `null`) for optional fields. An `api*` prefix helps reading but is not what makes a function public.
- **Confirmed:** 3/3 (ATECA-28, BARRA-02, BARRA-42; v0.2.1 arquitectura §Public functions, MPRO)
- **Destination:** references/architecture.md §Public functions

### R-45 — Report partial success honestly after an irreversible step
- **Rule:** Once the main change is committed, keep it and report precisely (`{ok:true, data:{mailSent:false}}`); secondary cleanups and side effects run outside the main `try`, each in its own `try`, with a degraded fallback instead of failing the operation.
- **Confirmed:** 2/3 (MPRO-11, ATECA-24)
- **Destination:** references/architecture.md §Public functions

### R-46 — Pure core plus reader wrapper, strict `null`
- **Rule:** `_xCore_(data)` is pure and a wrapper reads the sheets; missing input yields `null`, never `0`/`NaN`; the server handles states the UI cannot produce today (a manual sheet edit can); one filtering rule shared by every view; the pure core and its wrapper have clearly different names because a call with the wrong arity fails silently.
- **Confirmed:** 2/3 (MPRO-24, BARRA-43; v0.2.1 gotchas C3)
- **Destination:** references/architecture.md §Testable logic

### R-47 — One function owns rounding, including float noise
- **Rule:** A single pure function applies the rounding policy after removing binary floating-point noise (`7.499999999999999` → `7.5`), and every view, export and report calls it.
- **Confirmed:** 1/3 (MPRO-21)
- **Destination:** references/architecture.md §Testable logic

### R-48 — Snapshot global policy into each resource at creation
- **Rule:** Copy global settings into the resource row when it is created, compute from that copy, and let only an admin edit it, so policy changes never apply retroactively.
- **Confirmed:** 1/3 (MPRO-22)
- **Destination:** references/architecture.md §Base decisions

### R-49 — Model a variant as flagged rows and clean the abandoned branch
- **Rule:** A mode that is structurally the same as an existing entity becomes a boolean column of that table, and any action that regenerates rows of one mode deletes the rows flagged for the other.
- **Confirmed:** 1/3 (MPRO-23)
- **Destination:** references/architecture.md §Wizards

### R-50 — Soft delete for anything history points at
- **Rule:** "Delete" sets a status column; lists filter inactive records by default with a toggle to show them; physical deletion only for disposable data.
- **Confirmed:** 2/3 (ATECA-21; v0.2.1 arquitectura §Decisions, MPRO)
- **Destination:** references/architecture.md §Base decisions

### R-51 — Bulk destructive operations: archive copy first, parse dates defensively
- **Rule:** `makeCopy` the spreadsheet before any bulk delete and abort if the copy fails; parse dates accepting `Date`, ISO and the local text format, and keep and log rows whose date is not recognised.
- **Confirmed:** 1/3 (ATECA-22)
- **Destination:** references/architecture.md §Bulk operations

### R-52 — Order multi-step writes so a mid-way failure is recoverable
- **Rule:** Without transactions, write first the change that makes leftovers harmless (parent → pending) and then delete children; log the previous value before destroying it; ask "what if it stops here?" for every multi-sheet write.
- **Confirmed:** 1/3 (BARRA-17)
- **Destination:** references/architecture.md §Bulk operations

### R-53 — Corrections carry the base value they were opened on
- **Rule:** The client sends the value it displayed when the edit opened; inside the lock the server compares it with the fresh row and refuses with a dedicated code if it changed, and the client discards its draft.
- **Confirmed:** 1/3 (BARRA-16)
- **Destination:** references/architecture.md §Concurrency

### R-54 — Migration runner with an append-only registry
- **Rule:** `CURRENT_SCHEMA_VERSION` in code, `SCHEMA_VERSION` in script properties, an ordered never-pruned `MIGRATIONS` array of `{version, description, fn}`; save the version after each success, log with a searchable prefix, on error log and stop without blocking the app; stamp pre-system installs as v1; check the real current version in code before adding one.
- **Confirmed:** 2/3 (ATECA-17, BARRA-11; v0.2.1 arquitectura §Migrations [2])
- **Destination:** references/architecture.md §Migrations and setup

### R-55 — Setup creates exactly the schema of the latest migration
- **Rule:** A fresh install stamps `SCHEMA_VERSION = CURRENT_SCHEMA_VERSION` and runs no migration, so every column, sheet or config key a migration adds is added to setup in the same commit.
- **Confirmed:** 2/3 (ATECA-18; v0.2.1 arquitectura §Migrations [2], MPRO)
- **Destination:** SKILL.md (top rule)

### R-56 — Where migrations run
- **Rule:** On every `doGet`, behind a lock-free fast path (read the version, return if current, else lock, re-read, migrate — see D-12); time-trigger handlers and menu items that touch the schema migrate first; `onOpen` runs them only when `SETUP_COMPLETED` is set.
- **Confirmed:** 3/3 (ATECA-17, BARRA-11, BARRA-12; v0.2.1 gotchas D1, MPRO)
- **Destination:** references/architecture.md §Migrations and setup

### R-57 — Migrations are additive, idempotent and isolated
- **Rule:** Built from `_ensureColumn_`, `_ensureSheet_`, `_ensureConfigKey_`; they never delete or rewrite user data, work on `SpreadsheetApp` instead of business functions, invalidate the cache themselves (R-40) and never call a function that takes the script lock; obsolete columns stay, documented as legacy.
- **Confirmed:** 3/3 (ATECA-17, MPRO-18, BARRA-11)
- **Destination:** references/architecture.md §Migrations and setup

### R-58 — Setup never touches foreign sheets with content
- **Rule:** Setup reuses or deletes only completely empty non-schema sheets (`getLastRow() === 0 && getLastColumn() === 0`, the locale-named default sheet) and never deletes or renames a sheet with content; a retry after a half-finished install refuses instead of duplicating the admin.
- **Confirmed:** 2/3 (ATECA-14, BARRA-21)
- **Destination:** references/architecture.md §Migrations and setup

### R-59 — Sheet-menu installer for a non-technical deployer
- **Rule:** `onOpen` offers only "Install…" while `SETUP_COMPLETED` is missing, with a toast that explains the unverified-app consent screen; after install, maintenance items (public URL, my link, guide, clear cache); dialogs get everything precomputed in the template.
- **Confirmed:** 1/3 (BARRA-21; v0.2.1 arquitectura §Migrations "guided setup")
- **Destination:** references/architecture.md §Migrations and setup

### R-60 — Script lock discipline
- **Rule:** Every check-then-write runs inside `LockService.getScriptLock()` with `waitLock`, a readable busy error, fresh (uncached) reads and release in `finally`; the lock is not reentrant (an inner acquire/release frees the caller's lock), so document which functions take it and obtain lock-taking values before entering.
- **Confirmed:** 3/3 (ATECA-24, BARRA-10, MPRO-06, MPRO-12)
- **Destination:** SKILL.md (top rule)

### R-61 — One lock helper that flushes before releasing
- **Rule:** `_withLock_(fn)`: `waitLock` → `fn()` → `SpreadsheetApp.flush()` → `releaseLock()` in nested `finally`, so the next execution never reads unapplied writes; functions needed both inside and outside a lock come in pairs (`_xNoLock_` body + `_x_` wrapper).
- **Confirmed:** 1/3 (BARRA-10)
- **Destination:** references/architecture.md §Concurrency

### R-62 — One context object injected into the page
- **Rule:** `doGet` injects a single `APP_CONTEXT` (user, current resource or `null`) instead of loose globals; anything injected as text is a string, so convert on the server before injecting and again on the client before arithmetic, and compare booleans explicitly.
- **Confirmed:** 3/3 (ATECA-37, BARRA-19; v0.2.1 arquitectura §Context, MPRO)
- **Destination:** references/architecture.md §Context

### R-63 — Public page data computed on the server and injected in one pass
- **Rule:** One serialisable function builds everything a public page shows and `doGet` injects it into the context, avoiding a second round trip after the slow iframe load; test that it reads each big sheet only once.
- **Confirmed:** 1/3 (BARRA-19)
- **Destination:** references/security-and-api.md §Public pages

### R-64 — Wizards with several steps
- **Rule:** Never re-save a completed creation step; "back" reuses "go to step N"; a step that deletes saved items needs a real delete endpoint, lookup by identity and a double-click guard; anything that invalidates a later step marks it incomplete; switching a branching option clears the abandoned branch's data.
- **Confirmed:** 1/3 (v0.2.1 arquitectura §Wizards, MPRO; MPRO-23)
- **Destination:** references/architecture.md §Wizards

### R-65 — Partial save with merge needs three states
- **Rule:** In a merge payload, key with value = set, absent key = leave, key with `null` = clear deliberately; a correction updates the same row, never a parallel one that would skew aggregates.
- **Confirmed:** 1/3 (v0.2.1 arquitectura §Partial save, MPRO)
- **Destination:** references/architecture.md §Wizards

### R-66 — Bulk email: quota first, cap, per-address outcome, retry failures only
- **Rule:** Validate and dedupe all recipients first (any invalid → send nothing), check `MailApp.getRemainingDailyQuota()` against the batch, cap per call, return `{sent, skipped, failed}`, let the UI retry only failures, never regenerate credentials on resend, and do not take the lock in the outer sender if per-item helpers take it. Escape user values in `htmlBody`.
- **Confirmed:** 3/3 (ATECA-25, MPRO-12, BARRA-15)
- **Destination:** references/architecture.md §Mail and triggers

### R-67 — Keep a slice of the daily mail quota in reserve
- **Rule:** Bulk and anonymous senders stop at `remaining ≤ reserve` (a config key) and report the rest as pending; only admin alerts may go below the reserve.
- **Confirmed:** 1/3 (BARRA-15)
- **Destination:** references/architecture.md §Mail and triggers

### R-68 — Mail queue sheet drained by a time trigger
- **Rule:** When user actions trigger notifications, append queue rows inside the action's lock and let a 5-minute trigger group pending rows per person into one mail, cap people per run, stop at the quota reserve, mark undeliverable or unknown notices as skipped, and return without the lock when nothing is pending (see D-11).
- **Confirmed:** 1/3 (BARRA-13)
- **Destination:** references/architecture.md §Mail and triggers

### R-69 — Queue send errors: only recipient errors spend an attempt
- **Rule:** Classify `MailApp` errors: a recipient error increments that person's attempts and the run continues; any service or quota error stops the run without touching attempts; log every failure with a searchable prefix.
- **Confirmed:** 1/3 (BARRA-14)
- **Destination:** references/architecture.md §Mail and triggers

### R-70 — Demo addresses use the reserved `.invalid` TLD and are never mailed
- **Rule:** Generate demo people on `.invalid` and make every sender skip them, counted neither as sent nor as pending.
- **Confirmed:** 1/3 (BARRA-22)
- **Destination:** references/architecture.md §Mail and triggers

### R-71 — Time triggers: delete before create, stable public handler
- **Rule:** One `_manageTrigger_(enable)` deletes every trigger with the handler's name before creating one; the handler keeps a stable public name (renaming orphans the installed trigger), takes no parameters, is safe if a client calls it, and every reset deletes the trigger.
- **Confirmed:** 2/3 (ATECA-26, BARRA-13; v0.2.1 gotchas G1)
- **Destination:** references/architecture.md §Mail and triggers

### R-72 — Hourly triggers are imprecise: tolerance window plus a "done" flag
- **Rule:** Select items whose target time is within a tolerance wider than half the trigger period and mark each row as sent, so overlapping runs never send twice.
- **Confirmed:** 1/3 (ATECA-27)
- **Destination:** references/architecture.md §Mail and triggers

### R-73 — End-user persona drives the UI
- **Rule:** Confirm the end user's technical level at the start; for a low-tech audience use one-click direct interactions, always-visible actions, no single-item menus and immediate feedback.
- **Confirmed:** 1/3 (v0.2.1 arquitectura §Persona, MPRO)
- **Destination:** references/architecture.md §Persona

---

## Client

### R-74 — Sandbox parser rules for client JavaScript
- **Rule:** The HtmlService iframe parser rejects code that V8 accepts and reports errors far from the cause: never nest template literals 3+ levels, never declare functions inside a function that uses multi-line templates, never wrap `${}` in single quotes inside a template; precompute fragments and use top-level row helpers or concatenation (style choice in D-09).
- **Confirmed:** 3/3 (ATECA-38, BARRA-41; v0.2.1 sandbox-gas rules 1–3 [2], MPRO)
- **Destination:** SKILL.md (top rule)

### R-75 — File size limits of client scripts
- **Rule:** Split a scripts file before ~7,500 lines, and never inline a large bundle (~400 KB) in a `<script>` (`SyntaxError: missing ) in parenthetical`): load it with `<script src>`.
- **Confirmed:** 2/3 (ATECA-38, ATECA-39; v0.2.1 sandbox-gas rules 4–5, MPRO)
- **Destination:** references/client-sandbox.md §Syntax

### R-76 — Templates: always evaluate as a template, never double-wrap scripts
- **Rule:** Serve every page, dialog and include through `createTemplateFromFile(...).evaluate()` (`createHtmlOutputFromFile` prints scriptlets literally, and a conditional "only if it contains `<?`" breaks nested includes); a scripts file that already carries `<script>` is included bare.
- **Confirmed:** 2/3 (ATECA-47; v0.2.1 sandbox-gas rules 6–7, MPRO)
- **Destination:** SKILL.md (top rule)

### R-77 — URLs and navigation: capture `/exec` in `doGet`, navigate only through `<a>`
- **Rule:** In `doGet`, store the deployment URL in a script property only when it ends in `/exec`, and use that stored value for `<base href="…" target="_top">`, emails, menus and triggers (`getUrl()` is wrong outside a web request and once returned `/dev` inside one, D-05); navigate from JS only with a real or synthetic `<a>` click, never `window.location` (403 in the iframe, and it drops a personal token).
- **Confirmed:** 3/3 (MPRO-28, MPRO-43, ATECA-08, BARRA-26, BARRA-27)
- **Destination:** SKILL.md (top rule)

### R-78 — Context injection into the layout
- **Rule:** The server serialises the context with `JSON.stringify(ctx).replace(/</g, '\\u003c')` and the layout prints it raw with `<?!= context ?>` inside one `<script>`; do not mix it with `<?= ?>` for JSON (D-07).
- **Confirmed:** 3/3 (ATECA-11, BARRA-19; v0.2.1 sandbox-gas rule 8, MPRO)
- **Destination:** references/client-sandbox.md §Templates

### R-79 — Do not read the URL on the client
- **Rule:** `window.location.search` and the hash are unreliable inside the iframe: read `e.parameter` in `doGet` and inject it; for an incoming hash use `google.script.url.getLocation`. To see what reached the server, log `JSON.stringify(e.parameter)` at the top of `doGet`, because the address bar shows a `googleusercontent` echo URL.
- **Confirmed:** 2/3 (BARRA-30, ATECA-45; v0.2.1 sandbox-gas rule 11)
- **Destination:** references/client-sandbox.md §Navigation

### R-80 — In-page anchors with `<base target="_top">`
- **Rule:** `href="#x"` navigates the top window; one delegated listener handles `a[href^="#"]` with `preventDefault()` and `scrollIntoView()`.
- **Confirmed:** 1/3 (BARRA-30)
- **Destination:** references/client-sandbox.md §Navigation

### R-81 — `history.back()` does nothing inside the iframe
- **Rule:** Model sub-views with `google.script.history.push/replace` + `setChangeHandler`, use `replace` when closing an overlay, never plan on popping entries, and ban `history.pushState/replaceState` by test.
- **Confirmed:** 1/3 (BARRA-31)
- **Destination:** references/client-sandbox.md §Navigation

### R-82 — Model B client: wrap `google.script.run` in a careful Proxy
- **Rule:** With a token, a Proxy turns each call into `rpc(token, name, args)` but returns `undefined` for symbols, `then`, `toJSON`, `constructor`, uses `Object.prototype` versions of `toString`/`valueOf`, forwards and re-wraps every `with*`, implements `has`, and attaches a default failure handler that hides the spinner and shows the expired-link message; without a token it does nothing.
- **Confirmed:** 2/3 (MPRO-25, MPRO-26; ATECA-04 server side; v0.2.1 seguretat-api §2 Model B, ATECA)
- **Destination:** references/client-sandbox.md §Model B client

### R-83 — Model B client: keep the token on internal links
- **Rule:** A capture-phase listener on `click`, `auxclick` and `contextmenu` appends `t=` (before the hash, never twice) to links that start with `?` or whose resolved URL equals the `<base href>`; pages need nothing else.
- **Confirmed:** 1/3 (MPRO-27)
- **Destination:** references/client-sandbox.md §Model B client

### R-84 — Handle every `google.script.run` response defensively
- **Rule:** The success handler checks `!res || !res.ok` (serialisation can deliver `null`), properties with value `null` are dropped in transit (use `''` as a sentinel), `Date`, classes, `undefined` and functions do not serialise, and every failure handler shows a translated fallback when `e.message` is empty (transport failure) and restores the loading placeholder.
- **Confirmed:** 3/3 (MPRO-26, MPRO-29, ATECA-28, BARRA-42; v0.2.1 gotchas C1/C2)
- **Destination:** SKILL.md (top rule)

### R-85 — Tabs toggle the `active` class, not `hidden`
- **Rule:** `.tab-content.active { display:block }` beats `.hidden`, so panels are switched with `classList` on `active` only.
- **Confirmed:** 2/3 (ATECA-38; v0.2.1 sandbox-gas rule 12, MPRO)
- **Destination:** references/client-sandbox.md §DOM and CSS

### R-86 — Each page re-applies i18n in its own init
- **Rule:** A layout that calls `applyI18n()` before the page include is parsed only translates the shell; each page calls it again, after changing any data-dependent `data-i18n` key.
- **Confirmed:** 1/3 (MPRO-31; v0.2.1 sandbox-gas rule 13)
- **Destination:** references/client-sandbox.md §i18n

### R-87 — Select by attribute, namespace ids
- **Rule:** Address cells and controls by `data-*` attributes, never by child index; DOM ids and in-memory keys of entities that can render twice carry a section prefix (`section + ':' + id`).
- **Confirmed:** 2/3 (ATECA-40; v0.2.1 sandbox-gas rule 14, MPRO)
- **Destination:** references/client-sandbox.md §DOM and CSS

### R-88 — All templates of a page share one global scope
- **Rule:** For every view `doGet` can serve, expand the includes and assert that no top-level `function X` or `var X` is declared in two included files; prefix helpers per screen.
- **Confirmed:** 1/3 (BARRA-29)
- **Destination:** references/client-sandbox.md §Syntax

### R-89 — i18n engine
- **Rule:** `window.t('a.b', {n})` with `{name}` interpolation, `data-i18n` (and an attribute variant) in HTML, no hard-coded visible strings, identical dictionaries checked at start-up, server error codes translated too; language from a server-injected value validated against the allowed list.
- **Confirmed:** 3/3 (ATECA-31, BARRA-42; v0.2.1 arquitectura §Client conventions [2], MPRO)
- **Destination:** references/client-sandbox.md §i18n

### R-90 — Pages served outside the main layout receive the language from the server
- **Rule:** Every template `doGet` can return (registration, confirmation, error pages) gets the configured language injected and validated, including its `<title>`.
- **Confirmed:** 1/3 (ATECA-32)
- **Destination:** references/client-sandbox.md §i18n

### R-91 — Switching language at runtime keeps open forms
- **Rule:** On language change save field values, repaint from data already held (no server call), restore the values, re-render typed transient notices, and skip repainting while an action is in flight.
- **Confirmed:** 1/3 (BARRA-34)
- **Destination:** references/client-sandbox.md §i18n

### R-92 — Visible feedback and one action helper
- **Rule:** A global spinner or a per-button "working…" state for every perceptible call (it doubles as the anti-double-click guard), toasts, and an own confirm dialog instead of `window.confirm()`; keep the button disabled on success when a reload will repaint.
- **Confirmed:** 2/3 (BARRA-32; v0.2.1 arquitectura §Client conventions [2], MPRO)
- **Destination:** references/client-sandbox.md §State and feedback

### R-93 — Drop late responses
- **Rule:** Capture the view state or a request sequence number when calling and ignore the response if it no longer matches; do not repaint a view while an action is in flight.
- **Confirmed:** 1/3 (BARRA-32)
- **Destination:** references/client-sandbox.md §State and feedback

### R-94 — Client state objects and "already loaded" flags
- **Rule:** Keep screen state in one object with `null` = not loaded; any write that must be reflected resets the "loaded" flag (or the loader takes `force`); when a write affects data another view holds, update every derived store.
- **Confirmed:** 2/3 (ATECA-34, ATECA-35; v0.2.1 gotchas C6, MPRO)
- **Destination:** references/client-sandbox.md §State and feedback

### R-95 — Lazy-load failures: no poisoned cache, no retry loop
- **Rule:** On error keep the store `null`, show an error with a retry button, and record "last attempt failed" separately so re-renders do not re-fire the call.
- **Confirmed:** 1/3 (ATECA-36)
- **Destination:** references/client-sandbox.md §State and feedback

### R-96 — Setting `select.value` from code does not fire `change`
- **Rule:** Call the dependent-visibility handler (or dispatch `change`) after every programmatic reset, and audit every reset path of a modal.
- **Confirmed:** 1/3 (ATECA-33)
- **Destination:** references/client-sandbox.md §DOM and CSS

### R-97 — Client conventions carried over from v0.2.1
- **Rule:** A global save bar for pending changes with row actions disabled meanwhile; read-only modes hide controls by attribute and the server rejects writes (R-22); every error path restores the placeholder; human-only derived values (fractions shown as %) exist only in the UI; bulk saves run as a sequential queue; a living style document updated in the same commit as a new visual pattern.
- **Confirmed:** 1/3 (v0.2.1 arquitectura §Client conventions, MPRO)
- **Destination:** references/client-sandbox.md §State and feedback

### R-98 — Shared CSS classes: find every consumer first
- **Rule:** Before changing or reusing a class, grep every place that emits it and every JS selector that uses it; prefer semantic attributes for JS; verify non-trivial layout hypotheses by rendering the real CSS headless with a control case.
- **Confirmed:** 1/3 (v0.2.1 arquitectura §Shared CSS classes, MPRO)
- **Destination:** references/client-sandbox.md §DOM and CSS

### R-99 — Restricted networks
- **Rule:** Ask which domains the target network blocks; serve libraries from a host you control as external `<script src>`; generate images such as QR codes on the server with `UrlFetchApp` and return a `data:` URI (the Google Charts QR endpoint is retired).
- **Confirmed:** 2/3 (ATECA-39; v0.2.1 gotchas G4 [2], MPRO)
- **Destination:** references/client-sandbox.md §Assets and networks

### R-100 — Mobile inside the GAS iframe (hedged measurements)
- **Rule:** Google's banner outside the iframe shrinks the viewport (measured once at 360×530 on one phone): keep each screen's key information above that fold, reserve the height of fixed trays with a CSS variable, and set the viewport with `HtmlOutput.addMetaTag('viewport', …)` from `doGet`; `position: sticky/fixed` work inside the iframe.
- **Confirmed:** 1/3 (BARRA-33, single-device measurement)
- **Destination:** references/client-sandbox.md §Mobile

### R-101 — `localStorage` always in `try`, drafts per record, quiet `beforeunload`
- **Rule:** Wrap every storage access in `try` (hedged: rationale is that storage can be blocked, no incident recorded); keep unsent input as a draft keyed by record id; register `beforeunload` only while there is unsaved input and suppress it for intentional navigations.
- **Confirmed:** 1/3 (BARRA-35)
- **Destination:** references/client-sandbox.md §Mobile

---

## Testing

### R-102 — Node harness that runs the real `.gs` on simulated services
- **Rule:** Load every `.gs` into one `vm` context with in-memory `SpreadsheetApp`, `CacheService` (throws above 100 KB), `PropertiesService`, `LockService` (throws on nested `waitLock`), `Session` (active vs effective user), `MailApp` (quota, failures), `ScriptApp`; unsimulated services throw on access; build the installed state from the same schema constant setup uses; keep `tests/` out of the push.
- **Confirmed:** 3/3 (MPRO-32, ATECA-41, BARRA-36)
- **Destination:** references/testing.md §Server harness

### R-103 — Calibrate the sheet simulator against a real-sheet diagnostic
- **Rule:** Mocks that store values verbatim hide real bugs: run a one-off diagnostic on a real sheet and encode its conversions (apostrophe, formulas, `@` vs normal columns, checkbox fill, last-sheet deletion), then test the simulator itself.
- **Confirmed:** 1/3 (BARRA-36)
- **Destination:** references/testing.md §Server harness

### R-104 — `vm` realm pitfalls
- **Rule:** Compare results through `JSON.parse(JSON.stringify(x))`; in `.gs` use `Array.isArray` and `Object.prototype.toString.call(v) === '[object Date]'` instead of `instanceof` on built-ins (D-06).
- **Confirmed:** 3/3 (MPRO-36, ATECA-42, BARRA-37)
- **Destination:** references/testing.md §Server harness

### R-105 — Probes and service replacement
- **Rule:** Inject a probe with `vm.runInContext` to observe what a callee sees (e.g. the identity inside `rpc`), and replace a service per test (`ctx.HtmlService = …`) to capture which template `doGet` serves and what it injects.
- **Confirmed:** 1/3 (MPRO-36)
- **Destination:** references/testing.md §Server harness

### R-106 — What the public-surface test checks
- **Rule:** Extract top-level functions without trailing `_` (and, by a runtime sweep in `vm`, function-valued globals declared as `var`/arrow); each must be classified, guarded per category within the first lines, still exist (stale whitelist fails), not be declared twice; parse every `google.script.run` chain and `rpc(…, 'name')` under the client folder recursively and fail on calls to non-public names; self-check the parser; no top-level `const`/`let` in `.gs`.
- **Confirmed:** 3/3 (MPRO-34, ATECA-43, BARRA-04)
- **Destination:** templates/public-surface.test.js

### R-107 — Negative tests assert why they failed
- **Rule:** Match the expected error message and assert it is not an incidental one (`getUi` unavailable), and for side effects assert that nothing changed (row counts, properties, the one-time code still usable).
- **Confirmed:** 2/3 (MPRO-35, BARRA-02)
- **Destination:** references/testing.md §Assertions

### R-108 — Static assertions on the manifest and forbidden APIs
- **Rule:** A Node test parses `appsscript.json` (`executeAs`, `access`, scopes) and greps sources for forbidden calls (`addEditor`, `Session` outside the auth file, `window.location`, `history.pushState`).
- **Confirmed:** 2/3 (MPRO-37, BARRA-41)
- **Destination:** references/testing.md §Static checks

### R-109 — Enforce client sandbox rules by banning, not reviewing
- **Rule:** Extract every `<script>` block (replacing scriptlets), compile it with `new vm.Script`, and fail on the banned constructs the project chose (D-09), `window.location`, `history.pushState` and unguarded `localStorage`; a blunt ban is checkable, "max two levels" is not.
- **Confirmed:** 1/3 (BARRA-41)
- **Destination:** references/testing.md §Static checks

### R-110 — Local syntax check before pushing
- **Rule:** `cat File.gs | node --input-type=commonjs` (recent `node --check` rejects `.gs`) and `sed -n '2,99999p' x-scripts.html | node --input-type=commonjs`; only `SyntaxError` counts, and Node does not detect the sandbox rules of R-74.
- **Confirmed:** 1/3 (v0.2.1 sandbox-gas §Local check and gotchas A3, MPRO; ATECA-38 notes `node --check` passing)
- **Destination:** references/testing.md §Static checks

### R-111 — Testing client JavaScript in Node
- **Rule:** Either strip an `.html` to its `<script>` and run it in `vm` with fake `window`/`document`, or load the real page as `doGet` builds it in jsdom with a controllable fake `google.script` (pending calls answered by the test, history stack, `getLocation`, captured navigations) and fail on any collected JS error.
- **Confirmed:** 2/3 (MPRO-38, BARRA-38)
- **Destination:** references/testing.md §Client tests

### R-112 — A fake `google.script.run` returns a fresh runner per access
- **Rule:** Model it as a getter returning a new object with its own handler pair; a shared handler swaps the responses of concurrent calls.
- **Confirmed:** 1/3 (BARRA-39)
- **Destination:** references/testing.md §Client tests

### R-113 — Static lock-discipline test
- **Rule:** A heuristic test marks base writers, propagates "is a writer" to functions that call one outside an inline lock, and fails on public writers outside a lock or locking functions called inside a lock; document its limits and plant a violation to prove it detects it.
- **Confirmed:** 1/3 (BARRA-40)
- **Destination:** references/testing.md §Static checks

### R-114 — i18n test
- **Rule:** Identical key sets and no empty values across dictionaries, every key used in views exists, and every error code that can reach the client has a message in every language (plus a network-error key).
- **Confirmed:** 2/3 (BARRA-42, ATECA-31)
- **Destination:** references/testing.md §Static checks

### R-115 — Editor test functions: baseline, guard, or none (D-08)
- **Rule:** Prefer Node tests; if the project already has in-editor `test*` functions, guard them with an admin check and run them in the harness against a baseline of passing names that only fails on regressions.
- **Confirmed:** 1/3 (MPRO-33)
- **Destination:** references/testing.md §Server harness

### R-116 — Local preview server reusing the real pure functions
- **Rule:** A Node script renders any page from an in-memory scenario as `doGet` would, injecting the code of the pure `.gs` functions instead of re-implementing them; serve it on the LAN to open it on a phone.
- **Confirmed:** 1/3 (BARRA-43)
- **Destination:** references/testing.md §Client tests

### R-117 — Fixtures must contain every author and every role
- **Rule:** Seed data for multi-author aggregates creates entries for all authors; before calling something a regression, check the fixture.
- **Confirmed:** 1/3 (MPRO-39)
- **Destination:** references/testing.md §Assertions

### R-118 — Static-analysis tools may not see `.gs` files
- **Rule:** Before trusting a code graph or linter on a GAS repo, check it parses `.gs` and resolves cross-file calls (all files share one scope, no imports).
- **Confirmed:** 1/3 (ATECA-44)
- **Destination:** references/testing.md §Static checks

---

## Gotchas

### R-119 — Sheets converts what you write
- **Rule:** Write numbers as `Number` (in a comma-decimal locale the string `'9.7'` becomes a date and switches the cell format); apply plain-text format `@` before the first write to columns holding codes with leading zeros, times, timestamps, free-text names and version strings — at creation, in each migration that adds such a column, and to rows added by growing the grid; build compact times with `padStart`. Behaviour of `@` with booleans is unsettled (D-04).
- **Confirmed:** 3/3 (MPRO-40, ATECA-46, BARRA-25)
- **Destination:** SKILL.md (top rule)

### R-120 — Read booleans with one tolerant helper; never write a JS boolean to a text column
- **Rule:** `v === true || (typeof v === 'string' && v.trim().toUpperCase() === 'TRUE')`, never `!== false` or truthiness; the write helper refuses a JS boolean for a `@` column. Hedged: what `@` does to `'true'` and to booleans is contradictory between observations (D-04), and the dual read works either way.
- **Confirmed:** 1/3 (BARRA-24; v0.2.1 gotchas B2, MPRO — contradictory observation)
- **Destination:** references/gotchas.md §Sheets as a database

### R-121 — Dates are ISO strings end to end
- **Rule:** Normalise `Date` to `'YYYY-MM-DD'` in the read function (a cached value comes back as a string, an uncached one as `Date`); build dates with `new Date(iso + 'T12:00:00')`; use `Date` only for arithmetic at the edges; detect dates without `instanceof` (D-06).
- **Confirmed:** 2/3 (ATECA-22, BARRA-37; v0.2.1 gotchas B4, MPRO)
- **Destination:** references/gotchas.md §Sheets as a database

### R-122 — Checkbox validation on empty rows moves `getLastRow()`
- **Rule:** `requireCheckbox()` on a whole column fills empty cells with `FALSE` and `getLastRow()` counts them; apply it only to the rows just written.
- **Confirmed:** 1/3 (BARRA-23)
- **Destination:** references/gotchas.md §Sheets as a database

### R-123 — Execution limits
- **Rule:** One execution (including one `google.script.run` call) stops at 6 minutes; measure with `Date.now()` per step before optimising, since the first hypothesis is often wrong.
- **Confirmed:** 1/3 (MPRO-17; v0.2.1 gotchas B5 and C)
- **Destination:** references/gotchas.md §google.script.run

### R-124 — Context placeholders left empty
- **Rule:** When adding a context field, check that its neighbours come from a real read and not from a copied `''` literal; an empty string is a valid falsy value that silently disables client logic.
- **Confirmed:** 1/3 (v0.2.1 gotchas C4, MPRO)
- **Destination:** references/gotchas.md §google.script.run

### R-125 — Model A only: Drive permission is not OAuth consent
- **Rule:** Under `USER_ACCESSING` each user must be given access to the file (`addEditor`/`addViewer`) without blocking the user creation if sharing fails; under model B never share (R-11).
- **Confirmed:** 1/3 (v0.2.1 gotchas B7, MPRO before its move to model B)
- **Destination:** references/gotchas.md §Install and deployment

### R-126 — Declare `oauthScopes` explicitly and re-consent after adding a service
- **Rule:** Add the scope in the same commit as the new service; after pushing, run any function that uses it from the editor as the deployer and accept the dialog (existing deployments then work); a container-bound UI needs `script.container.ui`.
- **Confirmed:** 2/3 (ATECA-30, MPRO-47; v0.2.1 gotchas D2 [2])
- **Destination:** references/gotchas.md §Install and deployment

### R-127 — `getUrl()` is `null` without a web-app deployment
- **Rule:** Useful as a guard of a guided setup, but that guard makes the function fail from the editor; keep an unguarded editor setup and document the difference.
- **Confirmed:** 1/3 (v0.2.1 gotchas D3)
- **Destination:** references/gotchas.md §Install and deployment

### R-128 — `clasp push --force`, from a verified directory, then redeploy the version
- **Rule:** A non-interactive `clasp push` silently skips everything when it would ask about `appsscript.json`, so always `--force`; every checkout and worktree shares the `scriptId`, so check `pwd`, branch and `.clasp.json` first; `/exec` stays on its version until `clasp deploy -i <deploymentId>`, so redeploy and `curl -sL` the URL before asking for a test.
- **Confirmed:** 3/3 (ATECA-49, BARRA-28, MPRO-42; v0.2.1 gotchas A2/A4/D3c)
- **Destination:** SKILL.md (top rule)

### R-129 — `clasp push` never deletes remote files
- **Rule:** Files excluded or deleted locally survive remotely and `--force` says "already up to date"; diagnose with `clasp pull` into a temp folder, make one remote file differ, then push from the repo; exclude every tool output folder (and every `.html` you do not ship) in `.claspignore` before the first push.
- **Confirmed:** 1/3 (MPRO-42)
- **Destination:** references/gotchas.md §clasp

### R-130 — clasp account, logs and deployment ids
- **Rule:** Check `clasp show-authorized-user` before pushing; `clasp logs` and `clasp run` need a standard GCP project, so read the editor's Executions view; never delete and re-create a deployment that links point at.
- **Confirmed:** 1/3 (ATECA-49; v0.2.1 gotchas A6)
- **Destination:** references/gotchas.md §clasp

### R-131 — Worktrees and clasp
- **Rule:** `.clasp.json` is git-ignored and must be copied into each worktree; `.claspignore` excludes worktree and tool folders (a second `appsscript.json` makes the push fail with "A file with this name already exists"); a branch can only be deployed by pushing from its worktree.
- **Confirmed:** 1/3 (v0.2.1 gotchas A5, MPRO)
- **Destination:** references/gotchas.md §clasp

### R-132 — Subfolders with clasp (hedged)
- **Rule:** With `rootDir` at the repo root, remote names keep the folder (`web/layout`), so templates are referenced by path; put tooling folders and `package.json` in `.claspignore`, since clasp's default extensions would push stray `.js` as server code (a risk, not an observed incident).
- **Confirmed:** 1/3 (BARRA-20)
- **Destination:** templates/claspignore.template

### R-133 — Broad ignore rules silently drop files
- **Rule:** A `*.js` rule in `.gitignore` also hides vendored bundles and Node tests; add explicit negations and check `git check-ignore -v <path>` when a file "never arrives".
- **Confirmed:** 1/3 (ATECA-48)
- **Destination:** references/gotchas.md §Tooling

### R-134 — Merging a branch that ran `git rm --cached` deletes those files locally
- **Rule:** Back up the folders before merging such a branch, or restore them with `git archive <commit-before> <paths> | tar -x -k`, and add them to `.gitignore` in the same commit.
- **Confirmed:** 1/3 (MPRO-44)
- **Destination:** references/gotchas.md §Tooling

### R-135 — Exporting a native Doc to `.docx` needs the Drive REST endpoint
- **Rule:** `getAs(MimeType.MICROSOFT_WORD)` cannot convert native Docs; fetch `drive/v3/files/<id>/export?mimeType=…` with `ScriptApp.getOAuthToken()` in one shared helper and trash the temporary Doc.
- **Confirmed:** 2/3 (ATECA-29; v0.2.1 gotchas E1 [2], MPRO)
- **Destination:** references/gotchas.md §DocumentApp and Drive

### R-136 — DocumentApp quirks
- **Rule:** There is no `removeFooter()` (`getFooter() || addFooter()` then `clear()`); `body.clear()` throws if the body ends in a table or image; exporting the same `docId` to PDF repeatedly can return a cached export, so copy one template per document and export each copy once.
- **Confirmed:** 1/3 (v0.2.1 gotchas E2–E4, MPRO)
- **Destination:** references/gotchas.md §DocumentApp and Drive

### R-137 — `showSidebar()` always opens on the right
- **Rule:** It is not configurable; use `showModalDialog` for a centred dialog.
- **Confirmed:** 1/3 (v0.2.1 gotchas D4, MPRO)
- **Destination:** references/gotchas.md §Install and deployment

### R-138 — Editing the sheet by hand and stale cache
- **Rule:** A simple `onEdit` that invalidates helps but is not fully reliable; edit through the app, and if a manual edit does not show, it is the cache (clear the key or wait for the TTL).
- **Confirmed:** 1/3 (v0.2.1 gotchas B6, MPRO)
- **Destination:** references/gotchas.md §Sheets as a database

---

## Workflow

### R-139 — Bootstrap order and first decisions
- **Rule:** Before code, agree identity model, binding, languages, end-user profile, whether the `.clasp.json` script is test or production, and git preferences; then data layer + auth + setup → pure logic with tests → public functions → layout, i18n and one screen → the rest, one feature per branch; manifest with V8 and explicit scopes, surface test and `.claspignore` from the first commit.
- **Confirmed:** 1/3 (v0.2.1 SKILL "Starting a new project", MPRO and ATECA)
- **Destination:** references/workflow.md §Starting a project

### R-140 — Per-project preferences are asked once and recorded
- **Rule:** Worktrees or `main`, who commits, who pushes, when notes are updated, and whether the script is shared with real users differ between projects: ask once, write them in the project's `CLAUDE.md`.
- **Confirmed:** 1/3 (v0.2.1 flux-de-treball §Preferences)
- **Destination:** templates/CLAUDE.template.md

### R-141 — Feature cycle with three review layers
- **Rule:** Design → plan with exact code → branch → task-by-task with spec and quality review → push from the branch directory → user QA with a written script → final review of the whole branch → close; per-task review, branch review and real QA find different bugs.
- **Confirmed:** 1/3 (MPRO-48; v0.2.1 flux-de-treball §Feature cycle)
- **Destination:** references/workflow.md §Feature cycle

### R-142 — What the final review must verify
- **Rule:** Trace each data path end to end, verify every declared security invariant ("only the deployer installs", "no live credentials in a template") against all entry points including files outside the plan, find all consumers of shared code, and check each branch of reused validators.
- **Confirmed:** 1/3 (MPRO-48; v0.2.1 flux-de-treball §Final review)
- **Destination:** references/workflow.md §Feature cycle

### R-143 — Harden in two phases: surface first, identity model second
- **Rule:** Rename internals, guard what stays public, make setup non-re-runnable and add the tests before switching to model B, because the deployer's rights multiply the impact of any unguarded function; QA each phase from the browser console as a low-privilege user.
- **Confirmed:** 1/3 (MPRO-45)
- **Destination:** references/workflow.md §Security hardening

### R-144 — Sister tasks and repeated patterns
- **Rule:** Pass the fixes of a reviewed task to its sister task with the exact code and say which do not apply; when a bug is a repeated pattern, ask whether to fix every occurrence.
- **Confirmed:** 1/3 (v0.2.1 flux-de-treball §Sister tasks)
- **Destination:** references/workflow.md §Feature cycle

### R-145 — Worktree hygiene
- **Rule:** Check `git log origin/main..HEAD` before creating a worktree from a remote base, edit the plan copy inside the worktree, stash or commit main-checkout changes before merging, and remove re-entered worktrees with `git worktree remove` after merging.
- **Confirmed:** 1/3 (v0.2.1 flux-de-treball §Worktrees, MPRO)
- **Destination:** references/workflow.md §Worktrees and subagents

### R-146 — Subagents
- **Rule:** Only when the user asked; every brief starts with `cd` to the exact path and a branch check, carries the reminders hooks would have added, and the result is verified with `git log`/`git diff`, not the report.
- **Confirmed:** 1/3 (v0.2.1 flux-de-treball §Subagents, MPRO)
- **Destination:** references/workflow.md §Worktrees and subagents

### R-147 — QA and debugging
- **Rule:** When a symptom fits no hypothesis, ask for the exact click sequence; rule out stale inputs first (regenerate the link, compare deployed and local code with `clasp pull` into a temp folder); when a value "does not persist", inspect the real cell or the downloaded `.xlsx` (`openpyxl`); verify in a browser yourself when possible (the sandbox iframe is cross-origin, so only pixel interaction works); keep diagnostic scripts of unreproduced bugs.
- **Confirmed:** 2/3 (MPRO-49, ATECA-52; v0.2.1 flux-de-treball §QA)
- **Destination:** references/workflow.md §QA and debugging

### R-148 — Temporary diagnostics: tagged, committed alone, reverted alone
- **Rule:** Add `Logger.log` lines with a unique tag in their own commit, reproduce on the deployment, read Executions, revert that commit; set a rollback tag before a risky cross-cutting change.
- **Confirmed:** 1/3 (ATECA-51)
- **Destination:** references/workflow.md §QA and debugging

### R-149 — Validate UI on a real phone through a deployment
- **Rule:** Mobile screens are accepted only after the user validates them on the device through a throwaway deployment; headless captures of the local preview catch JS and layout errors first, and `curl -sL` checks what a deployment serves (headless rendering of `/exec` is often blank).
- **Confirmed:** 1/3 (BARRA-44)
- **Destination:** references/workflow.md §QA and debugging

### R-150 — Designing with the user
- **Rule:** Ask requirements in free text, one topic per turn, each with a reasoned proposal, and keep multiple choice for small bounded decisions; follow the project's normative text by default and say so before proposing otherwise; on "go back" restart from scratch; inventory every entry point (`onOpen`, `doGet`, dialogs, menus) before porting a pattern; stop between tasks when asked; do not widen a solved problem.
- **Confirmed:** 1/3 (BARRA-45; v0.2.1 flux-de-treball §Design)
- **Destination:** references/workflow.md §Designing with the user

### R-151 — Actions with external effect
- **Rule:** `git push` only when the user asked for that push; `clasp push` changes the live app, so the main agent does it from the verified directory, never a subagent.
- **Confirmed:** 1/3 (v0.2.1 flux-de-treball §External actions)
- **Destination:** references/workflow.md §External actions

### R-152 — Install and update guides for deployers
- **Rule:** Guides state "Execute as" and "Who has access" explicitly with the labels in every UI language the deployer may see, explain the unverified-app screen, require initialising right away from the deploying account, and for updates say when all files change, re-consent scopes, and edit the existing deployment to publish a new version.
- **Confirmed:** 2/3 (MPRO-46, MPRO-47, BARRA-01, BARRA-21)
- **Destination:** references/workflow.md §Deployment guides

### R-153 — Living documentation
- **Rule:** A short `CLAUDE.md` with rules and pointers; an active backlog and a history file; every new gotcha documented when found; non-blocking review findings become backlog items and accepted risks become comments at the function; anything that must survive the machine is versioned.
- **Confirmed:** 1/3 (MPRO-50; v0.2.1 flux-de-treball §Living documentation)
- **Destination:** references/workflow.md §Living documentation

### R-154 — Test or production script
- **Rule:** Ask once whether the `.clasp.json` script is a test environment or the live one and record it; in production every push and destructive operation needs confirmation, and there is no isolated test environment (`/dev` serves the last pushed branch).
- **Confirmed:** 1/3 (v0.2.1 gotchas A4/A7)
- **Destination:** references/workflow.md §External actions

---

## Dropped

### R-155 — Reference repositories on the author's machine
- **Rule:** v0.2.1 pointed to two local repositories as code references.
- **Confirmed:** 1/3 (v0.2.1 SKILL step 2)
- **Destination:** dropped (private local paths; a public skill cannot depend on them — the reusable code goes to `templates/` instead)

### R-156 — `clasp` "Premature close" on one Node release
- **Rule:** A `node-fetch` bug in one Node 24 minor release broke `clasp login/push`.
- **Confirmed:** 1/3 (v0.2.1 gotchas A1)
- **Destination:** dropped (fixed upstream in the next Node minor; version-specific workaround with a local install path)

### R-157 — Domain-specific example values
- **Rule:** Project-specific fields and examples (grades, bookings, fixtures) used to illustrate rules in the sources.
- **Confirmed:** 3/3 (all three inventories, as context only)
- **Destination:** dropped (domain; every rule above is written generically)

---

## Decisions (contradictions between projects)

### D-01 — Identity model A vs model B
- **Option A:** `executeAs: USER_ACCESSING` + `access: DOMAIN`, identity from the session, the file shared with every user (when all users are in the deployer's Workspace domain **and** no role holds data another role must not read; the app's role checks are only presentation while users hold file access). · **Option B:** `executeAs: USER_DEPLOYING` + `access: ANYONE` (or `ANYONE_ANONYMOUS`, D-02), session email for same-domain users and a personal `?t=` link for everyone else, file shared with nobody (when users span domains or any data must be hidden from some role; MPRO moved from A to B for exactly this). Under B every public function runs with the deployer's rights, so R-01, R-06 and R-23 become mandatory before switching (R-143). · **Sources:** MPRO-01, MPRO-02, MPRO-45, ATECA-03, BARRA-01; v0.2.1 seguretat-api §2.

### D-02 — `access: ANYONE` vs `ANYONE_ANONYMOUS`
- **Option A:** `ANYONE` ("anyone with a Google account") when there is no page for people without a Google account; it keeps a Google sign-in in front of everything and gives a session email to same-domain users (MPRO, ATECA). · **Option B:** `ANYONE_ANONYMOUS` only when a public page must open without any Google account; consequences: a session email cannot be relied on, so identify every non-public request by token only; the installer cannot rely on a deployer check (D-10); anonymous traffic consumes the deployer's quotas (executions, mail, the global cap of R-19); under model B every unguarded public function is reachable by the whole internet, not only by Google-account holders (R-01, R-06, R-31 sentinel test); and the publishing guide must say "do not pick *Anyone with a Google account*" in every UI language (BARRA). · **Sources:** MPRO-01, ATECA-03, BARRA-01, BARRA-02, BARRA-07.

### D-03 — Is there a "harmless" public category?
- **Option A:** v0.2.1 allowed pure functions and functions with non-serialisable parameters as harmless. · **Option B:** treat "harmless" as near-empty: anything that reads a sheet, config key or property is not harmless, and a non-serialisable parameter is not a guard (ATECA found the admin email readable through a "harmless" config reader). **Decision: B.** A category may remain for truly pure functions with no data access, each justified in the whitelist. · **Sources:** ATECA-02, MPRO-34; v0.2.1 seguretat-api §1.

### D-04 — What plain-text format `@` does (unverified)
- **Option A:** v0.2.1 observed that writing `'true'` into an `@` column stores a native boolean, and MPRO observed that `@` did not stop `'9.7'` from becoming a date in a comma-decimal locale. · **Option B:** one Barralliure diagnostic on a real sheet observed `@` keeping strings exactly as written (`'TRUE'`, `'007'`, ISO dates) and a JS boolean stored as the string `'true'`. **Decision: unresolved, keep as an explicitly unverified note** (conditions such as locale, write method and when the format was applied may differ). Practice that is safe either way: write numbers as `Number`, never write a JS boolean to a text column, read booleans with the tolerant dual check (R-120), apply `@` before the first write, and never rely on `@` against formulas (R-26). · **Sources:** BARRA-24, MPRO-40; v0.2.1 gotchas B2.

### D-05 — Which URL goes into `<base href>`
- **Option A:** v0.2.1 kept `ScriptApp.getService().getUrl()` inside `doGet` for the base URL (it is `/dev` when the page is opened via `/dev`). · **Option B:** Barralliure once saw `getUrl()` return `/dev` for a page opened via `/exec` (exact trigger not established), which sent non-owners to an unopenable URL. **Decision: B, refined.** Capture the URL inside `doGet` only when it ends in `/exec`, store it, and use the stored public URL for `<base href>`, emails, menus and triggers; fall back to `getUrl()` only when nothing is stored. Cost: a developer testing on `/dev` follows links to `/exec`. · **Sources:** BARRA-26, BARRA-27, MPRO-43, ATECA-08; v0.2.1 gotchas D3b, sandbox-gas rule 9.

### D-06 — `instanceof Date` in server code
- **Option A:** v0.2.1 B4 normalised with `valor instanceof Date ? … : valor`. · **Option B:** under a Node `vm` harness `instanceof` on built-ins lies across realms. **Decision: B.** Detect dates with `Object.prototype.toString.call(v) === '[object Date]'` and arrays with `Array.isArray`, which behave the same in GAS and in tests. · **Sources:** BARRA-37, MPRO-36, ATECA-42; v0.2.1 gotchas B4.

### D-07 — Injecting server values into templates
- **Option A:** one context object serialised with `JSON.stringify(...).replace(/</g, '\\u003c')` and printed raw with `<?!= ?>` (MPRO and Barralliure layouts; ATECA also does it for its token). · **Option B:** ATECA's restrictions doc says `JSON.stringify` "does not work" for strings and recommends `'<?= var ?>'`; ATECA's own layout mixes both forms. **Decision: A.** The ATECA note concerns `<?= ?>`: contextual escaping of `<?= ?>` transforms the output, so JSON printed through it is not the object you serialised (mechanism unverified); raw `<?!= ?>` of JSON whose `<` is escaped is the one form all three projects use. Never mix the two for the same value; use `<?= ?>` only for plain text in HTML. · **Sources:** ATECA-11, BARRA-19; v0.2.1 sandbox-gas rule 8; ATECA restrictions doc (not an inventory entry).

### D-08 — Where tests live
- **Option A:** Node with `vm` and service mocks only (ATECA, Barralliure): runs locally and adds no public surface. · **Option B:** in-editor `test*` functions kept (MPRO): they ship to production as public functions, so each needs an admin guard, and the harness runs them against a baseline. **Decision: A for new projects; B only to adopt an existing editor test suite.** · **Sources:** MPRO-33, ATECA-41, BARRA-36; v0.2.1 arquitectura §Tests.

### D-09 — Template literals in client code
- **Option A:** allow `const`/`let`, arrows and template literals of one or two levels, following R-74 while writing (MPRO). · **Option B:** ban backticks completely and enforce it by test (Barralliure), because "max two levels" cannot be checked mechanically. **Decision: project choice, recorded in the project's `CLAUDE.md`;** if A, the rules are review-only and Node does not catch them; if B, enforce with R-109. · **Sources:** BARRA-41, ATECA-38; v0.2.1 sandbox-gas "What works".

### D-10 — Protecting the installer before installation
- **Option A:** deployer check: the active session email equals the effective user (works under `ANYONE`, where the deployer has a session email). · **Option B:** a one-time code minted by the sheet menu (needs the open sheet), injected into the install dialog and checked before and inside the lock (required under `ANYONE_ANONYMOUS`, where a session email cannot be relied on). · **Option C:** a one-shot script property set by hand (editor-run setup). **Decision:** A under `ANYONE`, B under `ANYONE_ANONYMOUS` or when the installer runs from a sheet dialog, C for editor-run destructive functions; in every case R-23 (not re-runnable) applies. · **Sources:** MPRO-08, MPRO-09, BARRA-02, ATECA-13, ATECA-14.

### D-11 — Sending mail inline or through a queue
- **Option A:** inline sending with quota check, cap and per-address outcome, for admin-initiated batches (MPRO, ATECA). · **Option B:** a queue sheet drained by a trigger, when user actions trigger notifications at volume, when the deployer has a small consumer quota, or to remove the timing side channel of an anonymous "send me my link" endpoint (Barralliure). **Decision:** A by default; B when any of those conditions holds. Both keep a quota reserve for admin alerts (R-67). · **Sources:** ATECA-25, MPRO-12, MPRO-10, BARRA-05, BARRA-13.

### D-12 — Locking the migration runner
- **Option A:** migrations run in `doGet` without a lock (MPRO, ATECA; a property read is the usual cost). · **Option B:** double-checked: lock-free version read, then a dedicated lock, re-read and migrate (Barralliure). **Decision: B** whenever two executions can arrive together (any public or busy app), since the fast path keeps the cost of A; A remains acceptable for small single-domain apps. · **Sources:** BARRA-11, ATECA-17; v0.2.1 arquitectura §Migrations.

### D-13 — Exact vs tolerant header matching
- **Option A:** exact matching of normalised header names (all three projects' data layers). · **Option B:** tolerant substring matching for headers a human typed (ATECA, after one unexplained production mismatch). **Decision: A for headers created by code; B only for human-maintained headers, as a hedged pattern** (R-38). · **Sources:** ATECA-20.

---

## v0.2.1 coverage

| v0.2.1 file § rule | R-NN | kept / updated / dropped (reason) |
|---|---|---|
| SKILL principle "almost nothing fails loudly" | — | kept (becomes the SKILL.md intro) |
| SKILL top 1 trailing `_` is public | R-01 | kept (top) |
| SKILL top 2 lowercase keys | R-36 | kept (top) |
| SKILL top 3 boolean dual check | R-120 | updated (tolerant helper; hedged by D-04; folded into top rule R-119) |
| SKILL top 4 no appendRow/deleteRow/setValue in loops | R-37 | updated (merged with "by header name") |
| SKILL top 5 every write invalidates cache | R-40 | updated (resets, seeds and migrations invalidate all) |
| SKILL top 6 ISO date strings | R-121 | kept (moved from top to gotchas) |
| SKILL top 7 `null` stripped, `!res \|\| !res.ok` | R-84 | updated (empty `e.message`, placeholder restore) |
| SKILL top 8 identity never from the client [2] | R-08 | updated (static test; 3/3) |
| SKILL top 9 role consults every membership source | R-22 | updated (plus server-enforced read-only) |
| SKILL top 10 setup = last migration schema [2] | R-55 | kept (top) |
| SKILL top 11 template literal rules [2] | R-74 | updated (D-09 style choice) |
| SKILL top 12 `include()` always template | R-76 | updated (`createHtmlOutputFromFile`) |
| SKILL top 13 synthetic `<a>` click, absolute `<base href>` | R-77 | updated (stored `/exec`, D-05) |
| SKILL top 14 `clasp push --force` after `pwd` | R-128 | updated (redeploy the version) |
| SKILL top 15 a GET never modifies data | R-21 | kept (top; 1/3 exception, security-critical) |
| SKILL bootstrap 1 decide with the user first | R-139 | kept |
| SKILL bootstrap 2 reference repos | R-155 | dropped (private local paths) |
| SKILL bootstrap 3 CLAUDE.md from template | R-140 | kept |
| SKILL bootstrap 4 `.claspignore` from template | R-129, R-132 | kept |
| SKILL bootstrap 5 `appsscript.json` V8 + explicit scopes | R-126 | updated (model A/B manifest templates) |
| SKILL bootstrap 6 surface test from first commit | R-06 | kept (top) |
| SKILL bootstrap 7 build order | R-139 | kept |
| SKILL "what this skill is not" / "maintaining" | — | kept (SKILL.md footer) |
| seguretat-api §1 trailing `_`, leading `_` hides nothing | R-01 | kept |
| seguretat-api §1 classification table | R-03 | updated (more categories, per-category guards) |
| seguretat-api §1 "harmless" category | R-02 | updated (contradicted, D-03) |
| seguretat-api §1 public-surface test | R-06, R-106 | updated (runtime sweep, stale list, client cross-check) |
| seguretat-api §1 grep the client before renaming | R-05 | updated (docs and `addItem` strings) |
| seguretat-api §2 model A/B table | R-07 | updated (D-01, D-02) |
| seguretat-api §2 sensitive data under model A | R-07 | kept (D-01) |
| seguretat-api §2 common: identity never a parameter | R-08 | kept |
| seguretat-api §2 common: one identity function | R-08 | updated (static test) |
| seguretat-api §2 common: reusable throwing guards | R-14 | kept |
| seguretat-api §2 common: inactive user not identified | R-14 | kept |
| seguretat-api §2 common: validate requested role | R-14 | kept |
| seguretat-api §2 B: two-way token map | R-16 | updated (format, lock, deletion) |
| seguretat-api §2 B: client Proxy to `rpc` | R-82 | updated (trap list, default failure handler) |
| seguretat-api §2 B: `rpc` refusals | R-15 | updated (regex, deny-list, non-array args) |
| seguretat-api §2 B: invalid token throws | R-15 | kept |
| seguretat-api §2 B: one link helper, token only for active users, no token on QR | R-18 | updated (one email per recipient) |
| seguretat-api §2 B: request limits and single-use codes | R-19, R-20 | updated (identical answer, global cap, expiry) |
| seguretat-api §3 links that change data | R-21 | updated (generic message) |
| seguretat-api §4 formula injection | R-26 | updated (reject vs neutralise, rewrite hole) |
| seguretat-api §4 HTML in emails | R-27 | kept |
| seguretat-api §4 HTML in page, double quotes | R-27 | updated (inline handlers, R-28) |
| seguretat-api §4 context JSON `<` | R-78 | kept (D-07) |
| seguretat-api §4 configurable URLs | R-29 | kept |
| seguretat-api §4 ids validated | R-30 | kept |
| seguretat-api §4 numbers and qualitative values | R-30 | kept |
| seguretat-api §4 business rules on the server | R-30 | kept |
| seguretat-api §5 destructive editor functions | R-24 | kept |
| seguretat-api §6 re-runnable setup = privilege escalation | R-23 | updated (deployer check / one-time code, D-10) |
| seguretat-api §6 setup refuses when completed | R-23 | kept |
| seguretat-api §6 reset-to-reinstall window | R-25 | kept |
| seguretat-api §6 reset invalidates all cache | R-40 | kept |
| seguretat-api §6 `makeCopy` before bulk destructive ops | R-51 | updated (defensive dates) |
| seguretat-api §6 setup never deletes foreign sheets | R-58 | kept |
| seguretat-api checklist for a new public function | R-01, R-06, R-08, R-27, R-30 | kept (becomes the checklist in security-and-api.md) |
| arquitectura base: container-bound [2] | R-34 | kept |
| arquitectura base: identity models | R-07 | kept |
| arquitectura base: one spreadsheet, UUIDs [2] | R-34 | kept |
| arquitectura base: properties + Config sheet [2] | R-34 | kept |
| arquitectura base: soft delete | R-50 | kept |
| arquitectura base: dual install flow [2] | R-152 | updated (guides) |
| arquitectura files per responsibility, split at ~7,500 | R-35, R-75 | kept |
| arquitectura data layer table (read, cache, by-header writes) | R-37, R-39 | kept |
| arquitectura data layer: positional arrays break | R-37 | kept |
| arquitectura data layer: hand-built keys documented | R-36 | kept |
| arquitectura data layer: cache only raw reads | R-39 | kept |
| arquitectura data layer: Config values are text | R-42 | updated (strict vs page reader) |
| arquitectura public functions: `{ok,data}` envelope | R-44 | kept |
| arquitectura public functions: stable `errorCode` | R-44 | kept |
| arquitectura public functions: `''` not `null` | R-44 | kept |
| arquitectura public functions: `api*` prefix not what makes public | R-44 | kept |
| arquitectura authorisation: validated hierarchy | R-14 | kept |
| arquitectura authorisation: global + per-resource roles | R-22 | kept |
| arquitectura authorisation: every membership source | R-22 | kept |
| arquitectura authorisation: test with single-role users | R-22 | kept |
| arquitectura authorisation: read-only roles rejected by server | R-22 | kept |
| arquitectura testable logic: pure core + wrapper | R-46 | kept |
| arquitectura testable logic: strict `null` | R-46 | kept |
| arquitectura testable logic: no client calculation | R-46 | kept |
| arquitectura testable logic: distinct names (arity) | R-46 | kept |
| arquitectura testable logic: document side effects | R-46 | kept |
| arquitectura testable logic: shared validator generic `return {ok:true}` | R-142 | kept (final-review item) |
| arquitectura tests: Node vs editor | R-102, R-115 | updated (D-08) |
| arquitectura migrations: version in code and properties [2] | R-54 | kept |
| arquitectura migrations: runner | R-54 | kept |
| arquitectura migrations: fresh install runs none [2] | R-55 | kept |
| arquitectura migrations: additive and idempotent | R-57 | kept |
| arquitectura migrations: isolated, invalidate cache by hand | R-57, R-40 | updated (invalidate all in `finally`) |
| arquitectura migrations: run at each `doGet`, `onOpen` guarded | R-56 | updated (fast path, triggers and menus, D-12) |
| arquitectura migrations: check the real version in code | R-54 | kept |
| arquitectura migrations: obsolete columns stay | R-57 | kept |
| arquitectura migrations: guided setup via `onOpen` | R-59 | updated (sheet-menu installer) |
| arquitectura concurrency: lock pattern, not reentrant | R-60, R-61 | updated (flush before release) |
| arquitectura context: one `APP_CONTEXT` | R-62 | kept |
| arquitectura client: syntax style | R-74 | updated (D-09) |
| arquitectura client: visible feedback [2] | R-92 | updated (per-button action helper) |
| arquitectura client: escape backend values | R-27 | kept |
| arquitectura client: readable errors | R-44, R-84 | kept |
| arquitectura client: i18n [2] | R-89 | kept |
| arquitectura client: state object, loaded flag | R-94 | kept |
| arquitectura client: pending-changes bar | R-97 | kept |
| arquitectura client: read-only mode | R-97, R-22 | kept |
| arquitectura client: loading placeholders | R-97, R-84 | kept |
| arquitectura client: derived values UI-only | R-97 | kept |
| arquitectura client: sequential bulk save | R-97 | kept |
| arquitectura client: living style doc [2] | R-97 | kept |
| arquitectura client: restricted networks [2] | R-99 | kept |
| arquitectura wizards (five rules) | R-64 | kept |
| arquitectura partial save tri-state | R-65 | kept |
| arquitectura shared CSS classes | R-98 | kept |
| arquitectura mail: escaped `htmlBody` | R-66 | kept |
| arquitectura mail: quota, cap, retry failures | R-66 | updated (reserve R-67, queue D-11) |
| arquitectura triggers: delete before create, public handler | R-71 | kept |
| arquitectura 6-minute limit | R-123 | kept |
| arquitectura persona | R-73 | kept |
| sandbox-gas 1 no 3-level nested templates | R-74 | kept |
| sandbox-gas 2 no nested functions with multi-line templates | R-74 | kept |
| sandbox-gas 3 no `'${x}'` | R-74 | kept |
| sandbox-gas 4 split at ~7,500 lines | R-75 | kept |
| sandbox-gas 5 never inline a large bundle | R-75 | kept |
| sandbox-gas "what works" | R-74 | updated (D-09) |
| sandbox-gas local syntax check | R-110 | kept |
| sandbox-gas 6 `include()` always a template | R-76 | kept |
| sandbox-gas 7 scripts file included bare | R-76 | kept |
| sandbox-gas 8 context injection with `<` | R-78 | kept (D-07) |
| sandbox-gas 9 absolute `<base href>` from `getUrl()` | R-77 | updated (stored `/exec`, D-05) |
| sandbox-gas 10 synthetic click, never `window.location` | R-77 | updated (token loss) |
| sandbox-gas 11 no URL params on the client | R-79 | updated (`getLocation`, log `e.parameter`) |
| sandbox-gas 12 tabs with `active` | R-85 | kept |
| sandbox-gas 13 per-page `applyI18n()` | R-86 | kept |
| sandbox-gas 14 namespaced DOM ids | R-87 | kept |
| gotchas A1 Premature close | R-156 | dropped (fixed upstream, version-specific) |
| gotchas A2 Skipping push → `--force` | R-128 | kept (A1 in 1.0.0) |
| gotchas A3 `node --check` and `.gs` | R-110 | kept |
| gotchas A4 push from the wrong directory | R-128, R-154 | kept |
| gotchas A5 worktrees and clasp | R-131 | kept |
| gotchas A6 `clasp run` NOT_FOUND | R-130 | kept |
| gotchas A7 dev or production | R-154 | kept |
| gotchas B1 lowercase keys [2] | R-36 | kept |
| gotchas B2 booleans; `@` stores a native boolean | R-120 | updated (hedged, D-04) |
| gotchas B3 leading zeros, `@` columns | R-119 | updated (numbers as Number, times, grid growth) |
| gotchas B4 dates (`instanceof Date` snippet) | R-121 | updated (D-06) |
| gotchas B5 write performance, measure first | R-37, R-123 | kept |
| gotchas B6 cache empty result, 100 KB `try/catch` | R-39 | kept |
| gotchas B6 writes invalidate; direct writes by hand | R-40 | kept |
| gotchas B6 `onEdit` invalidation not reliable | R-138 | kept |
| gotchas B6 no computed-result cache | R-39 | kept |
| gotchas B6 cache survives sheet deletion | R-40 | kept |
| gotchas B6 rename key when shape changes; invalidate current key | R-40 | kept |
| gotchas B7 Drive permission ≠ OAuth (model A) | R-125 | kept (model A only) |
| gotchas B8 rows by position | R-37 | kept |
| gotchas B9 Config/template values are text | R-42, R-62 | kept |
| gotchas C1 `res` null | R-84 | kept |
| gotchas C2 `null` stripped | R-84 | kept |
| gotchas C3 silent arity | R-46 | kept |
| gotchas C4 empty context placeholders | R-124 | kept |
| gotchas C5 internal functions callable | R-01 | kept |
| gotchas C6 "already loaded" flag | R-94 | kept |
| gotchas C serialisation limits and 6 minutes | R-84, R-123 | kept |
| gotchas D1 `onOpen` migrations guarded | R-56 | updated (triggers and menus too) |
| gotchas D2 explicit `oauthScopes` [2] | R-126 | updated (re-consent from the editor) |
| gotchas D3 `getUrl()` null without deployment | R-127 | kept |
| gotchas D3b `getUrl()` outside the web app | R-77 | updated (also for `<base href>`, D-05) |
| gotchas D3c versioned deployment vs push | R-128 | kept |
| gotchas D4 sidebar on the right | R-137 | kept |
| gotchas E1 `.docx` export [2] | R-135 | kept |
| gotchas E2 no `removeFooter()` | R-136 | kept |
| gotchas E3 `body.clear()` | R-136 | kept |
| gotchas E4 repeated PDF export, Docs quota | R-136 | kept |
| gotchas F1 lock not reentrant | R-60 | updated (inner release frees outer lock) |
| gotchas F2 check-and-write without lock | R-60 | kept |
| gotchas G1 duplicate triggers | R-71 | kept |
| gotchas G2 mail quota | R-66 | kept |
| gotchas G3 email links with effects | R-21 | kept |
| gotchas G4 QR | R-99 | kept |
| flux-de-treball preferences table | R-140 | kept |
| flux-de-treball feature cycle and three layers | R-141 | kept |
| flux-de-treball final review asks | R-142 | updated (invariants against all entry points) |
| flux-de-treball sister tasks | R-144 | kept |
| flux-de-treball scope question for repeated patterns | R-144 | kept |
| flux-de-treball worktrees (five bullets) | R-145, R-131 | kept |
| flux-de-treball subagents (five bullets) | R-146 | kept |
| flux-de-treball QA: exact click sequence | R-147 | kept |
| flux-de-treball QA: `.xlsx` + `openpyxl` | R-147 | kept |
| flux-de-treball QA: verify in the browser | R-147 | kept |
| flux-de-treball QA: editor diagnostic functions | R-147 | kept |
| flux-de-treball QA: keep diagnostic scripts | R-147 | kept |
| flux-de-treball design with the user (five bullets) | R-150 | updated (open-dialogue requirements) |
| flux-de-treball external actions: `git push` | R-151 | kept |
| flux-de-treball external actions: `clasp push` | R-151 | kept |
| flux-de-treball living docs (four bullets) | R-153 | kept |
| CLAUDE.template.md | R-140 | kept (translated; model A/B row) |
| claspignore.template | R-129, R-132 | kept (tooling folders added) |

---

## Split decision

`references/client-sandbox.md` stays a single file; no mobile or landing file is added.

Barralliure's file-split signal counts 12 of 45 entries for mobile + public landing + sheet-menu installer (mobile/iframe 6, landing 3, installer 3), plus 4 for the mail queue. Each group is small, all of them are 1/3 (Barralliure only), and several are hedged (BARRA-33 single-device measurements, BARRA-35 rationale without an incident). They become sections instead:
- `references/client-sandbox.md` §Navigation (R-79, R-80, R-81) and §Mobile (R-100, R-101); device validation goes to `references/workflow.md` (R-149).
- `references/security-and-api.md` §Public pages (R-31, R-32, R-63) and §Install and reset (installer protection, D-10); `ANYONE_ANONYMOUS` is D-02.
- `references/architecture.md` §Migrations and setup (sheet-menu installer, R-59) and §Mail and triggers (queue, R-68 to R-70).

Revisit if a second project confirms the mobile/landing group: at that point a `references/public-mobile.md` would be justified.

---

## Notes for the skill writers

Duplicate clusters to merge into one place when writing the skill:
- R-03 / R-04 / R-24 (public-function categories and their guards).
- R-27 / R-28 / R-78 / D-07 (escaping and context injection).
- R-104 / R-121 / D-06 — state the `instanceof` rule once, in R-121.
- R-77 / D-05 / R-18 (stored `/exec` URL, base href, link builder).
- R-108 / R-109 / R-81 (static bans on the client).
- R-11 / R-125 (sharing the file: model B never, model A always).
- R-131 / R-145 (worktrees and clasp) and R-128 / R-151 / R-154 (who pushes, from where, to which script).

Present as checklists rather than prose: R-54..R-57 (migrations), R-49 / R-64 / R-65 (wizards), R-66..R-70 (mail).

Keep R-119's hedge sentence verbatim: "Behaviour of `@` with booleans is unsettled (D-04)."

---

## Coverage stats

- **Rules:** 157 `R-NN` (154 kept or hedged, 3 dropped); 13 `D-NN`.
- **Per area:** Security and public API 33 · Architecture 40 · Client 28 · Testing 17 · Gotchas 20 · Workflow 16 · Dropped 3.
- **Top rules:** 20: 14 at 3/3 (R-01, R-06, R-07, R-08, R-23, R-27, R-37, R-40, R-60, R-74, R-77, R-84, R-119, R-128) and 5 at 2/3 (R-22, R-26, R-36, R-55, R-76; R-36, R-55 and R-76 count MPRO through v0.2.1) and 1 stated exception at 1/3 (R-21, security-critical v0.2.1 top rule).
- **Source entries:** MPRO 50/50, ATECA 52/52, BARRA 45/45 cited at least once.
- **New vs v0.2.1:** MPRO 25 new, 13 partial (only the new part counted as new), 12 already covered; ATECA 15 new, 1 contradicting, 9 partial, 27 already covered; BARRA 30 new, 3 contradicting, 10 partial, 2 already covered.
- **Hedged rules:** R-33 (ATECA-15), R-38 (ATECA-20), R-100 (BARRA-33), R-101 (BARRA-35), R-120 (BARRA-24 / D-04), R-132 (BARRA-20); none is a top rule.
