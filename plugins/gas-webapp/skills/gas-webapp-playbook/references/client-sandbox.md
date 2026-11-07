# Client code inside the HtmlService sandbox

HtmlService serves every page inside a sandboxed iframe on a `googleusercontent.com` domain. Its JavaScript parser is stricter than V8, the iframe changes how URLs, history and storage behave, and errors arrive far from their cause or not at all. Apply these rules while writing, not while debugging.

Escaping of values placed in HTML, attributes and inline handlers lives in `references/security-and-api.md §Input and output`. Symptom lookup: `references/gotchas.md`.

## Syntax

**Parser rules (top rule).** The iframe parser rejects code that V8 accepts:
1. Never nest template literals 3 or more levels deep.
2. Never declare a function inside a function that uses multi-line template literals; move helpers to the top level of the file.
3. Never wrap `${}` in single quotes inside a template literal (`onclick="fn('${id}')"`); build such attributes by concatenation.

```javascript
// BAD (3 levels): a <ul> template literal whose ${} runs items.map(), which returns an <li> template literal
// whose ${} holds a third template literal for the <b> cell. The GAS parser rejects this shape.
// GOOD: precompute fragments, top-level row helper, concatenation
function _rowHtml(i) { var v = i.ok ? '<b>' + _esc(i.v) + '</b>' : ''; return '<li>' + v + '</li>'; }
```

Typical errors, often hundreds of lines after the real cause: `SyntaxError: '' string literal contains an unescaped line break`, `unexpected token: keyword 'class'`, `illegal character U+274C`.

**Style choice, recorded in the project's `CLAUDE.md`:**
- *Option A* — allow `const`/`let`, arrows and template literals of one or two levels, and follow the three rules in review. Node does not catch violations.
- *Option B* — ban backticks in client code completely and enforce it by test (`references/testing.md §Static checks`). Choose B when several people or agents write client code: "max two levels" cannot be checked mechanically, a blunt ban can.

**File size.** Split a scripts file before ~7,500 lines (`admin-scripts-2.html`); a practical, undocumented limit. Never inline a large bundle (~400 KB) in a `<script>`: it fails with `SyntaxError: missing ) in parenthetical` although the same content works from a URL. Load it with `<script src>` (see §Assets and networks).

**One global scope per page.** All templates included into one page share one scope: a top-level `function X` or `var X` declared in two included files silently keeps the later one, and an unrelated screen breaks. Prefix helpers per screen (`_adminRender`, `_editRender`) and add a test that expands the includes of every view `doGet` can serve and fails on duplicate top-level names (`references/testing.md §Static checks`).

**Quick local check** (catches only `SyntaxError`, not the three parser rules; full checks in `references/testing.md §Static checks`):
```bash
sed -n '2,99999p' html/screen-scripts.html | node --input-type=commonjs   # skips the opening <script>
```
`ReferenceError`s for browser globals and the error on the closing `</script>` are expected.

## Templates

**Always evaluate as a template (top rule).** Serve every page, dialog, sidebar and include with `createTemplateFromFile(...).evaluate()`. `createHtmlOutputFromFile()` serves the file as-is and prints `<?!= include('x') ?>` literally. No "only evaluate if it contains `<?`" optimisation: it breaks nested includes and leaves blank pages.

```javascript
var PARTIALS_ = ['html/layout-head', 'html/nav', 'html/screen-scripts'];   // every partial a page includes
function include(filename) {
  if (PARTIALS_.indexOf(filename) < 0) throw new Error('UNKNOWN_PARTIAL');
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}
```
`include` is a public, unguarded entry point: any visitor can call `google.script.run.include('anyView')`. Classify it in the surface test (`references/security-and-api.md §Public surface`), whitelist the partials it returns, and never put data-reading scriptlets in a partial: data reaches pages only through `doGet`'s context or guarded `api*` calls. A private `include_()` is an alternative only if you verify in your project that scriptlets can call `_`-suffixed functions. When an include "does not work", first check how the `.gs` creates the output.

