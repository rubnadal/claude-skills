#!/usr/bin/env node
// Comprovador d'estructura i de dades privades d'una skill.
// Ús: node tools/check-skill.mjs <skillDir>
//     node tools/check-skill.mjs --private-only <camí...>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRIVATE_PATTERNS = [
  { name: 'local-path', re: /~\/git(?:Lab|Hub)\b|\/Users\/[A-Za-z0-9._-]+/ },
  { name: 'email', re: /[A-Za-z0-9._%+-]+@(?!example\.(?:com|org)\b)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/ },
  { name: 'script-id', re: /\b1[A-Za-z0-9_-]{43,}\b/ },
];
const TEXT_EXT = new Set(['.md', '.json', '.js', '.mjs', '.yaml', '.yml', '.template', '.html', '.gs']);
const FORBIDDEN = ['README.md', 'CHANGELOG.md', '.git'];
// node_modules: dependències. results: traces generades per les evals (git-ignored, poden tenir camins locals).
const SKIP_DIRS = new Set(['node_modules', 'results']);
const MAX_LINES = 150;
const MAX_DESC = 1024;

function walk(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return [p];
  return fs.readdirSync(p).flatMap((n) => (SKIP_DIRS.has(n) ? [] : walk(path.join(p, n))));
}

export function checkPrivate(paths) {
  const problems = [];
  for (const root of paths) {
    if (!fs.existsSync(root)) continue;
    for (const f of walk(root)) {
      const ext = f.endsWith('.template') ? '.template' : path.extname(f);
      if (!TEXT_EXT.has(ext)) continue;
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        for (const { name, re } of PRIVATE_PATTERNS) {
          if (re.test(line)) problems.push(`${f}:${i + 1}: private data (${name})`);
        }
      });
    }
  }
  return problems;
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

export function checkSkill(dir) {
  const problems = [];
  const skillPath = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return [`${skillPath}: SKILL.md not found`];
  const text = fs.readFileSync(skillPath, 'utf8');
  const fm = frontmatter(text);
  if (!fm) problems.push(`${skillPath}:1: missing frontmatter`);
  else {
    if (!fm.name) problems.push(`${skillPath}:1: frontmatter name is missing`);
    if (!fm.description) problems.push(`${skillPath}:1: frontmatter description is missing`);
    else if (fm.description.length > MAX_DESC)
      problems.push(`${skillPath}:1: description has ${fm.description.length} chars (max ${MAX_DESC})`);
  }
  const lines = text.split('\n').length;
  if (lines > MAX_LINES) problems.push(`${skillPath}: ${lines} lines (max ${MAX_LINES})`);

  for (const name of FORBIDDEN) {
    if (fs.existsSync(path.join(dir, name))) problems.push(`${path.join(dir, name)}: not allowed inside a skill folder`);
  }

  // Referències internes: tokens references/<f> o templates/<f> a qualsevol fitxer .md de la skill.
  const refRe = /\b((?:references|templates)\/[A-Za-z0-9._-]+)/g;
  const mdFiles = walk(dir).filter((f) => f.endsWith('.md'));
  const referencedFromSkill = new Set();
  for (const f of mdFiles) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(refRe)) {
        const target = m[1].replace(/[.,;:)]+$/, '');
        if (f === skillPath) referencedFromSkill.add(target);
        if (!fs.existsSync(path.join(dir, target))) problems.push(`${f}:${i + 1}: ${target} not found`);
      }
    });
  }
  for (const sub of ['references', 'templates']) {
    const d = path.join(dir, sub);
    if (!fs.existsSync(d)) continue;
    for (const n of fs.readdirSync(d)) {
      if (!referencedFromSkill.has(`${sub}/${n}`)) problems.push(`${path.join(d, n)}: ${sub}/${n} not referenced from SKILL.md`);
    }
  }
  return problems.concat(checkPrivate([dir]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const problems = args[0] === '--private-only' ? checkPrivate(args.slice(1)) : checkSkill(args[0]);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('OK');
}
