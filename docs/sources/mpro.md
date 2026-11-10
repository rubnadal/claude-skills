# Source inventory — MPRO Avaluació

Reusable GAS + Google Sheets web-app lessons from the MPRO Avaluació project (container-bound Web App, 15+ `.gs` files, ~24 sheets, 4 roles, hybrid identity model since 2026-11-04). Domain concepts of the project are generalized: "resource" = the main entity users are members of, "membership table" = any table that gives a user a role inside a resource.

Evidence is given as repo-relative paths or commit hashes in the MPRO repository. "In v0.2.1" refers to the previous `gas-webapp-playbook` (Catalan file names: `SKILL.md`, `seguretat-api.md`, `arquitectura.md`, `sandbox-gas.md`, `gotchas.md`, `flux-de-treball.md`).

Entries are grouped by Area: security (01–16), architecture (17–24), client (25–31), testing (32–39), gotcha (40–44), workflow (45–50), performance (51–57, added 2026-11-10).

---

## Security

### MPRO-01 — Identity model B: execute as deployer, access "Anyone with a Google account"
- **Symptom:** With `executeAs: USER_ACCESSING` + `access: DOMAIN`, users from another Google domain cannot open the app at all, and every user must be given direct access to the spreadsheet — so any low-privilege user (e.g. a student) can open the file and read every other user's data, bypassing the app's role checks.
- **Cause:** In model A the script runs with each user's own permissions, so the spreadsheet must be shared with them; the app's authorization is only presentation while they hold file access.
- **Rule:** When users span domains or when one role must not see another role's data, use `executeAs: USER_DEPLOYING` + `access: ANYONE` (never `ANYONE_ANONYMOUS`). The spreadsheet is shared with nobody; the app never calls `addEditor`/`addViewer`. Every public function now runs with the deployer's rights, so the public-surface discipline (MPRO-13) becomes mandatory.
- **Area:** security
- **Evidence:** `appsscript.json`; commit `342dbba`; `docs/ROADMAP-historial.md` ("Seguretat Fase 2 — identitat multidomini, model B")
- **In v0.2.1:** yes (seguretat-api.md§2) — now confirmed in a second project, migrated from model A in production.

### MPRO-02 — Under USER_DEPLOYING + ANYONE, session email exists only for the deployer's domain
- **Symptom:** `Session.getActiveUser().getEmail()` returns `''` for users whose account is in a different Google domain than the deploying account; same-domain users are identified normally.
- **Cause:** Google only discloses the active user's email to scripts owned by the same domain.
- **Rule:** Hybrid identity: (1) session email if it belongs to an active user; (2) otherwise the identity fixed from a personal-link token `?t=<token>` for this execution; (3) otherwise the raw session value (possibly `''`) for the login screen. Same-domain users never get a token injected into the client. Derive the deployer's domain from `Session.getEffectiveUser()` to decide who needs a link.
- **Area:** security
- **Evidence:** `Auth.gs` (`_emailActual_`, `_tokenExecucio_`, `_dominiDesplegador_`); commit `76945e2`
- **In v0.2.1:** yes (seguretat-api.md§2 table, "Sessió si n'hi ha") — partial: the domain restriction and the precedence order are new.

### MPRO-03 — One identity function, enforced by a static test
- **Symptom:** Identity read directly from `Session` in several files (`doGet`, setup, demo data) silently ignores the token path, so token users appear anonymous in some code paths.
- **Cause:** Multiple identity sources drift apart as the identity model evolves.
- **Rule:** `_emailActual_()` is the only function that reads `Session.getActiveUser`; `Session.getEffectiveUser` appears only in the deployer helpers of the same auth file. A Node test greps every other `.gs` and fails on `/Session\.get(Active|Effective)User/`.
- **Area:** security
- **Evidence:** `Auth.gs`; `tests/auth.test.js` (section "Cap .gs fora d'Auth.gs llegeix Session")
- **In v0.2.1:** yes (seguretat-api.md§2 "Regles comunes") — the enforcing static test is new.

### MPRO-04 — Per-execution identity lives in globals, set at every entry point
- **Symptom:** (design risk) an identity cached in a global could leak between users if globals persisted.
- **Cause:** GAS re-initializes all top-level globals on every execution (each `doGet` and each `google.script.run` call), so a global is a safe per-request slot — and also empty unless the entry point fills it.
- **Rule:** Store the token-derived identity in module globals (`_AUTH_EMAIL_TOKEN`, `_AUTH_TOKEN`) set only by `_fixarTokenExecucio_(token)`, which first clears them and accepts the token only for an active user. Call it at the start of `doGet` (from `e.parameter.t`) and inside `rpc`. Never persist identity in `CacheService`/properties keyed by anything the client controls.
- **Area:** security
- **Evidence:** `Auth.gs` (`_fixarTokenExecucio_`); `Codigo.gs` (`doGet`)
- **In v0.2.1:** no

### MPRO-05 — `rpc` dispatcher: exact checks that keep it from widening the API
- **Symptom:** A generic `rpc(token, name, args)` entry point could otherwise call internal functions, natives (`parseInt`, `Object`) or entry points.
- **Cause:** `rpc` looks the function up by name on the global object.
- **Rule:** Refuse unless all hold: name matches `^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]$` (rejects leading/trailing `_`, empty, one-char); not `rpc`/`doGet`/`doPost`; `Object.prototype.hasOwnProperty.call(globalThis, name)`; `typeof === 'function'`; `Function.prototype.toString` does not contain `[native code]`. Non-array `args` → `[]`. A non-empty invalid token throws `ENLLAC_NO_VALID` (never falls back to anonymous); an empty token uses the session identity. Test with a probe function injected via `vm.runInContext` that returns `_emailActual_()`.
- **Area:** security
- **Evidence:** `Auth.gs` (`rpc`); `tests/auth.test.js` ("rpc" section)
- **In v0.2.1:** yes (seguretat-api.md§2 "Model B") — `doPost` exclusion, the regex and the non-array handling are additions.

