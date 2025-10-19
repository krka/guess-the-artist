/**
 * Spotify API Client with OAuth 2.0 PKCE Authentication
 *
 * PKCE (Proof Key for Code Exchange) allows secure OAuth without client secrets.
 * Perfect for client-side applications!
 *
 * Reference: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 */

class SpotifyClient {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.config = window.SPOTIFY_CONFIG;
    }

    /**
     * PKCE Helper: Generate random code verifier
     */
    generateCodeVerifier(length = 128) {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const values = crypto.getRandomValues(new Uint8Array(length));
        return Array.from(values)
            .map(x => possible[x % possible.length])
            .join('');
    }

    /**
     * PKCE Helper: Generate code challenge from verifier
     */
    async generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);

        return this.base64UrlEncode(digest);
    }

    /**
     * Base64 URL encode (without padding)
     */
    base64UrlEncode(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Step 1: Redirect user to Spotify authorization page
     */
    async redirectToSpotifyAuth() {
        // Generate and store code verifier
        const codeVerifier = this.generateCodeVerifier();
        localStorage.setItem('spotify_code_verifier', codeVerifier);

        // Generate code challenge
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        // Build authorization URL
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            response_type: 'code',
            redirect_uri: this.config.redirectUri,
            scope: this.config.scopes.join(' '),
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
        });

        // Redirect to Spotify
        window.location.href = `${this.config.authEndpoint}?${params.toString()}`;
    }

    /**
     * Step 2: Handle OAuth callback and exchange code for token
     */
    async handleCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
            throw new Error(`Spotify authorization failed: ${error}`);
        }

        if (!code) {
            return false; // No callback in progress
        }

        // Get stored code verifier
        const codeVerifier = localStorage.getItem('spotify_code_verifier');
        if (!codeVerifier) {
            throw new Error('Code verifier not found. Please try logging in again.');
        }

        // Exchange code for access token
        try {
            const response = await fetch(this.config.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.config.clientId,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: this.config.redirectUri,
                    code_verifier: codeVerifier,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`);
            }

            const data = await response.json();

            // Store tokens
            this.accessToken = data.access_token;
            this.refreshToken = data.refresh_token;
            this.tokenExpiry = Date.now() + data.expires_in * 1000;

            // Save refresh token to localStorage for persistence
            localStorage.setItem('spotify_refresh_token', this.refreshToken);

            // Clean up
            localStorage.removeItem('spotify_code_verifier');

            // Remove OAuth params from URL
            window.history.replaceState({}, document.title, window.location.pathname);

            return true;
        } catch (error) {
            localStorage.removeItem('spotify_code_verifier');
            throw error;
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken() {
        const refreshToken = this.refreshToken || localStorage.getItem('spotify_refresh_token');

        if (!refreshToken) {
            throw new Error('No refresh token available. Please log in again.');
        }

        try {
            const response = await fetch(this.config.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.config.clientId,
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                }),
            });

            if (!response.ok) {
                // Refresh token is invalid, user needs to re-login
                this.logout();
                throw new Error('Session expired. Please log in again.');
            }

            const data = await response.json();

            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + data.expires_in * 1000;

            // Refresh token might be rotated
            if (data.refresh_token) {
                this.refreshToken = data.refresh_token;
                localStorage.setItem('spotify_refresh_token', data.refresh_token);
            }

            return this.accessToken;
        } catch (error) {
            console.error('Token refresh error:', error);
            throw error;
        }
    }

    /**
     * Ensure we have a valid access token
     */
    async ensureAuthenticated() {
        // If no access token, try to restore from refresh token
        if (!this.accessToken) {
            const refreshToken = localStorage.getItem('spotify_refresh_token');
            if (refreshToken) {
                this.refreshToken = refreshToken;
                await this.refreshAccessToken();
                return;
            }
            throw new Error('Not authenticated. Please log in.');
        }

        // If token is expired or about to expire (within 5 min), refresh it
        if (Date.now() >= this.tokenExpiry - 5 * 60 * 1000) {
            await this.refreshAccessToken();
        }
    }

    /**
     * Check if user is logged in
     */
    isAuthenticated() {
        return !!this.accessToken || !!localStorage.getItem('spotify_refresh_token');
    }

    /**
     * Logout and clear tokens
     */
    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_code_verifier');
    }

    /**
     * Get user's top artists (personalized!)
     *
     * @param {number} limit - Number of artists (max 50)
     * @param {string} timeRange - 'short_term' (4 weeks), 'medium_term' (6 months), 'long_term' (years)
     */
    async getTopArtists(limit = 20, timeRange = 'medium_term') {
        await this.ensureAuthenticated();

        try {
            const url = `${this.config.apiBaseUrl}/me/top/artists?limit=${limit}&time_range=${timeRange}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch top artists: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            return data.items.map(artist => ({
                id: artist.id,
                name: artist.name,
                image: artist.images[0]?.url || null,
                popularity: artist.popularity,
                genres: artist.genres,
            }));
        } catch (error) {
            console.error('Error fetching top artists:', error);
            throw error;
        }
    }

    /**
     * Search for artists (doesn't require user authentication for public data)
     * But we still use the user's token if available
     */
    async searchArtists(query, limit = 20) {
        await this.ensureAuthenticated();

        try {
            const url = `${this.config.apiBaseUrl}/search?q=${encodeURIComponent(query)}&type=artist&limit=${limit}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            return data.artists.items
                .filter(artist => artist.images.length > 0)
                .map(artist => ({
                    id: artist.id,
                    name: artist.name,
                    image: artist.images[0]?.url || null,
                    popularity: artist.popularity,
                    genres: artist.genres,
                }));
        } catch (error) {
            console.error('Error searching artists:', error);
            throw error;
        }
    }

    /**
     * Get multiple genres and combine unique artists
     */
    async getArtistsByGenres(genres, limit = 20) {
        await this.ensureAuthenticated();

        const artistsMap = new Map();

        try {
            for (const genre of genres) {
                if (artistsMap.size >= limit) break;

                const artists = await this.searchArtists(`genre:${genre}`, 50);

                // Add unique artists sorted by popularity
                const sortedArtists = artists.sort((a, b) => b.popularity - a.popularity);

                for (const artist of sortedArtists) {
                    if (artistsMap.size >= limit) break;
                    if (!artistsMap.has(artist.id)) {
                        artistsMap.set(artist.id, artist);
                    }
                }
            }

            return Array.from(artistsMap.values()).slice(0, limit);
        } catch (error) {
            console.error('Error fetching artists by genres:', error);
            throw error;
        }
    }

    /**
     * Get artist details by ID
     */
    async getArtist(artistId) {
        await this.ensureAuthenticated();

        try {
            const url = `${this.config.apiBaseUrl}/artists/${artistId}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to get artist: ${response.status} ${response.statusText}`);
            }

            const artist = await response.json();

            return {
                id: artist.id,
                name: artist.name,
                image: artist.images[0]?.url || null,
                popularity: artist.popularity,
                genres: artist.genres,
            };
        } catch (error) {
            console.error('Error getting artist:', error);
            throw error;
        }
    }

    /**
     * Get current user profile
     */
    async getCurrentUser() {
        await this.ensureAuthenticated();

        try {
            const url = `${this.config.apiBaseUrl}/me`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to get user profile: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    }
}
