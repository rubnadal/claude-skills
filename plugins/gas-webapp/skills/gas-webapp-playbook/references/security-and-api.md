# Security and public API

Read before writing any server function. Fixing this late cost one app a rename of ~280 functions. Marks: (3/3), (2/3) = confirmed in that many of the three source apps; unmarked = seen in one; "Hedged" = unverified, keep the hedge.

Contents: Public surface · Identity (models, resolution, guards, roles, personal links, "send me my link") · Links that change data · Editor-run functions · Install and reset · Input and output · Public pages · Checklist for a new public function.

## Public surface

**Every top-level `.gs` function whose name does not end in `_` is callable from any served page with `google.script.run`**, whatever its parameters (3/3). A leading `_` hides nothing:

```javascript
function _wipeAll() {}    // PUBLIC — google.script.run._wipeAll() works from the console
function wipeAll_() {}    // hidden
function _wipeAll_() {}   // hidden — recommended: reads as internal on both sides
```

So a data layer named `readRows`, `updateRow`, `deleteRow` is a direct backdoor around every role check in the façade.

### Classify every public function, one guard per category (3/3)

| Category | Examples | Guard in the first lines |
|---|---|---|
| Client API | `apiSaveRecord` | identity/role guard (`requireRole_(...)`) as the first statement, then input validation |
| Entry point | `doGet`, `doPost`, `include`, `onOpen`, `rpc` | fixed names; `rpc` hardened (§Identity) |
| Unauthenticated endpoint | "send me my link" | rate-limited, identical answer in every case |
| Menu handler | `menuOpenInstaller` | `SpreadsheetApp.getUi()` **on line one** |
| Trigger handler | `onDailyDigest` | 0 parameters; harmless if a client calls it |
| Editor-run function | template reset, demo data, repair, editor `test*` | one-shot property or admin guard (§Editor-run functions) |
| Sheet-dialog function | installer dialog | one-time code minted by the menu (§Install and reset) |

- **Menu handlers** must be public (menus call by name). `getUi()` only throws outside the sheet when it is reached, so it goes first, before any side effect; enforce the position in the surface test.
- Trigger, menu and entry-point names go in the `rpc` deny-list.
- **The "harmless" category is a near-empty exception list.** A function that reads any sheet, config key or property is not harmless (a "harmless" config reader once exposed the admin email), and a non-serialisable parameter is luck, not access control: rename it to `_` and fix the callers. Keep a category only for truly pure functions with no data access, each justified in the whitelist.
- **Re-run the surface review after every feature that adds server code.** The test (`references/testing.md`, `templates/public-surface.test.js`) fails on public functions missing from the whitelist and on `api*` functions whose first statement is not a guard (stale entries are only warned).

### Renaming for visibility (2/3)

- Before renaming to `_`, grep every client file: if the client calls it, it needs a guard, not a rename.
- Do large renames mechanically over the AST, then review strings that name functions: `addItem('…', 'handler')`, trigger names, docs, diagnostic snippets.
- A trailing `_` also hides the function from the editor's Run menu — editor-run functions stay public and get a guard instead.

## Identity

### Identity models (3/3)

Decide with the user before writing backend code; it shapes everything.

| | **A. Domain session** | **B. Deployer + personal link** |
|---|---|---|
| `appsscript.json` | `executeAs: USER_ACCESSING`, `access: DOMAIN` | `executeAs: USER_DEPLOYING`, `access: ANYONE` (or `ANYONE_ANONYMOUS`, below) |
| Who gets in | accounts of the Workspace domain | any Google account (or anyone) |
| Identity | `Session.getActiveUser().getEmail()` | session email for the deployer's domain; personal `?t=<token>` for everyone else |
| Runs with the rights of | each user | the deployer |
| Spreadsheet sharing | must be shared with every user | **shared with nobody** |
| Own risk | every user can open the file directly: a viewer reads **every** sheet, an editor changes anything — the app's role checks are only presentation | every unguarded public function runs with the deployer's rights for anyone holding the URL |
| Choose when | all users are in the deployer's domain **and** no role holds data another role must not read | users span domains, or any data must be hidden from some role |

- Model B makes the public-surface rules, the surface test and the non-re-runnable installer **mandatory before switching** — harden the surface first, then change the manifest (`references/workflow.md`).
- **`ANYONE` vs `ANYONE_ANONYMOUS`:** use `ANYONE` unless a public page must open without any Google account; it keeps a Google sign-in in front of everything and gives same-domain users a session email. `ANYONE_ANONYMOUS` means: no session email can be relied on, so identify every non-public request by token only; the installer cannot use a deployer check (§Install and reset); anonymous traffic consumes the deployer's quotas; every unguarded function is reachable by the whole internet; the publishing guide must say "do not pick *Anyone with a Google account*" in every UI language. Never pick it by default.
- **Sharing the file:** under model B the app never calls `addEditor`/`addViewer` and the install guide says never to share the file; a static test greps `.gs` for those calls and asserts `executeAs`/`access` in `appsscript.json`. Under model A each user must be given file access (Drive permission is not OAuth consent) — see `references/gotchas.md`.

