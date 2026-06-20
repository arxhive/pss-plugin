#!/usr/bin/env bash
#
# /pss skill helper.
#
# Pushes the current Claude Code session to the PSS portal. The pss CLI
# auto-detects the active transcript by encoding the current working directory
# to the ~/.claude/projects/<encoded-cwd>/ directory and selecting the newest
# *.jsonl file, then parses it to the neutral manifest and uploads it.
#
# Usage: pss-push.sh [--project <slug>] [--name <name>] [--public]

set -euo pipefail

if ! command -v pss >/dev/null 2>&1; then
  echo "error: the 'pss' CLI is not on PATH. Build and link it first:" >&2
  echo "  pnpm --filter @pss/cli build && pnpm --filter @pss/cli link --global" >&2
  exit 127
fi

# The CLI auto-detects the Claude Code agent and transcript from the cwd.
# shellcheck disable=SC2086
exec pss push --agent claude-code ${*}
