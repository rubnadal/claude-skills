#!/usr/bin/env bash
# Porta de publicació d'un plugin. Ús: tools/validate.sh <plugin> [--structure-only]
# Variables: EVAL_RUNS (defecte 2), EVAL_MAX_COST (defecte 25), EVAL_JUDGE (model jutge, defecte sonnet)
set -uo pipefail
PLUGIN="${1:?usage: tools/validate.sh <plugin> [--structure-only]}"
MODE="${2:-full}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
P="$ROOT/plugins/$PLUGIN"
VERSION="$(node -p "require('$P/.claude-plugin/plugin.json').version")"
TMP="$(mktemp -d)"
fail=0

echo "== 1/3 Structure ($PLUGIN $VERSION)"
claude plugin validate "$ROOT" || fail=1
claude plugin validate "$P" || fail=1
for s in "$P"/skills/*/; do node "$ROOT/tools/check-skill.mjs" "$s" || fail=1; done
node "$ROOT/tools/check-skill.mjs" --private-only "$ROOT/docs/sources" "$ROOT/docs/validation" "$ROOT/docs/CONTRIBUTING.md" "$ROOT/CLAUDE.md" "$ROOT/README.md" "$ROOT/README.ca.md" "$P/evals" || fail=1
if [ "$fail" -ne 0 ]; then echo "Structure FAILED"; exit 1; fi
if [ "$MODE" = "--structure-only" ]; then echo "Structure OK"; exit 0; fi

echo "== 2/3 skillspector"
for s in "$P"/skills/*/; do
  name="$(basename "$s")"
  bl="$ROOT/tools/skillspector-baseline/$PLUGIN/$name.json"
  args=(); [ -f "$bl" ] && args=(--baseline "$bl")
  gate_bl=(); [ -f "$bl" ] && gate_bl=("$bl")
  SKILLSPECTOR_PROVIDER=claude_cli skillspector scan "$s" --format json --output "$TMP/ss-$name.json" ${args[@]+"${args[@]}"} > "$TMP/ss-$name.log" 2>&1
  if [ ! -f "$TMP/ss-$name.json" ]; then echo "skillspector crashed, see $TMP/ss-$name.log"; fail=1; continue; fi
  node "$ROOT/tools/skillspector-gate.mjs" "$TMP/ss-$name.json" ${gate_bl[@]+"${gate_bl[@]}"} > "$TMP/ss-$name.md" || fail=1
  cat "$TMP/ss-$name.md"
done

echo "== 3/3 evals"
claude plugin eval "$P" --trust-plugin --no-publish --judge-model "${EVAL_JUDGE:-sonnet}" --runs "${EVAL_RUNS:-2}" --threshold 0 \
  --max-cost-usd "${EVAL_MAX_COST:-25}" --json "$TMP/evals.json" > "$TMP/evals.log" 2>&1
node "$ROOT/tools/eval-gate.mjs" "$TMP/evals.json" > "$TMP/evals.md" || fail=1
cat "$TMP/evals.md"

if [ "$fail" -ne 0 ]; then echo "VALIDATION FAILED — details in $TMP"; exit 1; fi
OUT="$ROOT/docs/validation/$PLUGIN-$VERSION.md"
mkdir -p "$(dirname "$OUT")"
{
  echo "# Validation report — $PLUGIN $VERSION"
  echo
  echo "Date: $(date +%Y-%m-%d) · Claude Code $(claude --version | head -1) · skillspector $(skillspector --version | tail -1)"
  echo
  echo "## 1. Structure"
  echo
  echo "- \`claude plugin validate\` (marketplace and plugin), \`tools/check-skill.mjs\`: PASS"
  echo
  echo "## 2. skillspector (LLM analyzers via claude_cli)"
  for f in "$TMP"/ss-*.md; do echo; echo "### $(basename "$f" .md | sed 's/^ss-//')"; echo; cat "$f"; done
  echo
  echo "## 3. Evals (\`claude plugin eval\`, ${EVAL_RUNS:-2} runs per case, with/without plugin)"
  echo
  cat "$TMP/evals.md"
} > "$OUT"
echo "VALIDATION PASSED — report: $OUT"
