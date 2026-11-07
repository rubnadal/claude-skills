# Contributing

This repository is a Claude Code plugin marketplace (`claude-skills`). Each plugin lives in `plugins/<plugin>/` and is released only after it passes the validation gate in `tools/validate.sh`. Contributions are welcome as issues or merge requests on GitLab.

## What a lesson looks like

The skills here contain lessons, not tutorials: every rule cost a real bug in a real project. A new lesson starts as an inventory entry with four parts:

- **Symptom:** what you see, in the words you would search for (exact error text if there is one).
- **Cause:** why it happens.
- **Rule:** what to do instead, stated so that it can be checked in code review or by a test.
- **Origin:** the project(s) where it happened. For `gas-webapp` this is `confirmed n/3` (how many of the three source projects saw it). A rule seen once is still welcome; say so, and keep any doubt as a hedge in the wording.

Leave out domain logic (what the app is about) and anything you cannot generalise. If two projects disagree, do not pick one silently: write it as a decision with the options and when each applies.

## Where things go

| Content | Place |
|---|---|
| Where a rule comes from (inventory, per-project notes) | `docs/sources/` |
| When the skill triggers, what to read, the top rules | `skills/<skill>/SKILL.md` |
| Detail by area (security, architecture, client, testing, workflow) | `skills/<skill>/references/<area>.md` |
| Symptom → cause → fix entries | `skills/<skill>/references/gotchas.md` (add a row to its index) |
| Files the user copies into a project | `skills/<skill>/templates/` |
| An eval case that proves the lesson changes the agent's answer | `plugins/<plugin>/evals/<case>/` |
| Release notes | `plugins/<plugin>/CHANGELOG.md` |
| Design decisions | `docs/design/` |

## Rules for a skill

- `SKILL.md` has at most 150 lines; its frontmatter `description` has at most 1,024 characters and says *when* to use the skill (symptoms and tasks), not what it contains.
- References are read on demand, so each one starts with what it covers; link between files with relative paths that exist.
- No private data: no script ids, no real email addresses, no local paths, no institution or person names besides the author credit. `tools/check-skill.mjs` checks the patterns it can; review the rest yourself.
- No `README.md` or `CHANGELOG.md` inside the skill folder (they belong at the plugin root).
- Write in English, templates and their comments included.

## Eval cases

Each case is a folder in `plugins/<plugin>/evals/` with a `prompt.md` (frontmatter: `description`, `tags`, `runs`, `max_turns`, `allowed_tools`) and `graders/` (an LLM grader with concrete, checkable criteria and, where relevant, a `tool_used: Skill` grader). Cases named `critical-NN-<slug>` must score 1 with the plugin; the others count toward the overall score. A case that also passes without the plugin (delta 0) does not measure the skill: make it harder, or keep it only as a regression check and say so.

## Adding a plugin

1. Create `plugins/<plugin>/.claude-plugin/plugin.json` (`name`, `version`, `description`, `author`, `license`) and `plugins/<plugin>/skills/<skill>/SKILL.md`.
2. Add the plugin to `.claude-plugin/marketplace.json` with the same name and description.
3. Add `plugins/<plugin>/README.md`, `CHANGELOG.md` and `evals/` (include a positive and a negative activation case).
4. Add a row to the plugin table in `README.md` and `README.ca.md`.

## Validating and releasing

```bash
bash tools/validate.sh <plugin> --structure-only   # fast: manifests, skill limits, links, private data
bash tools/validate.sh <plugin>                    # full gate: + skillspector + evals
node --test tools/test/*.test.mjs                  # tests of the gate tools themselves
```

The full gate needs `claude` and `skillspector` installed and logged in, and it costs money: `EVAL_RUNS` (default 2), `EVAL_MAX_COST` (default 25 USD) and `EVAL_JUDGE` (judge model, default `sonnet`) control it. It passes when skillspector reports no HIGH/CRITICAL finding and no CAUTION recommendation, every critical eval scores 1, the overall score is at least 0.8 and the mean delta against no plugin is positive. On success it writes `docs/validation/<plugin>-<version>.md`. There is no CI: the gate is run locally before every release.

Use semver: patch for a new gotcha or a correction, minor for a new file or section, major for a rule that contradicts an earlier version. To release, bump `version` in `plugin.json`, add the `CHANGELOG.md` entry, run the full gate, commit, then tag:

```bash
claude plugin tag plugins/<plugin> --dry-run          # proposes <plugin>--v<version>
claude plugin tag plugins/<plugin> -m "<plugin> %s"   # creates the tag; push it explicitly
```
