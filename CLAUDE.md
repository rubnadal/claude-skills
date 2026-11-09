# claude-skills — instructions for Claude Code

This repo is a Claude Code plugin marketplace that publishes validated skills to the community. `docs/CONTRIBUTING.md` is the source of truth for what a lesson looks like, where content goes, skill limits, eval cases and the release gate: read it before changing a skill. This file adds only what an agent working here needs on top of it.

## Map

- `.claude-plugin/marketplace.json`: the marketplace; one entry per plugin.
- `plugins/<plugin>/`: `plugin.json` (version), `README.md`, `CHANGELOG.md`, `evals/`, `skills/<skill>/` (`SKILL.md`, `references/`, `templates/`).
- `docs/sources/`: where every rule comes from (per-project notes and `inventory.md` with rule ids `R-nn` and decisions `D-nn`). `docs/design/`: design decisions. `docs/validation/`: one report per released version, written by the gate.
- `tools/`: the release gate (`validate.sh`), its checkers and their tests.
- Not versioned: `docs/plans/` (working plans) and `plugins/*/evals/results/` (eval traces, may hold local paths).

## Working rules

- **Every change to a skill is a release.** Work on a branch, bump `version` in `plugin.json` (semver as in `docs/CONTRIBUTING.md`), add a `CHANGELOG.md` entry, run the full gate, commit, fast-forward `main`, then `claude plugin tag plugins/<plugin>`. Never edit a released tag.
- **Never push without explicit confirmation from the maintainer**, not even after a passing gate. Pushing `main` and pushing the tag are separate commands; both need the go-ahead.
- **Commit messages in Catalan** (repo convention), ending with the co-author line when an agent wrote the change.
- **Public repo: no private data.** No local paths, real email addresses, script ids, or institution and person names besides the author credit. The gate checks the patterns it can; review the rest yourself, including eval prompts and validation reports.
- **Do not touch the source projects.** Lessons are copied here and generalised; the projects keep their own local skills and `CLAUDE.md`.
- **Evidence over memory.** A new rule needs an origin (`docs/sources/`). A point that is not proven keeps a hedge in its wording. To remove a hedge, verify it first (for Apps Script, a throwaway script in a new spreadsheet), then record the result in the inventory decision (`D-nn`) and in the changelog.
- **Keep the three places in step.** A rule change touches the skill text, its inventory entry or decision, and, if behaviour changes, the eval case that covers it.

## The gate

```bash
bash tools/validate.sh <plugin> --structure-only   # seconds, free
bash tools/validate.sh <plugin>                    # ~25 min, ~7-10 USD: skillspector + evals with and without the plugin
node --test tools/test/*.test.mjs                  # pass the glob; a bare folder fails on recent Node
```

Ask the maintainer before running the full gate (it costs money). Run it in the background and wait for it to finish: the eval log stays almost empty until the end, which is not a hang.

## Pitfalls already met

- YAML frontmatter: a `description` containing `: ` is invalid; use ` — ` instead.
- Judge model: keep `sonnet` (`EVAL_JUDGE`); a smaller judge was too noisy.
- LLM graders judge behaviour, not wording: never require a specific function name, and never a criterion the prompt gives no basis for.
- One failed run out of two on a non-critical case is usually judge or model noise. Read the evidence in the eval JSON before changing a skill or a grader; change a grader only if the failure repeats across releases.
- A case with delta 0 passes without the plugin and does not measure the skill (see `docs/CONTRIBUTING.md`).
- A skill installed locally in a project with the same purpose wins over the plugin inside that project; test activation from a neutral folder.
- skillspector `AE1 static_parse_limit`: fix the content (simplify the construct it cannot parse) rather than adding it to the baseline. Any baseline entry needs a written `reason`.
