# Testing

Test in Node, locally, with no dependencies beyond Node itself (jsdom only for client tests). Keep `tests/` out of the push (`.claspignore`) and make sure broad ignore rules do not drop the test files from git (`references/gotchas.md` §Tooling).

**Where tests live:** for a new project, Node only — `vm` plus service mocks runs locally and adds no public surface. Keep in-editor `test*` functions only when adopting an existing suite (§Server harness, last part).

## Server harness

Load every `.gs` into **one** `vm` context (they share one global scope in Apps Script too) with in-memory services, then call functions directly. Minimal version, runnable as is:

```javascript
// tests/harness.js
const fs = require('fs'), path = require('path'), vm = require('vm');

function store() { const m = {}; return {
  get: (k) => (k in m ? m[k] : null), remove: (k) => { delete m[k]; },
  // Counts characters as a stand-in for the real 100 KB byte limit.
  put: (k, v) => { if (String(v).length > 100 * 1024) throw new Error('Argument too large: value'); m[k] = String(v); },
  getProperty: (k) => (k in m ? m[k] : null), setProperty: (k, v) => { m[k] = String(v); },
  deleteProperty: (k) => { delete m[k]; } }; }

function sheet(name, rows) { return { getName: () => name, getLastRow: () => rows.length,
  getDataRange: () => ({ getValues: () => rows.map((r) => r.slice()) }),
  appendRow: (r) => { rows.push(r.slice()); } }; }

// Loads every .gs of srcDir into one context; sheets start with the headers of `schema`
// (default: the SCHEMA constant that setup itself uses, declared with `var`).
function loadGas(srcDir, schema) {
  const sheets = {}, cache = store(), props = store(); let held = false;
  const ctx = vm.createContext({ console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheets[n] || null }), flush() {} },
    CacheService: { getScriptCache: () => cache },
    PropertiesService: { getScriptProperties: () => props },
    LockService: { getScriptLock: () => ({
      waitLock() { if (held) throw new Error('nested waitLock'); held = true; },
      releaseLock() { held = false; } }) },
    Utilities: { getUuid: () => require('crypto').randomUUID() } });
  for (const f of fs.readdirSync(srcDir).filter((f) => f.endsWith('.gs')).sort())
    vm.runInContext(fs.readFileSync(path.join(srcDir, f), 'utf8'), ctx, { filename: f });
  const s = schema || ctx.SCHEMA || {};
  for (const n in s) sheets[n] = sheet(n, [s[n].slice()]);
  return { ctx, sheets, cache, props };
}
module.exports = { loadGas };
```

```javascript
// tests/example.test.js — run with: node tests/example.test.js
const assert = require('assert'), { loadGas } = require('./harness');
const { ctx } = loadGas(__dirname + '/../src');
assert.strictEqual(ctx.add_(2, 3), 5);   // top-level `function`/`var` become ctx properties
console.log('ok');
```

Top-level `const`/`let` in a `.gs` do not become context properties; another reason the public-surface test bans them.

**Grow the simulator to cover what the code uses:**
- `SpreadsheetApp`: Spreadsheet/Sheet/Range over arrays; `setValues` throws on a dimension mismatch; unsupported calls (A1 notation, etc.) throw "not simulated".
- `CacheService.put` throws `Argument too large: value` above 100 KB (as above); `LockService` throws on a nested `waitLock` (as above) and can be set "busy"; `flush` and cache-invalidation events are observable.
- `Session` with separate active and effective users; `MailApp` that captures messages, with a configurable quota and per-recipient failures; `ScriptApp` (URL, installed triggers); `Utilities.formatDate` via `Intl`; a fixed clock.
- Services you do not simulate (`DocumentApp`, `DriveApp`, `UrlFetchApp`) **throw on access**, so a test never passes by accident.
- Build the installed state from the **same schema constant setup uses**, never from a hand-copied header list.

