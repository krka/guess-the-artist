#!/bin/bash

# Revert to development mode (undo deploy.sh changes)
# Usage: ./dev.sh

set -e

echo "🔧 Reverting to development mode..."

# Function to revert HTML file to use src/ directly
revert_html() {
    local file=$1

    sed -e 's|v/[a-f0-9]\+/src/css/|src/css/|g' \
        -e 's|v/[a-f0-9]\+/src/js/|src/js/|g' \
        "$file" > "$file.tmp"

    mv "$file.tmp" "$file"
    echo "  ✓ Reverted $file"
}

# Revert all HTML files
revert_html "index.html"
revert_html "game.html"
revert_html "debug.html"

echo "✅ Development mode restored!"
echo ""
echo "HTML files now point to src/ for local development."
echo "Run ./deploy.sh when ready to deploy."
