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

### 1. Development Mode (default)

HTML files point to `src/` directly:
```html
<link rel="stylesheet" href="src/css/styles.css">
<script src="src/js/game.js"></script>
```

Edit files in `src/` and test locally.

### 2. Deploy

```bash
./deploy.sh
```

This:
- Checks git is clean
- Creates `v/$HASH/` directory
- Copies `src/` to `v/$HASH/src/`
- Updates HTML to reference `v/$HASH/src/`
- Keeps last 3 versions, deletes older ones

Then commit and push:
```bash
git add -A
git commit -m "Deploy $HASH"
git push origin master
```

### 3. Back to Development

```bash
./dev.sh
```

Reverts HTML files to point to `src/` for continued development.

## Cleanup

The deploy script automatically keeps only the last 3 versions to avoid bloating the repository.
