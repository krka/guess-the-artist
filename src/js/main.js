/**
 * Main application logic
 * Handles UI interactions and coordinates with Spotify API client
 */

let spotifyClient = null;
let currentArtists = [];

// DOM Elements
const clientIdInput = document.getElementById('client-id');
const clientSecretInput = document.getElementById('client-secret');
const artistCountInput = document.getElementById('artist-count');
const fetchButton = document.getElementById('fetch-artists');
const statusMessage = document.getElementById('status-message');
const artistsGrid = document.getElementById('artists-grid');

// Load credentials from localStorage if available
window.addEventListener('DOMContentLoaded', () => {
    const savedClientId = localStorage.getItem('spotify_client_id');
    const savedClientSecret = localStorage.getItem('spotify_client_secret');

    if (savedClientId) clientIdInput.value = savedClientId;
    if (savedClientSecret) clientSecretInput.value = savedClientSecret;
});

// Fetch artists button click handler
fetchButton.addEventListener('click', async () => {
    const clientId = clientIdInput.value.trim();
    const clientSecret = clientSecretInput.value.trim();
    const artistCount = parseInt(artistCountInput.value);

    // Validate inputs
    if (!clientId || !clientSecret) {
        showStatus('Please enter both Client ID and Client Secret', 'error');
        return;
    }

    if (artistCount < 1 || artistCount > 50) {
        showStatus('Artist count must be between 1 and 50', 'error');
        return;
    }

    // Save credentials to localStorage
    localStorage.setItem('spotify_client_id', clientId);
    localStorage.setItem('spotify_client_secret', clientSecret);

    // Fetch artists
    await fetchArtists(clientId, clientSecret, artistCount);
});

/**
 * Fetch artists from Spotify API
 */
async function fetchArtists(clientId, clientSecret, count) {
    try {
        // Disable button and show loading state
        fetchButton.disabled = true;
        fetchButton.textContent = 'Fetching...';
        showStatus('Authenticating with Spotify...', 'info');
        artistsGrid.innerHTML = '<div class="loading">Loading artists...</div>';

        // Create or update Spotify client
        spotifyClient = new SpotifyClient(clientId, clientSecret);

        // Authenticate
        await spotifyClient.authenticate();
        showStatus('Fetching popular artists...', 'info');

        // Fetch artists
        currentArtists = await spotifyClient.getPopularArtists(count);

        // Display artists
        displayArtists(currentArtists);

        showStatus(`Successfully loaded ${currentArtists.length} artists!`, 'success');
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
        artistsGrid.innerHTML = '';
        console.error('Fetch error:', error);
    } finally {
        // Re-enable button
        fetchButton.disabled = false;
        fetchButton.textContent = 'Fetch Artists';
    }
}

/**
 * Display artists in the grid
 */
function displayArtists(artists) {
    artistsGrid.innerHTML = '';

    if (artists.length === 0) {
        artistsGrid.innerHTML = '<div class="loading">No artists found</div>';
        return;
    }

    artists.forEach(artist => {
        const card = createArtistCard(artist);
        artistsGrid.appendChild(card);
    });
}

/**
 * Create an artist card element
 */
function createArtistCard(artist) {
    const card = document.createElement('div');
    card.className = 'artist-card';
    card.dataset.artistId = artist.id;

    const image = document.createElement('img');
    image.className = 'artist-image';
    image.src = artist.image || 'https://via.placeholder.com/200?text=No+Image';
    image.alt = artist.name;
    image.loading = 'lazy';

    const info = document.createElement('div');
    info.className = 'artist-info';

    const name = document.createElement('div');
    name.className = 'artist-name';
    name.textContent = artist.name;

    const popularity = document.createElement('div');
    popularity.className = 'artist-popularity';
    popularity.textContent = `Popularity: ${artist.popularity}/100`;

    info.appendChild(name);
    info.appendChild(popularity);

    card.appendChild(image);
    card.appendChild(info);

    // Add click handler for debugging
    card.addEventListener('click', () => {
        console.log('Artist clicked:', artist);
        alert(`${artist.name}\nPopularity: ${artist.popularity}\nGenres: ${artist.genres.join(', ')}`);
    });

    return card;
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = type;
    statusMessage.classList.remove('hidden');

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 3000);
    }
}

/**
 * Shuffle array (for future use in game)
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Export functions for potential future use
 */
window.SistaMinuten = {
    getArtists: () => currentArtists,
    shuffleArtists: () => shuffleArray(currentArtists),
    spotifyClient: () => spotifyClient
};