### MPRO-06 — Personal-link tokens: format, storage and lifecycle
- **Symptom:** Orphan tokens after concurrent create/delete; a deleted user's old link still resolving; a copied app URL from the address bar giving someone else's access.
- **Cause:** Tokens are bearer credentials stored in script properties and carried in the URL.
- **Rule:** 32 lowercase hex (`getUuid()` without dashes); validate the format before any property lookup. Two-way map (`AUTH_T_<token>` → email, `AUTH_E_<email>` → token), permanent until an admin regenerates. Create, regenerate and delete under the script lock (and document that these helpers take it: never call them from inside a locked section). Delete tokens when deleting a user and whenever the email changes. An inactive user's token resolves to nothing. Tell users that any URL copied from the address bar carries their link; offer admin "regenerate".
- **Area:** security
- **Evidence:** `Auth.gs` (`_tokenPerUsuari_`, `_regenerarToken_`, `_esborrarTokens_`); commit `34f7807`; `docs/tech/installacio-plantilla.md` (Pas 5)
- **In v0.2.1:** yes (seguretat-api.md§2 "Model B") — lock on delete, format check and the copied-URL warning are new.

### MPRO-07 — A distributable template must not carry live tokens
- **Symptom:** (found in final review) resetting the master spreadsheet to distribute it left `AUTH_*` properties in place: the copy would ship valid personal links.
- **Cause:** The template reset deleted sheets and installation properties but not credential properties.
- **Rule:** The reset/"prepare template" routine deletes every installation property, including all token keys (iterate `getKeys()` by prefix), plus all cache keys. Test it: after reset, no key with the token prefix remains.
- **Area:** security
- **Evidence:** commit `0342349`; `Setup.gs` (`_esborrarPropietatsInstallacio_`); `tests/setup.test.js` (case 12)
- **In v0.2.1:** no

### MPRO-08 — With ANYONE access, only the deploying account may install or reset
- **Symptom:** Before installation (no admin exists yet), any Google account that knows the URL could call the installer from the browser console and become admin, or block the real installation.
- **Cause:** Under ANYONE, editor-style functions (`setup`, template reset) are reachable via `google.script.run` by any account.
- **Rule:** `_esDesplegador_()`: normalized `Session.getActiveUser()` email non-empty and equal to `Session.getEffectiveUser()` email (under USER_DEPLOYING the effective user is the deployer). Installer, editor setup before install, and template reset throw `NO_DESPLEGADOR` otherwise. Install docs: run initialization immediately after deploying, from the deploying account, before sharing the URL.
- **Area:** security
- **Evidence:** commit `0342349`; `Auth.gs` (`_esDesplegador_`); `tests/setup.test.js` (cases 7–11); `docs/tech/installacio-plantilla.md`
- **In v0.2.1:** no (seguretat-api.md§6 warns about the reset window but has no deployer check)

### MPRO-09 — Setup that cannot be re-run: `JA_INSTALLAT` and repair mode
- **Symptom:** From the console, a normal user called the installer on a live installation and it added them as ADMIN.
- **Cause:** The installer "adds the current user as ADMIN if missing" and was callable from the client.
- **Rule:** "Installed" = `SETUP_COMPLETED` property **or** an active ADMIN row (an inactive admin does not count). The client installer returns `JA_INSTALLAT` when installed and takes a lock against double clicks. The editor `setup()` on an installed platform is repair mode: requires ADMIN, creates only missing sheets/defaults, restores the property, never creates users or demo data. The refusal message tells the user what to do next, not just the code.
- **Area:** security
- **Evidence:** commit `3b8fba4`; `Setup.gs` (`_estaInstallat_`); `tests/setup.test.js` (cases 1–6)
- **In v0.2.1:** yes (seguretat-api.md§6)

### MPRO-10 — Self-service "send me my link": the only unauthenticated API
- **Symptom:** Users who lose their link need a way to recover it without an admin, on a screen where they have no identity yet.
- **Cause:** Any unauthenticated endpoint is an email-enumeration and mail-quota abuse vector.
- **Rule:** Response always identical (exists or not). Per-address limit (one request per 10 min) and global limit (30/hour) kept in `CacheService`; validate and length-cap the email; send only to active users; reuse the existing token (never regenerate). Classify it in its own whitelist category (`publicaSenseAuth`) of the surface test. Document accepted residual risks next to the code: timing side channel (sending takes longer) and global-limit exhaustion (admin can still send links).
- **Area:** security
- **Evidence:** `Auth.gs` (`enviarMeuEnllac_`); `tests/superficie-publica.test.js` (`publicaSenseAuth`); commits `2aa8d27`, `34f7807`
- **In v0.2.1:** yes (seguretat-api.md§2 "Límit de sol·licituds") — partial: identical response, two-level limits and documented accepted risks are new.

### MPRO-11 — Report partial success honestly after an irreversible step
- **Symptom:** Regenerating a link when the email failed showed a raw error, yet the old link was already invalidated — the user ended with no working link and the admin thought nothing happened. Deleting users reported failure when only the token cleanup threw after rows were already deleted.
- **Cause:** The irreversible step and a secondary side effect shared one `try`, so any later failure was reported as total failure.
- **Rule:** Once the main change is committed, keep it and report the outcome precisely (`{ok:true, data:{correuEnviat:false}}`) so the UI can tell the admin to copy the new link. Run secondary cleanups outside the main `try`, each in its own `try`, logging failures instead of failing the operation.
- **Area:** security
- **Evidence:** commit `34f7807`; `Auth.gs` (`regenerarEnllacUsuari_`); `tests/enllac.test.js`
- **In v0.2.1:** no

### MPRO-12 — Bulk send: all-or-nothing validation, quota first, no token side effects
- **Symptom:** (design) a bulk "send link to selected users" can partially send, double-send repeated ids or rotate credentials as a side effect.
- **Cause:** Validation interleaved with sending.
- **Rule:** Validate every id first (active, external-domain user); if any is invalid, send nothing. Deduplicate ids. Check `MailApp.getRemainingDailyQuota()` before the first send. Never regenerate tokens when re-sending. Do not take the script lock in the outer function when a helper already takes it (locks are not reentrant).
- **Area:** security
- **Evidence:** `Auth.gs` (`enviarEnllacsSeleccionats_`); commit `8224a61`; `tests/enllac.test.js`
- **In v0.2.1:** yes (gotchas.md G2, F1) — all-or-nothing validation and dedup are new.