### Resolving identity (3/3)

- The client never sends identity as an argument. One function, `currentEmail_()`, is the only reader of `Session.getActiveUser`; a static test fails if any other `.gs` reads `Session.getActiveUser/getEffectiveUser`.
- **Model B resolution order (2/3):** under `USER_DEPLOYING` the session email is `''` for accounts outside the deployer's domain, so: session email of an active user → token fixed for this execution → raw session value (only for the login screen). Derive the deployer's domain from `Session.getEffectiveUser()`; same-domain users never get a token injected. With a consumer (`@gmail.com`) deployer there is no domain, so every user except the deployer needs a token.
- **Per-execution identity in globals (2/3):** GAS re-initialises top-level globals on each execution, so a token-derived identity can live in module globals filled by one setter (clears them first, accepts only active users), called at the start of `doGet` and inside `rpc`. Never persist identity in cache or properties keyed by anything the client controls.
- **Empty identity never reaches a comparison:** every lookup returns "not authorised" when the trimmed email is empty, before reading any sheet — otherwise `''` matches a row with an empty email cell.
- **Normalise emails (2/3):** one `normEmail_()` (`toLowerCase().trim()`) on the session email, token keys, user lookups, duplicate detection, recipient lists and before saving; compare normalised on both sides, because legacy rows may hold mixed case.

```javascript
function currentEmail_() {
  var e = normEmail_(Session.getActiveUser().getEmail());
  if (e && isActiveUser_(e)) return e;
  return TOKEN_EMAIL_ || '';          // set per execution by setTokenIdentity_()
}
function requireUser_() {
  var e = currentEmail_();
  if (!e) throw coded_('NOT_AUTHORISED');   // coded_: references/architecture.md §Public functions
  return e;
}
```

### Guards (2/3)

- Reusable guards throw and return the email: `requireUser_()`, `requireAdmin_()`, `requireRole_([...])`, or `checkAccess_(minRole, resourceId)` for per-resource roles.
- An inactive user is not identified.
- The guard first throws if the requested role is not in the hierarchy array — `indexOf === -1` would make every comparison pass.

### Role inside a resource (2/3)

The resolver checks creator column → staff table → member table → any future membership table, each with an active check; a new source is added in the same commit that introduces it. A resolver that checks one source silently locks out every user whose role lives in another (including the creator, if creating a resource does not add a staff row). Read-only roles and historical modes are rejected by the server — hidden buttons are not access control. Test each screen with a user holding only that role.

### The `rpc` dispatcher (model B) (3/3)

The client turns each `google.script.run.fn(args)` into `rpc(token, 'fn', args)`, so `rpc` is an arbitrary-call primitive. Refuse unless the name:
- matches `^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]$` (no leading or trailing `_`);
- is not in the deny-list (`rpc`, `doGet`, `doPost`, menu and trigger handlers);
- is an own function of the global object and not native (`Function.prototype.toString` without `[native code]`).

Non-array `args` → `[]`. A non-empty invalid token throws a stable code; it never falls back to anonymous. The client side (Proxy around `google.script.run`, `has` trap, re-wrapped `with*` calls, a capture-phase listener that appends `t=` to links whose resolved URL matches `<base href>`, leaving `#` anchors untouched, and never `window.location`) is in `references/client-sandbox.md` §Model B client.

### Personal-link tokens (2/3)

- `Utilities.getUuid().replace(/-/g, '').toLowerCase()` (32 lowercase hex), format-checked before any lookup.
- Two-way map in script properties: `AUTH_T_<token>` → email and `AUTH_E_<email>` → token (~130 bytes per user against the 500 KB properties limit). Permanent until an admin regenerates.
- Create, regenerate and delete under the script lock; delete on user deletion or email change.
- **Hedged:** per-visitor state in `getUserProperties()` under `USER_DEPLOYING` is unproven — one app abandoned a sign-in design built on it without recording why. Prove it with two accounts from different domains before relying on it; the design that worked is script properties keyed by a server-resolved token.

### Links to the app (2/3)

- One helper builds every link from the stored `/exec` URL (captured in `doGet`, see `references/client-sandbox.md`) and appends `t=` only for an active user.
- A personal link means one email per recipient. QR codes, printed links and group notifications never carry a token.
- Tell users that a URL copied from the address bar carries their link; give admins a "regenerate" action.

### "Send me my link": the only unauthenticated API (3/3)

- Always return the same answer: exists or not, throttled or not, invalid input or internal error.
- Validate and length-cap the email; per-address throttle in `CacheService`; a global cap counted under the lock.
- Send only to active users and reuse the existing token.
- Document the accepted residual risks next to the code: a timing side channel and exhaustion of the global cap. To remove the timing channel, send through a queue sheet drained by a trigger (`references/architecture.md` §Mail and triggers); inline sending is the default otherwise.

## Links that change data

**A GET never changes data** (top rule; 1/3, security-critical). Mail scanners prefetch links, and an unguessable id is not authorisation once the app sends it to others.
- The link opens a confirmation page that validates the id format and shows **one generic message** for "not yours / does not exist / no identity".
- Only for the owner (or a permitted role) it offers a button that calls a guarded server function.
- **One-off emailed actions use single-use codes, not personal tokens:** store the code with a timestamp and fixed expiry, keep one live code per subject, sweep expired codes when minting, require the confirmation click, and never embed the approver's personal link.