**A scripts file that already carries `<script>…</script>` is included bare:** `<?!= include('html/screen-scripts') ?>`. Wrapping it in another `<script>` yields `<script><script>`; the browser closes at the first `</script>` and all the JS is dead.

**Context injection.** Inject one context object (shape and string-typing rules: `references/architecture.md §Context`):

```javascript
// server, in doGet
var tpl = HtmlService.createTemplateFromFile('layout');
tpl.context = JSON.stringify(ctx).replace(/</g, '\\u003c');   // a value containing </script> cannot close the tag
tpl.baseUrl = _publicUrl_();                                   // §Navigation
return tpl.evaluate().addMetaTag('viewport', 'width=device-width, initial-scale=1');
```
```html
<head><base href="<?= baseUrl ?>" target="_top"></head>
<script>window.APP_CONTEXT = <?!= context ?>;</script>
```
Print JSON raw with `<?!= ?>`; never print JSON through `<?= ?>` and never mix the two forms for the same value. `<?= ?>` escapes for its context: inside `<script>` it prints a quoted JavaScript string (`'{\x22name\x22:…}'`), so `var ctx = <?= json ?>` gives a string, not an object; in HTML it prints entities (`&#34;`). `<?!= ?>` prints the JSON untouched, `</script>` included, which is why the server escapes `<` first. Use `<?= ?>` only for plain text in HTML. Verified on a real template.

**Pages served outside the main layout** (registration, confirmation, error pages) must replicate the `<base href>`, the context injection and the language (§i18n).

## Navigation

**Base URL: capture `/exec` in `doGet` (top rule).** `ScriptApp.getService().getUrl()` is wrong outside a web request (a menu or trigger gets an id that matches no deployment) and was once seen returning `/dev` inside a request opened via `/exec` (exact trigger not established). Store the public URL only when it ends in `/exec` and use the stored value for `<base href>`, emails, menus and triggers:

```javascript
function _savePublicUrl_() {               // first statement of doGet
  try {
    var url = ScriptApp.getService().getUrl();
    if (typeof url !== 'string' || !/\/exec$/.test(url)) return;   // never store /dev
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty('PUBLIC_URL') !== url) props.setProperty('PUBLIC_URL', url);
  } catch (e) {}                           // must never break the page
}
function _publicUrl_() {
  return PropertiesService.getScriptProperties().getProperty('PUBLIC_URL') ||
    ScriptApp.getService().getUrl() || '';
}
```
Cost: a developer testing on `/dev` follows links to `/exec`; until someone opens `/exec` once, menus show the publishing guide instead of a link. Build every link (and personal-link tokens) through one helper: `references/security-and-api.md §Identity`.

`<base href="…" target="_top">` goes in the layout `<head>` before any include. `target="_top"` alone is not enough: `<a href="?page=x">` resolves against the sandbox domain and gives a blank page. Diagnostic: typing the full URL works, clicking the link does not.

**Navigate from JS only through an `<a>` click.** `window.location.href = …` navigates inside the iframe (`script.google.com` answers 403), ignores `<base target>` and drops a personal-link token. GET forms bypass the token too.
```javascript
function _go(href) {
  var a = document.createElement('a');
  a.href = href; a.target = '_top';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
```

**Do not read the URL on the client.** `window.location.search` and the hash are unreliable in the iframe: read `e.parameter` in `doGet` and inject it in the context. For an incoming hash use `google.script.url.getLocation(function (loc) { … loc.hash … })`. In one project the address bar showed a `script.googleusercontent.com/…/echo?user_content_key=…` URL, so it did not reveal the request; to see what reached the server, log `JSON.stringify(e.parameter)` at the top of `doGet` and read the editor's Executions view.

**In-page anchors.** With `<base target="_top">`, `href="#x"` navigates the top window and reloads the app. One delegated listener in the shared client script:
```javascript
document.addEventListener('click', function (ev) {
  var a = ev.target.closest && ev.target.closest('a[href^="#"]');
  var el = a && document.getElementById(a.getAttribute('href').slice(1));
  if (!el) return;
  ev.preventDefault(); el.scrollIntoView();
});
```

