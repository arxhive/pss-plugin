---
name: "pss"
description: "Capture the current Claude Code session and upload it to the PSS portal ('GitHub for agent sessions') so it can be browsed, shared, cloned, or forked into any supported agent (Claude Code, Codex, Cursor, OpenCode). Use when the user wants to hand off, delegate, back up, or publish the current session."
argument-hint: "[--project <slug>] [--name <name>] [--public]"
user-invocable: true
---

# /pss - share this agent session

This skill captures the **current Claude Code session** and pushes it to the PSS
portal ("GitHub for agent sessions"). Capture is always explicit - there is no
background sync.

## What it does

1. Resolves the active transcript for the current working directory. Claude Code
   stores transcripts at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`,
   where `<encoded-cwd>` is the absolute working directory with `/`, `\`, and `.`
   replaced by `-`.
2. Invokes the `pss` CLI, which parses the transcript into the agent-neutral
   manifest, derives the project slug from the git remote origin (or directory
   name), and uploads it.
3. Prints the shareable reference `<project-slug>/<public-id>` and the portal URL.

## Prerequisites

- The `pss` CLI is installed and on `PATH`. From a checkout of the pss repo:
  `pnpm --filter @pss/cli build && pnpm --filter @pss/cli link --global`.
- `PSS_ENDPOINT` is set if the portal is not at `http://localhost:3000`.

## How to run

Run the bundled helper script from the current working directory, forwarding any
flags. `${CLAUDE_PLUGIN_ROOT}` is the absolute path to this installed plugin:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/pss/pss-push.sh" "$ARGUMENTS"
```

The script lets the CLI auto-detect the Claude Code transcript via the encoded
cwd. If no active transcript is found, the CLI exits with code 5 and a clear
"no session found" message rather than uploading an empty session.

## Output

On success the skill reports the session reference and URL, for example:

```
Pushed session github.com/arxhive/pss/Ab12Cd34Ef56Gh78Ij90Kl
URL: http://localhost:3000/github.com/arxhive/pss/Ab12Cd34Ef56Gh78Ij90Kl
```

Share that reference; a teammate runs `pss fork <reference> --agent <name>` to
fork it and open it in their agent (native resume for Claude Code, Codex, and
OpenCode; an honest `handoff.md` bootstrap prompt for Cursor). From the portal,
the "Fork" button does the same in one click when it runs on the same machine.
