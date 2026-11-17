# Knowledge inventory — Reserves ATECA

Reusable lessons from Reserves ATECA, a Google Apps Script web app backed by a single Google Sheets file (container-bound, `executeAs: USER_DEPLOYING`, `access: ANYONE`, hybrid session + personal-link identity, ES/CA i18n). The project is a fork of a public GAS app, so several lessons come from hardening inherited code.

Evidence is a repo-relative path or a commit hash in the ATECA repository. "Author notes" means the author's private project notes for this repository (not versioned). The domain (bookings of rooms and equipment) is only context: every rule below is written to apply to any GAS + Sheets web app.

Sources read: `CLAUDE.md`; `docs/tech/*.md`; `docs/superpowers/specs/2026-10-07-auth-token-design.md`, `2026-10-08-seguretat-api-publica-design.md`; `tests/*.js` (structure); `Auth.gs`, `Migration.gs`, `Recordatoris.gs`, `Incidencias.gs`, `i18n-core.html` and selected parts of `Codigo.gs`/`index.html`; the author's notes for both copies of the repo; the full git log (224 commits), with the diffs of the security and hardening commits read in detail.

---

## Security

### ATECA-01 — Only a trailing `_` hides a server function
- **Symptom:** Helpers named `_canEditX`, `_invalidateAllCache`, `_sendReminderEmail` (which sends mail with client-supplied content) were callable from the browser console with `google.script.run._sendReminderEmail(...)`. An inventory found 155 top-level functions in the inherited code, most of them reachable.
- **Cause:** Apps Script exposes to `google.script.run` every top-level function whose name does not *end* in `_`. A leading underscore is only a naming habit and hides nothing.
- **Rule:** Every internal backend function ends in `_` (the project convention `_name_()` makes it obvious from both sides). Only functions the client really calls, entry points, trigger handlers and editor-run functions keep a plain name. Before renaming one, grep every client file: if the client calls it, it is not internal and needs a guard instead. The hardening renamed 76 functions plus 23 leading-underscore-only helpers.
- **Area:** security
- **Evidence:** cbf72d8, 2c6f07c, docs/superpowers/specs/2026-10-08-seguretat-api-publica-design.md
- **In v0.2.1:** yes (seguretat-api.md§1)

### ATECA-02 — "Harmless" public functions are rarely harmless (the `bc672ab` sweep)
- **Symptom:** Three weeks after the big rename, a call-graph review found that any visitor, even one not registered, could call the generic config readers (`getConfigValue(key)`) and read keys such as the administrator's email address. Setup internals that take a `Spreadsheet` argument (`createStructure(ss)`, `ensureAdmin(ss, email)`) were also still public.
- **Cause:** The public-surface whitelist had a "harmless" category that accepted (a) generic readers judged to hold "no secrets" and (b) functions whose parameters cannot be serialised from the client. (a) was wrong: the config sheet held personal data. (b) was luck, not a guard.
- **Rule:** Treat the "harmless" category as a near-empty exception list. A function that reads any sheet, config key or property is not harmless; a non-serialisable parameter is not access control. Rename to `_` and fix the callers (the `bc672ab` sweep touched 9 files for 5 functions). Re-run the public-surface review after every feature that adds server code, not only once.
- **Area:** security
- **Evidence:** bc672ab, tests/superficie-publica.test.js
- **In v0.2.1:** contradicts (seguretat-api.md§1 lists "pure, … or with non-serialisable parameters" as an acceptable "harmless" category)

### ATECA-03 — Users outside the deployer's domain get an empty session email
- **Symptom:** With `executeAs: USER_DEPLOYING`, users from another Google domain landed on the registration form on every visit. Registration and approval succeeded, but the next visit showed the form again: an endless loop. About 20 server functions that identified the user via `Session.getActiveUser().getEmail()` saw `""` too.
- **Cause:** When the script runs as the deployer, Google only reveals the visitor's email to accounts in the deployer's own domain. Everyone else is anonymous to the script.
- **Rule:** Hybrid identity: use the session email when present; otherwise resolve a personal token from the link `?t=<token>` once per execution (a global variable, which GAS resets at every execution, so it cannot leak between calls). Tokens live in script properties in both directions (`AUTH_T_<token>` → email, `AUTH_E_<email>` → token), 32 hex chars from `Utilities.getUuid()`, permanent until an admin regenerates them, about 130 bytes per user against the 500 KB properties limit. Manifest: `access: ANYONE` (any Google account), never `ANYONE_ANONYMOUS`; changing it requires `clasp push --force`.
- **Area:** security
- **Evidence:** docs/superpowers/specs/2026-10-07-auth-token-design.md, 0cdf020, faefbf9, 5b570c3, 8e1e15e
- **In v0.2.1:** yes (seguretat-api.md§2)

### ATECA-04 — `rpc()` is a generic dispatcher: harden it like one
- **Symptom:** A first draft of `rpc(token, fnName, args)` could dispatch to any global, including natives such as `eval`/`Function`, to `rpc` itself, to `doGet`, and to internal `_` helpers, defeating the trailing-underscore rule.
- **Cause:** `globalThis[fnName].apply(null, args)` with an unchecked name is an arbitrary-call primitive running as the deployer.
- **Rule:** Refuse with a fixed error unless all of these hold: the name matches `/^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]$/` (so nothing starting or ending in `_`), it is not `rpc` or `doGet`, it is an own property of the global object, it is a function, and `Function.prototype.toString.call(fn)` does not contain `[native code]`. A non-empty but invalid token (regenerated link, deactivated user) must throw (`Error('Enllaç no vàlid')`, "invalid link"), never fall back silently to anonymous. `rpc` itself is listed in the public-surface test as an entry point.
- **Area:** security
- **Evidence:** Auth.gs (`rpc`), 2c6f07c, docs/tech/backend.md
- **In v0.2.1:** yes (seguretat-api.md§2 "Model B")

