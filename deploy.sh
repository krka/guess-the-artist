#!/bin/bash

# Deploy script with commit-hash based versioning
# Usage: ./deploy.sh

set -e  # Exit on error

echo "🚀 Starting deployment..."

# Check if git working directory is clean
if [[ -n $(git status --porcelain) ]]; then
    echo "❌ Error: Git working directory is not clean. Please commit or stash changes."
    git status --short
    exit 1
fi

# Get current commit hash (short version)
HASH=$(git rev-parse --short HEAD)
echo "📝 Commit hash: $HASH"

# Create versioned directory
VERSION_DIR="v/$HASH"
mkdir -p "$VERSION_DIR"

# Copy assets to versioned directory
echo "📦 Copying assets to $VERSION_DIR..."
cp -r src "$VERSION_DIR/"

# Create deployment HTML files with versioned paths
echo "🔧 Generating deployment HTML files..."

# Function to update HTML file with versioned paths
update_html() {
    local file=$1
    local output=$2

    sed -e "s|src/css/|$VERSION_DIR/src/css/|g" \
        -e "s|src/js/|$VERSION_DIR/src/js/|g" \
        "$file" > "$output"

    echo "  ✓ Generated $output"
}

# Update all HTML files
update_html "index.html" "index.html.tmp"
update_html "game.html" "game.html.tmp"
update_html "debug.html" "debug.html.tmp"

# Move tmp files to final location
mv index.html.tmp index.html
mv game.html.tmp game.html
mv debug.html.tmp debug.html

# Clean up old version directories (keep last 3)
echo "🧹 Cleaning up old versions..."
cd v
ls -t | tail -n +4 | xargs -r rm -rf
cd ..

echo "✅ Deployment prepared!"
echo ""
echo "Next steps:"
echo "  1. Test locally: open index.html in browser"
echo "  2. Commit the changes: git add -A && git commit -m 'Deploy $HASH'"
echo "  3. Push to GitHub: git push origin master"
echo ""
echo "📁 Current versions in v/:"
ls -lh v/
