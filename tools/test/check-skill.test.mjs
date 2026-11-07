import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSkill, checkPrivate } from '../check-skill.mjs';

function mkSkill(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return dir;
}
const FM = '---\nname: demo\ndescription: Use when testing.\n---\n';

test('skill vàlida no té problemes', () => {
  const dir = mkSkill({
    'SKILL.md': FM + 'Read `references/a.md` and `templates/b.template`.\n',
    'references/a.md': '# A\n',
    'templates/b.template': 'x\n',
  });
  assert.deepEqual(checkSkill(dir), []);
});

test('description massa llarga i name absent', () => {
  const dir = mkSkill({ 'SKILL.md': `---\ndescription: ${'x'.repeat(1025)}\n---\n` });
  const p = checkSkill(dir).join('\n');
  assert.match(p, /description.*1024/);
  assert.match(p, /name/);
});

test('SKILL.md de més de 150 línies', () => {
  const dir = mkSkill({ 'SKILL.md': FM + 'l\n'.repeat(150) });
  assert.match(checkSkill(dir).join('\n'), /150/);
});

test('referència trencada i fitxer orfe', () => {
  const dir = mkSkill({
    'SKILL.md': FM + 'See `references/missing.md`.\n',
    'references/orphan.md': '# O\n',
  });
  const p = checkSkill(dir).join('\n');
  assert.match(p, /references\/missing\.md.*not found/);
  assert.match(p, /references\/orphan\.md.*not referenced/);
});

test('fitxers prohibits dins la skill', () => {
  const dir = mkSkill({ 'SKILL.md': FM, 'README.md': '# r\n' });
  assert.match(checkSkill(dir).join('\n'), /README\.md.*not allowed/);
});

test('dades privades a la skill', () => {
  const dir = mkSkill({
    'SKILL.md': FM + 'See `references/a.md`.\n',
    'references/a.md': 'path ~/gitLab/foo\nmail jane.doe@xtec.cat\nid 1JRofzlJuvL7gyNx3gjGvzlA58nIyZKhvSP8O6dj_21OiEfKtXknpoETE\n',
  });
  const p = checkSkill(dir).join('\n');
  assert.match(p, /a\.md:1: private data \(local-path\)/);
  assert.match(p, /a\.md:2: private data \(email\)/);
  assert.match(p, /a\.md:3: private data \(script-id\)/);
});

test('correus d\'exemple i dominis sols no són privats', () => {
  const dir = mkSkill({ 'x.md': 'admin@example.com and @school.example users\n' });
  assert.deepEqual(checkPrivate([dir]), []);
});

test('--private-only detecta /Users/ i correus a docs', () => {
  const dir = mkSkill({ 'docs/n.md': 'see /Users/someone/x\nwrite to a.b@gmail.com\n' });
  const p = checkPrivate([path.join(dir, 'docs')]).join('\n');
  assert.match(p, /local-path/);
  assert.match(p, /email/);
});

test('evals/results (generat, git-ignored) no s\'escaneja', () => {
  const dir = mkSkill({ 'evals/results/run.json': '{"cwd":"/Users/someone/x"}\n' });
  assert.deepEqual(checkPrivate([dir]), []);
});
