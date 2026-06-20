# pss-plugin

The Claude Code plugin for [PSS](https://github.com/arxhive/pss) ("GitHub for agent
sessions"). This repo is a dedicated plugin marketplace so installing the plugin
clones only the plugin, not the whole PSS monorepo.

It bundles the `/pss` skill: capture the current Claude Code session and upload it
to the PSS portal, where it can be browsed, cloned, or forked into any supported
agent (Claude Code, Codex, Cursor, OpenCode).

## Install

From inside Claude Code:

```text
/plugin marketplace add arxhive/pss-plugin
/plugin install pss@pss
```

`/plugin marketplace add` registers this repo as a plugin marketplace; `/plugin
install` installs the `pss` plugin from it. Start a new Claude Code session so the
skill is discovered, then run `/pss` in any session.

## Prerequisite: the `pss` CLI

The skill shells out to the `pss` CLI, which must be on your `PATH`. Build and link
it from a checkout of the [PSS repo](https://github.com/arxhive/pss):

```bash
pnpm install
pnpm --filter @pss/cli build
pnpm --filter @pss/cli link --global
```

Point the CLI at your portal with `PSS_ENDPOINT` if it is not at
`http://localhost:3000`.

## Layout

```text
.claude-plugin/marketplace.json   # the marketplace catalog (one plugin: pss)
plugins/pss/                      # the plugin
  .claude-plugin/plugin.json
  skills/pss/SKILL.md
  skills/pss/pss-push.sh
  README.md
```

See [plugins/pss/README.md](plugins/pss/README.md) for usage details.
