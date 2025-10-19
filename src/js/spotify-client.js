/**
 * Spotify API Client
 * Handles authentication and data retrieval from Spotify Web API
 */

class SpotifyClient {
    constructor(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Get access token using Client Credentials Flow
     * https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow
     */
    async authenticate() {
        const authString = btoa(`${this.clientId}:${this.clientSecret}`);

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: 'grant_type=client_credentials'
            });

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            // Set expiry time (token expires in 1 hour, we'll refresh 5 min before)
            this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

            return this.accessToken;
        } catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    }

    /**
     * Ensure we have a valid access token
     */
    async ensureAuthenticated() {
        if (!this.accessToken || Date.now() >= this.tokenExpiry) {
            await this.authenticate();
        }
    }

    /**
     * Fetch popular artists using search API
     * Note: Spotify doesn't have a direct "popular artists" endpoint without auth,
     * so we'll search for common genre terms and collect unique artists
     */
    async getPopularArtists(count = 20) {
        await this.ensureAuthenticated();

        // Popular genres to search for
        const genres = ['pop', 'rock', 'hip hop', 'electronic', 'indie', 'r&b', 'country', 'jazz'];
        const artistsMap = new Map(); // Use Map to avoid duplicates

        try {
            // Search for artists in different genres
            for (const genre of genres) {
                if (artistsMap.size >= count) break;

                const response = await fetch(
                    `https://api.spotify.com/v1/search?q=genre:${encodeURIComponent(genre)}&type=artist&limit=50`,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`
                        }
                    }
                );

                if (!response.ok) {
                    throw new Error(`Search failed: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();

                // Add artists to map (sorted by popularity)
                const sortedArtists = data.artists.items
                    .filter(artist => artist.images.length > 0) // Only artists with images
                    .sort((a, b) => b.popularity - a.popularity);

                for (const artist of sortedArtists) {
                    if (artistsMap.size >= count) break;

                    if (!artistsMap.has(artist.id)) {
                        artistsMap.set(artist.id, {
                            id: artist.id,
                            name: artist.name,
                            image: artist.images[0]?.url || null,
                            popularity: artist.popularity,
                            genres: artist.genres
                        });
                    }
                }
            }

            // Convert map to array and return
            return Array.from(artistsMap.values()).slice(0, count);
        } catch (error) {
            console.error('Error fetching artists:', error);
            throw error;
        }
    }

    /**
     * Alternative: Search for specific popular artists
     * This is more reliable but requires maintaining a list
     */
    async searchArtists(artistNames) {
        await this.ensureAuthenticated();

        const artists = [];

        try {
            for (const name of artistNames) {
                const response = await fetch(
                    `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`
                        }
                    }
                );

                if (!response.ok) {
                    console.warn(`Search failed for ${name}`);
                    continue;
                }

                const data = await response.json();

                if (data.artists.items.length > 0) {
                    const artist = data.artists.items[0];
                    artists.push({
                        id: artist.id,
                        name: artist.name,
                        image: artist.images[0]?.url || null,
                        popularity: artist.popularity,
                        genres: artist.genres
                    });
                }
            }

            return artists;
        } catch (error) {
            console.error('Error searching artists:', error);
            throw error;
        }
    }

    /**
     * Get artist details by ID
     */
    async getArtist(artistId) {
        await this.ensureAuthenticated();

        try {
            const response = await fetch(
                `https://api.spotify.com/v1/artists/${artistId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Get artist failed: ${response.status} ${response.statusText}`);
            }

            const artist = await response.json();

            return {
                id: artist.id,
                name: artist.name,
                image: artist.images[0]?.url || null,
                popularity: artist.popularity,
                genres: artist.genres
            };
        } catch (error) {
            console.error('Error getting artist:', error);
            throw error;
        }
    }
}