## Editor-run functions

Functions run from the editor cannot end in `_` (they would vanish from the Run menu), so they are public. Guard each one (2/3):

```javascript
function resetTemplate() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('CONFIRM_RESET') !== 'true') {
    throw new Error('Blocked: set script property CONFIRM_RESET = true and run again.');
  }
  props.deleteProperty('CONFIRM_RESET');   // one shot: every run needs a fresh confirmation
  // ... destructive work ...
}
```

Apply it to template reset, demo data and repair. Editor `test*` functions shipped to production take an admin guard instead (`references/testing.md`).

## Install and reset

- **A re-runnable installer is privilege escalation** (3/3): an installer that "adds the current user as admin if missing" and is reachable from the client lets anyone become admin from the console.
  - "Installed" = the `SETUP_COMPLETED` property **or** an active admin row (the property can be lost; an inactive admin does not count).
  - The client-reachable installer refuses with `ALREADY_INSTALLED`, under a lock (double clicks).
  - Setup on an installed system is a repair mode: admin only, creates only missing sheets and defaults, never creates users or demo data. The refusal message says what to do next.
- **Before installation, protect the installer:** under `ANYONE`, a deployer check (active session email equals the effective user); under `ANYONE_ANONYMOUS` or when the installer runs from a sheet dialog, a one-time code minted by the sheet menu, injected into the dialog and checked before and inside the lock; for editor-run destructive functions, the one-shot property above.
- **Close the install window immediately (2/3):** between deploying (or a reset) and initialising, anyone who opens the URL may reach the installer. Initialise right away from the deploying account, before sharing the URL, or undeploy first.
- **A distributable template carries no live credentials:** the "prepare template" reset deletes every installation property, including all token keys (iterate `getKeys()` by prefix), and every cache key; a test asserts no token key survives.
- Resets invalidate every cache key (`CacheService` survives sheet deletion) — `references/architecture.md`.

## Input and output

**Validate every input on the server (2/3):** ids for format and existence (and ownership when acting on someone's record), numbers for type and range, qualitative values against the allowed list, and business rules (deadlines, limits, "only a finished period can be closed") — not only in the form.

**Formula injection (2/3):** strings starting with `=`, `+`, `-` or `@` become formulas. Reject them in short structured fields; prefix `'` in free text; re-apply the neutraliser to every string cell of a row read with `getValues()` before writing it back (the apostrophe is not returned). Plain-text format `@` does not stop formulas.

```javascript
function sheetText_(v) {
  var t = String(v == null ? '' : v);
  return /^[=+\-@]/.test(t.trim()) ? "'" + t : t;
}
```

**Escaping (3/3):** escape `& < > " '` for every backend or user value in `innerHTML`, attributes, toasts, email `htmlBody` and server-built pages. Inline JSON in a page: `JSON.stringify(v).replace(/</g, '\\u003c')` (context injection: `references/client-sandbox.md`).

**Inline-handler values:** HTML escaping is decoded before an `on…="…"` handler runs, so every value concatenated into one passes through a whitelist helper; a test scans all such attributes and fails on any other expression (with a sanity floor on the number of handlers seen). Prefer delegated listeners with `data-*` for anything richer.

```javascript
function idJs(v) { return String(v).replace(/[^0-9a-z_-]/g, ''); }
// '<button onclick="openRecord(\'' + idJs(r.id) + '\')">'
```

**Admin-configurable URLs** that end in an `href` are validated on the server before rendering: `http`/`https` only, no whitespace, quotes or angle brackets, bounded length; invalid → render nothing. The client check is only comfort. Extract the validator as a pure function and unit-test it.

## Public pages

For pages any visitor can open (anonymous landing, public catalogue):
- **Compute on the server, inject in one pass:** one serialisable function builds everything the page shows and `doGet` injects it into the context, avoiding a second round trip after the slow iframe load; test that it reads each big sheet only once.
- **Test payloads with sentinel strings:** build fixtures with distinctive personal values and assert that the serialised public data contains none of them nor keys like `"email"`; strip ids the public view does not use; fail on any `null`/`undefined`.
- **Erasing a cell does not erase Drive version history:** a "delete my data" feature cannot purge the spreadsheet's revisions — say so in the privacy notice or the admin's erasure procedure.

## Checklist for a new public function

- [ ] The name lacks a trailing `_` because the client really calls it (grepped).
- [ ] First statement: identity/role guard (`requireRole_` / `checkAccess_`).
- [ ] No identity parameter; identity comes from `currentEmail_()`.
- [ ] Every id validated against real data; ownership checked when acting on someone's record.
- [ ] Numbers range-checked, qualitative values checked against the allowed list, business rules enforced here.
- [ ] Free text neutralised on write and escaped on display or in email.
- [ ] Classified in the public-surface test's whitelist; under model B, not in the `rpc` deny-list by mistake.