### MPRO-13 — Hiding ~280 internal functions: rename by AST, then guard what stays public
- **Symptom:** From the browser console a low-privilege user could call the data layer (`updateRow`, `deleteRow`) and every `test*` function directly.
- **Cause:** Every top-level function not ending in `_` is callable via `google.script.run`; a leading `_` hides nothing.
- **Rule:** Do the rename mechanically with a script over the AST (acorn) — in MPRO 276 functions, 2862 edits in 15 files — updating references and comments but not strings; then review strings that name functions (menu `addItem('…', 'handlerName')` must keep pointing at public handlers). Keep public only: entry points, `api*` with the access guard in the first lines, the installer, menu/editor handlers and `test*` functions — the last three guarded with an admin check (`_exigirAdmin_()`), because editor test functions ship to production.
- **Area:** security
- **Evidence:** commits `bfcde13`, `47a8398`; `docs/ROADMAP-historial.md` ("Seguretat Fase 1")
- **In v0.2.1:** yes (seguretat-api.md§1) — the AST rename procedure and the `addItem` string caveat are new.

### MPRO-14 — Normalize emails at every identity comparison and on write
- **Symptom:** A user whose email was stored with capitals in the users sheet was not recognized; creating the same address with different capitalization produced a duplicate user.
- **Cause:** Sheet values keep whatever case was typed; session emails and token maps are compared as strings.
- **Rule:** One `_normEmail_()` (`toLowerCase().trim()`) applied to the session email, token keys, user lookups, duplicate detection and before saving a new user. Compare normalized on both sides, because legacy rows may still hold mixed case.
- **Area:** security
- **Evidence:** commits `342dbba`, `0342349`; `Auth.gs` (`_normEmail_`, `_usuariActiuPerEmail_`); `tests/auth.test.js`
- **In v0.2.1:** no

### MPRO-15 — Role inside a resource: query every membership source, creator first
- **Symptom:** `Rol insuficient al projecte. Cal: GESTOR. Tens: PROFESSOR` for the creator of the resource; earlier, every member-only user was always denied.
- **Cause:** The role resolver consulted only the first membership table implemented; creation writes only the creator column, not a membership row.
- **Rule:** Resolver order: creator column → staff table → member table → any future membership table, each with an active check. Add the new source in the same commit that introduces it. Test each screen with a user that holds only that role.
- **Area:** security
- **Evidence:** `Auth.gs` (`getRolEnProjecte_`); `CLAUDE.md` §12; `docs/ROADMAP-historial.md` (Fase 8, Fase 9)
- **In v0.2.1:** yes (arquitectura.md§Autorització per recurs)

### MPRO-16 — Validate the requested role before comparing hierarchy indexes
- **Symptom:** (code review) a typo in the minimum role would let comparisons pass.
- **Cause:** `indexOf` of an unknown role is `-1`, lower than any real role.
- **Rule:** First line of the access guard: throw if `rolMinim` is not in the hierarchy array.
- **Area:** security
- **Evidence:** `Auth.gs` (`verificarAcces_`)
- **In v0.2.1:** yes (arquitectura.md§Autorització per recurs)

---

## Architecture

### MPRO-17 — Per-execution memo for sheet reads (sheets above 100 KB never cache)
- **Symptom:** A dashboard call took 428–453 s (over the 6-minute limit of one `google.script.run` call) with ~900 full reads of the same sheet; the largest sheet was 1.18 MB.
- **Cause:** `CacheService` refuses values over 100 KB, so the biggest sheet (passed ~150 rows) was never cached; every helper re-read it from Sheets.
- **Rule:** Besides the 6 h cache, keep a module-global map `sheetName → rows` that lives only for the current execution (globals reset per call). Read functions return copies (`findRows` filters on the internal rows and copies only matches); filter callbacks must only compare, never mutate. Every invalidation also clears the memo entry. Measured: 2.9 s cold, 175–273 ms warm, 1 read per call. Measure with a realistic volume spike before optimizing.
- **Area:** architecture
- **Evidence:** commit `e0507ce`; `DataAccess.gs` (`_MEMO_FULLS`); `docs/ROADMAP-historial.md` ("Rendiment: memòria per execució")
- **In v0.2.1:** no (only the 100 KB `try/catch`, gotchas.md B6)

### MPRO-18 — Migrations invalidate the cache of every sheet
- **Symptom:** After a migration added columns or fixed values, the app kept serving the pre-migration version of the sheet for up to 6 h.
- **Cause:** Migrations write with `SpreadsheetApp` directly, bypassing the data layer's invalidation.
- **Rule:** In the migration runner's `finally`, if at least one migration ran, call a helper that builds the cache key of every existing sheet and does one `removeAll(keys)` (and clears the per-execution memo). Caches with their own key and TTL (e.g. a config cache) are not covered: migrations that touch them clear them explicitly.
- **Area:** architecture
- **Evidence:** commit `86b74ec`; `DataAccess.gs` (`_invalidateCacheTotsElsFulls_`); `Migration.gs`
- **In v0.2.1:** yes (arquitectura.md§Migracions i setup; gotchas.md B6) — the "all sheets in `finally`" mechanism is new.

### MPRO-19 — Seeding with the native API poisons the cache across a reset
- **Symptom:** Reinstalling after a template reset failed in the same execution with a lookup error against a freshly seeded catalogue sheet (`Error: … desconegut: "<value>" per id …`), although the sheet held the right rows.
- **Cause:** An empty catalogue had been cached as `[]` for 6 h; `CacheService` is script-scoped and survived the sheet deletion; the seed wrote with `Range.setValues` and never invalidated.
- **Rule:** Every setup/seed writer invalidates the key of the sheet it writes; reset invalidates every sheet key before deleting the sheets.
- **Area:** architecture
- **Evidence:** `docs/ROADMAP-historial.md` (2026-08-28, "Nivell SS desconegut")
- **In v0.2.1:** yes (gotchas.md B6)

### MPRO-20 — No cache layer for computed results; verify that documented caches exist
- **Symptom:** The project documentation promised a 30-minute cache of computed dashboards; code review found the TTL constant declared but never used.
- **Cause:** Design text was written before implementation and never checked.
- **Rule:** Cache only raw sheet reads. Invalidating computed results correctly at every write point costs more than it saves; if ever needed, start with the heaviest read and wire invalidation to every write that feeds it. When a doc states a mechanism, grep for its use before relying on it.
- **Area:** architecture
- **Evidence:** `docs/ROADMAP-historial.md` (2026-07-27); `CLAUDE.md` §5.5; `DataAccess.gs` (`CACHE_TTL_CALCULATED`)
- **In v0.2.1:** yes (gotchas.md B6; arquitectura.md§Capa de dades)

