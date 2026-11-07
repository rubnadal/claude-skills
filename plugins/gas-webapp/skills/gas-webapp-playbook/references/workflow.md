# Workflow

How the source projects were built without serious regressions. The user's explicit instructions always win over this file.

## Per-project options

These choices differ between projects. Ask once at the start, record the answers in the project's `CLAUDE.md` (`templates/CLAUDE.template.md`), and never carry them over from another project.

| Decision | Options | When to choose |
|---|---|---|
| Isolation | (a) one git worktree per feature · (b) a branch in the main checkout, or `main` directly | (a) when several features run in parallel or the main checkout must stay clean; costs `.clasp.json` copies and push discipline (§Worktrees and subagents). (b) for a solo, sequential project. |
| Who commits | (a) the assistant, one commit per task · (b) the user, unless they authorise a full implementation | (a) when the user reviews by branch; (b) when the user wants to review every diff before it enters history. |
| Who runs `git push` | (a) the assistant, with explicit confirmation for each push · (b) always the user | Never assume (a); agreeing a merge or a plan does not authorise a push. |
| Commit message language | the project's language · English | Follow the existing history; ask on a new repository. |
| Notes and backlog updates | at the close of each feature · only on request | Default to closing-time updates when the project keeps a backlog/history pair (§Living documentation). |
| Script behind `.clasp.json` | test script · production script | Production when real users are already on it; otherwise test (§External actions). |
| Client template-literal style | allow 1–2 levels · ban backticks | `references/client-sandbox.md §Syntax`. |
| Where tests live | Node only · Node plus guarded in-editor tests | `references/testing.md` (Node only for new projects). |

## Starting a project

Agree before writing code: identity model (A or B, `references/security-and-api.md §Identity`), container binding, languages, the end user's technical level (`references/architecture.md §Persona`), whether the `.clasp.json` script is test or production, and the options above.

Then build in this order, one feature per branch:
1. Manifest with V8 and explicit `oauthScopes`, `.claspignore`, and the public-surface test, all in the first commit.
2. Data layer + auth + setup.
3. Pure logic with tests.
4. Public functions.
5. Layout, i18n and one screen end to end.
6. The rest of the screens.

## Feature cycle

1. **Design** with the user → a written spec.
2. **Plan** with small tasks and the exact code of each step.
3. **Branch** (or worktree) for the feature.
4. **Implement task by task**, each with a spec-compliance review and a separate quality review. The second finds what the first cannot (interaction between pieces, lifecycle, CSS cascade); do not skip it for "plain CRUD".
5. **Push** with `clasp push --force` from the branch's directory (§External actions).
6. **User QA** with a written script of exact steps and expected results. The QA task is not closed without the user's explicit confirmation.
7. **Final review of the whole branch** before merging.
8. **Close:** move the backlog item to history, merge, clean up.

Per-task review, branch review and real QA consistently found different bugs; none replaces another.

**The final review must verify, not just read the diff:**
- Trace each data path end to end (`doGet` → context → client logic); an empty placeholder on the server silently kills correct client logic.
- Check every declared security invariant ("only the deployer installs", "no live credentials in a template", "irreversible") against all entry points, including files the plan never touched.
- Find all consumers of every shared class, component or function that changed.
- Check each branch of reused validators (a generic `return {ok:true}` path can accept what the new code assumed was rejected).
- Every new public function passes `references/security-and-api.md §Checklist for a new public function` and the surface test stays green.

**Sister tasks.** When two tasks apply the same pattern to near-identical screens and the first went through a round of fixes, pass those fixes to the second with the exact code, and say which do not apply.

**Repeated patterns.** When a bug turns out to be a pattern repeated in N places, ask whether to fix only the reported one or all; recommend "all" when the change is mechanical.

## Security hardening

To harden an existing app, work in two phases and never switch the identity model first: under `USER_DEPLOYING` every unguarded public function runs with the deployer's rights.
1. **Surface:** rename internals to `_`, guard what stays public, make setup non-re-runnable, add the surface, setup and guard tests (`references/security-and-api.md`).
2. **Identity model:** switch to model B.

QA each phase from the browser console as a low-privilege user: the installer answers `ALREADY_INSTALLED`, an internal function is "not a function", a guarded function answers with a role error.

## Worktrees and subagents

Mechanics of clasp in worktrees (`.clasp.json` copy, `.claspignore`, "A file with this name already exists"): `references/gotchas.md` A3.

**Worktree hygiene:**
- Before creating a worktree from a remote base, check `git log origin/main..HEAD --oneline`: a tool that starts from `origin/main` silently drops unpushed local commits. Push first (with permission) or create it from the local HEAD with `git worktree add`.
- A plan and its tracking file then exist twice (main checkout and worktree). Edit and commit the worktree copy; if the plan changes mid-way, sync it before dispatching the next task.
- Before merging, check `git status` in the main checkout; stash or commit changes to files the branch also touches.
- A worktree you re-entered may not be removable by the tool that created it: keep it on exit, then `git worktree remove <path>` and `git branch -d <branch>` after merging.

