---
description: Blank page in the GAS iframe — nested templates and window.location
tags: [critical, client]
runs: 2
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
This client script works in Chrome when I open the HTML file, but inside my Apps Script web app the page is blank. Fix it.
```js
function render(items){
  list.innerHTML = items.map(i => `<li onclick="go('${i.id}')">${i.tags.map(t => `<span>${`#${t}`}</span>`).join('')}</li>`).join('');
}
function go(id){ window.location.href = '?page=item&id=' + id; }
```