### MPRO-21 — One function owns rounding, including floating-point noise
- **Symptom:** A weighted sum displayed as `7.499999999999999` rounded to 7 instead of 8; two code paths computed the final value and could diverge.
- **Cause:** Sums of fractional weights accumulate binary floating-point error; duplicated computation.
- **Rule:** A single pure function applies the rounding policy and corrects float noise first (MPRO rounds to 6 decimals: `7.499999999999999` → `7.5`, then rounds to 8). Every view, export and report calls it; delete dead alternative implementations.
- **Area:** architecture
- **Evidence:** commit `9445a19`; `Calculator.gs` (`_aplicarPoliticaNotaFinal_`, `_netejarSorollNota_`); `docs/ROADMAP-historial.md` ("Política de qualificació final configurable")
- **In v0.2.1:** no

### MPRO-22 — Snapshot global defaults into each resource at creation
- **Symptom:** (requirement) changing an institution-wide policy must not retroactively change resources already in progress.
- **Cause:** Reading the global value at compute time applies new rules to old resources.
- **Rule:** Copy the global configuration into columns of the resource row when it is created (added by migration for existing rows); compute from the resource's copy; only an admin edits the copy; a closed resource is read-only.
- **Area:** architecture
- **Evidence:** commit `8360f54`; `docs/ROADMAP-historial.md` ("Política de qualificació final configurable")
- **In v0.2.1:** no

### MPRO-23 — Model a variant as flagged rows of an existing table, and clean the abandoned branch
- **Symptom:** After switching a draft from one planning mode to the other, rows created by the first mode stayed orphaned and mixed into the next step.
- **Cause:** The cleanup filter only matched the rows of the current mode.
- **Rule:** A new mode that is structurally the same as an existing entity becomes a boolean column on that table (via migration), so all generic code keyed by the entity id works unchanged. Any action that regenerates rows of one mode also deletes the rows flagged for the other.
- **Area:** architecture
- **Evidence:** commit `079fe22`; `docs/ROADMAP-historial.md` ("Mode de planificació clàssic")
- **In v0.2.1:** yes (arquitectura.md§Wizards "Canviar una opció que bifurca el flux…") — the flagged-row modelling choice is new.

### MPRO-24 — Pure core + reader wrapper, strict `null`, guard "unreachable" cases server-side
- **Symptom:** A resource with no evaluation components reported a complete final value of 0; some views and the aggregate disagreed on which rows to include.
- **Cause:** Missing data defaulted to 0; filtering rules duplicated per view.
- **Rule:** Pure `_xCore_(data)` plus a wrapper that reads sheets; missing input → `null` ("incomplete"), never 0. Even if the UI cannot produce a state today, the server handles it (a manual sheet edit can). One filtering rule shared by every view.
- **Area:** architecture
- **Evidence:** commit `1632c7a`; `docs/ROADMAP-historial.md` ("Casos límit de la qualificació final")
- **In v0.2.1:** yes (arquitectura.md§Lògica testable)

---

## Client

### MPRO-25 — `google.script.run` Proxy: forward the chain, never call the server for language probes
- **Symptom:** With a token, code that touched the runner indirectly (`Promise.resolve(run)`, `JSON.stringify`, `String(run)`, `'x' in run`) fired spurious server calls to functions named `then`, `toJSON`, `toString`.
- **Cause:** A naive Proxy `get` trap turns every property access into an `rpc`.
- **Rule:** Wrap `google.script.run` in a Proxy that: returns `undefined` for symbols, `then`, `toJSON`, `constructor`; returns `Object.prototype` versions of `toString`/`valueOf`/`toLocaleString`; forwards every `with*` method and re-wraps the result; implements a `has` trap that delegates to the real runner; turns any other property into `runner.rpc(token, name, args)`. Install with `Object.defineProperty(google.script, 'run', {get})`, fall back to assignment, and log if neither replaced it or if `Proxy` is missing. Without a token, do nothing.
- **Area:** client
- **Evidence:** `html/auth-client.html`; commits `ef4e500`, `9c5aa0b`; `tests/auth-client.test.js` (section 2b)
- **In v0.2.1:** yes (seguretat-api.md§2 "El client embolcalla `google.script.run` amb un Proxy") — the trap list and `has` are new.

### MPRO-26 — Default failure handler for calls that register none
- **Symptom:** When a personal link expired, screens whose calls had no `withFailureHandler` kept the spinner spinning forever with no message.
- **Cause:** GAS sends unhandled server errors only to the console.
- **Rule:** In the Proxy, if the chain has no failure handler, attach a default one: for the expired-link code hide the spinner and show the translated message; for other errors `console.error` (standard GAS behaviour). When the caller registers its own handler, translate the expired-link error before passing it on.
- **Area:** client
- **Evidence:** commit `105e6f6`; `html/auth-client.html` (`falladaPerDefecte`); `tests/auth-client.test.js` (1b)
- **In v0.2.1:** no

### MPRO-27 — Keep the token on internal links: capture-phase interceptor on the resolved URL
- **Symptom:** Token users lost their session (`Accés no autoritzat`) after middle-click, "open in new tab", or links written as absolute URLs or `exec?page=…`.
- **Cause:** The interceptor listened only to `click` and decided "internal" from the raw `href` attribute.
- **Rule:** Listen to `click`, `auxclick` and `contextmenu` in capture phase; walk up to the `<a>`; skip `#anchor` links; treat as internal if `href` starts with `?` or the resolved `el.href` without query/hash equals the `<base href>` without query; append `t=` before the hash, never twice (`tab=` is not `t=`). Note `./?page=x` resolves outside the app and must stay untouched.
- **Area:** client
- **Evidence:** commits `ef4e500`, `9c5aa0b`; `html/auth-client.html`; `tests/auth-client.test.js` (section 2)
- **In v0.2.1:** no

### MPRO-28 — Under a token model, `window.location` navigation drops the session
- **Symptom:** Token users land on the unauthorized screen after clicking a button that navigates via JS.
- **Cause:** The interceptor only sees clicks on `<a>`; `window.location.href = …` and GET forms bypass it (and in the sandbox iframe they also 403).
- **Rule:** Navigate only with real `<a href="?page=…" target="_top">` or a synthetic `link.click()` on an `<a>`. Pages need nothing else; the interceptor adds the token.
- **Area:** client
- **Evidence:** `.claude/skills/gas-dev-gotchas/SKILL.md` ("Usuari … que en navegar acaba a 'Accés no autoritzat'"); `CLAUDE.md` §5.3
- **In v0.2.1:** yes (sandbox-gas.md rule 10) — the token-loss consequence is new.

