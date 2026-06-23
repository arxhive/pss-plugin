# pss - Claude Code plugin

Adds the `/pss` skill to Claude Code: capture the current session and upload it to
the [PSS portal](https://github.com/arxhive/pss) ("GitHub for agent sessions"),
where it can be browsed, cloned, or forked into any supported agent (Claude Code,
Codex, Cursor, OpenCode).

## Install

From inside Claude Code:

```text
/plugin marketplace add arxhive/pss-plugin
/plugin install pss@pss
```

The first command registers this repo as a plugin marketplace; the second installs
the `pss` plugin from it. Restart Claude Code (or start a new session) so the skill
is discovered.

## Prerequisite: the `pss` CLI

The skill shells out to the `pss` CLI, which must be on your `PATH`. Install the
prebuilt binary (requires Node.js 18+):

```bash
curl -fsSL https://raw.githubusercontent.com/arxhive/pss-plugin/main/install.sh | sh
```

This installs a single self-contained `pss` to `~/.local/bin` and prints how to add
that directory to `PATH` if needed. The CLI targets the hosted portal at
`https://pss.cat` by default. Set `PSS_ENDPOINT` to point it at a different portal.

<details>
<summary>Build from source instead (for CLI development)</summary>

```bash
pnpm install
pnpm --filter @pss/core build
pnpm --filter @pss/cli build
cd packages/cli && pnpm link --global   # needs `pnpm setup` once, then a new shell
```

</details>

## Usage

In any Claude Code session, run:

```text
/pss
```

Optional flags are forwarded to the CLI:

```text
/pss --name "bug investigation" --public
/pss --project my-service
```

The skill prints a shareable reference (`<project-slug>/<public-id>`) and the portal
URL. A teammate resumes it with `pss fork <reference> --agent <name>`, or one-click
"Fork" from the portal when it runs on their machine.
