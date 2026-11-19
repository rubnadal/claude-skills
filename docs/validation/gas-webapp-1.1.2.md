# Validation report — gas-webapp 1.1.2

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

- Overall score (with plugin): **1** · cases passed: 17/17 · mean delta vs. no plugin: **0.5588235294117647**
- Claude Code 2.1.328 · cost 8.142383799999998 USD · 1806 s

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
| case-17-save-all-round-trips | 1 | 1 |
| critical-01-public-function | 1 | 0.5 |
| critical-02-identity-model | 1 | 1 |
| critical-03-boolean-read | 1 | 1 |
| critical-04-bulk-insert | 1 | 0.5 |
| critical-05-client-sandbox | 1 | 1 |
| critical-06-res-null | 1 | 0 |
| critical-15-activation-positive | 1 | 1 |
| critical-16-activation-negative | 1 | 0 |

- Result: **PASS**
  - warning: case-09-dates-shift: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: case-10-stale-after-edit: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: case-11-skipping-push: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: case-13-email-link-get: delta 0 (passes without the plugin, so it does not measure the skill)
  - warning: critical-06-res-null: delta 0 (passes without the plugin, so it does not measure the skill)

## Notes

- 1.1.2 only moves the repository from GitLab to GitHub: the URL in `SKILL.md` ("Keeping this skill current"), `plugin.json`, `marketplace.json` and the READMEs. No rule changed and no eval case was added; the gate was run in full because `SKILL.md` changed.
- Passed on the first run. Compared with 1.1.1, `case-17-save-all-round-trips` is back at 1 (its 0.5 in 1.1.1 was model variance), and the mean delta is back to +0.56 because `critical-01-public-function` and `critical-04-bulk-insert` failed once without the plugin. The difference between runs comes from the model, not from the skill text.
