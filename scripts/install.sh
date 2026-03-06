#!/bin/sh
# Install getdot CLI binary.
# Usage: curl -fsSL https://getdot.ai/install.sh | sh
#
# Respects GETDOT_INSTALL_DIR (default: /usr/local/bin)

set -e

REPO="Snowboard-Software/getdot"
INSTALL_DIR="${GETDOT_INSTALL_DIR:-/usr/local/bin}"

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)  PLATFORM="darwin" ;;
  Linux)   PLATFORM="linux" ;;
  MINGW*|MSYS*|CYGWIN*)
    echo "On Windows, download the binary from GitHub Releases:"
    echo "  https://github.com/$REPO/releases/latest"
    exit 1
    ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

TARGET="${PLATFORM}-${ARCH}"

# Get latest release tag
LATEST=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | head -1 | cut -d'"' -f4)
if [ -z "$LATEST" ]; then
  echo "Failed to fetch latest release"
  exit 1
fi

VERSION="${LATEST#v}"
BINARY="getdot-${VERSION}-${TARGET}"
URL="https://github.com/$REPO/releases/download/${LATEST}/${BINARY}"

echo "Installing getdot ${VERSION} for ${TARGET}..."

# Download
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

if ! curl -fsSL -o "$TMP/getdot" "$URL"; then
  echo "Download failed. Check https://github.com/$REPO/releases for available binaries."
  exit 1
fi

chmod +x "$TMP/getdot"

# Install
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP/getdot" "$INSTALL_DIR/getdot"
else
  echo "Installing to $INSTALL_DIR (requires sudo)..."
  sudo mv "$TMP/getdot" "$INSTALL_DIR/getdot"
fi

echo "Installed getdot to $INSTALL_DIR/getdot"
echo ""
echo "Get started:"
echo "  getdot login"
echo "  getdot \"What were total sales last month?\""