### MPRO-29 — Transport failures arrive with an empty `e.message`
- **Symptom:** A tab stuck on "Loading…" with an empty red error bar; a second attempt worked.
- **Cause:** `withFailureHandler` fires on transport failures of `google.script.run` (server exceptions are already caught and returned as `{ok:false}`); in that case `e.message` is usually empty and the handler did not reset the container.
- **Rule:** Every failure handler shows a fallback translated message when `e.message` is empty and clears the loading placeholder, exactly like the `!res.ok` branch.
- **Area:** client
- **Evidence:** `docs/ROADMAP-historial.md` (2026-08-28, "Projectes (visió global)… Carregant…")
- **In v0.2.1:** no

### MPRO-30 — Escaping: toasts use `innerHTML`, attribute values need `&quot;`
- **Symptom:** A name like `Entrega "final"` broke an `<input value="…">`; backend names passed to a toast could inject markup.
- **Cause:** The shared toast builds with `innerHTML`; an escape helper did not encode double quotes.
- **Rule:** Escape `& < > " '` for any backend value placed in HTML or attributes, including toast messages. Check whether shared UI helpers use `innerHTML` before passing data to them.
- **Area:** client
- **Evidence:** commit `da7e752`; `docs/ROADMAP-historial.md` ("Mode de planificació clàssic", bug 1)
- **In v0.2.1:** yes (arquitectura.md§Convencions del client)

### MPRO-31 — Page content is not translated by the layout's i18n pass
- **Symptom:** `data-i18n` strings inside a page stay untranslated, silently; the navigation bar is translated.
- **Cause:** The layout calls `applyI18n()` in a script that runs before the page include is parsed.
- **Rule:** Each page re-calls `if (typeof applyI18n === 'function') applyI18n();` in its own init. Change a `data-i18n` key before that call when the label depends on data.
- **Area:** client
- **Evidence:** `html/CLAUDE.md` ("Patró i18n"); commit `1b3f724`
- **In v0.2.1:** yes (sandbox-gas.md rule 13)

---

## Testing

### MPRO-32 — Node harness that runs the real `.gs` files on a simulated spreadsheet
- **Symptom:** Tests could only run manually in the Apps Script editor, against real data, and `clasp run` was unavailable.
- **Cause:** GAS services are not available locally.
- **Rule:** Load every `.gs` into one `vm` context with in-memory services: `SpreadsheetApp` (Spreadsheet/Sheet/Range on arrays; `setValues` throws on dimension mismatch; A1 notation throws "not simulated"), `CacheService` (throws `Argument too large: value` above 100 KB), `PropertiesService`, `LockService` (counts locks), `Session` (separate active and effective users), `MailApp` (captures messages, configurable quota and per-recipient failure), `Utilities.formatDate` via `Intl`. Unsimulated services (`DocumentApp`, `DriveApp`, `UrlFetchApp`) throw on access, so tests depending on them fail visibly. Wrap builders in a permissive Proxy so formatting calls (`setFontWeight`, `setFrozenRows`) are no-ops. Build the "installed" state from the schema constant the setup uses (one sheet per definition with its header row) plus one admin row and the install properties. Keep `tests/` in `.claspignore`.
- **Area:** testing
- **Evidence:** `tests/gas-harness.js`; commit `100a63c`; `.claspignore`
- **In v0.2.1:** yes (arquitectura.md§Lògica testable, "Node amb vm + mocks") — schema-driven sheets and the failure-injection hooks are new.

### MPRO-33 — Baseline of passing editor tests instead of "all green"
- **Symptom:** Dozens of existing in-editor `test*` functions; some can never pass locally (they need unsimulated services).
- **Cause:** Requiring all to pass would block adoption; ignoring them hides regressions.
- **Rule:** The harness runs every global `test*` function in a fresh context and writes the passing names to `tests/harness-baseline.txt` (`--write-baseline`); `--baseline` fails only when a previously passing test now fails. A new test that passes locally is added to the baseline. Run the whole Node suite as a gate before every `clasp push`.
- **Area:** testing
- **Evidence:** `tests/gas-harness.js`; `tests/harness-baseline.txt` (63 entries); `CLAUDE.md` §12
- **In v0.2.1:** no

### MPRO-34 — Public-surface test: whitelist, guard position, and client-call cross-check
- **Symptom:** (final review) the test scanned `html/*.html` but not `html/js/`, so client calls in subfolders were never checked.
- **Cause:** Non-recursive file listing.
- **Rule:** Extract top-level `function name(` without trailing `_`; each must be in a classified whitelist (entry, protected, menu, editor, harmless, unauthenticated) or match `api*`/`test*`; guarded categories must contain the guard regex within the first 4 non-comment lines; whitelist entries that no longer exist fail ("stale list"). Parse every `google.script.run` chain recursively under `html/` (skipping `with*(…)` calls, strings and comments) and fail if a called name is not a public server function — this catches a rename to `_` that breaks the client. Self-check the parser: any `.apiX(` found by a plain regex but missed by the parser is an error.
- **Area:** testing
- **Evidence:** `tests/superficie-publica.test.js`; commits `feb45df`, `7f78dd3`
- **In v0.2.1:** yes (seguretat-api.md§1 "Test de superfície pública") — client-call cross-check, stale-list and extractor self-check are new.

### MPRO-35 — Negative tests must assert why it failed
- **Symptom:** A "non-admin cannot run X" test passed although the guard was missing: X threw because `SpreadsheetApp.getUi()` is unavailable outside the editor.
- **Cause:** `assert.throws(fn)` without a matcher accepts any error.
- **Rule:** Match the expected message (`/Rol insuficient|no autoritzat/`) and assert it is not the incidental error (`getUi`). For side effects, also assert that nothing changed (row counts, properties).
- **Area:** testing
- **Evidence:** commit `7f78dd3`; `tests/guardes.test.js`; `tests/setup.test.js` (case 4)
- **In v0.2.1:** no

