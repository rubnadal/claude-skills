# <Project name> — project rules

**Version:** 1.0 · **Date:** <date> · **Platform:** Google Apps Script (web app) + Google Sheets

> Template. Replace everything in `<>`, fill each `<!-- fill in -->` section with the user, delete sections that do not apply. Keep this file short: rules and pointers. Long detail goes in `docs/` and `html/CLAUDE.md`.

## 1. Context and goal

<Who needs it, what for, and what must stay generic or reusable.>

**End user:** <profile and technical level — it drives the whole UI>.

## 2. Technical platform

| Element | Specification |
|---|---|
| Backend | Google Apps Script, no external dependencies |
| Storage | One spreadsheet, normalised vertical sheets, IDs from `Utilities.getUuid()` |
| Frontend | HtmlService; allowed CDNs: <list>; Tailwind via own prebuilt bundle |
| Binding | <container-bound / standalone> |
| Configuration | `PropertiesService` + `Config` sheet; nothing hardcoded |

**Constraints:** client↔server only through `google.script.run`; one `.gs` file per responsibility; all business logic and validation on the backend.

## 3. Identity model

<!-- fill in -->
<Model A (domain session, `USER_ACCESSING` + `DOMAIN`) or model B (`USER_DEPLOYING` + `ANYONE` + personal link). The email always comes from one function (`currentEmail_()`), never from the client. See the playbook's `references/security-and-api.md` §Identity.>

## 4. Roles

<!-- fill in -->
| Role | Code | Description |
|---|---|---|
| <...> | `<...>` | <...> |

<Can a user hold several roles? Is there a per-resource role besides the global one? Which sheets does each role come from?>

## 5. Files and architecture

<!-- fill in -->
<Short list of `.gs` files by responsibility; `ls *.gs` and `ls html/` are the source of truth. Split any client script file that passes ~7,500 lines.>

**Setup:** set the real time zone in `appsscript.json` (`timeZone`; the template default is `"UTC"`).

**Deployment:** `.clasp.json` is git-ignored. `clasp push --force` / `clasp open` / `clasp deploy`. `.clasp.json` points to: <test script / production script>. Manifest: V8, explicit `oauthScopes`, `executeAs`/`access` matching section 3.

**Client → server:** public functions at the file root, returning `{ok: true, data}` or `{ok: false, error}`. On the client: `if (!res || !res.ok)`.

**Client context:** `doGet()` injects a single `window.APP_CONTEXT`. Any new data is added to it; no loose globals.

## 6. Data layer

<!-- fill in -->
<N sheets. Exact headers live in `Setup.gs`; details in `docs/<reference>.md`. State the key-case rule of the read helper (e.g. always lower-case keys), the cache policy (raw sheet reads only, invalidated on every write, no cache of computed results), and the migration process (`CURRENT_SCHEMA_VERSION`, additive idempotent migrations, update `Setup.gs` too).>

## 7. Code conventions

- Comments: <language>. Commits: <language>.
- camelCase. **Backend: every internal function ends in `_`**; only functions the client calls have no suffix.
- Client helpers prefixed `_`; syntax style: <`var` + concatenation / `const` and one-level templates>.
- Sheet booleans: `v === true || v === 'TRUE'`. Dates: `YYYY-MM-DD` strings. Missing data is `null`, never 0.

## 8. Security

- **Every top-level function not ending in `_` is callable from the browser.** Public functions start with an identity/role guard: `requireUser_()`, `requireAdmin_()`, `requireRole_([...])` or `checkAccess_(minRole, resourceId)`.
- `tests/public-surface.test.js` lists every public function; a new one must be classified there.
- A GET never changes data; emailed links with effects open a confirmation page.
- Free text is neutralised against formulas when saved, and escaped when displayed or emailed.
- Role inside a resource consults **all** membership sources: <list, in priority order>.
- Numeric inputs validated on the backend (range and type); qualitative inputs against an allowed list; no client-supplied ID is trusted.

## 9. Tests before `clasp push`

<!-- fill in -->
```bash
node tests/public-surface.test.js
# <other test commands>
cat File.gs | node --input-type=commonjs          # syntax check, backend
sed -n '2,99999p' html/x-scripts.html | node --input-type=commonjs   # syntax check, client
```

## 10. User preferences

<!-- fill in -->
- Isolation: <worktree per feature / branch / `main`>.
- Who commits: <assistant / user>. Who runs `git push`: <assistant after explicit confirmation / user>.
- Commit language: <...>. Backlog updates: <at feature close / on request>.
- Subagents: <allowed / only when asked>.

## 11. Out of scope (v1.0)

<Explicit list.>

---

*Active backlog in `docs/ROADMAP.md`; history of closed features in `docs/ROADMAP-historial.md` — when closing an item, move its entry from one file to the other.*