**Calibrate against a real sheet.** A mock that stores values verbatim hides real bugs. Run a one-off diagnostic on a real sheet and encode what it observed: apostrophes, a formula sentinel plus `getFormulas`, conversions in `@` versus normal columns, checkbox fill, `deleteSheet` refusing the last sheet. Then test the simulator itself (`tests/harness.test.js`). Conversion rules: `references/gotchas.md` §Sheets as a database.

**`vm` realm pitfalls.** Objects created in the context have another realm's prototypes, so `assert.deepStrictEqual` fails on objects that look identical: compare `JSON.parse(JSON.stringify(x))` copies. For the same reason, `.gs` code must not use `instanceof` on built-ins (rule in `references/gotchas.md` §Sheets as a database).

**Probes and service replacement.**
- Inject a probe to observe what a callee sees: `vm.runInContext('function probe_(){ return currentEmail_(); }', ctx)` (for example the identity inside the `rpc` dispatcher).
- Replace a service per test (`ctx.HtmlService = {…}`) to capture which template `doGet` serves and the context it injects.

**Existing in-editor test functions:** Each `test*` function ships to production as a public function, so it needs an admin guard (`references/security-and-api.md` §Editor-run functions). Run every global `test*` in a fresh context; `--write-baseline` writes the passing names to `tests/harness-baseline.txt`, and `--baseline` fails only when a previously passing test now fails. Add every new test that passes locally to the baseline.

## Assertions

- **Negative tests assert why they failed.** Match the expected error message or code, and assert it is not an incidental one (for example `getUi` unavailable in the harness, which also throws). A refusal test that only checks "it threw" passes for the wrong reason.
- For refused side effects, assert that nothing changed: row counts, script properties, the one-time code still usable.
- **Fixtures contain every author and every role.** Seed multi-author aggregates with entries from all authors (and all roles) the code combines. Before calling something a regression, check the fixture.

## Static checks

**Public surface.** A whitelist test from the first commit: `templates/public-surface.test.js` scans the `.gs` files only and fails on any public function missing from `ALLOWED` and on any `api*` function whose first statement (directly or first inside a leading `try {`) is not a guard; unbalanced braces fail closed and stale whitelist entries are only warned. Extensions your project adds to its copy: per-category guards (menu handlers with `getUi()` on line one, editor-run functions) and a scan of the client sources for `google.script.run` calls to non-public names. What it checks and why: `references/security-and-api.md` §Public surface.

**Syntax before every push.**
```bash
cat File.gs | node --input-type=commonjs                     # recent `node --check` rejects .gs
sed -n '2,99999p' html/page-scripts.html | node --input-type=commonjs   # first line is <script>
```
Only `SyntaxError` counts: runtime errors for missing GAS globals are expected, and the trailing `</script>` gives a harmless false positive. Node does **not** detect the sandbox parser rules (`references/client-sandbox.md` §Syntax).

**Manifest and forbidden APIs.** A Node test parses `appsscript.json` and asserts `executeAs`, `access` and the declared `oauthScopes`, and greps sources for forbidden calls: `addEditor`, `Session` outside the auth file, `window.location`, `history.pushState`.

**Strip before you ban.** Run every ban regex (`window.location`, `addEditor`, backticks...) on source with comments and string literals removed (reuse `strip()` from `templates/public-surface.test.js`): a match in a comment fails the test for nothing, and one in a string hides nothing. Run the tests and read the output before saying they pass.

