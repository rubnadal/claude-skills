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

## SkillSpector findings reviewed (added 2026-11-19, after release)

The four MEDIUM findings were reviewed one by one against the skill text, which is unchanged since the `gas-webapp--v1.1.2` tag. All four come from SkillSpector's static pattern matching. Its own LLM review disagreed with each of them (`llm_review_outcome: disagreed`, tag `llm-unconfirmed`), and all four sit in reference documentation (`surface: docs`), not in an executable script. None is a real risk, so the skill text stays as it is. None was added to a baseline either: the gate's threshold already allows MEDIUM findings, and a baseline would hide them from future scans.

| Finding | Location | What matched | Why it is not a risk |
|---|---|---|---|
| `EA2` Autonomous Decision Making | `references/gotchas.md:365` (gotcha E5) | "without checking" | The phrase describes the *cause of a bug* ("`onOpen` ran migrations without checking `SETUP_COMPLETED`"), and the fix is to add that check. It tells the agent to check more, not to act without confirmation. LLM review: disagreed (0.97). |
| `E1` External Transmission | `references/testing.md:101` (§Static checks, icon names) | `https://api.iconify.design/` | A read-only query to a public API, made by a test the user writes in their own project, that checks whether icon names exist. It sends only icon names that are already public in the app's client code. No credentials, tokens or user data are involved, and the test is skipped when there is no network. LLM review: disagreed (0.93). |
| `E1` External Transmission | `references/workflow.md:90` (mobile screens) | `curl -sL <url>` | A GET request to the user's own deployment, made to check that the view renders. Nothing is sent: the output is only searched for text from the view. LLM review: disagreed (0.93). |
| `EA2` Autonomous Decision Making | `references/workflow.md:105` (test or production script) | "without asking" | The rule adds human confirmation. The agent asks the user once whether the script is for testing or production and records the answer. Destructive operations without asking are allowed only on a test script with no real users, and only when the user confirms that nobody depends on its data. On a production script, every push and every destructive operation needs confirmation. LLM review: disagreed (0.85). |
