import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEvals } from '../eval-gate.mjs';

const run = (cases, extra = {}) => ({
  schemaVersion: 1, partial: false,
  aggregates: { overallScore: 0.9, casesPassed: cases.length, casesTotal: cases.length, meanDelta: 0.4 },
  cases, costUsd: 3.2, durationSeconds: 600, claudeVersion: '2.1.319', ...extra,
});
const c = (name, score, delta) => ({ name, aggregates: { score, delta } });

test('execució bona passa', () => {
  const r = evaluateEvals(run([c('critical-01-a', 1, 0.5), c('case-07-b', 0.5, 0.5)]));
  assert.equal(r.pass, true);
});

test('cas crític per sota d\'1 falla', () => {
  const r = evaluateEvals(run([c('critical-01-a', 0.5, 0.5)]));
  assert.equal(r.pass, false);
  assert.match(r.reasons.join('\n'), /critical-01-a/);
});

test('puntuació global < 0.8 falla', () => {
  const x = run([c('case-07-b', 0.5, 0.5)]); x.aggregates.overallScore = 0.7;
  assert.equal(evaluateEvals(x).pass, false);
});

test('meanDelta <= 0 falla', () => {
  const x = run([c('case-07-b', 1, 0)]); x.aggregates.meanDelta = 0;
  assert.equal(evaluateEvals(x).pass, false);
});

test('execució parcial falla', () => {
  assert.equal(evaluateEvals(run([], { partial: true, partialReason: 'cost ceiling' })).pass, false);
});

test('cas sense delta és avís, no error; els -negative no avisen', () => {
  const r = evaluateEvals(run([c('case-08-x', 1, 0), c('critical-16-activation-negative', 1, 0)]));
  assert.equal(r.pass, true);
  assert.deepEqual(r.warnings, ['case-08-x: delta 0 (passes without the plugin, so it does not measure the skill)']);
});

test('resultat absent falla', () => {
  assert.equal(evaluateEvals(null).pass, false);
});