**Client sandbox rules: ban, do not review.** Extract every `<script>` block from the `.html` files (replace `<?= ?>`/`<?!= ?>` scriptlets with a placeholder), compile each with `new vm.Script(code)` and fail on the constructs the project chose to ban (a choice recorded in the project's `CLAUDE.md`; for example any backtick), on `window.location`, `history.pushState`/`replaceState`, and on `localStorage` outside a `try`. A blunt ban is checkable; "at most two nesting levels" is not.

**Lock discipline (heuristic).** Mark base writers (`appendRows_`, `updateRows_`, `deleteRows_`); a function that calls a writer outside an inline `withLock_(function () {…})` becomes a writer itself (repeat to a fixed point). Fail on a public function that writes outside a lock, and on a function that takes the lock (transitively) called inside a locked block. Document the limits in the test header (inline callbacks only, no dynamic calls, naive brace counting, explicit exemptions for setup and migrations) and plant a violation to prove the heuristic detects it.

**i18n.** Every dictionary has the same key set with no empty values; every key used in views exists; every error code that can reach the client has a message in every language, plus a network-error key.

**Tooling blind spots.** Before trusting a code graph, linter or static-analysis tool on a GAS repo, check that it parses `.gs` files and resolves cross-file calls (all files share one scope, with no imports).

## Client tests

Two levels:
1. **Script in `vm`:** strip an `.html` to its `<script>` and run it with fake `window`/`document` — enough for pure helpers.
2. **The real page in jsdom:** build the page exactly as `doGet` would (template plus context from an in-memory scenario), load it with `runScripts: 'dangerously'` (pin the jsdom version) and a controllable fake `google.script`; fail on any collected JS error.

The fake `google.script` provides:
- `run` as a **getter that returns a fresh runner per access**, each with its own `withSuccessHandler`/`withFailureHandler` pair; a shared handler pair swaps the responses of concurrent calls. Calls stay pending until the test answers success, a coded error or a network failure — or routes them to the in-memory server through the real `rpc`.
- `history` with a stack, `url.getLocation`, captured navigations instead of real ones, and a per-page `localStorage` seed.

```javascript
Object.defineProperty(fakeScript, 'run', { get() {
  const call = { ok: null, fail: null };
  const runner = new Proxy({}, { get(_, name) {
    if (name === 'withSuccessHandler') return (f) => { call.ok = f; return runner; };
    if (name === 'withFailureHandler') return (f) => { call.fail = f; return runner; };
    return (...args) => pending.push(Object.assign({ name, args }, call));
  } });
  return runner;
} });
```

**Local preview server.** A Node script renders any page mode from an in-memory scenario as `doGet` would and writes it to a folder; its "live" fake responses inject the code of the pure `.gs` functions (validation, previews) instead of re-implementing them, with a test that they match. Serve the folder on the LAN to open it on a phone. Reuse the same scenario module in the jsdom harness. Device validation: `references/workflow.md` §QA and debugging.

## Measuring latency

Before optimising speed, measure which layer the time goes to (one app; `references/architecture.md` §Round trips). Keep the instrumentation on a branch that is never merged:
- **Client:** a wrapper around `google.script.run` (a `Proxy` like the model B client in `references/client-sandbox.md`) that times each call from invocation to handler (round trip) and the handler itself (render), records click → screen ready across navigations in `localStorage`, and offers an on-screen report plus a "ping" button that makes N sequential calls to the cheapest API (the fixed cost per call).
- **Server:** timers on every sheet read (cache or Sheets, rows, ms) and every write in the data layer, and a timing field added to every API response by the shared `ok_`/`fail_` wrapper, so round trip minus server time gives the platform overhead.
- Measure on a temporary **versioned** deployment as well as `/dev`, with realistic data; delete the deployment afterwards and push the main branch back.
- The timing field reveals which sheets the server reads: it must never reach the main branch. A test that requires an identical response (an unauthenticated endpoint) failing in that branch is the guard.

## Before every push

Run, in this order, and push only when all pass:
1. Public-surface test.
2. Static checks (manifest, forbidden APIs, client bans, lock discipline, i18n).
3. Server harness tests (plus `--baseline` if the project keeps editor tests).
4. Client tests.
5. Syntax check of every changed `.gs` and client script.

Wire them into one command (`npm test` or a shell loop over `tests/*.test.js`) and record it in the project's `CLAUDE.md`.
