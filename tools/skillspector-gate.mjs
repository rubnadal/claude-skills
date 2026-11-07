#!/usr/bin/env node
// Porta de skillspector. Ús: node tools/skillspector-gate.mjs <informe.json> [baseline.json]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BAD_RECOMMENDATION = /CAUTION|UNSAFE|BLOCK|DANGER|REJECT|DO_NOT/i;
const AUTO_REASON = 'Accepted finding (auto-generated baseline)';

export function evaluateScan(report, baseline) {
  const reasons = [];
  const ra = report.risk_assessment || {};
  for (const i of report.issues || []) {
    if (/^(HIGH|CRITICAL)$/i.test(i.severity)) {
      reasons.push(`${i.severity} ${i.id} at ${i.location?.file}:${i.location?.start_line ?? '?'} — ${i.pattern}: ${i.finding}`);
    }
  }
  if (!ra.recommendation) reasons.push('recommendation missing');
  else if (BAD_RECOMMENDATION.test(ra.recommendation)) reasons.push(`recommendation is ${ra.recommendation}`);
  if (report.metadata?.llm_available !== true) reasons.push('LLM analysis was not available (set SKILLSPECTOR_PROVIDER=claude_cli)');
  const statuses = report.analysis_completeness?.analyzer_statuses || [];
  const semantic = statuses.filter((a) => String(a.analyzer_id ?? '').startsWith('semantic_'));
  if (semantic.length === 0) reasons.push('no semantic analyzer ran');
  for (const a of semantic) {
    if (a.status !== 'completed') reasons.push(`${a.analyzer_id} status ${a.status}`);
  }
  const entries = baseline?.fingerprints || [];
  for (const e of entries) {
    if (!e.reason || e.reason === AUTO_REASON || e.reason.trim().length < 20) {
      reasons.push(`baseline entry ${e.rule_id} (${e.file}) has no real justification`);
    }
  }
  const md = [
    `- Risk score: ${ra.score} · severity: ${ra.severity} · recommendation: **${ra.recommendation}**`,
    `- Findings reported: ${(report.issues || []).length}`,
    ...(report.issues || []).map((i) => `  - ${i.severity} \`${i.id}\` ${i.location?.file}: ${i.pattern}`),
    `- Accepted in baseline: ${entries.length}`,
    ...entries.map((e) => `  - \`${e.rule_id}\` ${e.file}: ${e.reason}`),
    `- Result: **${reasons.length ? 'FAIL' : 'PASS'}**`,
    ...reasons.map((r) => `  - ${r}`),
  ].join('\n');
  return { pass: reasons.length === 0, reasons, markdown: md };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [reportPath, baselinePath] = process.argv.slice(2);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  let baseline = null;
  if (baselinePath) {
    if (!fs.existsSync(baselinePath)) {
      console.error(`baseline file not found: ${baselinePath}`);
      process.exit(1);
    }
    baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  }
  const res = evaluateScan(report, baseline);
  console.log(res.markdown);
  process.exit(res.pass ? 0 : 1);
}