### ATECA-05 — An empty identity can match an empty row
- **Symptom:** The authorisation lookup `checkUserAuthorization_(email)` compared the caller's email against the users sheet; with an anonymous caller (`""`) a users row with an empty email cell would have matched and authorised the caller.
- **Cause:** "No identity" was passed through as an ordinary string and compared like any other value.
- **Rule:** Every identity lookup returns "not authorised" immediately when the trimmed email is empty, before reading any sheet. Never let `''` reach a comparison against sheet data.
- **Area:** security
- **Evidence:** 48e7238 (Codigo.gs `checkUserAuthorization_`)
- **In v0.2.1:** no

### ATECA-06 — Email links that change data: confirmation page, owner only, nothing leaked
- **Symptom:** `?action=cancel&id=<uuid>` cancelled any record with a plain GET. Because the client already received other users' record IDs, any user could cancel anyone's records, and email scanners that prefetch links cancelled records on their own. A similar admin-approval link did not check that the visitor was an admin.
- **Cause:** A GET with side effects, an unguessable ID treated as authorisation, and no identity check.
- **Rule:** A GET never mutates. The link opens a page that (1) validates the ID format, (2) shows one generic message for "not yours", "does not exist" and "no identity", so it never reveals whether the ID exists, and (3) only for the owner shows the details and a button that calls a protected server function (through `rpc` with the embedded token if the identity came from a token). Admin actions go through the admin panel, not the owner's link.
- **Area:** security
- **Evidence:** 464496f, f5d6362, 6fcacc8, Codigo.gs (`_paginaConfirmarCancelacio_`)
- **In v0.2.1:** yes (seguretat-api.md§3)

### ATECA-07 — Approval emails carry a single-use code, not the approver's personal token
- **Symptom:** The "approve this registration" email sent to administrators originally embedded the admin's personal access link, so the email itself became a long-lived credential, and the approval ran on GET.
- **Cause:** Reusing the general-purpose personal link for a one-off action.
- **Rule:** For one-off actions sent by email, issue a single-use code (stored in script properties with a timestamp, expiring after a fixed period, 14 days here), keep one live code per subject (reuse it instead of minting more), sweep expired codes and orphaned indexes whenever a new one is created, and require a confirmation click. Escape every user-supplied value on the confirmation page.
- **Area:** security
- **Evidence:** 635a56c, 61ab7ed, Auth.gs (`_crearCodiAprovacio_`, `_netejarCodisCaducats_`)
- **In v0.2.1:** yes (seguretat-api.md§2, "single-use codes"; the expiry, one-code-per-subject and sweep details are new)

### ATECA-08 — Token links: one helper, active users only, one email per recipient
- **Symptom:** Notification emails sent to several recipients at once would have exposed one person's personal link to the others; public links (QR codes, links sent to a group of admins) must not carry anyone's token.
- **Cause:** A personal token in a URL is a bearer credential: whoever receives the email can sign in as that user.
- **Rule:** Build every app link with one helper (`_urlApp_(email, params)`) that reads the base URL from config (empty = `ScriptApp.getService().getUrl()`) and appends `t=` only for an active registered user. Send one email per recipient when the link is personal. Links that go to several people or get printed (QR, group notifications) are built with an empty email and never carry a token.
- **Area:** security
- **Evidence:** 93285d9, Auth.gs (`_urlApp_`), docs/superpowers/specs/2026-10-07-auth-token-design.md §2
- **In v0.2.1:** yes (seguretat-api.md§2; "one email per recipient" is not stated)

### ATECA-09 — "Resend my link": identical answer and rate limits
- **Symptom:** A self-service "email me my access link" form can be used to find out which addresses are registered, or to flood a mailbox.
- **Cause:** Different responses for known and unknown addresses; no throttling.
- **Rule:** Always return the same response ("if the address is registered you will receive an email"), whether or not it exists and whether or not the throttle kicked in. Throttle per address with `CacheService` (here 1 send per address per 10 minutes, key `AUTH_RESEND_<email>`) and cap open registration requests globally (here 30 per hour). Validate the email shape and length before anything else. A registration attempt from an already active user is turned into a resend, so no admin sees it.
- **Area:** security
- **Evidence:** f91d34d, 61ab7ed, Auth.gs (`reenviarEnllacAcces`)
- **In v0.2.1:** yes (seguretat-api.md§2, "rate limits on open registration"; the identical response is not stated)

### ATECA-10 — Formula injection: reject in structured fields, neutralise free text
- **Symptom:** A user-typed value starting with `=`, `+`, `-` or `@` was stored by `appendRow`/`setValues` and evaluated by Sheets as a formula. Rejecting free text that started with `-` (an ordinary dash bullet) blocked legitimate descriptions.
- **Cause:** Sheets interprets the leading character of any string written through the API.
- **Rule:** For short structured fields (IDs, categories, names) reject values matching `/^[=+\-@]/` after trim. For free text (notes, descriptions) never reject: prefix an apostrophe (`"'" + text`) so Sheets stores it as text. Apply it at every write point, including legacy or rarely-used paths.
- **Area:** security
- **Evidence:** fa92836, bfa0eec, Incidencias.gs (`reportarIncidencia`), Codigo.gs (`textFulla`)
- **In v0.2.1:** yes (seguretat-api.md§4)

### ATECA-11 — Escape on every output channel: email HTML, generated pages, inline JSON
- **Symptom:** User names, notes and record details were interpolated raw into `htmlBody` emails and into HTML pages built in `.gs` (confirmation pages, `<title>`). Values embedded in an inline `<script>` with plain `JSON.stringify` could close the script tag.
- **Cause:** Server-built HTML has no templating engine escaping it.
- **Rule:** One `_escHtml_` helper (escapes `& < > " '`) applied to every user value in emails and server-generated pages; values put into inline scripts use `JSON.stringify(v).replace(/</g, '\\u003c')`. Free text that ends up in third-party URLs that render HTML (a calendar "add event" template) is escaped too.
- **Area:** security
- **Evidence:** 48e7238, fd2af9e, bfa0eec, 2b18739, Auth.gs (`_escHtml_`)
- **In v0.2.1:** yes (seguretat-api.md§4)

