/**
 * Spotify API Configuration
 *
 * To use this app:
 * 1. Go to https://developer.spotify.com/dashboard
 * 2. Create a new app
 * 3. Copy your Client ID and paste it below
 * 4. Add redirect URIs in your Spotify app settings:
 *    - For local: https://localhost:8443 (HTTPS required by Spotify)
 *    - For production: https://krka.github.io/guess-the-artist/
 */

const SPOTIFY_CONFIG = {
    // Spotify App Client ID (public, safe to commit)
    clientId: 'ec5f94ae62a74407920a3cb46f916fe6',

    // Redirect URI - automatically adapts to environment
    // Localhost: just the origin (https://localhost:8443)
    // GitHub Pages: origin + repo path (https://krka.github.io/guess-the-artist/)
    get redirectUri() {
        const origin = window.location.origin;
        const pathname = window.location.pathname;

        // For localhost/127.0.0.1, just return origin
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return origin;
        }

        // For GitHub Pages, return origin + base path (without index.html)
        // Extract base path: /guess-the-artist/ from /guess-the-artist/index.html
        const basePath = pathname.endsWith('.html')
            ? pathname.substring(0, pathname.lastIndexOf('/') + 1)
            : pathname;

        return origin + basePath;
    },

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
