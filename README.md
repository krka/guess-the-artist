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

Run locally with HTTPS (required by Spotify OAuth):
```bash
make run-local
```

Visit https://127.0.0.1:8443

Deploy to GitHub Pages:
```bash
make deploy
```

## Tech Stack

- Vanilla JavaScript (ES6+)
- Spotify Web API with OAuth 2.0 PKCE
- Pure CSS (Spotify-themed)
- GitHub Pages deployment
