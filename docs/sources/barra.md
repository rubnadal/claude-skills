# Source inventory: Barralliure

Reusable GAS + Google Sheets web-app lessons from Barralliure, a mobile-first multi-user web app
(container-bound, model B identity with personal `?t=` links, a public anonymous landing page, a sheet menu
installer, a mail queue driven by a time trigger, Node test harnesses for the server and for the client).
Built 2026-10-13 → 2026-10-25, on top of `gas-webapp-playbook` v0.2.1.

Evidence is repo-relative to the Barralliure repository (file path or commit hash). Domain concepts
(teams, fixtures, results) have been generalised to "records", "resources" and "items".

Areas: security · architecture · gotcha · client · testing · workflow.

---

## Security

### BARRA-01 — Public landing needs `ANYONE_ANONYMOUS`, not `ANYONE`
- **Symptom:** With `access: ANYONE` ("Anyone with a Google account") visitors without a Google account (or not signed in on the phone) cannot open the public page at all; they hit a Google sign-in wall.
- **Cause:** `ANYONE` still requires a Google login. Only `ANYONE_ANONYMOUS` serves the page to people with no account. With `executeAs: USER_DEPLOYING` and anonymous access there is never a session e-mail, so identity comes only from the personal token.
- **Rule:** If the app has a public page for people without Google accounts, deploy `executeAs: USER_DEPLOYING` + `access: ANYONE_ANONYMOUS` and identify every non-public request by token only (never by `Session`). The publishing guide must say explicitly "do NOT pick *Anyone with a Google account*", with the label in every UI language the deployer might see.
- **Area:** security
- **Evidence:** `appsscript.json`; `web/full/guia-publicacio.html`; commit `8bb30d7`; `docs/superpowers/specs/2026-10-14-fase1-disseny-tecnic-design.md` §5
- **In v0.2.1:** no (extends `seguretat-api.md`§2: `ANYONE` is right only when there is no public page)

### BARRA-02 — Installer reachable from the web is protected by a one-time code minted by the sheet menu
- **Symptom:** The install function must be a public (non-`_`) function because the install dialog (HtmlService, inside the sheet) calls it with `google.script.run`; with an anonymous web app anyone could call it from the console and become admin.
- **Cause:** Every top-level function without a trailing `_` is callable from any page served by the deployment, including anonymous ones.
- **Rule:** Only the menu item (which needs the sheet open, `SpreadsheetApp.getUi()`) generates a random code with a short expiry (30 min) in a script property and injects it into the dialog template. The public install function checks the code (and "not installed yet") before taking the lock **and again inside the lock** (a double click must not install twice), and deletes the code only after a successful install — a validation error leaves it usable for a retry.
  ```javascript
  function instalarDesDelFull(dades, codi) {
    try {
      _comprovarCodi_(codi);                       // NO_AUTORITZAT / JA_INSTALAT
      _ambLock_(function () { _comprovarCodi_(codi); _instalar_(dades); props.deleteProperty('INSTAL_CODI'); });
      return _apiOk_('');
    } catch (e) { return _apiError_(e); }
  }
  ```
- **Area:** security
- **Evidence:** `servidor/Instalador.gs` (`menuInstalar`, `_comprovarCodiInstalacio_`, `instalarDesDelFull`); `tests/instalador.test.js` ("sense codi vàlid no escriu res", "un error de dades no consumeix el codi"); commit `7a711cc`
- **In v0.2.1:** no (`seguretat-api.md`§6 covers "setup must refuse if installed", not how to protect a web-reachable installer)

### BARRA-03 — Sheet-menu handlers must call `SpreadsheetApp.getUi()` on their very first line
- **Symptom:** A menu handler is public by necessity (menus call by name). If its first statement is something like `_invalidarTot_()` and only then `getUi()`, a web caller executes the side effect before the function fails.
- **Cause:** `getUi()` throws outside the sheet, but only when reached.
- **Rule:** Every menu handler starts with `var ui = SpreadsheetApp.getUi();` as line one. Enforce it with the public-surface test (first non-comment line of the body must match `SpreadsheetApp.getUi()`), and also add every menu handler, trigger handler and entry point to the `rpc` deny-list.
- **Area:** security
- **Evidence:** `tests/superficie-publica.test.js` ("els ítems de menú tenen SpreadsheetApp.getUi() a la primera línia"); `servidor/Auth.gs` (`RPC_PROHIBIDES`)
- **In v0.2.1:** yes (`seguretat-api.md`§1 table: "`SpreadsheetApp.getUi()` ja falla des de la web") — the first-line requirement and its test are new

### BARRA-04 — Public-surface test: one guard regex per category, plus a runtime sweep
- **Symptom:** A whitelist-only surface test passes even if a "protected" function forgot its guard, if a menu item uses a role guard instead of `getUi()`, or if a public function is created as `var x = function` / arrow (invisible to a `^function` regex).
- **Cause:** Static name extraction alone doesn't prove the right kind of guard nor catch non-declaration functions.
- **Rule:** Classify every public function (protected, anonymous, gateway, entry point, menu, trigger, sheet-dialog) and check a category-specific guard in the first lines (`_exigir…_(`, `SpreadsheetApp.getUi()`, `_comprovarCodi…_(`). Also: load all `.gs` in a `vm` context and fail on any function-valued global without `_` that isn't classified; trigger handlers must take 0 parameters and be in the `rpc` deny-list; no top-level `const`/`let` in `.gs`; no function name declared in two `.gs` files (GAS silently keeps one); no client file calls a server function ending in `_`.
- **Area:** security
- **Evidence:** `tests/superficie-publica.test.js`; commits `b1327bd`, `b4e5ea4`
- **In v0.2.1:** yes (`seguretat-api.md`§1 "Test de superfície pública") — per-category guards, runtime sweep, duplicate names and client→internal check are new

