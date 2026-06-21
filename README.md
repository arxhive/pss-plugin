# pss-plugin

The public home of the [PSS](https://github.com/arxhive/pss) ("GitHub for agent
sessions") **Claude Code plugin** and the **`pss` CLI**. Kept separate from the PSS
web monorepo so installing the plugin or building the CLI clones only this small
repo.

- `/pss` Claude Code skill - capture the current session and upload it to the PSS
  portal, where it can be browsed, cloned, or forked into any supported agent
  (Claude Code, Codex, Cursor, OpenCode).
- `pss` CLI - push, clone, fork, and manage sessions from the terminal.

## Install the Claude Code plugin

From inside Claude Code:

```text
/plugin marketplace add arxhive/pss-plugin
/plugin install pss@pss
```

`/plugin marketplace add` registers this repo as a plugin marketplace; `/plugin
install` installs the `pss` plugin from it. Start a new Claude Code session so the
skill is discovered, then run `/pss` in any session.

## Install the `pss` CLI

The plugin (and direct terminal use) needs the `pss` CLI on your `PATH`. Build and
link it from a checkout of this repo:

```bash
pnpm install
pnpm --filter @pss/cli build
pnpm --filter @pss/cli link --global
```

Point the CLI at your portal with `PSS_ENDPOINT` if it is not at
`http://localhost:3000`.

## Sign in to the CLI

The portal is gated by GitHub authentication, so stored and private sessions
require a token. Authenticated commands (`push`, and `fork`/`clone`/`list` on
private sessions) send a portal-issued personal access token as an
`Authorization: Bearer <token>` header; read-only access to public sessions still
works anonymously.

1. **Create a token in the portal.** Sign in to the portal with GitHub, open the
   token page (`/tokens`), enter a label (for example `laptop`), and click
   **Create token**. The raw token value is shown only once - copy it before
   leaving the page.
2. **Store it in the CLI.** Run `pss auth login` and paste the token when
   prompted:

   ```bash
   pss auth login
   # Paste your portal token: ****
   # Logged in as <your-github-login>
   ```

   Non-interactive shells (CI, scripts) can pass it directly instead of being
   prompted:

   ```bash
   pss auth login --token <token>
   # or, without storing it on disk:
   PSS_TOKEN=<token> pss push
   ```

3. **Verify and manage the session.**

   ```bash
   pss auth status   # show the GitHub login the stored token resolves to
   pss auth logout   # remove the locally stored token
   ```

The CLI resolves the token in this order, first match wins: the `--token` flag,
the `PSS_TOKEN` environment variable, then the token stored by `pss auth login`.
`pss auth login` validates the token against the portal before saving it to
`~/.config/pss/config.json` (override the directory with `XDG_CONFIG_HOME`), and
never prints the stored token back. `pss auth logout` only removes the local
copy - revoke a token server-side from the portal token page.

## CLI usage

```bash
pss push [--agent <name>] [--project <slug>] [--name <name>] [--public]
pss clone <project-slug>/<public-id> --agent <name> [--into <dir>]
pss list  [<project-slug>] [--archived]
pss fork  <project-slug>/<public-id> [--name <name>] [--agent <name>]  # with --agent: clone the fork and open it
pss rename     <project-slug>/<public-id> <new-name>
pss visibility <project-slug>/<public-id> <private|public>
pss archive    <project-slug>/<public-id>
pss rm <project-slug>/<public-id>
```

## Layout

```text
.claude-plugin/marketplace.json   # the marketplace catalog (one plugin: pss)
plugins/pss/                      # the Claude Code plugin
  .claude-plugin/plugin.json
  skills/pss/SKILL.md
  skills/pss/pss-push.sh
packages/core/                    # agent-neutral session manifest + adapters (@pss/core)
packages/cli/                     # the pss CLI (@pss/cli)
```

`@pss/core` is the single source of truth for the session manifest format and the
per-agent adapters; the PSS web app consumes the same package. See
[plugins/pss/README.md](plugins/pss/README.md) for plugin usage details.

## Development

```bash
pnpm install
pnpm -w build
pnpm -w lint
pnpm -w test
```
