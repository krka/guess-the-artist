/**
 * Spotify API Configuration
 *
 * To use this app:
 * 1. Go to https://developer.spotify.com/dashboard
 * 2. Create a new app
 * 3. Copy your Client ID and paste it below
 * 4. Add redirect URI in your Spotify app settings:
 *    - For local: http://localhost:8000 or http://127.0.0.1:8000
 *    - For production: your deployed URL
 */

const SPOTIFY_CONFIG = {
    // Spotify App Client ID (public, safe to commit)
    clientId: 'ec5f94ae62a74407920a3cb46f916fe6',

    // Redirect URI - automatically uses current origin
    // Make sure this matches what you set in Spotify Dashboard
    redirectUri: window.location.origin + window.location.pathname,

    // OAuth scopes we need
    scopes: [
        'user-top-read',      // Read user's top artists
        // Add more scopes as needed:
        // 'user-read-recently-played',  // For recently played artists
        // 'user-library-read',           // For saved artists
    ],

    // Spotify API endpoints
    authEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
    apiBaseUrl: 'https://api.spotify.com/v1'
};

// Make config available globally
window.SPOTIFY_CONFIG = SPOTIFY_CONFIG;
