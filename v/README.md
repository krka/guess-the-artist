# Versioned Assets Directory

This directory contains versioned copies of static assets (CSS, JS) based on git commit hashes.

## Structure

```
v/
  abc123/          <- git commit hash
    src/
      css/
        styles.css
      js/
        *.js
  def456/          <- another version
    src/
      ...
```

## Purpose

- **Cache busting**: Each deployment creates a new hash-based directory
- **No stale files**: Browser always loads matching CSS/JS for current HTML
- **Rollback safe**: Old versions remain available for a few deployments

## Deployment Workflow

### 1. Development Mode (always)

In the **master branch**, HTML files always point to `src/` directly:
```html
<link rel="stylesheet" href="src/css/styles.css">
<script src="src/js/game.js"></script>
```

Edit files in `src/` and test locally. Your dev environment is **never mutated**.

### 2. Deploy to GitHub Pages

```bash
make deploy
```

This:
- Copies all files to `gh-pages/` worktree
- Creates `v/$HASH/` directory in gh-pages
- Copies `src/` to `v/$HASH/src/` in gh-pages
- Updates HTML to reference `v/$HASH/src/` in gh-pages
- Keeps last 3 versions in gh-pages, deletes older ones
- Commits and pushes gh-pages branch

**All transformations happen in the `gh-pages/` worktree.** The master branch stays clean for development.

## Cleanup

The deploy script automatically keeps only the last 3 versions to avoid bloating the repository.