### ATECA-12 — Admin-configurable URLs are validated on the server
- **Symptom:** A help-link URL editable in the admin config tab ends up in an `href` shown to every user. The client-side form check could be bypassed by calling the save function directly; also, the intended help host only listened on plain HTTP and redirected from there, so an "https only" rule broke it.
- **Cause:** A config value rendered into markup is an injection vector (`javascript:` URLs, quotes).
- **Rule:** The server function that reads the value validates it before it reaches the template: scheme `http`/`https` only, a bare domain gets `http://` prepended, no whitespace, quotes or angle brackets, bounded length; an invalid value renders nothing. Mirror the check on the client only for the form's comfort. Extract the validator as a pure function and unit-test it in Node.
- **Area:** security
- **Evidence:** faa9641, 7724767, Codigo.gs (`_urlAjudaValida_`), tests/url-ajuda.test.js
- **In v0.2.1:** yes (seguretat-api.md§4)

### ATECA-13 — Editor-run and destructive functions need a one-shot property guard
- **Symptom:** Functions meant to be run from the Apps Script editor (seed test data, wipe test data, repair the installation, reset the template for distribution) are public by construction, since a trailing `_` would also hide them from the editor's Run menu.
- **Cause:** There is no "editor only" visibility in GAS.
- **Rule:** Guard each one with a script property that must be set to `'true'` by hand and is deleted by the function itself on use (`CONFIRMAR_DADES_PROVA`, `CONFIRMAR_REPARACIO`, `CONFIRMAR_RESET_PLANTILLA`), so every run needs fresh confirmation from someone with editor access.
- **Area:** security
- **Evidence:** b23e646, b9d7f26, Setup.gs (`prepararPlantillaPerDistribuir`)
- **In v0.2.1:** yes (seguretat-api.md§5)

### ATECA-14 — The installer must refuse to run twice and must not touch foreign sheets
- **Symptom:** The setup function behind the activation screen (which makes the caller admin) could be called by any user through `google.script.run` on an installed system. Reinstalling could delete whatever sheet sat at index 0, even one not created by the app.
- **Cause:** No "already installed" guard; setup assumed it owned the whole file.
- **Rule:** Setup refuses when the installed flag is set. It only reuses an empty sheet outside its schema (Sheets cannot have zero sheets) and never deletes or renames a sheet with content. A reset leaves a blank sheet at index 0. Between a reset and reinstalling, anyone who opens the URL can run the installer and become admin, so reinstall immediately or undeploy first.
- **Area:** security
- **Evidence:** 4927995, Setup.gs (`ejecutarSetupVinculado`, `crearEstructuraInterna_`)
- **In v0.2.1:** yes (seguretat-api.md§6)

### ATECA-15 — An abandoned sign-in design built on user properties (unverified cause)
- **Symptom:** A first multi-domain sign-in design (one-time codes plus `PropertiesService.getUserProperties()`, with access opened to anyone) was unreliable in production; ATECA abandoned it with a hard reset.
- **Cause:** Not recorded: the author's notes say only "not reliable in production", and ATECA abandoned the design. (Hypothesis, unverified in ATECA: under `executeAs: USER_DEPLOYING` user-scoped storage belongs to the deployer, not to each visitor.)
- **Rule:** Unverified in ATECA. Do not build per-visitor state on `getUserProperties()`/`getUserCache()` in a deployer-executed app without first proving it on a throwaway deployment with two accounts from different domains; the design that did work is ATECA-03 (script properties keyed by a server-resolved token).
- **Area:** security
- **Evidence:** author notes, 2026-04-14 (the commits were removed with `git reset --hard`, so no hash remains in the history); replacement design in docs/superpowers/specs/2026-10-07-auth-token-design.md
- **In v0.2.1:** no

### ATECA-16 — Read-only roles are enforced by the server, not by hidden buttons
- **Symptom:** A read-only "manager" role needed to see the admin panel (selected tabs only, configurable) without being able to change anything, and a historical "past period" mode needed the same for every role.
- **Cause:** Hiding buttons only changes the UI; every write function stays callable from the console.
- **Rule:** Each write function guards with an explicit role list (`_exigirRol_(['admin'])`), and a read-only role gets a separate read endpoint that returns only the data subset it may see. The same applies to "historical read-only mode": hide controls with `[data-admin-only]` *and* reject the write on the server.
- **Area:** security
- **Evidence:** f31db84, 59ad4f7, 81cb281
- **In v0.2.1:** yes (arquitectura.md§Autorització per recurs)

---

## Architecture

### ATECA-17 — Migration runner with an append-only registry
- **Symptom:** Schema changes shipped as ad-hoc "add column if missing" code scattered through features; partial failures left installs in unknown states.
- **Cause:** No single place that knew which changes an install had received.
- **Rule:** `CURRENT_SCHEMA_VERSION` in code, `SCHEMA_VERSION` in script properties, and an ordered `MIGRATIONS` array of `{version, description, fn}` that is never pruned. The runner applies pending entries in order, saves the version *after* each success, logs with a searchable prefix (`[Migration]`), and on error logs and `break`s (never skips ahead out of order) without blocking the app; the next load retries. Installs that predate the system (installed flag set, no version) are stamped as v1. Migrations are additive and idempotent, built from `_ensureColumn_`, `_ensureSheet_`, `_ensureConfigKey_` (which never overwrites an existing value). It runs from `doGet`.
- **Area:** architecture
- **Evidence:** Migration.gs (`checkAndMigrate_`, `MIGRATIONS`), docs/tech/migracions.md
- **In v0.2.1:** yes (arquitectura.md§Migracions i setup)

