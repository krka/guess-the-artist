# Sista Minuten - Game Plan

## Overview
Web-based social game inspired by the "Sista Minuten" segment from the Swedish gameshow "Doobidoo". Players work in teams to guess music artists based on sung songs within a time limit.

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

### Technology Stack (Proposed)
- **Frontend**: HTML5, CSS3, JavaScript (vanilla or React for future scalability)
- **Backend**: Node.js with Express (or similar lightweight framework)
- **API Integration**: Spotify Web API
- **Data Storage**: Initially in-memory, later database for sessions/leaderboards

### Spotify API Integration

#### Artist Data Sources (Two Options)
1. **Global Popular Artists Mode**
   - Fetch list of popular artists using Spotify API
   - Pre-select subset for game session
   - Randomize order for each round
   - No authentication required

2. **Personalized Mode** (Future Enhancement)
   - OAuth integration with Spotify
   - Fetch artists from user's listening history
   - Curate based on top artists, recently played, or playlists
   - More engaging for users familiar with their own music taste

#### Required Data
- Artist name
- Artist image (Spotify provides multiple sizes)
- Artist ID for reference

### API Endpoints (Backend)

```
GET /api/artists/popular
- Returns list of popular artists with images
- Query params: count (default: 20)

GET /api/game/start
- Initializes new game session
- Returns session_id and artist list

POST /api/game/:session_id/score
- Updates score for current round
- Body: { team_id, points }

GET /api/game/:session_id/status
- Returns current game state
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
sista_minuten/
├── PLAN.md
├── README.md
├── .gitignore
├── index.html          # Debug view with artist display
├── src/
│   ├── js/
│   │   ├── spotify-client.js    # Spotify API integration
│   │   └── main.js              # Main app logic
│   └── css/
│       └── styles.css           # Styling
└── config/
    └── .env.example            # Environment variables template
```

## Spotify API Setup Requirements

1. Register app at https://developer.spotify.com/dashboard
2. Obtain Client ID and Client Secret
3. Configure Redirect URI (for future OAuth)
4. API Endpoints to use:
   - Search API: `https://api.spotify.com/v1/search`
   - Top Artists (requires auth): `https://api.spotify.com/v1/me/top/artists`
   - Get Artist: `https://api.spotify.com/v1/artists/{id}`

## Environment Variables

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

## Future Considerations

- **Accessibility**: Screen reader support, keyboard navigation
- **Internationalization**: Support multiple languages
- **Analytics**: Track popular artists, game duration stats
- **Social Features**: Share results, challenge friends
- **Anti-Cheat**: Prevent Singer from seeing artist name in HTML
- **Audio Preview**: Optional artist preview clips for verification