**Subagents:**
- Only when the user asked for them or the agreed workflow includes them.
- Every brief starts with `cd` to the exact path and a check of `git branch --show-current`, stopping on mismatch; every reviewer starts by verifying branch and HEAD.
- Hooks and reminders of the main context do not reach subagents: put them in the brief.
- Give implementers the exact code and reviewers a concrete checklist.
- Verify what was done with `git log` / `git diff`, not with the report. If a subagent went beyond its brief, tell the user plainly and let them decide.
- Subagents never run `clasp push` (§External actions).

## QA and debugging

- **When a QA symptom fits no hypothesis, stop reading code and ask for the exact click sequence** ("what did you see right before and after each action").
- **Rule out stale inputs first:** regenerate the link or email; compare deployed and local code with `clasp pull` into a temporary folder (copy `.clasp.json` there, `rootDir` pointing inside it); check that `/exec` was redeployed (`references/gotchas.md` D4). Close as a false positive when that explains it.
- **When a value "does not persist", inspect the real cell** (type, format, `=ISTEXT()`), or ask for the spreadsheet downloaded as `.xlsx` and read it with `openpyxl`, before changing code. Hand-copied data that contradicts itself between turns is the signal.
- **Verify in a browser yourself** when a browser tool is available. The sandbox iframe is cross-origin: DOM reads and JS execution do not reach it, only pixel interaction (click, keyboard, screenshot) works. Ask the user for the URL.
- **Real server data:** a diagnostic function run from the editor, then read the Executions view. Keep diagnostic scripts of unreproduced bugs in case they come back.
- **Temporary diagnostics:** add `Logger.log` lines carrying a unique searchable tag (`[DIAG-X]`) in a commit of their own, push, reproduce on the deployment, read Executions, then revert that commit. Set a rollback tag (`git tag pre-<change>`) before a risky cross-cutting change.
- **Mobile screens are accepted only after the user validates them on the real device, through a deployment:** throwaway branch → push to the test script → a separate deployment → validate → undeploy, delete the branch, push `main` back. Catch JS and layout errors first with headless screenshots of a local preview (`references/testing.md §Client tests`); headless rendering of `/exec` is often blank, so check a deployment with `curl -sL <url>` and grep for text of the view (behind a Google sign-in you will likely get the sign-in page instead).

## Designing with the user

- Ask requirements in free text, one topic per turn, each with a reasoned proposal the user can accept or correct; keep multiple choice for small, bounded decisions.
- When the project's normative text already describes a behaviour, that is the default; if you propose otherwise, say so before the user chooses.
- On "go back", restart the question from scratch instead of reconciling earlier answers.
- Before porting a pattern from another project, inventory every entry point (`onOpen`, `doGet`, `showSidebar`, `showModalDialog`, menus) and read each file before discarding it.
- When asked to pause between tasks, really stop after each one, with reviews done and the commit saved.
- Do not widen a solved problem: once the real cause is fixed, do not open new paths the user did not ask for; if a remark seems to open one, ask whether it is needed now or an idea for later.

## External actions

- **`git push`** only when the user asked for that specific push (or per the recorded option).
- **`clasp push` changes the live app** for everyone using `/dev` (and the saved code every new version is built from). The main agent does it, from the verified directory; never a subagent.
- **Test or production script.** Ask once and record it. Option: on a test script with no real users, allow destructive operations without asking and do not propose parallel environments; choose this only when the user confirms nobody depends on its data. On a production script every push and every destructive operation needs confirmation. Either way there is no isolated test environment: `/dev` serves the last pushed branch, whoever pushed it.
- **Before every push:**
  ```bash
  pwd && git branch --show-current && cat .clasp.json && clasp show-authorized-user
  # run the project's test suite
  clasp push --force
  ```
- **`/dev` vs versioned deployment.** `/dev` serves HEAD to editors only. `/exec` serves a pinned version: publish with `clasp deploy -i <deploymentId> -d "<label>"` (same URL) and check it before asking anyone to test (`references/gotchas.md` D4, D5).

## Deployment guides

Guides for whoever deploys a copy (often non-technical):
- State "Execute as" and "Who has access" explicitly, with the labels in every UI language the deployer may see; the dialog defaults "Who has access" to "Only myself". Under `ANYONE_ANONYMOUS` say explicitly not to pick "Anyone with a Google account".
- Explain the unverified-app screen ("Google hasn't verified this app" → Advanced → go to the project).
- Under model B, say never to share the spreadsheet.
- Require initialising right away from the deploying account, before sharing the URL (`references/security-and-api.md §Install and reset`).
- For updates: say when all files change (partial copies fail with `ReferenceError`); re-consent new scopes by running a function from the editor as the deployer; in Manage deployments → Edit, check both settings and publish a new version; run setup in repair mode to add missing sheets and columns.

## Living documentation

- A short `CLAUDE.md` with rules and pointers; detail in files loaded when relevant (a `CLAUDE.md` inside the client folder, project-local skills for migrations and gotchas).
- An active backlog and a history file; closing an item moves it from one to the other.
- Document every new gotcha when found: symptom, cause, rule.
- Non-blocking review findings become backlog items with their rationale; accepted risks become comments at the function, so reviewers do not re-raise them.
- Anything that must survive this machine is versioned: a git-ignored folder does not travel with the repository.