### ATECA-18 — Every migration must also land in the setup schema
- **Symptom:** On fresh installs, features failed with `null` sheets or missing columns (two whole sheets and a column were missing), while upgraded installs worked.
- **Cause:** A fresh install sets `SCHEMA_VERSION = CURRENT_SCHEMA_VERSION` and never runs migrations; the columns and sheets had only been added in `_migrate_vN_`.
- **Rule:** In the same commit as a migration, update the setup schema (headers, sheet list, config defaults). Review checklist item: "is everything this migration adds also created by setup?"
- **Area:** architecture
- **Evidence:** 47cb3d8, 23ca6ab, CLAUDE.md ("Schema Migrations", step 3)
- **In v0.2.1:** yes (arquitectura.md§Migracions i setup)

### ATECA-19 — Write rows by header name, never by position
- **Symptom:** Users created from the admin panel could not sign in (name and email swapped, only 4 of 8 columns written); the approval flow wrote 6 of 8 columns; seed data missed the last column. No error anywhere.
- **Cause:** `appendRow([...])` with positional arrays written when the sheet had fewer columns, never updated as columns were added.
- **Rule:** Build the row from a header → index map (`new Array(numCols).fill('')`, then `row[map['email']] = value` for each field), and route every write to a given sheet through one function. Positional arrays are acceptable only in setup code that also defines the headers in the same place.
- **Area:** architecture
- **Evidence:** aef6877, 72fda4f, 9ebd366, Codigo.gs (`crearNuevaReserva` header map)
- **In v0.2.1:** yes (gotchas.md§B8)

### ATECA-20 — Header matching breaks on invisible characters
- **Symptom:** A column lookup returned `-1` in production even though the header was visibly present in the sheet; the same code worked on a fresh test sheet.
- **Cause:** The real header contained something not visible (the commit blames capitalisation, spaces or invisible characters), so the exact comparison of the normalised name (`toLowerCase().replace(/[\s_]+/g, '') === 'iddispositivafectat'`, the code before the fix) never matched.
- **Rule:** For headers a human may have typed or pasted, match tolerantly: ATECA switched to a substring test on the lowercased header (`h.indexOf('dispositiu') !== -1 && h.indexOf('afect') !== -1`) and treats a missing column as optional (`-1` → empty value). Create headers from code (setup/migrations) so the exact name is known. The diagnosis used a temporary debug field in the response (author notes). Stripping zero-width characters or applying NFC in a single normaliser is the author's suggestion, not observed in ATECA.
- **Area:** architecture
- **Evidence:** 836d19e (Incidencias.gs `getIncidencias`)
- **In v0.2.1:** no

### ATECA-21 — Soft delete for anything history points at
- **Symptom:** Deleting a resource or a user would orphan historical records and break statistics and history views.
- **Cause:** Physical row deletion in a store with no foreign keys.
- **Rule:** "Delete" sets a status column to inactive; lists filter inactive records by default and a toggle shows them with an "inactive" badge; restore is an edit. Keep physical deletion for disposable data only (expired codes, closed-period cleanup after an archive copy).
- **Area:** architecture
- **Evidence:** 5fd2f55, CLAUDE.md ("Soft Delete")
- **In v0.2.1:** yes (arquitectura.md§Decisions de base)

