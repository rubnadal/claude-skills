# claude-skills

[Català](README.ca.md)

Validated [Claude Code](https://docs.claude.com/en/docs/claude-code) skills, distilled from real projects and distributed as a plugin marketplace. Every rule in a skill here comes from a real project, and inferred or unsettled points are marked as such; every release passes a validation gate whose report is kept in this repository.

## Plugins

| Plugin | Skill | What it covers | Version | Validation |
|---|---|---|---|---|
| [`gas-webapp`](plugins/gas-webapp/) | `gas-webapp-playbook` | Google Apps Script web apps with Google Sheets as the database: public server surface and identity models, data layer and cache, migrations and locks, the HtmlService client sandbox, Node testing, latency (round trips), clasp workflow, and gotchas indexed by symptom | 1.1.2 | [report](docs/validation/gas-webapp-1.1.2.md) · [acceptance (1.0.0)](docs/validation/gas-webapp-1.0.0-acceptance.md) |

The `gas-webapp` knowledge comes from three real apps by the author: an assessment platform, a booking system and a mobile-first app with an anonymous public landing page. Where each rule comes from is recorded in [`docs/sources/`](docs/sources/).

## Install

In Claude Code:

```
/plugin marketplace add rubnadal/claude-skills
/plugin install gas-webapp@claude-skills
```

Update later with `/plugin marketplace update claude-skills`.

The marketplace moved from GitLab to GitHub in November 2026 (1.1.2). If you added it from `gitlab.com/rnadalb/claude-skills`, run `/plugin marketplace remove claude-skills` and add it again with the command above.

**Manual install.** Skills follow the standard `SKILL.md` format, so you can also copy the skill folder by hand: copy `plugins/gas-webapp/skills/gas-webapp-playbook/` into `~/.claude/skills/` (or into the skills folder of another agent that supports the format). You then update it by copying again.

## How it is validated

Each release runs `tools/validate.sh <plugin>` locally before it is tagged. There is no CI: the evals need the author's Claude credentials and cost money. The gate has three layers, and all three must pass:

1. **Structure.** `claude plugin validate` on the marketplace and the plugin; skill limits (`SKILL.md` ≤ 150 lines, description ≤ 1,024 characters), relative links that resolve, and a scan for private data (local paths, email addresses, script ids).
2. **Security scan.** An agent follows a skill's instructions with the user's own permissions, so every release goes through [SkillSpector](https://github.com/NVIDIA/SkillSpector), NVIDIA's open-source scanner for agent skills. It looks for patterns such as prompt injection, data exfiltration or dangerous code, with static analysis plus LLM analyzers. The gate requires no HIGH or CRITICAL finding and a recommendation other than CAUTION. A clean scan is a check, not a guarantee: it finds known patterns, and the behaviour evals and human review complement it. gas-webapp 1.1.2: **recommendation SAFE, risk score 19 (LOW), four MEDIUM findings and none HIGH or CRITICAL**; the findings are listed in the [validation report](docs/validation/gas-webapp-1.1.2.md), and the report explains why each one is not a risk (none has been added to a baseline).
3. **Behaviour.** 17 `claude plugin eval` cases, each run twice with the plugin and twice without it, graded by an LLM against concrete criteria. Every critical case must score 1 with the plugin, the overall score must be at least 0.8, and the mean difference against no plugin must be positive. gas-webapp 1.1.2: overall score **1.00**, mean delta **+0.56**, critical cases **8/8 at 1**.

Not every case measures the skill: in 1.1.2, five cases also pass without the plugin (delta 0), besides the negative activation case, where 0 is expected. They are kept as regression checks, and the report lists them as warnings.

For 1.0.0 there was also a one-off **acceptance test**, run on the 0.9.0 pre-release build: two fresh agents, with and without the plugin, built the same small app from the same brief, and each result was checked against 15 rules of the skill. With the plugin: **15/15**; without it: **9/15** (it shared the spreadsheet with every user, used positional column indexes, trusted the `@` format against formula injection, among others).

Reports: [`docs/validation/`](docs/validation/).

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md): the format of a lesson, where each thing goes, the rules for a skill, and how to run the gate and tag a release.

## License

[MIT](LICENSE) © Rubén Nadal
