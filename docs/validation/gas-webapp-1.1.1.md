# Validation report — gas-webapp 1.1.1

Date: 2026-11-19 · Claude Code 2.1.328 (Claude Code) · skillspector SkillSpector v2.12.0

## 1. Structure

- `claude plugin validate` (marketplace and plugin), `tools/check-skill.mjs`: PASS

## 2. skillspector (LLM analyzers via claude_cli)

### gas-webapp-playbook

- Risk score: 19 · severity: LOW · recommendation: **SAFE**
- Findings reported: 4
  - MEDIUM `EA2` references/gotchas.md: Autonomous Decision Making
  - MEDIUM `E1` references/testing.md: External Transmission
  - MEDIUM `E1` references/workflow.md: External Transmission
  - MEDIUM `EA2` references/workflow.md: Autonomous Decision Making
- Accepted in baseline: 0
- Result: **PASS**

## 3. Evals (`claude plugin eval`, 2 runs per case, with/without plugin)

- Overall score (with plugin): **0.9705882352941176** · cases passed: 17/17 · mean delta vs. no plugin: **0.4411764705882353**
- Claude Code 2.1.328 · cost 8.4870106 USD · 1916 s

| Case | Score (with) | Delta |
|---|---|---|
| case-07-locale-number-date | 1 | 1 |
| case-08-leading-zeros | 1 | 1 |
| case-09-dates-shift | 1 | 0 |
| case-10-stale-after-edit | 1 | 0 |
| case-11-skipping-push | 1 | 0 |
| case-12-add-column | 1 | 1 |
| case-13-email-link-get | 1 | 0 |
| case-14-setup-rerun | 1 | 0.5 |
| case-17-save-all-round-trips | 0.5 | 0.5 |
| critical-01-public-function | 1 | 0 |
| critical-02-identity-model | 1 | 1 |
| critical-03-boolean-read | 1 | 0.5 |
| critical-04-bulk-insert | 1 | 0 |
| critical-05-client-sandbox | 1 | 1 |
| critical-06-res-null | 1 | 0 |
| critical-15-activation-positive | 1 | 1 |
| critical-16-activation-negative | 1 | 0 |

- Result: **PASS**
  - warning: case-09-dates-shift: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: case-10-stale-after-edit: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: case-11-skipping-push: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: case-13-email-link-get: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: critical-01-public-function: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: critical-04-bulk-insert: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: critical-06-res-null: delta 0 (passes without the plugin, so it does not measure the skill)

## Notes

- This is the second full run of the gate on this content. The first run (2026-11-18) was cut short by the account's monthly spend limit: skillspector passed, but 24 eval runs (critical-03, 04, 05, 06, 15 and 16, both arms) ended with an API error, so it has no result. Nothing in the plugin changed between the two runs except the release date in `CHANGELOG.md`.
- 1.1.1 adds no eval case. A case for the new gotcha E11 (blank icon, no console error) would most likely pass without the plugin too (delta 0), and the `clasp push` correction to A4 is in the area of `case-11-skipping-push`, which already passes without the plugin.
- `case-17-save-all-round-trips` scored 0.5 (1 of 2 runs, judge 2 to 1 against). The failed answer returned the refreshed table only when every row saved, so after a partial failure the client still needs a reload call, which criterion 4 rejects; the FAIL is fair. The rule (`references/architecture.md` §Round trips) is unchanged in 1.1.1 and the case scored 1 in 1.1.0, so it is treated as model variance. If it fails again, state in §Round trips that the refreshed data is returned even when some rows fail.
- Mean delta went from +0.53 (1.1.0) to +0.44, mostly because `critical-01-public-function` and `critical-06-res-null` now pass without the plugin as well. Neither rule changed in 1.1.1.