### ATECA-22 — Bulk destructive operations: archive copy first, parse dates defensively
- **Symptom:** A "close the period" cleanup deleted rows whose date had been typed as `dd/MM/yyyy` text, because comparing the raw string made them look older than the cut-off.
- **Cause:** Mixed cell types (native `Date`, ISO text, locale text) in a date column, compared as strings.
- **Rule:** Before any bulk delete, `makeCopy` the whole spreadsheet (it lands in the deployer's Drive under `USER_DEPLOYING`) and abort without touching anything if the copy fails. Parse dates with a helper that accepts `Date`, ISO and the local text format; rows whose date is not recognised are kept and logged, never deleted. Only allow closing a period that has already ended, and check it on the server.
- **Area:** architecture
- **Evidence:** 14937c5, 32f13ea, 70b3a45 (`_dataReservaISO`)
- **In v0.2.1:** yes (seguretat-api.md§6 "makeCopy first"; the defensive date parsing for deletes is new)

### ATECA-23 — Invalidate the current cache key, and the whole cache on resets
- **Symptom:** A newly approved user did not appear until the cache expired hours later; after deleting all sheets and reinstalling, stale data was served.
- **Cause:** The approval handler removed an old versioned key (`..._V5`) while reads used the current one (`..._V7_FULL`); `CacheService` is script-scoped and survives sheet deletion.
- **Rule:** Keep cache key names in one constant table and invalidate through it, never with string literals. Provide one "invalidate everything" helper and call it from every reset or reinstall path.
- **Area:** architecture
- **Evidence:** 70b3a45, 10e8338
- **In v0.2.1:** yes (gotchas.md§B6)

### ATECA-24 — Non-reentrant script lock: obtain lock-taking values before entering the section
- **Symptom:** Creating a record (inside `LockService.getScriptLock()`) also sent a confirmation email whose personal link might need a new token; token creation takes the same lock, so it would block until timeout.
- **Cause:** The script lock is not reentrant.
- **Rule:** Document in each function header whether it takes the lock. Call lock-taking helpers (here, ensure the user's token exists) *before* acquiring the lock; inside, they find the value and return without locking. Wrap the call that could still need the lock in `try/catch` with a degraded fallback (a link without token) so the main operation never fails because of an email.
- **Area:** architecture
- **Evidence:** fd2af9e, Auth.gs (`_tokenPerUsuari_`), docs/tech/restriccions-gas.md
- **In v0.2.1:** yes (gotchas.md§F1)

### ATECA-25 — Bulk email: quota check, cap, per-address outcome, retry only failures
- **Symptom:** Sending access links to a selection of users could stop halfway when the daily mail quota ran out, with no way to know who had received one.
- **Cause:** `MailApp` quotas are per day and per deployer account; a loop of `sendEmail` throws midway.
- **Rule:** Before sending, check `MailApp.getRemainingDailyQuota()` against the batch size and refuse with a stable code (`quota`, plus the remaining count) if it is short; cap each call (here 100); dedupe and normalise addresses; return `{sent, skipped, failed}`; let the UI retry only the failed ones. A resend never regenerates credentials. Do not take the script lock in the bulk sender if per-item helpers take it.
- **Area:** architecture
- **Evidence:** 66939bd, 51f737b, Auth.gs (`adminEnviarEnllacos`)
- **In v0.2.1:** yes (arquitectura.md§Correu i triggers)

### ATECA-26 — Time-based triggers: delete before create, and never rename the handler
- **Symptom:** Toggling a scheduled feature on and off created duplicate hourly triggers (duplicate emails). Separately, the security rename could not touch the trigger handler.
- **Cause:** Every `ScriptApp.newTrigger()` adds a trigger; installed triggers call the handler by name, so renaming it (for example adding `_`) orphans the existing trigger silently.
- **Rule:** A single `manageTrigger_(enable)` that first deletes every project trigger with that handler name and then creates one if enabled. Keep the handler name stable and public (list it as a trigger in the public-surface test) and make it safe to call from the client: it only does work that was due anyway and marks it done. Any reset deletes the trigger too.
- **Area:** architecture
- **Evidence:** Recordatoris.gs (`gestionarTriggerRecordatoris_`), docs/superpowers/specs/2026-10-08-seguretat-api-publica-design.md §1
- **In v0.2.1:** yes (gotchas.md§G1, seguretat-api.md§1)

### ATECA-27 — Hourly triggers are imprecise: use a tolerance window plus a "done" flag
- **Symptom:** Scheduled reminders sent zero emails: the filter required "same day, later than now" and the computed time was always midnight.
- **Cause:** Two bugs: PascalCase keys on lowercase-normalised rows (the lookup map was empty, so every time defaulted to 00:00), and date-based instead of time-window logic. GAS hourly triggers do not fire at exact times.
- **Rule:** Select items whose target time falls within `|target − (now + lead)| ≤ tolerance`, with the tolerance wider than half the trigger period (here ±35 min for an hourly trigger), and set a per-row "sent" column so overlapping executions never send twice.
- **Area:** architecture
- **Evidence:** b2344b4, 49f846b, Recordatoris.gs (header comment)
- **In v0.2.1:** no

### ATECA-28 — Return stable error codes, not `e.message`
- **Symptom:** The client showed raw translation keys or English exception text when an unexpected error reached a handler that passed `e.message` to `window.t()`.
- **Cause:** The client translated whatever string came back, and exception messages are not keys.
- **Rule:** Server functions map every failure, including unexpected exceptions caught at the top, to a small fixed set of codes (`noData`, `permissionDenied`, `genericError`…) that exist in every dictionary; log the real message server-side.
- **Area:** architecture
- **Evidence:** 9a85754, 8fd0a9f
- **In v0.2.1:** yes (arquitectura.md§Funcions públiques)

### ATECA-29 — Exporting a native Google Doc to .docx needs the Drive REST endpoint
- **Symptom:** `Cannot convert application/vnd.google-apps.document to application/vnd.openxmlformats-officedocument.wordprocessingml.document` from `DriveApp.getFileById(id).getAs(MimeType.MICROSOFT_WORD)`.
- **Cause:** `getAs()` cannot export native Docs/Sheets/Slides to Office formats.
- **Rule:** `UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/export?mimeType=' + encodeURIComponent(MimeType.MICROSOFT_WORD), {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}})`, then trash the temporary Doc. Wrap it in one shared helper (`_generateDocxBlob_(name, buildFn)`).
- **Area:** architecture
- **Evidence:** eeace25, Informes.gs (`_generarDocxBlob_`)
- **In v0.2.1:** yes (gotchas.md§E1)

### ATECA-30 — A new Google service breaks the deployed authorisation
- **Symptom:** After adding document generation, the deployed app failed with `No tens permís per cridar X. Permisos obligatoris: https://www.googleapis.com/auth/...` ("You do not have permission to call X. Required permissions: …"). Later, with explicit scopes, the spreadsheet menu sidebar failed until `script.container.ui` was added.
- **Cause:** A `USER_DEPLOYING` web app runs on the consent the owner last gave; new services add scopes that consent does not cover. With explicit `oauthScopes`, nothing is inferred.
- **Rule:** Declare `oauthScopes` explicitly and add the scope in the same commit as the new service. After deploying, open the editor, run any function that uses the new service and accept the consent dialog; existing deployments (head and versioned) work again without redeploying.
- **Area:** architecture
- **Evidence:** 804a122, c4346b1, author notes (2026-06-22, report generation)
- **In v0.2.1:** yes (gotchas.md§D2; the "run once from the editor to re-consent" fix is not stated)

---

## Client

### ATECA-31 — i18n: `t(key, params)` with `{name}` interpolation and a parity check
- **Symptom:** Strings concatenated around translated fragments read wrong in the other language; keys added to one dictionary only showed the raw key in the other.
- **Cause:** Word order differs between languages; two hand-maintained dictionaries drift.
- **Rule:** One engine (`i18n-core`) with `window.t('a.b', {count: n})` replacing `{count}` (global regex per param), `data-i18n` for text and `data-i18n-html` only for trusted markup, and a start-up validator that walks both dictionaries and `console.warn`s keys present in only one. Language comes from a server-injected value validated against the supported list, then the browser, then a default. Every visible string goes through it, including server-returned codes (ATECA-28).
- **Area:** client
- **Evidence:** i18n-core.html, docs/tech/i18n.md
- **In v0.2.1:** yes (arquitectura.md§Convencions del client)

### ATECA-32 — Pages served outside the main layout must receive the language from the server
- **Symptom:** The registration page appeared in the browser's language instead of the language configured for the app.
- **Cause:** That page was rendered by a different `doGet` branch that did not inject the app language, so the i18n engine fell back to `navigator.language`.
- **Rule:** Every template `doGet` can return (registration, confirmation, error pages) gets the configured UI language injected, validated against the allow-list on the server (invalid → default), and translates its `<title>` too.
- **Area:** client
- **Evidence:** 1d75b15, Codigo.gs (`_idiomaUiValid_`), registro.html
- **In v0.2.1:** no

### ATECA-33 — Setting `select.value` from code does not fire `change`
- **Symptom:** After cancelling a modal with a non-default option selected and reopening it, the select showed the default value but the dependent form sections stayed hidden.
- **Cause:** The reset code assigned `el.value = default`; programmatic assignment does not dispatch `change`, so the visibility handler never ran.
- **Rule:** Keep each dependent-visibility handler as a named function stored on the element (`el._syncHandler`) and call it explicitly right after any programmatic reset (or `el.dispatchEvent(new Event('change'))`). Audit every reset path of a modal for the same pattern.
- **Area:** client
- **Evidence:** 2815ec6 (scripts.html)
- **In v0.2.1:** no

### ATECA-34 — The same data held in two client stores goes stale in one of them
- **Symptom:** After an admin cancelled their own records from the admin panel and returned to the main view, the "my active records" badge still showed the old count.
- **Cause:** The admin view updated its own state object only; the main view's list was loaded once at start-up, and the "reload" after leaving the admin panel fetched static data that did not include it.
- **Rule:** When a write in one view affects data another view caches, update every store derived from it in the success handler (filter by ID and re-render the badge), or reload that specific dataset. List the client stores (`AdminState`, `globalState`…) and which server data each mirrors.
- **Area:** client
- **Evidence:** 4ba6843 (admin-scripts.html)
- **In v0.2.1:** no

### ATECA-35 — A "data already loaded" flag turns reloads into no-ops
- **Symptom:** After a destructive admin action, the panel kept showing old data although the reload function was called.
- **Cause:** `loadAdminData()` returned early while `adminDataReady` was true.
- **Rule:** Any write that must be reflected sets the flag to false before calling the loader. Prefer a loader with an explicit `force` parameter.
- **Area:** client
- **Evidence:** 8eb8796, CLAUDE.md ("Gotcha: loadAdminData()")
- **In v0.2.1:** yes (gotchas.md§C6)

### ATECA-36 — Lazy-loaded data: never cache the failure as data, but stop retry loops
- **Symptom:** Two lazy-loaded views hit opposite bugs on failure: one retried the server call endlessly (fixed by writing a `[]` sentinel in the error handler); in the other, an error must not be stored as "loaded, empty" (fixed by leaving the cache `null`).
- **Cause:** The error path shared the single "loaded/not loaded" field with the success path, so it could either loop or poison the cache.
- **Rule:** On error keep the store `null` (not loaded), show an error state with an explicit retry button, and record "last attempt failed" separately so automatic re-renders do not re-fire the call.
- **Area:** client
- **Evidence:** aeedea7, d1d889c, author notes (history and incident-statistics features, 2026-06-03)
- **In v0.2.1:** no

### ATECA-37 — Template-injected values are strings
- **Symptom:** A year selector listed `"20231"` instead of `2024`.
- **Cause:** `doGet` injected a config value into `window.FIRST_YEAR` and the client did `y + 1` on a string.
- **Rule:** Convert on the server before injecting (`String(parseInt(v, 10) || fallback)`) and again on the client (`parseInt(window.X, 10)`) before arithmetic; booleans are injected as `'true'`/`'false'` and compared explicitly.
- **Area:** client
- **Evidence:** 5fd2f55, CLAUDE.md ("Course Selector")
- **In v0.2.1:** yes (gotchas.md§B9)

### ATECA-38 — Sandbox parser rules, with the exact errors they produce
- **Symptom:** `SyntaxError: '' string literal contains an unescaped line break`, `unexpected token: keyword 'class'` or `illegal character U+274C` at page load, often hundreds of lines after the real problem; `node --check` passed. Separately, a tab stayed visible after `classList.add('hidden')`.
- **Cause:** The HtmlService iframe parser is stricter than V8 for template literals nested 3+ deep, function declarations nested inside functions with multi-line templates, and `'${x}'` inside a template; and `.tab-content.active { display:block }` beats Tailwind `.hidden`.
- **Rule:** Precompute conditional fragments into variables; move row builders to top-level helpers using concatenation; build `onclick="fn('…')"` attributes by concatenation; split script files before ~7,500 lines; toggle tab panels with the `active` class only.
- **Area:** client
- **Evidence:** 5211306, a4dd353, d2e3cdb, 6aadd06, c7dc215, f8f879e, docs/tech/restriccions-gas.md
- **In v0.2.1:** yes (sandbox-gas.md§Sintaxi, §DOM i CSS)

### ATECA-39 — Restricted networks: self-host bundles as external scripts, generate images on the server
- **Symptom:** Behind the schools' content filter, the Tailwind CDN was blocked (unstyled UI) and a third-party chart/QR domain too. Inlining the ~400 KB Tailwind bundle into a `<script>` to avoid the CDN broke the sandbox parser with `SyntaxError: missing ) in parenthetical`, although the same content worked from an external URL.
- **Cause:** Network filters block generic CDNs; the sandbox parser has a practical size limit for inline scripts.
- **Rule:** Ask which domains the target network blocks. Serve large libraries from a host you control as an external `<script src>`, never inline. Generate images (QR) on the server with `UrlFetchApp` and return a `data:` URI; in emails a direct image URL works because the mail client fetches it through its own proxy. The Google Charts QR endpoint returns 404 (retired).
- **Area:** client
- **Evidence:** 5fa8ff5, 337be9c, tailwind-vendor.html, Codigo.gs (`getQrDataUri`)
- **In v0.2.1:** yes (sandbox-gas.md§5, gotchas.md§G4, arquitectura.md§Convencions del client)

### ATECA-40 — Code that addresses table cells by position blocks new columns
- **Symptom:** Adding a selection checkbox column to the users table would have broken existing toggles that read `row.children[5]`; the checkbox had to be squeezed into the avatar cell instead.
- **Cause:** DOM lookups by child index couple behaviour to column order.
- **Rule:** Select cells and controls by `data-*` attribute (`row.querySelector('[data-col="active"]')`), never by index. When you find positional lookups, fix them before adding columns.
- **Area:** client
- **Evidence:** c0836aa, author notes (bulk link sending, 2026-10-13)
- **In v0.2.1:** no

---

## Testing

### ATECA-41 — Unit-test `.gs` files in Node with `vm` and service mocks
- **Symptom:** Identity and token logic could only be checked by deploying and clicking with two accounts.
- **Cause:** GAS globals (`PropertiesService`, `CacheService`, `LockService`, `Session`, `ScriptApp`, `MailApp`) do not exist in Node.
- **Rule:** Load the `.gs` source into a `vm` context with in-memory mocks of those services and stubs for cross-file functions, then call functions directly (`node tests/auth.test.js`, no dependencies). Cover: create/reuse token, regeneration invalidates the old one, session wins over token, inactive user not identified, `rpc` refusals, rate limits, link builder with and without base URL. Make sure the ignore rules do not exclude `tests/*.js` (ATECA-48) and that `clasp` does not upload them.
- **Area:** testing
- **Evidence:** tests/auth.test.js, 0cdf020, 1390450
- **In v0.2.1:** yes (arquitectura.md§On viuen els tests)

### ATECA-42 — Objects created inside a `vm` context fail `deepStrictEqual`
- **Symptom:** `assert.deepStrictEqual(result, {success: true})` failed although the printed values were identical.
- **Cause:** Objects created in the `vm` context have that context's `Object.prototype`; strict deep equality compares prototypes.
- **Rule:** Compare through a JSON round-trip: `assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), expected)` (a small `igual(a, b)` helper).
- **Area:** testing
- **Evidence:** tests/auth.test.js (`igual`)
- **In v0.2.1:** no

### ATECA-43 — A public-surface test that fails on any unclassified function
- **Symptom:** New public functions kept appearing without guards, and client calls referenced functions that had been renamed to `_`.
- **Cause:** Nothing mechanical connected "is public" with "is guarded" and "is called by the client".
- **Rule:** A dependency-free Node test that (1) extracts every top-level function without a trailing `_` from all `.gs` and fails if it is not in a categorised whitelist (`protected`, `entry`, `trigger`, `editor`, …); (2) for `protected` ones, checks the first lines of the body contain the guard (`_exigir…`, `_emailActual_()`, role helper); (3) checks that every `google.script.run…name(` and `rpc(…, 'name'` in client files and in HTML strings built by `.gs` points to an existing public function.
- **Area:** testing
- **Evidence:** tests/superficie-publica.test.js, 81cb281
- **In v0.2.1:** yes (seguretat-api.md§1 "Test de superfície pública")

### ATECA-44 — Static tools miss `.gs` files and cross-file calls
- **Symptom:** A code knowledge graph of the repo contained no backend files at all, and after a workaround it had zero call edges between `.gs` files, so security review by "who calls this?" was blind.
- **Cause:** Tools that dispatch by extension do not recognise `.gs`; all `.gs` files share one global scope without `import`s, so AST-based call resolution finds no cross-file calls.
- **Rule:** Before trusting any static analysis on a GAS repo, check that it sees the `.gs` files (copy them to `.js` for the tool if needed) and that cross-file calls are resolved (a post-pass that matches `name(` against the set of top-level functions, validated against the source line). A review done this way found the `bc672ab` issues (ATECA-02).
- **Area:** testing
- **Evidence:** bc672ab, author notes (code graph reference, 2026-10-30)
- **In v0.2.1:** no

---

## Gotchas

### ATECA-45 — `doGet` hides the request parameters from the address bar
- **Symptom:** While debugging a link (`?action=...`), the address bar after load showed a `script.googleusercontent.com/.../echo?user_content_key=...` URL, so it was impossible to tell which action had been requested.
- **Cause:** Every `doGet` response (HTML or `ContentService`) is served through a redirect to the user-content domain.
- **Rule:** To know what reached the server, log `JSON.stringify(e.parameter)` at the top of `doGet` and read it in the editor's Executions view. Do not infer the request from the browser.
- **Area:** gotcha
- **Evidence:** author notes (2026-06-21, link investigation); the nearby commit b8e4b4e does not show the episode, so the lesson rests on the notes
- **In v0.2.1:** no

### ATECA-46 — Times and compact datetimes: text format and zero padding
- **Symptom:** Times like `9:00` written to a sheet came back as `0.375`. A calendar "add event" link built from `8:10` produced `T81000`, read as 81 hours, and the event landed three days later.
- **Cause:** Sheets converts time-looking strings to day fractions unless the column is plain text; `'8:10'.replace(':', '') + '00'` has 5 digits.
- **Rule:** Set `setNumberFormat('@')` on time columns in setup, before any write, and also when no sample data is loaded. Build `HHMMSS` with `padStart(6, '0')` and test single-digit hours.
- **Area:** gotcha
- **Evidence:** 4927995 (time columns as text), 676916e (padding), Setup.gs
- **In v0.2.1:** yes (gotchas.md§B3 covers the text format for codes; time fractions and padding are new)

### ATECA-47 — `createHtmlOutputFromFile` does not run scriptlets
- **Symptom:** A sidebar that started using `<?!= include('vendor') ?>` rendered the scriptlet literally and lost its styles.
- **Cause:** `HtmlService.createHtmlOutputFromFile()` serves the file as-is; only `createTemplateFromFile(...).evaluate()` processes `<? ?>`.
- **Rule:** Serve every page and dialog through `createTemplateFromFile(...).evaluate()`. When an include "does not work", first check how the `.gs` creates the output.
- **Area:** gotcha
- **Evidence:** 5fa8ff5 (Codigo.gs `mostrarInstruccionesSidebar`), Sidebar.html
- **In v0.2.1:** no

### ATECA-48 — A broad `*.js` ignore rule silently drops vendored assets and tests
- **Symptom:** The self-hosted Tailwind bundle returned 404 from the static site although it existed locally, and `git status` showed nothing pending. Earlier, the Node tests had not been committed for the same reason.
- **Cause:** `*.js` in `.gitignore` (meant for local copies of `.gs` files) also matched `docs/assets/tailwind.js` and `tests/*.js`; ignored files do not appear as untracked.
- **Rule:** Add explicit negations (`!docs/assets/tailwind.js`, `!tests/*.js`) and `git add -f` once. When a file "never arrives" at the remote, run `git status --ignored <path>` / `git check-ignore -v <path>` before suspecting CI.
- **Area:** gotcha
- **Evidence:** 337be9c, 1390450
- **In v0.2.1:** no

### ATECA-49 — clasp: account check, no `clasp logs`, keep the deployment ID
- **Symptom:** `clasp push` failed with "The caller does not have permission"; `clasp logs` gave nothing; deleting and re-creating the versioned deployment broke every link already emailed.
- **Cause:** clasp was logged in with a different account (or the session had expired); `clasp logs` needs a standard GCP project, which a container-bound script does not have; a new deployment gets a new `/exec` URL while stored base URLs and sent links point at the old one.
- **Rule:** Before pushing, check `clasp show-authorized-user` against the account that owns the script. Read logs in the editor's Executions view. Publish new versions with `clasp deploy -i <deploymentId> -d "<label>"`, never delete and re-create a deployment that links point at.
- **Area:** gotcha
- **Evidence:** ffa0e7f, docs/tech/deploy.md, docs/tech/installacio-clasp.md, author notes (resume point, 2026-10-30)
- **In v0.2.1:** yes (gotchas.md§D3c covers `deploy -i`; the account check and `clasp logs` are new)

### ATECA-50 — After a mass rename to `_`, docs still tell people to run hidden functions
- **Symptom:** The migrations guide still says to run `checkAndMigrate_` from the editor's Run menu to force a re-run, and its "reset schema version" snippet is named `_resetSchemaVersion` (leading underscore only).
- **Cause:** The rename changed visibility both ways: a trailing `_` hides a function from the editor's Run dropdown as well as from the client, and the doc example kept the old naming, which would make it callable from the browser if pasted into the project.
- **Rule:** After any visibility rename, grep the docs and snippets for the old and new names. Functions people must run from the editor keep a plain name *and* a one-shot property guard (ATECA-13); diagnostic snippets in docs follow the same rule.
- **Area:** gotcha
- **Evidence:** docs/tech/migracions.md ("Forçar una re-execució manual", "Resetar la versió manualment"), cbf72d8
- **In v0.2.1:** yes (seguretat-api.md§1 already says the trailing `_` hides a function from the Run menu; only "grep the docs and snippets after a rename" is new)

### ATECA-53 — A real push from the main branch removes branch-only remote files
- **Symptom:** After measuring latency from an instrumentation branch (two extra files, a server `.gs` and a client `.html`), `clasp push --force` from the main branch listed 27 files instead of 29; a `clasp pull` into a temporary folder showed the two files gone and the remote identical to the main branch.
- **Cause:** The push uploaded changed files, so clasp replaced the whole project with the local file set; files that existed only on the other branch were removed. This is the other side of MPRO-42 (nothing is replaced while every uploaded file matches).
- **Rule:** Do not rely on "`clasp push` never deletes remote files": a push that uploads anything replaces the project. After cleaning up an instrumentation or experiment branch, verify with a temporary `clasp pull` that the remote matches the main branch.
- **Area:** gotcha
- **Evidence:** author notes (2026-11-16), clasp 3.4.1; the instrumentation branch is local and never merged
- **In v0.2.1:** no

---

## Workflow

### ATECA-51 — Temporary diagnostics: tagged, committed alone, reverted alone
- **Symptom:** A registration flow misbehaved only on the deployed app with real accounts, and could not be reproduced locally.
- **Cause:** Behaviour depended on the deployed identity model, which local tests mock.
- **Rule:** Add `Logger.log` lines carrying a unique searchable tag (`[DIAG-REG]`) in a commit of their own (`chore(diag): …`), push, reproduce, read Executions, then `revert` that commit, so no diagnostic noise is left behind and the history shows what was instrumented. Set a rollback tag before a risky cross-cutting change (`pre-auth-token`) so it can be undone with one command.
- **Area:** workflow
- **Evidence:** 7d1ec4b, cb10836, tag `pre-auth-token`
- **In v0.2.1:** no

### ATECA-52 — Rule out stale inputs before debugging code
- **Symptom:** A page reached from a calendar-event link "did not work" after a fix had been deployed.
- **Cause:** The tests kept reopening an old link (from an event created before the fix, offered again by browser autocomplete); the deployed code was correct (confirmed by comparing `clasp pull` with local code).
- **Rule:** When a fix "does not work", first confirm the exact input: regenerate the link or email, compare deployed and local code (`clasp pull` into a temp dir), and ask for the exact click sequence, before changing code. Close it as a false positive when that explains it.
- **Area:** workflow
- **Evidence:** author notes (2026-06-21); commits 3267707 and b8e4b4e are the feature and its follow-up, they do not show the false-positive investigation, so the lesson rests on the notes
- **In v0.2.1:** yes (flux-de-treball.md§QA i depuració, "ask for the exact click sequence"; stale-link and `clasp pull` comparison are new)
