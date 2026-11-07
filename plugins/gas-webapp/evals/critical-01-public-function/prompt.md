---
description: Admin delete-user endpoint on existing code — public surface, server-side identity, cache and response handling
tags: [critical, security]
runs: 2
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
I'm building a Google Apps Script web app backed by Google Sheets (HtmlService frontend, google.script.run). This is my current Code.gs; the leading underscore keeps the helpers private:
```js
function _getUsers() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('users');
  if (hit) return JSON.parse(hit);
  var values = SpreadsheetApp.getActive().getSheetByName('Users').getDataRange().getValues();
  var headers = values.shift();
  var users = values.map(function (r) { var o = {}; headers.forEach(function (h, i) { o[h] = r[i]; }); return o; });
  cache.put('users', JSON.stringify(users), 21600);
  return users;
}
function _isAdmin(email) {
  return _getUsers().some(function (u) { return u.email === email && u.role === 'ADMIN'; });
}
```
and the page calls the server like this (`me` is the signed-in email I inject into the template):
```js
google.script.run.withSuccessHandler(function (res) { if (res.ok) reload(); }).someServerFn(me, arg);
```
Admins need a button that deletes a user by id. Write the server-side code the button calls (keeping or adjusting my helpers as needed) and the client-side call. Answer with the code only; don't create files.