**History.** `history.back()` and `history.go(-n)` do nothing inside the iframe (no error, no callback; the device's own back gesture works). Model sub-views with `google.script.history.push/replace` + `setChangeHandler`; use `replace` when closing an overlay so "back" does not reopen it; never plan features around popping entries. Ban `window.location` and `history.pushState/replaceState` by test (`references/testing.md §Static checks`).

## Model B client

Applies only under identity model B with a personal `?t=` link (server side, `rpc` and tokens: `references/security-and-api.md §Identity`). One shared client file does both jobs below; pages need nothing special. Without a token it does nothing.

**Wrap `google.script.run` in a careful Proxy** that turns each call into `rpc(token, name, args)`. A naive `get` trap fires server calls for language probes (`Promise.resolve(run)`, `JSON.stringify`, `String(run)`, `'x' in run`):

```javascript
function _wrapRun(runner, token, hasFailure) {
  return new Proxy(runner, {
    get: function (r, name) {
      if (typeof name === 'symbol' || name === 'then' || name === 'toJSON' || name === 'constructor') return undefined;
      if (name === 'toString' || name === 'valueOf' || name === 'toLocaleString') return Object.prototype[name];
      if (/^with/.test(name)) return function () {
        return _wrapRun(r[name].apply(r, arguments), token, hasFailure || name === 'withFailureHandler');
      };
      return function () {
        var target = hasFailure ? r : r.withFailureHandler(_defaultFailure);
        return target.rpc(token, name, Array.prototype.slice.call(arguments));
      };
    },
    has: function (r, name) { return name in r; }
  });
}
```
- Install it with `Object.defineProperty(google.script, 'run', { get: … })`, fall back to assignment, and log if neither replaced the runner or `Proxy` is missing.
- `_defaultFailure`: unhandled server errors otherwise go only to the console and the spinner spins forever. For the expired-link code hide the spinner and show the translated message; otherwise `console.error`. When the caller registers its own handler, translate the expired-link error before passing it on.

**Keep the token on internal links.** A capture-phase listener on `click`, `auxclick` and `contextmenu` walks up to the `<a>`, skips `#anchor` links, and treats a link as internal when its `href` starts with `?` or its resolved `el.href` without query/hash equals the `<base href>` without query. It appends `t=` before the hash, never twice (`tab=` is not `t=`). `./?page=x` resolves outside the app and stays untouched. Middle-click and "open in new tab" are why `auxclick`/`contextmenu` matter. JS navigation must still use `_go()` (§Navigation): the listener only sees `<a>` clicks.

## DOM and CSS

- **Tabs toggle `active`, not `hidden`.** `.tab-content.active { display:block }` beats `.hidden`; switch panels with `classList` on `active` only.
- **Select by attribute, namespace ids.** Address cells and controls with `data-*` (`row.querySelector('[data-col="active"]')`), never `row.children[5]`; fix positional lookups before adding a column. Entities that can render twice on one page (a user with two roles on one resource) get DOM ids and in-memory keys prefixed by section: `section + ':' + id`; otherwise `getElementById` always finds the first.
- **`select.value = x` does not fire `change`.** After every programmatic reset call the dependent-visibility handler (keep it as a named function, e.g. `el._syncHandler`) or `el.dispatchEvent(new Event('change'))`; audit every reset path of a modal.
- **Shared CSS classes: find every consumer first.** Before changing or reusing a class, grep every place that emits it and every JS selector that uses it; prefer semantic attributes for JS hooks. Verify non-trivial layout hypotheses by rendering the real CSS headless with a control case.

## i18n

- **Engine.** `window.t('a.b', {n: 3})` with `{name}` interpolation; `data-i18n` (plus an attribute variant such as `data-i18n-placeholder`) in HTML; no hard-coded visible strings; identical dictionaries checked at start-up; server error codes translated too (`references/architecture.md §Public functions`). The language comes from a server-injected value validated against the allowed list. Tests: `references/testing.md §Static checks`.
- **Each page re-applies i18n in its own init.** A layout that calls `applyI18n()` before the page include is parsed translates only the shell; each page calls `if (typeof applyI18n === 'function') applyI18n();` again, after changing any data-dependent `data-i18n` key.
- **Pages outside the main layout** get the configured language injected and validated by `doGet`, including their `<title>`.
- **Switching language at runtime keeps open forms.** Save field values, repaint from data already held (no server call, no state reset), restore the values; if a view shows "loading…" or a load error, re-open it instead. Transient notices carry a `data-type` so they can be re-rendered in the new language; clear one-off success messages. Skip repainting while an action is in flight.

## State and feedback

**Handle every `google.script.run` response defensively (top rule).**
```javascript
google.script.run
  .withSuccessHandler(function (res) {
    if (!res || !res.ok) { _showError(t('errors.' + (res && res.error || 'UNKNOWN'))); _restorePlaceholder(); return; }
    _render(res.data);
  })
  .withFailureHandler(function (e) {           // transport failure: e.message is often empty
    _showError(e && e.message ? e.message : t('errors.network'));
    _restorePlaceholder();
  })
  .apiListItems(filter);
```
- Serialisation can deliver `null`/`undefined` to the success handler; a `TypeError` there leaves the spinner hanging.
- Properties whose value is `null` are dropped in transit (unlike the context injected with `JSON.stringify`); use `''` as the "present but empty" sentinel. `Date`, class instances, `undefined` and functions do not serialise; send ISO strings (`references/gotchas.md` B5, C2).

**Visible feedback.** Every perceptible call shows a global spinner or a per-button "working…" state through one shared action helper; the disabled button doubles as the double-click guard, and stays disabled on success when a reload will repaint. Use toasts and an own confirm dialog, never `window.confirm()`.

**Drop late responses.** Capture the view state (view, id, step) or a request sequence number when calling and ignore the response if it no longer matches; do not repaint a view while an action is in flight (mark it `aria-busy` and check).

**State objects.** Keep each screen's state in one object, `null` = not loaded. Any write that must be reflected resets the "loaded" flag, or the loader takes `force`; otherwise the reload is a silent no-op. When a write affects data another view holds, update every derived store in the success handler (list the stores and which server data each mirrors).

**Lazy-load failures.** On error keep the store `null`, show an error with a retry button, and record "last attempt failed" separately, so re-renders neither re-fire the call in a loop nor cache the failure as "loaded, empty".

**Conventions:**
- A global save bar for pending changes, with row actions disabled meanwhile; bulk saves run as a sequential queue.
- Read-only modes hide controls by attribute; the server rejects the writes anyway (`references/security-and-api.md §Identity`, role inside a resource).
- Every error path restores the loading placeholder.
- Human-only derived values (fractions shown as %) exist only in the UI; stored values stay untouched.
- A living style document, updated in the same commit as any new visual pattern.

## Assets and networks

- Ask which domains the target network blocks (school and corporate filters block generic CDNs).
- Serve libraries from a host you control as an external `<script src>`; never inline a large bundle (§Syntax).
- Generate images such as QR codes on the server with `UrlFetchApp` and return a `data:` URI (`'data:image/png;base64,' + Utilities.base64Encode(blob.getBytes())`). In emails a direct image URL works, because the mail client fetches it through its own proxy. The Google Charts QR endpoint is retired (404).

## Mobile

Hedged: measured on one phone in one project.
- Google's "created by a Google Apps Script user" banner sits outside the iframe and shrinks it (measured 360×530 on a 360 px phone). Keep each screen's key information above that fold and nothing important in the top strip.
- `position: sticky/fixed` work inside the iframe. Measure fixed trays in JS into a CSS variable and reserve that height (`padding-bottom`, `scroll-padding-bottom: calc(var(--tray-h) + 12px)`).
- Set the viewport from `doGet`: `HtmlOutput.addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')`.
- Wrap every `localStorage` access in a one-line `try { … } catch (e) {}` (hedged: rationale is that storage can be blocked, e.g. private modes; no incident recorded). Keep unsent input as a draft keyed by record id.
- Register `beforeunload` only while there is unsaved input, and set a flag in the navigation helper so intentional navigations (including an expired-link reload) do not prompt.
- Accept mobile screens only after validation on the real device: `references/workflow.md §QA and debugging`.
