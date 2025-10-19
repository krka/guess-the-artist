# Guess the Artist - Game Plan

## Overview
Web-based social music guessing game inspired by the "Sista Minuten" segment from the Swedish gameshow "Doobidoo". Players work in teams to guess music artists based on sung songs within a time limit.

## Game Rules

### Basic Gameplay
- **Teams**: Two players per team, multiple teams can participate
- **Round Duration**: 60 seconds per team
- **Roles**: Singer and Guesser (roles swap after each correct guess)

### Flow
1. Singer sees artist picture and name
2. Singer performs a song by that artist
3. Guesser attempts to identify the artist
4. Both players can skip/pass to next artist
5. Correct guess = 1 point
6. Players swap roles (Guesser becomes Singer)
7. Continue until time expires

### Scoring
- 1 point per correctly guessed artist
- No penalty for skips
- Team with most points wins

## Technical Architecture

### Technology Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (purely client-side, no backend required)
- **API Integration**: Spotify Web API with OAuth 2.0 PKCE flow
- **Data Storage**: Browser localStorage for sessions and settings
- **Hosting**: Static hosting (GitHub Pages, Netlify, Vercel, etc.)

### Spotify API Integration

#### Authentication: OAuth 2.0 with PKCE
Uses **Authorization Code Flow with PKCE** (Proof Key for Code Exchange):
- **No client secret required** - safe for client-side apps
- User logs in with their Spotify account
- Access token stored in browser memory (not localStorage for security)
- Token refresh handled automatically
- **Required scopes**: `user-top-read` (for personalized artists)

#### Artist Data Sources
1. **Personalized Mode** (Primary)
   - Fetch artists from user's top artists (`/v1/me/top/artists`)
   - Time ranges: short_term (4 weeks), medium_term (6 months), long_term (years)
   - Most engaging - users recognize the artists

2. **Search Mode** (Alternative)
   - Search for artists across genres (`/v1/search`)
   - Useful for guest mode or variety
   - No authentication required for public data

#### Required Data
- Artist name
- Artist image (Spotify provides multiple sizes)
- Artist ID for reference
- Popularity score (for sorting/filtering)

### Spotify API Endpoints Used

```
POST https://accounts.spotify.com/api/token
- Exchange authorization code for access token (PKCE)

GET https://api.spotify.com/v1/me/top/artists
- Get user's top artists
- Query params: limit, time_range, offset

GET https://api.spotify.com/v1/search
- Search for artists
- Query params: q, type=artist, limit

GET https://api.spotify.com/v1/artists/{id}
- Get specific artist details
```

## Implementation Phases

### Phase 1: Proof of Concept (Current Focus)
**Goal**: Validate Spotify API integration and basic artist display

**Deliverables**:
- [ ] Set up project structure (HTML/CSS/JS)
- [ ] Register Spotify Developer App
- [ ] Implement Spotify API client for fetching popular artists
- [ ] Create debug view showing artist list with images
- [ ] Basic styling for artist cards

**Success Criteria**: Can fetch and display 20 popular artists with images

### Phase 2: Core Game Mechanics
**Goal**: Build playable single-team version

**Deliverables**:
- [ ] Game timer (60 second countdown)
- [ ] Role management (Singer/Guesser views)
- [ ] Score tracking
- [ ] Skip/Pass functionality
- [ ] Role swap after correct guess
- [ ] Round completion summary

### Phase 3: Multi-Team Support
**Goal**: Enable competitive gameplay

**Deliverables**:
- [ ] Team creation and management
- [ ] Turn-based round system
- [ ] Leaderboard
- [ ] Session persistence

### Phase 4: Enhanced Features
**Goal**: Add variety and user engagement

**Deliverables**:
- [ ] Spotify OAuth for personalized artist lists
- [ ] Multiple game modes:
  - Classic (swap after each guess)
  - Speed Round (shorter time, no role swap)
  - Marathon (longer time, more artists)
  - Custom (configurable time/rules)
- [ ] Sound effects and animations
- [ ] Mobile responsive design
- [ ] Shareable results

## File Structure (Phase 1)

```
guess-the-artist/
├── PLAN.md
├── README.md
├── DEPLOY.md
├── .gitignore
├── index.html          # Debug view with artist display
└── src/
    ├── js/
    │   ├── config.js           # Spotify configuration
    │   ├── spotify-client.js   # Spotify OAuth + API client
    │   └── main.js             # Main app logic
    └── css/
        └── styles.css          # Styling
```

## Spotify API Setup Requirements

1. Register app at https://developer.spotify.com/dashboard
2. Obtain **Client ID only** (no secret needed for PKCE!)
3. Configure **Redirect URI**:
   - For local development: `http://localhost:8000` or `http://127.0.0.1:8000`
   - For production: Your deployed URL (e.g., `https://yourdomain.com`)
4. Enable **Web API** access

## Configuration

No environment variables needed! The Client ID can be safely embedded in the frontend code since PKCE doesn't require a secret. Store it in:

```javascript
// src/js/config.js
const SPOTIFY_CONFIG = {
    clientId: 'your_client_id_here',
    redirectUri: window.location.origin,  // Automatically uses current domain
    scopes: ['user-top-read']
};
```

## Future Considerations

- **Accessibility**: Screen reader support, keyboard navigation
- **Internationalization**: Support multiple languages
- **Analytics**: Track popular artists, game duration stats
- **Social Features**: Share results, challenge friends
- **Anti-Cheat**: Prevent Singer from seeing artist name in HTML
- **Audio Preview**: Optional artist preview clips for verification
