#!/usr/bin/env node
// Porta de les evals. Ús: node tools/eval-gate.mjs <resultat.json>
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MIN_OVERALL = 0.8;

export function evaluateEvals(result) {
  if (!result) return { pass: false, reasons: ['eval result missing or unreadable'], warnings: [], markdown: '- Result: **FAIL** (no eval result)' };
  const reasons = [];
  const warnings = [];
  const ag = result.aggregates || {};
  if (result.partial) reasons.push(`partial run: ${result.partialReason || 'unknown reason'}`);
  for (const k of result.cases || []) {
    const s = k.aggregates?.score;
    const d = k.aggregates?.delta;
    if (k.name.startsWith('critical-') && !(s >= 1)) reasons.push(`${k.name}: critical case scored ${s}`);
    if (typeof d === 'number' && d <= 0 && !k.name.includes('-negative')) {
      warnings.push(`${k.name}: delta ${d} (passes without the plugin, so it does not measure the skill)`);
    }
  }
  if (!(ag.overallScore >= MIN_OVERALL)) reasons.push(`overall score ${ag.overallScore} < ${MIN_OVERALL}`);
  if (!(ag.meanDelta > 0)) reasons.push(`mean delta ${ag.meanDelta} is not positive`);
  const rows = (result.cases || []).map((k) => `| ${k.name} | ${k.aggregates?.score} | ${k.aggregates?.delta ?? '—'} |`);
  const md = [
    `- Overall score (with plugin): **${ag.overallScore}** · cases passed: ${ag.casesPassed}/${ag.casesTotal} · mean delta vs. no plugin: **${ag.meanDelta}**`,
    `- Claude Code ${result.claudeVersion} · cost ${result.costUsd} USD · ${result.durationSeconds} s`,
    '',
    '| Case | Score (with) | Delta |',
    '|---|---|---|',
    ...rows,
    '',
    `- Result: **${reasons.length ? 'FAIL' : 'PASS'}**`,
    ...reasons.map((r) => `  - ${r}`),
    ...warnings.map((w) => `  - warning: ${w}`),
  ].join('\n');
  return { pass: reasons.length === 0, reasons, warnings, markdown: md };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let result = null;
  try { result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); } catch { result = null; }
  const res = evaluateEvals(result);
  console.log(res.markdown);
  process.exit(res.pass ? 0 : 1);
}