### MPRO-36 — `vm` realm pitfalls and probes
- **Symptom:** `assert.deepStrictEqual` failed on objects that looked identical.
- **Cause:** Objects created inside a `vm` context have another realm's prototypes.
- **Rule:** Compare `JSON.parse(JSON.stringify(x))` copies. To observe what a callee sees (e.g. the identity inside `rpc`), inject a probe function with `vm.runInContext('function probe(){ return _emailActual_(); }', ctx)`. Replace a global service per test (`ctx.HtmlService = {...}`) to capture which template `doGet` serves and the JSON context it injects.
- **Area:** testing
- **Evidence:** `tests/auth.test.js` (`pla`, `sondaIdentitat`, `capturarPlantilles`)
- **In v0.2.1:** no

### MPRO-37 — Static assertions on manifest and forbidden APIs
- **Symptom:** (prevention) a later change could silently revert the deployment model or reintroduce file sharing.
- **Cause:** `appsscript.json` and "never call X" rules are not exercised by behaviour tests.
- **Rule:** A Node test parses `appsscript.json` and asserts `executeAs`, `access` and required scopes; it greps all `.gs` for forbidden calls (`addEditor`, `addViewer`, direct `Session` reads outside the auth file).
- **Area:** testing
- **Evidence:** `tests/auth.test.js` ("Model B: l'app no comparteix mai el full…")
- **In v0.2.1:** no

### MPRO-38 — Testing client JS from an `.html` file in Node
- **Symptom:** Browser-only logic (Proxy, link interceptor) had no tests.
- **Cause:** The code lives inside `<script>` in an HtmlService file.
- **Rule:** Strip everything outside `<script>…</script>`, run it in a `vm` context with fake `window`, `document` (record `addEventListener` with its capture flag; `querySelector('base')`) and a fake runner that records `rpc` calls and handlers. Simulate `<a>` with a `href` getter that resolves against the base via `new URL(attr, BASE)`, as the browser does.
- **Area:** testing
- **Evidence:** `tests/auth-client.test.js`
- **In v0.2.1:** no

### MPRO-39 — Multi-author fixtures must include every author
- **Symptom:** In QA, aggregated columns showed "Pending" — looked like a regression of a performance change.
- **Cause:** Seed data had contributions from only one of the two authors, so aggregates that require all authors were legitimately incomplete.
- **Rule:** Seed scripts for multi-author features create entries for every author; before calling something a regression, check the fixture.
- **Area:** testing
- **Evidence:** `docs/ROADMAP-historial.md` ("Rendiment: memòria per execució", QA)
- **In v0.2.1:** no

---

## Gotcha

### MPRO-40 — Catalan/European locale: a decimal written as text becomes a date
- **Symptom:** A config value "is not saved": an `<input type="number">` reloads blank; the cell holds the date 9 July (`'9.7'` → `2026-07-09`); afterwards even a number written there reads as a date (`9.5` → `8/1/1900`). Integers are unaffected, so a sibling field seems fine.
- **Cause:** In a spreadsheet whose locale uses `,` as decimal separator, `setValues` of the string `'9.7'` is parsed as a date and the cell format switches to date. Plain-text format `@` does not prevent it.
- **Rule:** Write numeric values as `Number`, never as strings (keep a list of numeric keys for key/value config and convert on every write path: save, migration helper, setup defaults). Repair existing cells with a numeric format (`0.####`) and reset values that became dates to their default — the original cannot be recovered reliably.
- **Area:** gotcha
- **Evidence:** commits `cbd2033`, `da3e9b2`, `be5b3be`; `ConfigService.gs` (`_valorConfigPerDesar_`); `.claude/skills/gas-dev-gotchas/SKILL.md`
- **In v0.2.1:** no (gotchas.md B2/B3 cover booleans and leading zeros only)

### MPRO-41 — Key/value config sheet with duplicated keys
- **Symptom:** While repairing the config sheet, one key was found in two rows; any edit lands on one row while a reader that scans differently could see the other.
- **Cause:** Earlier insert paths added keys without checking existence; the updater writes the first match.
- **Rule:** Helpers that add config keys must check existence first; a repair migration removes repeated keys keeping the first row (where updates write) and invalidates the sheet cache.
- **Area:** gotcha
- **Evidence:** commit `cbd2033` (migration v22); `ConfigService.gs` (`_planReparacioConfig_`)
- **In v0.2.1:** no

### MPRO-42 — `clasp push` never deletes remote files that are excluded or deleted locally
- **Symptom:** A file added to `.claspignore` (or deleted) still appears in the Apps Script editor; `clasp push --force` answers `Script is already up to date.`
- **Cause:** clasp compares only the local files it would upload with the remote ones; if they all match it uploads nothing, so it never replaces the project and extra remote files survive. `clasp status` lists only local files. Also, `htmlExtensions: [".html"]` uploads any `.html` in the tree (a generated `graphify-out/graph.html` was uploaded).
- **Rule:** Diagnose with `clasp pull` into a temporary folder (copy `.clasp.json` there). Fix: make one remote file differ (e.g. from that temp folder delete the stray file, add a newline to `appsscript.json`, `clasp push --force`), then push from the repo — a real push replaces the whole project. Verify with another temporary pull. Exclude every tool output folder in `.claspignore` before the first push.
- **Area:** gotcha
- **Evidence:** commit `061a9ca`; `.claude/skills/gas-dev-gotchas/SKILL.md`; `.claspignore`
- **In v0.2.1:** no

### MPRO-43 — Links built outside `doGet` need a stored public URL
- **Symptom:** Links in emails sent from menu/admin flows must point at the real `/exec` deployment.
- **Cause:** `ScriptApp.getService().getUrl()` is only reliable inside the web app execution.
- **Rule:** Build every personal link from a stored `WEB_APP_URL` property, falling back to `getUrl()`; tests assert the stored URL wins and the same token is reused.
- **Area:** gotcha
- **Evidence:** `Auth.gs` (`_urlApp_`); `tests/enllac.test.js` (section 1)
- **In v0.2.1:** yes (gotchas.md D3b) — independently confirmed in MPRO.