### BARRA-05 — Anonymous "e-mail me my link": identical answer, per-address marker, daily cap under lock
- **Symptom:** An anonymous endpoint that sends a personal link can be used to enumerate members (different answer or error), to flood an address, or to burn the whole daily mail quota.
- **Cause:** Any anonymous endpoint with a side effect is an oracle and an amplifier unless constrained.
- **Rule:** Always return the same `ok` (also on invalid input and on internal error). Per address: put a random marker in `CacheService` for N minutes and, inside the lock, re-check that the marker is still yours (a concurrent call overwrote it → abandon). Global: a `'YYYY-MM-DD|n'` counter in a script property, incremented under the lock, released **before** sending (the send itself takes the lock for the token, and the lock is not re-entrant). Skip if remaining quota ≤ a configured reserve. Known residual: a known address still answers slower because it sends inline; routing it through the mail queue (BARRA-13) removes the timing side channel.
- **Area:** security
- **Evidence:** `servidor/Correu.gs` (`demanarEnllac`); commit `64a013b`; `docs/pendents.md` §3 "Fase 2" (timing side channel)
- **In v0.2.1:** yes (`seguretat-api.md`§2 "Límit de sol·licituds…") — only one line there; the concrete pattern and the timing side channel are new

### BARRA-06 — Values concatenated into inline `on…="…"` handlers go through a whitelist, not HTML escaping
- **Symptom:** `onclick="_obrir('` + id + `')"` with an HTML-escaped value is still injectable: `&#39;` is decoded back to `'` before the attribute's JavaScript runs.
- **Cause:** HTML escaping protects the HTML context, not the JS-string context inside an event attribute.
- **Rule:** Every value interpolated inside an `on…="…"` attribute passes through a whitelist helper (`_idJs(v)` → only `[0-9a-z_-]`: UUIDs, view names, indices). Enforce with a test that scans every `on[a-z]+="…"` attribute for `' + expr + '` and fails unless `expr` is `_idJs(...)` (plus a sanity floor: the test must see more than N handlers, so it can't silently match nothing). Prefer delegated listeners with `data-*` attributes for anything richer.
- **Area:** security
- **Evidence:** `web/comu.html` (`_idJs`); `tests/client.test.js` ("tot valor concatenat dins un atribut on…="…" passa per _idJs"); commit `e4d45d1`
- **In v0.2.1:** no (`seguretat-api.md`§4 and `sandbox-gas.md` rule 3 only cover HTML escaping and quoting)

### BARRA-07 — Public payload: test it with sentinel strings, and strip ids it doesn't need
- **Symptom:** A public page injects a big server-computed object; personal fields (surnames, e-mails, internal person ids, "who entered this") slip in when a helper used by private views is reused.
- **Cause:** Shared helpers return whatever the private view needs; nothing checks the public serialisation as a whole.
- **Rule:** Build test fixtures with distinctive sentinel values (`'Cognomsecret'`, a fake e-mail, a known person id) and assert that `JSON.stringify(publicData())` contains none of them, nor keys like `"email"`, `"id_persona"`. Also walk the object and fail on any `null`/`undefined`. Remove record ids the public view doesn't use (here it also cut ~33 KB from the page).
- **Area:** security
- **Evidence:** `tests/landing.test.js` ("cap dada personal", "cap null enlloc"); `tests/pagines.test.js` ("el correu de l'administrador i els cognoms no surten a les vistes públiques"); commit `4060c48`
- **In v0.2.1:** no

### BARRA-08 — Formula neutralisation is lost when a row is read back and rewritten
- **Symptom:** A record named `=1+1` (saved neutralised as `'=1+1`) becomes a live formula after an unrelated field of the same row is updated.
- **Cause:** Sheets stores the leading apostrophe as a "text" marker and `getValues()` returns the text **without** it. An update that rewrites the whole row from `getValues()` writes `=1+1` raw. `'@'` (plain-text) format does **not** stop a leading `=` from becoming a formula.
- **Rule:** Any code path that writes back values obtained from `getValues()` re-applies the neutraliser to every string cell of the touched rows, not only to the fields being changed.
  ```javascript
  valors[fila] = valors[fila].map(function (v) { return typeof v === 'string' ? _textFulla_(v) : v; });
  ```
- **Area:** security
- **Evidence:** `servidor/Dades.gs` (`_updateRows_`); commit `678dfe5`; `docs/pendents.md` §3 "Operació i privacitat" (real-sheet diagnostic)
- **In v0.2.1:** yes (`seguretat-api.md`§4 neutralise on write) — the read-back/rewrite hole is new

### BARRA-09 — Erasing personal data from a sheet doesn't erase it from Drive version history
- **Symptom:** A "delete my data" feature anonymises the row, but the previous values are still visible in *File → Version history*.
- **Cause:** Google Sheets keeps revision history of every cell edit; the script cannot purge it.
- **Rule:** State it in the privacy notice or in the admin's erasure procedure; don't promise erasure the platform can't deliver.
- **Area:** security
- **Evidence:** `docs/pendents.md` §3 "Operació i privacitat"
- **In v0.2.1:** no

---

## Architecture

### BARRA-10 — One lock helper: `waitLock` → work → `flush()` → `releaseLock()`, and never nest it
- **Symptom:** (a) The next execution to take the lock reads data that the previous one "wrote" but Sheets hadn't applied yet. (b) A function called inside a locked section takes the lock itself; its `releaseLock()` frees the **caller's** lock half-way through the caller's critical section.
- **Cause:** Sheets batches writes until `SpreadsheetApp.flush()` or end of execution; the script lock is shared per execution, so an inner acquire/release pair releases the outer one.
- **Rule:** A single helper owns the lock (timeout → readable `SISTEMA_OCUPAT`), with `flush()` in a `finally` before `releaseLock()`. Document in its header which functions take the lock; functions that need to run both ways come in pairs (`_xSenseLock_` body + `_x_` wrapper). If a locked section needs the result of a locking function, get it before entering.
  ```javascript
  function _ambLock_(fn) {
    var lock = LockService.getScriptLock();
    try { lock.waitLock(15000); } catch (e) { throw _err_('SISTEMA_OCUPAT'); }
    try { return fn(); } finally { try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); } }
  }
  ```
- **Area:** architecture
- **Evidence:** `servidor/Dades.gs` (`_ambLock_`); `servidor/Auth.gs` (`_tokenPerPersonaSenseLock_`); commit `c436a61`
- **In v0.2.1:** yes (`arquitectura.md`§Concurrència, `gotchas.md` F1) — `flush()` before release and the "inner release frees the outer lock" mechanism are new

### BARRA-11 — Run migrations on every `doGet`, but with a lock-free fast path
- **Symptom:** A public page means every anonymous hit runs `doGet` → migrations → `waitLock`; under load visitors queue on the script lock for nothing.
- **Cause:** The migration runner always took the lock before checking the version.
- **Rule:** Read `SCHEMA_VERSION` first without the lock and return if it is current; only then take the lock, re-read and migrate (double-checked). Throw if the stored version isn't a number rather than re-running everything. The migration lock is its own (longer timeout), also flushes before release, and no migration may call a function that takes the lock.
- **Area:** architecture
- **Evidence:** `servidor/Migration.gs` (`_migrar_`); commit `9b236ec`
- **In v0.2.1:** no (`arquitectura.md`§Migracions says "cost habitual: una lectura de propietat" but not the double-check or the lock)

### BARRA-12 — Every entry point that isn't `doGet` migrates first: triggers and menu items too
- **Symptom:** New sheets added by a migration (e.g. the queue sheet) don't exist yet when the time trigger fires or when the admin uses the menu to activate notifications; the handler fails until someone happens to open the web app.
- **Cause:** Only `doGet` ran migrations; a trigger can run before any web visit after a code update.
- **Rule:** Time-trigger handlers and menu items that touch the schema call the (idempotent, fast-path) migration as their first action, before any other lock is taken. Test it: "the trigger starts by ensuring the schema is migrated", "the activate-notifications menu migrates before installing the trigger". Keep the `SETUP_COMPLETED` guard for `onOpen`.
- **Area:** architecture
- **Evidence:** `servidor/Cua.gs` (`activadorCua`); `servidor/Instalador.gs` (`menuActivarAvisos`); commits `902476f`, `f6f32de`; `tests/cua.test.js`
- **In v0.2.1:** no (`gotchas.md` D1 covers `onOpen` only)

### BARRA-13 — Outgoing mail through a queue sheet drained by a time trigger
- **Symptom:** Sending mail inline from user actions burns quota in bursts (a consumer `gmail.com` deployer has ~100 recipients/day), sends several mails to the same person for related events, and holds the user waiting.
- **Cause:** `MailApp` is synchronous and quota-bound; actions don't coordinate.
- **Rule:** Actions append notice rows (`id, person, channel, type, JSON data, created, state, sent_at, attempts`) **inside their own lock**, all in one `setValues`. A trigger every 5 min (installed once, deduplicated by handler name) groups pending rows per person into one mail in that person's language, sends at most N people per run (the lock is held while sending), stops when remaining quota ≤ reserve, marks recipients that can't receive (inactive, no consent, fictitious address) and unknown notice types as `skipped` — never an empty line or empty mail. With no pending rows it returns without taking the lock. With no known public URL it touches nothing (links can't be built). Open debts: purge old sent rows (the sheet outgrows the 100 KB cache), consider sending outside the lock.
- **Area:** architecture
- **Evidence:** `servidor/Cua.gs`; `tests/cua.test.js`; commits `c4d1ee2`, `793acf1`, `902476f`; `docs/pendents.md` "Ajornats de la revisió final"
- **In v0.2.1:** no (`gotchas.md` G1/G2 cover trigger dedupe and quota only)

### BARRA-14 — Queue send errors: only recipient errors spend an attempt
- **Symptom:** A Gmail outage or quota error marks every pending notice as failed after 3 runs; notices are lost although nothing was wrong with them.
- **Cause:** All exceptions from `MailApp.sendEmail` were treated the same.
- **Rule:** Classify the error. Recipient errors (message matches invalid/recipient) increment that person's `attempts` (→ `error` at the max) and the run continues with the others. Any other error (service down, quota) **stops the run without touching attempts**; rows already sent in this run stay `sent`. Log every failure with a searchable prefix.
- **Area:** architecture
- **Evidence:** `servidor/Cua.gs` (`_errorDeDestinatari_`, `_buidarCua_`); `tests/cua.test.js` ("error de servei (Gmail caigut)…"); commit `902476f`
- **In v0.2.1:** no

### BARRA-15 — Keep a slice of the daily mail quota in reserve
- **Symptom:** A bulk send (season start, ~44 links) or a burst of self-service requests leaves zero quota, so admin alerts (consent withdrawn, errors) can't go out that day.
- **Cause:** Every sender checked only `getRemainingDailyQuota() > 0`.
- **Rule:** Bulk and anonymous senders stop at `remaining ≤ reserve` (a `Config` key) and report the rest as pending (`{sent, pending, skipped}`) so the UI can offer "resend pending" later; only admin alerts may go below the reserve. Bulk-send helpers persist the pending list and merge it back under the lock after sending.
- **Area:** architecture
- **Evidence:** `servidor/Correu.gs` (`_enviarEnllacos_`, `_avisarAdmins_`); commits `c33009b`, `64a013b`
- **In v0.2.1:** yes (`gotchas.md` G2, `arquitectura.md`§Correu i triggers) — the reserve is new

### BARRA-16 — Corrections send the base value they were opened on (optimistic check inside the lock)
- **Symptom:** Two admins correct the same record, or one corrects while another reverts it; the second save silently overwrites a change it never saw, and a stale local draft "wins" over the server.
- **Cause:** The update only carried the new value.
- **Rule:** The client sends the value it displayed when the edit was opened; inside the lock the server compares it with the fresh row and refuses with a dedicated code (`RESULTAT_CANVIAT`) if it differs. The client then discards its draft and shows the current value. Apply the same to destructive actions (revert/reset) and give "the record is no longer in the expected state" its own clear message.
- **Area:** architecture
- **Evidence:** commits `227b8c1`, `ce42675`, `ff767a3`; `docs/superpowers/specs/2026-10-24-dades-velles-design.md`
- **In v0.2.1:** no (`gotchas.md` F2 covers check-and-write under lock, not stale client state)

### BARRA-17 — Order multi-step writes so a mid-way failure leaves a recoverable state
- **Symptom:** "Revert to pending" deleted the child rows first and then updated the parent; if the second write failed, the parent said "done" with no children.
- **Cause:** Without transactions, the order of writes decides which half-state survives.
- **Rule:** Write first the change that makes the leftover harmless (parent → pending), then delete the children; orphan children are already cleaned up by the next save. Log the previous value before destroying it. Think through "what if it stops here?" for every multi-sheet write.
- **Area:** architecture
- **Evidence:** commit `7862772`; `docs/pendents.md` "deutes/servidor"
- **In v0.2.1:** no

### BARRA-18 — A hand-edited bad `Config` value must not take pages down
- **Symptom:** The admin types `abc` into a numeric key of the `Config` sheet; `doGet` throws while building the context and the app becomes unusable for admin and manager.
- **Cause:** The same strict integer reader was used for operations and for page rendering.
- **Rule:** Two readers. `_configInt_` (operations) throws a coded error (`CONFIG_INVALIDA`) the client translates. `_configIntPagina_` (anything that renders a page or screen) validates (`/^\s*\d+\s*$/`, ≥ 1), falls back to the default and `console.warn`s with the key and bad value.
- **Area:** architecture
- **Evidence:** `servidor/Config.gs`; commits `9da5ef4`, `7862772`; `tests/pagines.test.js`, `tests/landing.test.js` ("… escrit malament a mà a Config")
- **In v0.2.1:** no (`gotchas.md` B9 says parse config values, not how to fail)

### BARRA-19 — Public page data computed on the server and injected in one pass
- **Symptom:** A landing that renders first and fetches its data with `google.script.run` paints empty, then jumps; on a phone behind the GAS banner it looks broken.
- **Cause:** The extra round trip happens after the (already slow) iframe load.
- **Rule:** One pure-ish function produces a serialisable object with everything the public page shows; `doGet` injects it into `APP_CONTEXT` (escaped `<`). That function is also the seam to move the page to static hosting later. Test that it reads each big sheet only once.
- **Area:** architecture
- **Evidence:** `docs/superpowers/specs/2026-10-14-fase1-disseny-tecnic-design.md` §2; `servidor/Codi.gs` (`doGet`); `tests/landing.test.js` ("la landing llegeix … un sol cop")
- **In v0.2.1:** no

### BARRA-20 — Code in `servidor/` and `web/` subfolders with clasp
- **Symptom:** Moving server and client files into folders changes their remote names (templates must then be referenced by path), and with clasp's default `scriptExtensions: [".js", ".gs"]` any Node tool script left un-ignored in the repo would be pushed as server code (risk, not an observed incident).
- **Cause:** clasp keeps the relative path in the remote file name (`web/layout`), while all `.gs` still share one global scope regardless of folder.
- **Rule:** With `rootDir` at the repo root and `skipSubdirectories: false`, reference templates by path (`'web/layout'`, `'web/vistes/' + vista`). Put tooling (`eines/`, `tests/`, `prototip/`, `node_modules/`, `package.json`) in `.claspignore`. Add a test that (a) every `.gs` lives under `servidor/` and every `.html` under `web/` — the only folders the other tests scan — and (b) every excluded tool folder is listed in `.claspignore`.
- **Area:** architecture
- **Evidence:** commits `d2f7403`, `5c5366d`, `4903c34`; `.claspignore`; `tests/superficie-publica.test.js` ("el codi que es puja és només a servidor/ … i web/"); `CLAUDE.md` §5.1
- **In v0.2.1:** no

### BARRA-21 — Installer from a sheet menu, for a non-technical deployer
- **Symptom:** A fresh copy of the sheet gives no hint of what to do; the OAuth "unverified app" screen scares the user; after installation the default empty `Sheet1` (named differently per locale) remains.
- **Cause:** Nothing guides the first run; the default sheet's name is locale-dependent.
- **Rule:** `onOpen` shows only "Install…" while `SETUP_COMPLETED` is missing, plus a long `toast` explaining the consent screen (pick your account → *Advanced* → *Go to … (unsafe)*). After install, the menu offers maintenance items (public URL, my admin link, publishing guide, clear cache, activate notifications) and demo-only items only while demo data exists. Install deletes every non-schema sheet that is completely empty (`getLastRow() === 0 && getLastColumn() === 0`) and keeps foreign sheets with content. A retry after a half-finished install refuses (`INSTAL_PARCIAL`) instead of duplicating the admin. Dialogs get everything precomputed in the template (they call no server function).
- **Area:** architecture
- **Evidence:** `servidor/Instalador.gs`; `servidor/Setup.gs` (`_instalar_`, `_esborrarFullsBuits_`); `tests/instalador.test.js`; commits `7a711cc`, `51d8012`
- **In v0.2.1:** no (`arquitectura.md`§Migracions i setup mentions a guided setup via `onOpen` only in one line)

### BARRA-22 — Demo/test people use the reserved `.invalid` TLD and are never mailed
- **Symptom:** Demo data with plausible addresses sends real mail (or bounces) and spends quota during testing.
- **Cause:** Demo rows go through the same senders as real ones.
- **Rule:** Generate demo addresses on `.invalid` (RFC 2606) and make every sender skip them (`omesos`, counted neither as sent nor as pending). The privacy contact and admin alerts skip them too.
- **Area:** architecture
- **Evidence:** `servidor/Correu.gs` (`_correuFictici_`); commits `6d9f604`, `19cdf20`
- **In v0.2.1:** no

---

## Gotchas

### BARRA-23 — Checkbox validation on empty rows writes `FALSE` and moves `getLastRow()`
- **Symptom:** Install failed on a brand-new sheet with the schema check "El full Persones no coincideix amb l'esquema: falta o és fora d'ordre la columna id_persona."; `getLastRow()` returned ~1000.
- **Cause:** Applying `requireCheckbox()` data validation to a whole column fills every empty validated cell with `FALSE`; `getLastRow()` counts them, so the "new" sheet looked populated and the header check ran against row 1 of garbage. (Rows that are only *formatted* are ignored by `getLastRow()`.)
- **Rule:** Apply checkbox validation only to the rows you just wrote (in the append helper), never to the whole column at sheet creation.
- **Area:** gotcha
- **Evidence:** commit `8d66183`; `servidor/Migration.gs` (`_formatCaselles_`, `_ensureSheet_`); `servidor/Dades.gs` (`_appendRows_`)
- **In v0.2.1:** no

### BARRA-24 — What plain-text (`'@'`) format did in one real-sheet diagnostic (unreconciled with v0.2.1)
- **Symptom:** Contradictory beliefs about booleans and formulas in text columns.
- **Cause:** Barralliure's single diagnostic on a real sheet (Europe/Madrid) recorded: in a `'@'` column, strings stay exactly as written (`'TRUE'`, `'007'`, `'2026-10-14'`, `'10:00'`), a JS boolean is stored as the lowercase string `'true'`/`'false'`, numbers stay numbers, and a leading `=` **still becomes a formula**. In a normal column `'007'` → 7, `'TRUE'` → boolean, ISO dates/datetimes and `'HH:mm'` → `Date` (times on 1899-12-30), `'1.0'` stays text.
- **Rule:** Treat this as one observation, not settled fact: v0.2.1 B2 observed the opposite for `'true'` in a `'@'` column, possibly under different conditions (how the value was written, locale, when the format was applied). Verify on a real sheet before merging either version. Safe either way: use `'@'` to stop conversions, not formulas (neutralise those, BARRA-08). Never write a JS boolean to a text column — make the write helper throw on it. Read booleans with one tolerant helper: `v === true || (typeof v === 'string' && v.trim().toUpperCase() === 'TRUE')`.
- **Area:** gotcha
- **Evidence:** `tests/helpers/gas.js` (comment above `valorDesat`: "Conversió dels valors escrits, calcada del diagnòstic sobre un full real (Europe/Madrid)"); `tests/harnes.test.js`; `servidor/Dades.gs` (`_esCert_`, `_valorColumna_`); commits `98180ad`, `6d3a088`
- **In v0.2.1:** contradicts (`gotchas.md` B2: "escriure `'true'` en una columna `@` acaba desant un booleà natiu" — Barralliure's diagnostic recorded text staying text and a JS boolean becoming the string `'true'`; unreconciled, verify before merging)

### BARRA-25 — Text columns must cover free-text names and be re-applied when the sheet grows
- **Symptom:** A record named `007` reads back as `7`, one named `TRUE` as a boolean, a timestamp loses its time part after rows are appended past the original grid.
- **Cause:** Only some columns were `'@'`, and rows added with `insertRowsAfter` don't inherit the column format.
- **Rule:** Keep a per-sheet list of columns Sheets would convert (names, version strings, timestamps `yyyy-MM-ddTHH:mm:ss`, times, free config values) and apply `'@'` to exactly those — at creation, in each migration that adds such a column, and to the new rows whenever the append helper extends the grid. Other columns keep native types. Don't paste by hand over text columns (pasting can drop the format).
- **Area:** gotcha
- **Evidence:** `servidor/Migration.gs` (`COLUMNES_TEXT`, `_formatTextColumnes_`); `servidor/Dades.gs` (`_appendRows_`); commits `f55e7aa`, `6d3a088`; `docs/pendents.md` §3
- **In v0.2.1:** yes (`gotchas.md` B3) — names, timestamps/times and grid extension are new

### BARRA-26 — `getUrl()` inside `doGet` can return the `/dev` URL; use the saved `/exec` for `<base href>`
- **Symptom:** On the phone, opened through `/exec`, an internal link ("see full table") landed on `…/dev`, which non-owners can't open.
- **Cause:** Observed once, in testing, with the owner's session (exact trigger not established): `ScriptApp.getService().getUrl()` inside `doGet` returned the `/dev` URL while the page was opened through `/exec`, and the layout used it for `<base href>`.
- **Rule:** In `doGet`, save the URL to a script property only when it ends in `/exec`; use the saved value (`_urlPublica_()`) for `<base href>`, menus and e-mails. Test that `<base href>` is the saved `/exec` even when `getUrl()` returns `/dev`.
- **Area:** gotcha
- **Evidence:** `servidor/Codi.gs` (`_desarUrlPublica_`, `_pagina_`); commit `2393cb3`; `tests/pagines.test.js` ("_pagina_: el <base href> és l'adreça /exec desada…"); `docs/pendents.md` "deutes/client"
- **In v0.2.1:** contradicts in part (`gotchas.md` D3b last paragraph and `sandbox-gas.md` rule 9 keep `getUrl()` for `baseUrl`; D3b already notes it is `/dev` when the page is opened via `/dev` — the new part is `/dev` returned for an `/exec` request)

### BARRA-27 — `getUrl()` called from a sheet menu returns a non-existent deployment
- **Symptom:** A link built from a menu or trigger opens a Google Drive 404 ("couldn't open the file").
- **Cause:** Outside a web request `ScriptApp.getService().getUrl()` returns `…/macros/s/<id>/exec` with an id that matches no deployment. Local tests can't see it because they stub `getUrl`.
- **Rule:** Capture the `/exec` URL inside `doGet` into a script property and read it everywhere else; until someone has opened `/exec` once, menus show the publishing guide instead of a broken link.
- **Area:** gotcha
- **Evidence:** commit `3c7a6a1`; `servidor/Codi.gs`; `servidor/Instalador.gs` (`menuAdrecaPublica`); `docs/pendents.md` "Lliçons de GAS del pla 2"
- **In v0.2.1:** yes (`gotchas.md` D3b)

### BARRA-28 — A versioned deployment does not follow `clasp push`
- **Symptom:** After a successful push, the phone (no owner session, `/exec`) still shows the old code; a mobile validation failed because of it.
- **Cause:** `/exec` is pinned to a version; only `/dev` serves HEAD.
- **Rule:** Before asking for a test through `/exec`, redeploy the same deployment id (`clasp deploy -i <deploymentId> -d "…"`) and check with `curl -sL <url>/exec` for a string of the new view.
- **Area:** gotcha
- **Evidence:** `docs/pendents.md` "Proves"; project memory note on test deployments (2026-10-15)
- **In v0.2.1:** yes (`gotchas.md` D3c)

---

## Client

### BARRA-29 — All templates of a page share one global scope: test for name collisions
- **Symptom:** With the admin panel scripts loaded, a user-facing editor broke on `main`; nothing in the panel code looked related.
- **Cause:** A panel script defined a top-level `function _revisar` with the same name as one in the app script; the later definition silently replaced the earlier one.
- **Rule:** For every view `doGet` can serve, expand the layout's includes (honouring conditional includes) and assert that no top-level `function X(` or `var X` appears in two included files. Prefix helpers per screen when in doubt.
- **Area:** client
- **Evidence:** `tests/client-globals.test.js`; commits `8ced83b` (rename), `f920c41` (test); `docs/pendents.md` "Lliçó del 3c"
- **In v0.2.1:** no (`sandbox-gas.md` rule 14 covers duplicate DOM ids, not global functions)

### BARRA-30 — `<base target="_top">` breaks `href="#x"`; read the hash with `google.script.url.getLocation`
- **Symptom:** In-page anchors (`<a href="#ranking">`) navigate the top window (reloading the app) instead of scrolling; a link to `/exec#ranking` doesn't scroll on arrival.
- **Cause:** `target="_top"` applies to fragment links too; and the hash isn't sent to `doGet` nor readable from `window.location` inside the sandbox iframe.
- **Rule:** One delegated click listener in the shared client script: for `a[href^="#"]` whose target exists, `preventDefault()`, `scrollIntoView()` and focus. To act on an incoming hash, call `google.script.url.getLocation(function (loc) { … loc.hash … })`.
- **Area:** client
- **Evidence:** `web/comu.html`; `web/vistes/landing-scripts.html`; commits `7263d12`, `2393cb3`
- **In v0.2.1:** no (`sandbox-gas.md` rules 9 and 11 don't cover fragments or `getLocation`)

### BARRA-31 — `history.back()` does nothing inside the GAS iframe
- **Symptom:** A "back" button calling `window.history.back()` or `history.go(-2)` does nothing — no error, no `setChangeHandler` callback. Leaving a sub-view leaves duplicate history entries.
- **Cause:** Verified on Android: the sandboxed iframe ignores programmatic history traversal; `google.script.history` only has `push`/`replace`/`setChangeHandler`, so entries can't be removed. The device's hardware/gesture back does work.
- **Rule:** Model sub-views with `google.script.history.push/replace` + `setChangeHandler`; use `replace` (not `push`) when closing an overlay so back doesn't reopen it; never plan features around popping entries. Ban `history.pushState/replaceState` in the client by test.
- **Area:** client
- **Evidence:** commit `2ee12dd`; `docs/pendents.md` "Descartats o ajornats" (pla 5); `tests/client.test.js`
- **In v0.2.1:** no

### BARRA-32 — Late server responses and double taps
- **Symptom:** (a) A background reload that returns after the user moved on re-opens an editor they had closed, or repaints a counter with pre-action numbers. (b) Tapping twice on "Save" before the reload repaints the screen sends the action twice.
- **Cause:** `google.script.run` callbacks run whenever the response arrives, regardless of what the screen shows now; re-enabling the button on success opens a window before the repaint.
- **Rule:** Capture the navigation state (view, id, step) or a request sequence number when calling, and drop the response if it no longer matches. A shared action helper disables the button with a "working…" label until the server answers, shows the error next to it, and can keep it disabled on success when a reload will repaint. Don't repaint a view while an action is in flight (mark it `aria-busy` and check).
- **Area:** client
- **Evidence:** `web/panell/panell-scripts.html` (`_accio`, `aria-busy`); commits `300c23b`, `18d5c66`, `816337f`, `5377387`
- **In v0.2.1:** yes (`arquitectura.md`§Convencions del client: spinner as anti-double-click guard) — stale-response guards are new

### BARRA-33 — Mobile inside the GAS iframe: design for 360×530
- **Symptom:** On a real 360 px phone the Google "created by a Google Apps Script user" banner takes 85 px, leaving 360×530; a fixed bottom input tray (~300 px) covered the active row.
- **Cause:** The banner sits outside the iframe and shrinks it on every visit (dismissable; hidden by some blockers). The tray height varies with content.
- **Rule:** Worst case is 360×530: key information of each screen fits without scrolling, nothing important in the top strip. `position: sticky/fixed` do work inside the iframe. Measure the tray height in JS into a CSS variable and reserve it (`padding-bottom`, `scroll-padding-bottom: calc(var(--alt-safata) + 12px)`). Set the viewport with `HtmlOutput.addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')` from `doGet`.
- **Area:** client
- **Evidence:** `docs/pendents.md` "Bàner de Google — verificat"; `servidor/Codi.gs` (`_pagina_`); `web/vistes/app-scripts.html`, `web/estils.html` (`--alt-safata`); commit `ce94f8c`
- **In v0.2.1:** no

### BARRA-34 — Switching UI language at runtime must not lose open forms or stale messages
- **Symptom:** Changing language in a panel reset half-filled forms, repainted with stale data, or erased a real "refresh failed" warning.
- **Cause:** The language switch re-rendered views from scratch (and sometimes re-fetched), and transient messages were plain text in the old language.
- **Rule:** On language change: save field values, repaint from the data already held (no server call, no state reset), restore the values; for each open form register a repaint hook. If the view shows "loading…" or a load error, re-open it instead. Transient notices carry a `data-type` so they can be re-rendered in the new language; clear one-off success messages. Skip repainting while an action is in flight.
- **Area:** client
- **Evidence:** commits `b280b46`, `5377387`, `816337f`; `tests/client-configuracio.test.js`, `tests/client-wizard.test.js`
- **In v0.2.1:** no

### BARRA-35 — `localStorage` always in `try`, drafts per record, and a quiet `beforeunload`
- **Symptom:** Where storage is blocked, an unguarded `localStorage` access throws and kills the rest of the script; `beforeunload` asked "leave page?" when the app itself navigated (expired token reload).
- **Cause:** Storage can be blocked, e.g. in private modes (rationale behind the test, not a recorded incident); the unload prompt can't tell intentional navigation from accidental.
- **Rule:** Every `localStorage` access is a one-line `try { … } catch (e) {}` (enforced by test). Keep unsent input as a draft keyed by record id and treat a recovered draft as "touched". Register `beforeunload` only while there is unsaved input and set a `NAVEGANT = true` flag in the navigation helper so intentional navigations don't trigger it.
- **Area:** client
- **Evidence:** `web/comu.html` (`_anarA`, `NAVEGANT`); `web/vistes/app-scripts.html`; `tests/client.test.js` ("localStorage sempre dins try"); commits `4b1ef06`, `2393cb3`
- **In v0.2.1:** no

---

## Testing

### BARRA-36 — Server harness: Sheets simulation calibrated against a real-sheet diagnostic
- **Symptom:** Tests passed with mocks that stored values verbatim, while the real sheet converted `'007'`, ate apostrophes, turned `=` into formulas and filled checkboxes — four production-class bugs were invisible.
- **Cause:** Mocks encoded what the author assumed Sheets does.
- **Rule:** Run a one-off diagnostic on a real sheet, then encode its results in the in-memory sheet (`valorDesat`: apostrophe, formula sentinel + `getFormulas`, `'@'` vs normal-column conversions, checkbox fill, `deleteSheet` refusing the last sheet, `setValues` size checks, `getMaxRows`). Simulate `CacheService.put` throwing `Argument too large` over 100 KB, `LockService` that throws on a nested `waitLock` and can be "busy", `flush` and invalidation events, installed triggers, mail quota, a fixed clock. Test the simulator itself (`harnes.test.js`).
- **Area:** testing
- **Evidence:** `tests/helpers/gas.js`; `tests/harnes.test.js`; commits `98180ad`, `8d66183`, `c436a61`
- **In v0.2.1:** yes (`arquitectura.md`§On viuen els tests: vm + mocks) — calibration against a real diagnostic and the specific behaviours are new

### BARRA-37 — `vm` realms: `instanceof Array/Date/Error` lies under the Node harness
- **Symptom:** Code that works in GAS fails (or passes wrongly) in tests: `x instanceof Array` is false for an array literal created inside the `vm` context, and `deepStrictEqual` fails on objects that look identical.
- **Cause:** Built-ins passed into the context are Node's; literals created inside the context get that realm's prototypes.
- **Rule:** In `.gs`, use `Array.isArray(v)` and `Object.prototype.toString.call(v) === '[object Date]'` instead of `instanceof` on built-ins. In tests, normalise results with `JSON.parse(JSON.stringify(x))` before deep comparisons.
- **Area:** testing
- **Evidence:** `tests/helpers/gas.js` (comment "ATENCIÓ: els built-ins…", `pla()`); `servidor/Dades.gs` (`_esData_`)
- **In v0.2.1:** contradicts (`gotchas.md` B4 snippet uses `valor instanceof Date`, which is unreliable under a `vm` harness)

### BARRA-38 — Client harness: the real page in jsdom with a controllable fake `google.script`
- **Symptom:** Static text checks on client code missed behaviour bugs (late reloads, delegated anchor clicks, error flows) that only showed on the phone.
- **Cause:** The client was never executed in tests.
- **Rule:** Build the page exactly as `doGet` would (template + context from an in-memory scenario) and load it in jsdom (`runScripts: 'dangerously'`, pinned version) with: `google.script.run` as a getter returning a **fresh runner per access** whose calls stay pending until the test answers `ok(name, data)` / `error(name, code)` / `xarxa(name)` or routes them to the in-memory server through the real `rpc`; `google.script.history` with a stack and `enrere()`; `google.script.url.getLocation`; captured navigations instead of real ones; per-page `localStorage` seed. Collect `jsdomError`, uncaught errors in listeners/timers and `console.error` into `p.errors`, and make `tancar()` throw if any. Filter only known "Not implemented" noise. First test: every mode loads without JS errors.
- **Area:** testing
- **Evidence:** `tests/helpers/client.js`; `tests/harnes-client.test.js`; `docs/superpowers/plans/2026-10-18-harnes-client.md`; commit `4b09936`
- **In v0.2.1:** no

### BARRA-39 — A fake `google.script.run` must keep one handler pair per call
- **Symptom:** In the local preview, two concurrent calls swapped responses (each screen got the other's data).
- **Cause:** The fake stored a single success handler shared by all calls; real GAS gives every `google.script.run` access its own runner with its own handlers.
- **Rule:** Model `google.script.run` as a getter that returns a new object each time, capturing its own `withSuccessHandler`/`withFailureHandler`.
- **Area:** testing
- **Evidence:** commit `37e189c`; `tests/helpers/client.js` (`Object.defineProperty(script, 'run', { get() { … } })`)
- **In v0.2.1:** no

### BARRA-40 — Static test: every write inside the lock, no lock inside a lock
- **Symptom:** Writes outside the lock (and nested locks) slip in during reviews because they look harmless locally.
- **Cause:** Nothing checks lock discipline across ~25 `.gs` files.
- **Rule:** A heuristic test over the `.gs` text: base writers (`_appendRows_`, `_updateRows_`, `_deleteRows_`); an internal function that calls a writer outside an inline `_ambLock_(function () {…})` becomes a writer itself (fixed point); a public function that calls a writer outside a lock fails; functions that take the lock (transitively) can't be called inside a locked block. Document its limits in the header (only inline lock callbacks, no dynamic calls, naive brace counting, explicit exemptions for install/migration) and include a test that the heuristic detects a planted violation.
- **Area:** testing
- **Evidence:** `tests/escriptures-amb-lock.test.js`; commit `b244625`
- **In v0.2.1:** no

### BARRA-41 — Enforce sandbox rules by banning, not by reviewing
- **Symptom:** The playbook says nested template literals and `window.location` break in the sandbox but Node's syntax check can't detect the former.
- **Cause:** The parser difference only shows inside the GAS iframe.
- **Rule:** A client test extracts every `<script>` block (replacing `<?= ?>` scriptlets), compiles it with `new vm.Script` (syntax), and fails on **any** backtick, `window.location`, `history.pushState/replaceState`, or `localStorage` outside a same-line `try`. A blunt ban is checkable; "max two levels" isn't.
- **Area:** testing
- **Evidence:** `tests/client.test.js`
- **In v0.2.1:** no (`sandbox-gas.md`§Comprovació local says rules 1–3 can't be detected and must be followed while writing)

### BARRA-42 — i18n test: parity, no empty strings, used keys exist, a message for every error code
- **Symptom:** A raw key or an untranslated server error code appears on screen in one language.
- **Cause:** Parity alone doesn't catch keys used in HTML/JS that exist in neither dictionary, nor error codes the server can send.
- **Rule:** Load each dictionary file in a `vm` context; assert identical key sets and no empty values; scan all views for `data-i18n="…"` and `_t('…'` and assert each key exists; keep a list of every error code that can reach the client and assert `err_<code>` exists in all languages (plus `err_xarxa`). Test composite keys (`'avis_' + x`) explicitly.
- **Area:** testing
- **Evidence:** `tests/i18n.test.js`
- **In v0.2.1:** yes (`arquitectura.md`§Convencions del client: "Val la pena un validador de paritat") — used-key and error-code coverage are new

### BARRA-43 — Local preview server reusing the real pure server functions
- **Symptom:** Some screens can't be exercised on the shared test sheet (e.g. a creation wizard while a season is active), and a hand-written preview drifts from server validation.
- **Cause:** Preview fakes duplicated server logic.
- **Rule:** A Node script mounts any page mode from an in-memory scenario exactly as `doGet` does and writes it to a folder; "live" fake responses inject the code of the pure `.gs` functions (validation, previews) instead of re-implementing them, with a test that they match. Serve the folder on the LAN (`python3 -m http.server <port> --bind <ip>`) to open it on the phone. The same scenario module feeds the jsdom harness.
- **Area:** testing
- **Evidence:** commits `fa23448`, `c5ac479`, `7d3cee6`; `tests/vista-previa.test.js`; `docs/pendents.md` "Eines"
- **In v0.2.1:** no

---

## Workflow

### BARRA-44 — Validate UI on the real phone, through a deployment; know the limits of headless checks
- **Symptom:** Screens that looked fine in desktop screenshots broke at 360 px inside the iframe; headless captures of the published `/exec` came out blank.
- **Cause:** The deciding factors (banner, iframe size, touch) only exist on the device; headless Chrome won't go below ~500 px wide and often renders `/exec` blank.
- **Rule:** Offer each screen proposal already deployed for the phone (throwaway branch → push to the test script → anonymous deployment → validate → undeploy, delete branch, push `main` back). Use headless screenshots of the local preview to catch JS and layout errors before the phone; to check a deployment, `curl -sL <url>` and grep for text of the view. A feature is merged only after the user says "validated" on the phone.
- **Area:** workflow
- **Evidence:** project memory notes on phone review and test deployments; `docs/pendents.md` "Eines", item 3 ("Lliçó del 3a")
- **In v0.2.1:** no (`flux-de-treball.md`§QA covers browser verification by the agent, not device validation)

### BARRA-45 — Requirements as an open dialogue, one topic per turn
- **Symptom:** The user rejected the first requirements question asked as a 4-option multiple choice.
- **Cause:** Closed options force a choice before the user has given context they already have in mind.
- **Rule:** During requirements/brainstorming ask in free text, one topic per turn, each with a reasoned proposal the user can accept or correct; reserve multiple-choice prompts for small, well-bounded decisions. Record decisions with a status marker (e.g. `[A]` agreed) in the requirements file.
- **Area:** workflow
- **Evidence:** project memory note on open-dialogue requirements (2026-10-13); `CLAUDE.md` §1; `docs/requisits.md`
- **In v0.2.1:** no (`flux-de-treball.md`§Disseny amb l'usuari doesn't cover the question format)

---

## File-split signal

- Mobile client / iframe behaviour: BARRA-30, BARRA-31, BARRA-32, BARRA-33, BARRA-35, BARRA-44 → **6** (plus BARRA-26 on base URL as seen from the phone).
- Public anonymous landing: BARRA-01, BARRA-07, BARRA-19 → **3**.
- Sheet-menu installer: BARRA-02, BARRA-03, BARRA-21 → **3** (plus BARRA-12, menu items that migrate).
- Mail queue / quota: BARRA-13, BARRA-14, BARRA-15, BARRA-22 → **4**.

Total mobile + landing + installer = **12** of 45. On their own each group is small (3–6 entries); together
("public, mobile, non-technical-deployer apps") they could justify one extra file in Task 9, or else they fit
as subsections of `sandbox-gas.md` (mobile/iframe), `seguretat-api.md` (landing, installer) and
`arquitectura.md` (queue).
