#!/usr/bin/env node
// Public-surface test for a Google Apps Script project.
// Every top-level function whose name does NOT end in "_" can be called from
// the browser with google.script.run. This test fails when:
//   1. a public function is not in ALLOWED (unclassified leak), or
//   2. an api* function does not start with a documented guard, or
//   (stale ALLOWED entries are reported as warnings only.)
//
// Fail-closed: if braces do not balance after stripping comments/strings (e.g. a regex
// literal containing a quote), the file is reported and the test fails.
// To extend: add the name of each new public function to ALLOWED (entry points
// and api* functions only). Internal helpers must end in "_" instead.
// Usage: node public-surface.test.js [dir]   (default: current directory)
// Requires Node >= 20, no dependencies.
'use strict';
const fs = require('fs');
const path = require('path');

const ALLOWED = [
  'doGet',
  'doPost',
  'include',
  'apiExample',
];

// A guard must be the first statement of every api* function.
const GUARDS = ['requireUser_(', 'requireAdmin_(', 'requireRole_(', 'checkAccess_('];
// Public functions that intentionally have no guard (e.g. "send me my link").
const UNGUARDED_OK = [];

const dir = path.resolve(process.argv[2] || process.cwd());
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.gs')) files.push(p);
  }
})(dir);

// Replace comments and string/template literals with spaces (offsets kept).
function strip(src) {
  let out = '';
  let i = 0;
  const blank = (t) => t.replace(/[^\n]/g, ' ');
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') {
      const e = src.indexOf('\n', i);
      const end = e < 0 ? src.length : e;
      out += blank(src.slice(i, end)); i = end;
    } else if (c === '/' && n === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e < 0 ? src.length : e + 2;
      out += blank(src.slice(i, end)); i = end;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; if (c !== '`' && src[j] === '\n') break; j++; }
      const closed = src[j] === c;
      const end = closed ? j + 1 : Math.min(j, src.length);
      out += c + blank(src.slice(i + 1, closed ? j : end)) + (closed ? c : ''); i = end;
    } else { out += c; i++; }
  }
  return out;
}

const DECL = new RegExp(
  '(?<![\\w$.])(?:(?:async\\s+)?function\\s+([A-Za-z0-9_$]+)\\s*\\(' +
  '|(?:var|let|const)\\s+([A-Za-z0-9_$]+)\\s*=\\s*(?:async\\s*)?(?:function\\b|\\([^)]*\\)\\s*=>|[A-Za-z_$][\\w$]*\\s*=>))', 'g');

const errors = [];
const found = new Set();
for (const f of files) {
  const src = strip(fs.readFileSync(f, 'utf8'));
  const depth = new Int32Array(src.length + 1);
  let d = 0, neg = false;
  for (let i = 0; i < src.length; i++) {
    depth[i] = d;
    if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d < 0) { neg = true; d = 0; } }
  }
  const rel = path.relative(dir, f);
  if (d !== 0 || neg) {
    errors.push(`${rel}: unbalanced braces after stripping comments/strings - scan unreliable (a regex literal with a quote or brace? move it into a _-suffixed helper or use new RegExp(...))`);
    continue;
  }
  let m;
  DECL.lastIndex = 0;
  while ((m = DECL.exec(src))) {
    const name = m[1] || m[2];
    if (depth[m.index] !== 0) continue;
    const ls = src.lastIndexOf('\n', m.index) + 1;
    if (src.slice(ls, m.index).trim() !== '') continue; // not at statement start
    if (name.endsWith('_')) continue;
    found.add(name);
    if (!ALLOWED.includes(name)) {
      errors.push(`${rel}: public function "${name}" is not in ALLOWED (rename it with a trailing "_" or classify it)`);
    }
    if (name.startsWith('api') && !UNGUARDED_OK.includes(name)) {
      const rest = src.slice(m.index + m[0].length);
      const open = rest.indexOf('{');
      const arrowExpr = !m[1] && /=>/.test(m[0]) && !/^\s*\{/.test(rest);
      const body = open < 0 || arrowExpr ? '' : rest.slice(open + 1);
      const first = body.replace(/^\s*/, '');
      const ok = GUARDS.some((g) => first.startsWith(g) ||
        new RegExp('^(var|let|const)\\s+[\\w$]+\\s*=\\s*' + g.replace('(', '\\(')).test(first));
      if (!ok) errors.push(`${rel}: "${name}" must start with one of ${GUARDS.join(' ')}`);
    }
  }
}
for (const n of ALLOWED) {
  if (!found.has(n)) console.warn(`warning: ALLOWED lists "${n}" but no such public function exists (stale entry?)`);
}

if (errors.length) {
  console.error('Public surface FAILED:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`Public surface OK (${found.size} public functions, ${files.length} files)`);