### MPRO-44 — Merging a branch that did `git rm --cached` deletes the files from your working tree
- **Symptom:** After merging a "prepare for publication" branch that untracked local-only folders, those folders disappeared from the main checkout.
- **Cause:** Git applies the removal to every checkout that merges the commit; files untracked with `--cached` on the branch are deleted elsewhere.
- **Rule:** Before merging such a branch, back up the folders, or recover afterwards with `git archive <commit-before> <paths> | tar -x -k`. Add them to `.gitignore` in the same commit.
- **Area:** gotcha
- **Evidence:** commits `4e54e1e`, `eeb2674`
- **In v0.2.1:** no

---

## Workflow

### MPRO-45 — Harden in two phases: public surface first, identity model second
- **Symptom:** Moving to model B made every public function run with the deployer's rights; doing it on an unaudited surface would have exposed the data layer to anyone with a Google account.
- **Cause:** Identity changes multiply the impact of any unguarded function.
- **Rule:** Phase 1: rename internals, guard what stays public, make setup non-re-executable, add the surface/setup/guard tests. Phase 2: change the identity model. QA each phase from the browser console as a low-privilege user: installer → `JA_INSTALLAT`, data-layer function → "not a function", test function → `Rol insuficient`.
- **Area:** workflow
- **Evidence:** `docs/ROADMAP-historial.md` ("Seguretat Fase 1", "Seguretat Fase 2")
- **In v0.2.1:** no

### MPRO-46 — Deployment dialog defaults are wrong for model B
- **Symptom:** After deploying, only the deployer can open the app.
- **Cause:** The "New deployment" dialog defaults "Who has access" to "Only myself"; "Execute as: Me" is already the default. First authorization shows "Google hasn't verified this app".
- **Rule:** Install guides state both values explicitly, explain the unverified-app screen (Advanced → Go to project), warn never to share the spreadsheet, and require initializing immediately from the deploying account.
- **Area:** workflow
- **Evidence:** `docs/tech/installacio-plantilla.md` (Pas 2, Pas 3)
- **In v0.2.1:** no

### MPRO-47 — Updating existing copy-based installations after a model change
- **Symptom:** Partial manual updates fail with `ReferenceError`; new features silently fail authorization.
- **Cause:** A rename touching every `.gs` file; new scopes (`script.send_mail`) need re-consent; deployment settings are per deployment.
- **Rule:** Release notes say explicitly when all files change. After updating code: open the editor as the deployer and accept new scopes, then in Manage deployments → Edit check "Execute as" and "Who has access" and publish a new version. Running `setup` in repair mode adds missing sheets/columns.
- **Area:** workflow
- **Evidence:** `docs/tech/installacio-plantilla.md` ("Actualitzar el sistema")
- **In v0.2.1:** no

