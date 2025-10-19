# Guess the Artist

A web-based music guessing game inspired by the Swedish gameshow "Doobidoo" segment "Sista minuten" (Last minute).

## Play Now

**➡️ [Play the game here!](https://krka.github.io/guess-the-artist/)**

## How to Play

1. Log in with your Spotify account
2. Create teams with 2+ players each
3. Select artist sources (your playlists, top charts, decades, etc.)
4. Configure game settings (round duration, number of artists)
5. Take turns guessing artists from their pictures!

## Features

- **15+ Artist Sources**: Personal playlists, My Top Artists, Global/Country Top 50 charts, decades (1960s-2020s), related artists
- **Team-based Gameplay**: Customizable teams with 2+ players
- **Live Timer**: Visual countdown with progress bar
- **Stats Tracking**: Streaks, fastest guesses, and final leaderboard
- **Pure Frontend**: No backend needed, uses Spotify OAuth PKCE

## Development

### Local Development

Run locally with HTTPS (required by Spotify OAuth):
```bash
make run-local
```

Visit https://127.0.0.1:8443

### Deployment

The project uses commit-hash-based versioning to avoid stale file caching issues:

1. **Make your changes** in `src/` and test locally
2. **Commit your changes** to master:
   ```bash
   git add <files>
   git commit -m "Your message"
   git push origin master
   ```
3. **Deploy to GitHub Pages**:
   ```bash
   make deploy
   ```
   This automatically:
   - Copies files to `gh-pages/` worktree
   - Creates versioned assets in `v/$HASH/`
   - Updates HTML to reference versioned paths
   - Commits and pushes to gh-pages branch

**Your dev environment stays clean!** All transformations happen in the `gh-pages/` worktree.

See `v/README.md` for details on the versioning system.

## Tech Stack

- Vanilla JavaScript (ES6+)
- Spotify Web API with OAuth 2.0 PKCE
- Pure CSS (Spotify-themed)
- GitHub Pages deployment
