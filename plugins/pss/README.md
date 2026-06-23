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

The skill shells out to the `pss` CLI, which must be on your `PATH`. Build and link
it from a checkout of this repo ([arxhive/pss-plugin](https://github.com/arxhive/pss-plugin)):

```bash
pnpm install
pnpm --filter @pss/cli build
pnpm --filter @pss/cli link --global
```

The CLI targets the hosted portal at `https://pss.cat` by default. Set
`PSS_ENDPOINT` to point it at a different portal.

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
