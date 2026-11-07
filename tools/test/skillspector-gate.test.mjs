import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateScan } from '../skillspector-gate.mjs';

const gatePath = fileURLToPath(new URL('../skillspector-gate.mjs', import.meta.url));

const ok = () => ({
  risk_assessment: { score: 5, severity: 'LOW', recommendation: 'SAFE', max_issue_severity: 'LOW' },
  issues: [],
  metadata: { llm_available: true },
  analysis_completeness: { analyzer_statuses: [
    { analyzer_id: 'semantic_security_discovery', status: 'completed' },
    { analyzer_id: 'semantic_quality_policy', status: 'completed' },
    { analyzer_id: 'static_yara', status: 'completed' },
  ] },
});

test('informe net passa', () => {
  assert.equal(evaluateScan(ok(), null).pass, true);
});

test('troballa HIGH falla', () => {
  const r = ok(); r.issues = [{ severity: 'HIGH', id: 'AE1', pattern: 'x', location: { file: 'SKILL.md', start_line: 3 }, finding: 'f' }];
  const res = evaluateScan(r, null);
  assert.equal(res.pass, false);
  assert.match(res.reasons.join('\n'), /HIGH/);
});

test('recomanació CAUTION falla', () => {
  const r = ok(); r.risk_assessment.recommendation = 'CAUTION';
  assert.equal(evaluateScan(r, null).pass, false);
});

test('sense LLM falla', () => {
  const r = ok(); r.metadata.llm_available = false;
  assert.match(evaluateScan(r, null).reasons.join('\n'), /LLM/);
});

test('analitzador semàntic fallit falla', () => {
  const r = ok(); r.analysis_completeness.analyzer_statuses[0].status = 'failed';
  assert.match(evaluateScan(r, null).reasons.join('\n'), /semantic_security_discovery/);
});

test('baseline amb motiu autogenerat o curt falla', () => {
  const bl = { fingerprints: [
    { rule_id: 'AE1', file: 'SKILL.md', reason: 'Accepted finding (auto-generated baseline)' },
    { rule_id: 'AE1', file: 'x.md', reason: 'short' },
  ] };
  const res = evaluateScan(ok(), bl);
  assert.equal(res.pass, false);
  assert.equal(res.reasons.filter((x) => /baseline/.test(x)).length, 2);
});

test('baseline justificada passa i surt al resum', () => {
  const bl = { fingerprints: [{ rule_id: 'AE1', file: 'x.md', reason: 'Static parser limit on a documented code sample; no executable content.' }] };
  const res = evaluateScan(ok(), bl);
  assert.equal(res.pass, true);
  assert.match(res.markdown, /Static parser limit/);
});

test('sense cap analitzador semàntic falla', () => {
  const r = ok(); r.analysis_completeness.analyzer_statuses = [{ analyzer_id: 'static_yara', status: 'completed' }];
  assert.match(evaluateScan(r, null).reasons.join('\n'), /no semantic analyzer ran/);
});

test('sense analysis_completeness falla', () => {
  const r = ok(); delete r.analysis_completeness;
  assert.match(evaluateScan(r, null).reasons.join('\n'), /no semantic analyzer ran/);
});

test('recomanació buida o absent falla', () => {
  const r = ok(); r.risk_assessment.recommendation = '';
  assert.match(evaluateScan(r, null).reasons.join('\n'), /recommendation missing/);
  const r2 = ok(); delete r2.risk_assessment;
  assert.match(evaluateScan(r2, null).reasons.join('\n'), /recommendation missing/);
});

test('CLI amb baseline inexistent surt amb codi 1', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  const reportPath = path.join(dir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(ok()));
  const res = spawnSync(process.execPath, [gatePath, reportPath, path.join(dir, 'no-existeix.json')], { encoding: 'utf8' });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /baseline file not found/);
});
