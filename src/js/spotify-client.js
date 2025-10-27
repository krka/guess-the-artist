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

            console.log('OAuth callback successful, tokens stored:', {
                hasAccessToken: !!this.accessToken,
                hasRefreshToken: !!this.refreshToken,
                tokenExpiry: new Date(this.tokenExpiry).toISOString(),
                expiresIn: data.expires_in
            });

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
     * Refresh access token using refresh token (with retry for server errors)
     */
    async refreshAccessToken(retryCount = 0) {
        const refreshToken = this.refreshToken || localStorage.getItem('spotify_refresh_token');

        console.log('Attempting to refresh access token...', {
            hasRefreshToken: !!refreshToken,
            hasAccessToken: !!this.accessToken,
            tokenExpiry: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'none',
            retry: retryCount
        });

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

            console.log('Token refresh response:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: 'unknown', error_description: errorText };
                }

                console.error('Token refresh failed:', response.status, errorData);

                // Retry on server errors (500-599) up to 3 times
                if (response.status >= 500 && retryCount < 3) {
                    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
                    console.log(`Retrying in ${delay}ms... (attempt ${retryCount + 1}/3)`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.refreshAccessToken(retryCount + 1);
                }

                // Don't logout on server errors - token might still be valid
                if (response.status < 500) {
                    this.logout();
                }

                throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error || response.statusText}`);
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
     * Ensure we have a valid access token (supports both user auth and anonymous mode)
     */
    async ensureAuthenticated() {
        console.log('ensureAuthenticated called', {
            hasAccessToken: !!this.accessToken,
            hasRefreshTokenInMemory: !!this.refreshToken,
            hasRefreshTokenInStorage: !!localStorage.getItem('spotify_refresh_token'),
            tokenExpiry: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'none',
            isExpired: this.tokenExpiry ? (Date.now() >= this.tokenExpiry - 5 * 60 * 1000) : 'N/A'
        });

        // If no access token, try to restore from refresh token OR use anonymous mode
        if (!this.accessToken) {
            const refreshToken = localStorage.getItem('spotify_refresh_token');
            if (refreshToken) {
                console.log('No access token, restoring from refresh token...');
                this.refreshToken = refreshToken;
                await this.refreshAccessToken();
                return;
            }
            // No user auth - use anonymous mode (client credentials)
            console.log('No user auth, using anonymous mode (client credentials)...');
            await this.getClientCredentialsToken();
            return;
        }

        // If token is expired or about to expire (within 5 min), refresh it
        if (Date.now() >= this.tokenExpiry - 5 * 60 * 1000) {
            console.log('Access token expired or expiring soon, refreshing...');
            // If we have a refresh token (user mode), use it
            if (this.isUserAuthenticated()) {
                await this.refreshAccessToken();
            } else {
                // Anonymous mode - get new client credentials token
                await this.getClientCredentialsToken();
            }
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
     * Get access token using Client Credentials flow (anonymous mode)
     * This allows public API access without user login
     */
    async getClientCredentialsToken() {
        try {
            console.log('Client credentials request:', {
                clientId: this.config.clientId,
                clientSecretLength: this.config.clientSecret?.length,
                tokenEndpoint: this.config.tokenEndpoint
            });

            const credentials = btoa(`${this.config.clientId}:${this.config.clientSecret}`);

            const response = await fetch(this.config.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'grant_type=client_credentials',
            });

            console.log('Client credentials response:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: 'unknown', error_description: errorText };
                }
                console.error('Client credentials failed:', errorData);
                throw new Error(`Client credentials auth failed: ${errorData.error_description || errorData.error || response.statusText}`);
            }

            const data = await response.json();

            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + data.expires_in * 1000;
            // No refresh token in client credentials flow

            console.log('Client credentials token obtained (anonymous mode)');
            return this.accessToken;
        } catch (error) {
            console.error('Client credentials error:', error);
            throw error;
        }
    }

    /**
     * Check if we're in user-authenticated mode (vs anonymous mode)
     */
    isUserAuthenticated() {
        return !!this.refreshToken || !!localStorage.getItem('spotify_refresh_token');
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

    /**
     * Get user's playlists
     */
    async getUserPlaylists(limit = 50) {
        await this.ensureAuthenticated();

        try {
            const url = `${this.config.apiBaseUrl}/me/playlists?limit=${limit}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to get playlists: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            return data.items.map(playlist => ({
                id: playlist.id,
                name: playlist.name,
                owner: playlist.owner.display_name,
                trackCount: playlist.tracks.total,
                image: playlist.images[0]?.url || null,
            }));
        } catch (error) {
            console.error('Error getting playlists:', error);
            throw error;
        }
    }

    /**
     * Search for public playlists
     */
    async searchPlaylists(query, limit = 20) {
        await this.ensureAuthenticated();

        try {
            const url = `${this.config.apiBaseUrl}/search?q=${encodeURIComponent(query)}&type=playlist&limit=${limit}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to search playlists: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Filter out null entries that Spotify sometimes returns
            return data.playlists.items
                .filter(playlist => playlist !== null)
                .map(playlist => ({
                    id: playlist.id,
                    name: playlist.name,
                    owner: playlist.owner.display_name,
                    trackCount: playlist.tracks.total,
                    image: playlist.images[0]?.url || null,
                }));
        } catch (error) {
            console.error('Error searching playlists:', error);
            throw error;
        }
    }

    /**
     * Get artists from a playlist
     */
    async getArtistsFromPlaylist(playlistId, progressCallback) {
        await this.ensureAuthenticated();

        const artistsMap = new Map();

        try {
            // Fetch all tracks from playlist (might need pagination)
            let url = `${this.config.apiBaseUrl}/playlists/${playlistId}/tracks?limit=100`;
            let totalTracks = 0;
            let fetchedTracks = 0;

            while (url) {
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                });

                if (!response.ok) {
                    throw new Error(`Failed to get playlist tracks: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();

                // Set total on first page
                if (totalTracks === 0) {
                    totalTracks = data.total;
                }

                // Extract unique artists (primary artist only, skip features)
                // Also collect track names for hints
                data.items.forEach(item => {
                    if (item.track && item.track.artists && item.track.artists.length > 0) {
                        // Only take the first artist (primary), not featured artists
                        const artist = item.track.artists[0];
                        if (!artistsMap.has(artist.id)) {
                            artistsMap.set(artist.id, {
                                id: artist.id,
                                name: artist.name,
                                tracks: []
                            });
                        }
                        // Add track name to this artist's track list (for hints)
                        if (item.track.name) {
                            artistsMap.get(artist.id).tracks.push(item.track.name);
                        }
                    }
                });

                fetchedTracks += data.items.length;

                // Report progress as percentage
                if (progressCallback && totalTracks > 0) {
                    const percent = Math.round((fetchedTracks / totalTracks) * 100);
                    progressCallback({ stage: 'tracks', percent });
                }

                // Get next page if available
                url = data.next;
            }

            // Fetch full artist details for each unique artist
            const artistIds = Array.from(artistsMap.keys());
            const artists = [];
            const totalBatches = Math.ceil(artistIds.length / 50);

            // Fetch in batches of 50 (Spotify API limit)
            for (let i = 0; i < artistIds.length; i += 50) {
                const batch = artistIds.slice(i, i + 50);
                const batchUrl = `${this.config.apiBaseUrl}/artists?ids=${batch.join(',')}`;

                const response = await fetch(batchUrl, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                });

                if (!response.ok) {
                    console.warn('Failed to fetch artist details for batch');
                    continue;
                }

                const data = await response.json();

                data.artists.forEach(artist => {
                    if (artist) {
                        // Get track names from the artistsMap we built earlier
                        const tracksData = artistsMap.get(artist.id);
                        artists.push({
                            id: artist.id,
                            name: artist.name,
                            image: artist.images[0]?.url || null,
                            popularity: artist.popularity,
                            genres: artist.genres,
                            tracks: tracksData ? tracksData.tracks : []
                        });
                    }
                });

                // Report progress as percentage for artist details
                if (progressCallback) {
                    const percent = Math.round(((i + 50) / artistIds.length) * 100);
                    progressCallback({ stage: 'artists', percent: Math.min(percent, 100) });
                }
            }

            return artists;
        } catch (error) {
            console.error('Error getting artists from playlist:', error);
            throw error;
        }
    }

    /**
     * Get artists from multiple playlists
     */
    async getArtistsFromPlaylists(playlistIds, progressCallback) {
        const artistsMap = new Map();

        for (let i = 0; i < playlistIds.length; i++) {
            const playlistId = playlistIds[i];
            const playlistNum = i + 1;
            const totalPlaylists = playlistIds.length;

            const playlistProgress = (progress) => {
                if (progressCallback) {
                    progressCallback({
                        playlistNum,
                        totalPlaylists,
                        stage: progress.stage,
                        percent: progress.percent
                    });
                }
            };

            const artists = await this.getArtistsFromPlaylist(playlistId, playlistProgress);
            artists.forEach(artist => {
                if (!artistsMap.has(artist.id)) {
                    artistsMap.set(artist.id, artist);
                }
            });
        }

        return Array.from(artistsMap.values());
    }

    /**
     * Get related artists based on user's top artists
     */
    async getRelatedArtists(limit = 50) {
        await this.ensureAuthenticated();

        try {
            // Get user's top artists first
            const topArtists = await this.getTopArtists(5);
            const artistsMap = new Map();

            // For each top artist, get related artists
            for (const artist of topArtists) {
                const url = `${this.config.apiBaseUrl}/artists/${artist.id}/related-artists`;
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                });

                if (!response.ok) {
                    console.warn('Failed to get related artists for', artist.name);
                    continue;
                }

                const data = await response.json();

                data.artists.forEach(relatedArtist => {
                    if (!artistsMap.has(relatedArtist.id) && artistsMap.size < limit) {
                        artistsMap.set(relatedArtist.id, {
                            id: relatedArtist.id,
                            name: relatedArtist.name,
                            image: relatedArtist.images[0]?.url || null,
                            popularity: relatedArtist.popularity,
                            genres: relatedArtist.genres,
                        });
                    }
                });

                if (artistsMap.size >= limit) break;
            }

            return Array.from(artistsMap.values());
        } catch (error) {
            console.error('Error getting related artists:', error);
            throw error;
        }
    }

    /**
     * Get artists from a decade using year search
     */
    async getArtistsByDecade(decade, limit = 50) {
        await this.ensureAuthenticated();

        try {
            // Map decade to year range
            const yearRanges = {
                '1960s': '1960-1969',
                '1970s': '1970-1979',
                '1980s': '1980-1989',
                '1990s': '1990-1999',
                '2000s': '2000-2009',
                '2010s': '2010-2019',
                '2020s': '2020-2029'
            };

            const yearRange = yearRanges[decade];
            if (!yearRange) {
                throw new Error(`Unknown decade: ${decade}`);
            }

            // Search for popular artists from that era
            const url = `${this.config.apiBaseUrl}/search?q=year:${yearRange}&type=artist&limit=${limit}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to search decade: ${response.status} ${response.statusText}`);
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
                }))
                .sort((a, b) => b.popularity - a.popularity); // Sort by popularity
        } catch (error) {
            console.error('Error getting artists by decade:', error);
            throw error;
        }
    }

}