### MPRO-48 — The whole-branch final review keeps finding security bugs
- **Symptom:** Per-task reviews passed, yet the final review found: client calls in a subfolder never checked; `setup()` before installation callable by any account; tokens surviving template reset; emails compared without normalization.
- **Cause:** Cross-cutting invariants ("only the deployer installs", "no live credentials in a template") span files no single task touched.
- **Rule:** Keep the final review of the entire branch, and ask it to verify each declared security invariant against all entry points, including files outside the plan.
- **Area:** workflow
- **Evidence:** commits `7f78dd3`, `0342349`
- **In v0.2.1:** yes (flux-de-treball.md§Cicle d'una feature, §Què demanar a la revisió final)

### MPRO-49 — Diagnose config bugs with the real spreadsheet, not the first suspect
- **Symptom:** "The value is not saved" was first attributed to the save function and the cache.
- **Cause:** The value was saved, as a date (MPRO-40); only the real file showed it.
- **Rule:** When a value "doesn't persist", inspect the actual cell (type, format, `=ISTEXT()`), or download the spreadsheet as `.xlsx` and read it with `openpyxl`, before changing code.
- **Area:** workflow
- **Evidence:** `docs/ROADMAP-historial.md` ("El llindar d'excel·lència no es desava", "diagnosticada amb el full real")
- **In v0.2.1:** yes (flux-de-treball.md§QA i depuració, `.xlsx` + `openpyxl`)

### MPRO-50 — Document accepted risks and deferred polish in the backlog, not in memory
- **Symptom:** Small known issues from a security phase (spinner on expired link, raw-`href` comparison, Proxy without `has`) risked being forgotten.
- **Cause:** Final reviews produce non-blocking findings.
- **Rule:** Record each non-blocking finding as a backlog item with its rationale; close them in a follow-up branch; record risks you accept (timing side channel, global limit) as code comments at the function, so reviewers do not re-raise them.
- **Area:** workflow
- **Evidence:** `docs/ROADMAP-historial.md` ("Seguretat Fase 2" pendents, "Robustesa de l'enllaç personal"); `Auth.gs` (`enviarMeuEnllac_`)
- **In v0.2.1:** no

---

## Performance

Measured 2026-11-10 on a versioned `/exec` deployment (Workspace domain, identity model B) with a small demo dataset (10 members, ~130 records), using the instrumentation of MPRO-57. Figures are wall-clock times seen in the browser.

### MPRO-51 — The fixed cost of a round trip dominates, not your code or Sheets
- **Symptom:** Users perceive the app as slow: ~6 s to open the dashboard, 4–6 s per screen change, 2–4 s to open a form, although the server code is fast.
- **Cause:** Each `google.script.run` call costs ~1.2–2.0 s end to end (about 1.7 s typical) while the server code runs 40–170 ms; each `?page=` navigation costs ~2.5 s to first byte while `doGet` code runs 0.2–0.7 s. `/dev` and `/exec` measured the same. Platform overhead is 60–85 % of every wait; client rendering is negligible (0–4 ms). A read from Sheets that misses the cache costs 0.4–2 s even for a 4–9 row sheet, and each `CacheService.get` 15–250 ms.
- **Rule:** Design screens by the number of round trips, not by server cost: one call per user action, no call on page load when the data can travel with the page (MPRO-54). Measure an empty call first; it is the floor no optimisation inside Apps Script removes.
- **Area:** performance
- **Evidence:** `docs/ROADMAP.md` (item "agilitat percebuda", tables before/after); branch `mesura-rendiment` (`a9afb51`)
- **In v0.2.1:** no.

### MPRO-52 — "Save all" is one batch call, not one call per row
- **Symptom:** Saving 10 edited rows took ~35 s plus a reload, and the screen looked frozen.
- **Cause:** The client walked a queue calling the single-record save API once per row (and once per row × column in another screen), paying MPRO-51's fixed cost each time; each server call also re-read the whole sheet to find its row. This was the documented convention "bulk saves run as a sequential queue" (v0.2.1).
- **Rule:** A save-all action sends the whole batch in one call. On the server, split each save into *prepare* (validate and compute, no write; returns `{action: 'update', id, data}` or `{action: 'append', data}`) and *write*; prepare every item in its own `try/catch`, reject a key repeated in the same batch, then write with one `updateRows_` plus one `appendRows_`. Return one result per item (`{id, ok, error?}`) so the client keeps per-row error marking. Single-record writers reuse the same *prepare* function. Measured: 10 rows saved and repainted in ~3.7 s (was ~38 s); one row ~4.1 s (was ~6.5 s).
- **Area:** performance / architecture
- **Evidence:** `AvaluacioFunctions.gs` (`_prepararNotaRA_`, `_desarLotNotes_`), `ApiHandler.gs` (`apiGuardarNotesRALot`); commits `d7367ff`, `aed4f34`, `5f2c2fd`, `30c608b`
- **In v0.2.1:** contradicts (arquitectura §Client conventions, "bulk saves run as a sequential queue").

### MPRO-53 — The save returns the refreshed data; no reload calls after saving
- **Symptom:** Every save was followed by one or two more calls (form and side-menu summary), adding 2–3 s.
- **Cause:** The client reloaded its state with separate read calls after the save succeeded.
- **Rule:** The save API returns what the screen repaints, built with the same internal readers as the read APIs. Build that part inside its own `try/catch` that yields `null`, so a failure after the write is never reported as "nothing saved"; the client skips the repaint on `null`. Repaint the form only when no row failed, so rows in error keep what the user typed.
- **Area:** performance / client
- **Evidence:** `ApiHandler.gs` (`_construirRespostaLot_`), `html/eval-ra-scripts.html` (`_erRunSaveQueue`); commits `5f2c2fd`, `94ea606`
- **In v0.2.1:** no.

### MPRO-54 — First-load data travels inside the page, with a fallback call
- **Symptom:** Each screen showed "Loading…" for ~2 s after the page itself had taken ~2.5 s to arrive.
- **Cause:** `doGet` served the shell and the client fetched its data with `google.script.run` on load: two round trips per screen.
- **Rule:** The page-serving function calls the same public `api*` functions the client would call (same guard, same shape) and puts only `ok: true` responses into the injected context (`initialData[key]`); a throw or `{ok:false}` leaves the key absent. The client reads each key once (read, then delete) and falls back to its usual call when the key is absent. The context's existing `<` escaping covers the new data. Measured: dashboard ~6 s → ~2.9 s, no call on load.
- **Area:** performance / client
- **Evidence:** `Codigo.gs` (`_afegirDadesInicials_`), `html/Layout.html` (`window._dadesInicials`); commits `ee501c5`, `4892b85`, `7c0967a`
- **In v0.2.1:** no.

### MPRO-55 — Injected data and `google.script.run` must deliver the same shape
- **Symptom:** (risk found while designing MPRO-54) the same value could arrive as `x: null` through the template and with `x` absent through `google.script.run`, so `=== undefined` checks would behave differently by path.
- **Cause:** `google.script.run` drops object properties whose value is `null` (skill `references/gotchas.md` B5, C2; v0.2.1 gotchas); `JSON.stringify` into the template keeps them.
- **Rule:** Pass injected API responses through a deep copy that removes `null`/`undefined` object properties, leaving arrays as they are, and apply it only to that data: other context fields may rely on keeping `null`. Hedged: an injected response and a fetched one were compared and matched, but that data held no `null` inside arrays, so what `google.script.run` does there was not observed.
- **Area:** client
- **Evidence:** `Codigo.gs` (`_senseNullsComGoogleScriptRun_`), `tests/dades-inicials.test.js`
- **In v0.2.1:** partial (gotchas: `null` dropped in transit) — the parity rule is new.

### MPRO-56 — Whole-sheet writers need the lock, and so does every writer to the same sheet
- **Symptom:** (found in review before release) two users saving at once could silently lose one user's changes, or a batch could append a duplicate of a record another execution had just created.
- **Cause:** `updateRows_` reads the whole sheet and writes it all back, and `appendRows_` takes its start row from `getLastRow()`; a single-row update landing between a batch's read and write is overwritten. Invalidating the cache inside the lock was not enough: an unlocked reader could put a stale copy back afterwards and the batch read it. ID-validation maps built as `{}` accepted `'toString'` as an id and wrote a row for it.
- **Rule:** One helper takes the script lock (`waitLock`, readable busy error, release in `finally`, never re-entered) around every write to those sheets, batch and single-row alike. Inside the lock, read the sheets you prepare from straight from Sheets, skipping `CacheService`, and keep the result in the per-execution memo. Build lookup maps of allowed ids with `Object.create(null)` or check them with `hasOwnProperty`. If an automatic save that runs before navigating fails as a whole, stay on the screen: navigating would discard what the user typed.
- **Area:** architecture / security
- **Evidence:** `AvaluacioFunctions.gs` (`_ambBloqueigNotes_`), `DataAccess.gs` (`_refrescarFullDesDeSheets_`), `html/eval-ra-scripts.html` (`_erOnNavClick`); commits `1724bde`, `94ea606`
- **In v0.2.1:** partial (lock discipline) — the whole-sheet writer race, the stale cache after invalidation and the prototype-key bypass are new.

### MPRO-57 — A measurement branch that is never merged
- **Symptom:** Guesses about "the spreadsheet is slow" pointed at the wrong layer.
- **Cause:** From the browser, platform overhead, Sheets reads and server code look the same.
- **Rule:** Keep an instrumentation branch: a client wrapper around `google.script.run` that times each call (response and render) and each click-to-ready navigation, with an on-screen report and an empty-call "ping"; server timers on every sheet read (cache or Sheets, rows, ms) and every write; and a timing field added to every API response so the client can subtract server time from round-trip time. Measure on a temporary versioned deployment, delete it afterwards and push the main branch back. The timing field reveals which sheets the server reads, so it must never reach the main branch; a test that requires an identical response fails on purpose in that branch.
- **Area:** testing / workflow
- **Evidence:** branch `mesura-rendiment` (`Perf.gs`, `html/perf-client.html`); `docs/ROADMAP.md` ("Per tornar a mesurar")
- **In v0.2.1:** no.
