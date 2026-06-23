#!/bin/sh
# pss CLI installer.
#
# Downloads the prebuilt single-file `pss` CLI from GitHub Releases and installs
# it onto your PATH. The CLI is a bundled Node.js program, so Node.js 18+ must be
# installed (it is not embedded).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/arxhive/pss-plugin/main/install.sh | sh
#
# Environment overrides:
#   PSS_INSTALL_DIR   where to install (default: $HOME/.local/bin)
#   PSS_VERSION       release tag to install (default: latest)
#   PSS_DOWNLOAD_URL  full URL to fetch the binary from (bypasses REPO/VERSION)
set -eu

REPO="arxhive/pss-plugin"
REMOTE_ASSET="pss.cjs" # release asset name (a self-contained CommonJS bundle)
CMD="pss"              # installed command name
INSTALL_DIR="${PSS_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${PSS_VERSION:-latest}"

err() { printf 'pss-install: error: %s\n' "$1" >&2; exit 1; }
info() { printf 'pss-install: %s\n' "$1" >&2; }

# The bundled CLI runs on Node; fail early with a clear message if it is missing.
command -v node >/dev/null 2>&1 || err "Node.js is required but was not found on PATH. Install Node 18+ and re-run."

if command -v curl >/dev/null 2>&1; then
  download() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  download() { wget -qO "$2" "$1"; }
else
  err "neither curl nor wget is available."
fi

if [ -n "${PSS_DOWNLOAD_URL:-}" ]; then
  URL="$PSS_DOWNLOAD_URL"
elif [ "$VERSION" = "latest" ]; then
  URL="https://github.com/$REPO/releases/latest/download/$REMOTE_ASSET"
else
  URL="https://github.com/$REPO/releases/download/$VERSION/$REMOTE_ASSET"
fi

info "downloading pss ($VERSION) from $URL"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
download "$URL" "$tmp" || err "download failed from $URL"

# Guard against a 404 HTML page or truncated download being installed as the CLI.
head -n 1 "$tmp" | grep -q "env node" || err "downloaded file does not look like the pss CLI (wrong URL or no release published yet)."

mkdir -p "$INSTALL_DIR"
chmod +x "$tmp"
mv "$tmp" "$INSTALL_DIR/$CMD"
trap - EXIT

"$INSTALL_DIR/$CMD" --version >/dev/null 2>&1 || err "installed pss failed to run (is Node 18+ on PATH?)."
info "installed pss $("$INSTALL_DIR/$CMD" --version 2>/dev/null) to $INSTALL_DIR/$CMD"

# Tell the user how to reach it if the install dir is not already on PATH.
case ":$PATH:" in
  *":$INSTALL_DIR:"*)
    info "run: pss --help"
    ;;
  *)
    info "$INSTALL_DIR is not on your PATH. Add it and restart your shell:"
    info "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.zshrc   # or ~/.bashrc"
    ;;
esac
