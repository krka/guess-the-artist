# Guess the Artist

A web-based social music guessing game inspired by the Swedish gameshow "Doobidoo".

## About

Two players team up to identify music artists. One player sings, the other guesses. Correct guesses earn points, and roles swap after each success. Race against the clock in 60-second rounds!

## Features

- **Purely frontend** - No backend required, runs entirely in your browser
- **OAuth PKCE** - Secure authentication without client secrets
- **Personalized artists** - Fetch your top artists from Spotify
- **Multiple modes** - View artists from different time ranges or by genre

## Quick Start

### 1. Register Your Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create app"
3. Fill in the details:
   - **App name**: guess-the-artist (or whatever you prefer)
   - **App description**: Music guessing game
   - **Redirect URIs**: Add all three:
     - `http://localhost:8000`
     - `http://127.0.0.1:8000`
     - `https://krka.github.io/guess-the-artist/`
   - **API**: Select "Web API"
4. Click "Save"
5. Copy your **Client ID** (you won't need the Client Secret!)

### 2. Configure the App

The Client ID is already configured in `src/js/config.js`. If you're forking this repo, you'll need to:
1. Create your own Spotify app (step 1 above)
2. Update the Client ID in `src/js/config.js`

### 3. Run the App

Since this is a purely frontend app, you just need a simple HTTP server:

**Option 1: Using Python (most common)**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

**Option 2: Using Node.js**
```bash
npx http-server -p 8000
```

**Option 3: Using PHP**
```bash
php -S localhost:8000
```

Then open your browser to: **http://localhost:8000**

### 4. Login and Test

1. Click "Login with Spotify"
2. Authorize the app
3. Select your preferred artist source and time range
4. Click "Fetch Artists" to see your personalized music!

## Deployment

Since this is a static site, you can deploy it anywhere:

- **GitHub Pages**: Push to a `gh-pages` branch
- **Netlify**: Drag and drop your folder
- **Vercel**: Connect your git repo

**Important**: The app automatically adapts to any domain using `window.location.origin`. Just make sure to add your production URL to your Spotify app's redirect URIs.

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Authentication**: OAuth 2.0 with PKCE (no backend needed!)
- **API**: Spotify Web API
- **Styling**: Custom CSS with Spotify theme

## Current Status

**Phase 1 Complete** - Basic Spotify integration with OAuth and artist display

See [PLAN.md](PLAN.md) for the complete roadmap and upcoming features.

## Development

No build process required! Just edit the files and refresh your browser.

**File structure:**
```
src/
├── js/
│   ├── config.js          # Spotify API configuration
│   ├── spotify-client.js  # OAuth + API client
│   └── main.js           # UI logic
└── css/
    └── styles.css        # Styling
```

## Security Notes

- Client ID is safe to expose in frontend code (it's public by design)
- PKCE flow doesn't require a client secret
- Access tokens are stored in memory only (not localStorage)
- Refresh tokens are stored in localStorage for session persistence

## License

MIT
