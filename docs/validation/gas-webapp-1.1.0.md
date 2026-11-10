# Validation report — gas-webapp 1.1.0

Date: 2026-11-10 · Claude Code 2.1.322 (Claude Code) · skillspector SkillSpector v2.12.0

## 1. Structure

- `claude plugin validate` (marketplace and plugin), `tools/check-skill.mjs`: PASS

## 2. skillspector (LLM analyzers via claude_cli)

### gas-webapp-playbook

- Risk score: 17 · severity: LOW · recommendation: **SAFE**
- Findings reported: 3
  - MEDIUM `EA2` references/gotchas.md: Autonomous Decision Making
  - MEDIUM `E1` references/workflow.md: External Transmission
  - MEDIUM `EA2` references/workflow.md: Autonomous Decision Making
- Accepted in baseline: 0
- Result: **PASS**

## 3. Evals (`claude plugin eval`, 2 runs per case, with/without plugin)

- Overall score (with plugin): **0.9705882352941176** · cases passed: 17/17 · mean delta vs. no plugin: **0.5294117647058824**
- Claude Code 2.1.322 · cost 8.0914622 USD · 1913 s

| Case | Score (with) | Delta |
|---|---|---|
| case-07-locale-number-date | 1 | 1 |
| case-08-leading-zeros | 1 | 1 |
| case-09-dates-shift | 1 | 0 |
| case-10-stale-after-edit | 1 | 0 |
| case-11-skipping-push | 1 | 0 |
| case-12-add-column | 1 | 1 |
| case-13-email-link-get | 1 | 0 |
| case-14-setup-rerun | 0.5 | 0 |
| case-17-save-all-round-trips | 1 | 1 |
| critical-01-public-function | 1 | 1 |
| critical-02-identity-model | 1 | 1 |
| critical-03-boolean-read | 1 | 0.5 |
| critical-04-bulk-insert | 1 | 0 |
| critical-05-client-sandbox | 1 | 1 |
| critical-06-res-null | 1 | 0.5 |
| critical-15-activation-positive | 1 | 1 |
| critical-16-activation-negative | 1 | 0 |

- Result: **PASS**
  - warning: case-09-dates-shift: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: case-10-stale-after-edit: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: case-11-skipping-push: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: case-13-email-link-get: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: case-14-setup-rerun: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: critical-04-bulk-insert: delta 0 (passes without the plugin, so it does not measure the skill)

## Notes

- This is the second full run of the gate on this commit. The first run failed on one point only: `critical-05-client-sandbox` scored 0.5 (overall 0.88, mean delta 0.47, `case-17-save-all-round-trips` delta 0.5). In the failed run the answer rewrote `'${i.id}'` by concatenation but did not name single-quoted `${}` inside a template as a parser error, which criterion 1 requires; the judge's FAIL was correct. The rule is in `SKILL.md` rule 16 and `references/client-sandbox.md`, unchanged in 1.1.0, and the case scored 1 in 1.0.0 and 1.0.1, so it was treated as model variance and the gate was re-run without changes. If it fails again, add the `onclick="fn('${id}')"` example to `SKILL.md` rule 16.
