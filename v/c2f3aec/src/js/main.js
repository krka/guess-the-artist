/**
 * Main application logic
 * Handles OAuth flow, UI interactions, and Spotify API coordination
 */

let spotifyClient = null;
let currentArtists = [];

// DOM Elements
const authSection = document.getElementById('auth-section');
const controlsSection = document.getElementById('controls-section');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userName = document.getElementById('user-name');
const artistSourceSelect = document.getElementById('artist-source');
const timeRangeGroup = document.getElementById('time-range-group');
const timeRangeSelect = document.getElementById('time-range');
const artistCountInput = document.getElementById('artist-count');
const fetchButton = document.getElementById('fetch-artists');
const statusMessage = document.getElementById('status-message');
const artistsGrid = document.getElementById('artists-grid');

/**
 * Initialize app on page load
 */
window.addEventListener('DOMContentLoaded', async () => {
    // Initialize Spotify client
    spotifyClient = new SpotifyClient();

    // Check if this is an OAuth callback
    if (window.location.search.includes('code=')) {
        showStatus('Completing login...', 'info');
        try {
            await spotifyClient.handleCallback();
            console.log('OAuth callback successful');
            showStatus('Login successful!', 'success');
            await initializeAuthenticatedUI();
            console.log('Authenticated UI initialized');
        } catch (error) {
            console.error('OAuth callback error:', error);
            showStatus(`Login failed: ${error.message}`, 'error');
            showLoginUI();
        }
    }
    // Check if user is already logged in
    else if (spotifyClient.isAuthenticated()) {
        try {
            await initializeAuthenticatedUI();
        } catch (error) {
            console.error('Failed to restore session:', error);
            showStatus('Session expired. Please log in again.', 'error');
            showLoginUI();
        }
    }
    // Show login UI
    else {
        showLoginUI();
    }

    // Setup event listeners
    setupEventListeners();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
    loginButton.addEventListener('click', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    fetchButton.addEventListener('click', handleFetchArtists);

    // Show/hide time range based on artist source
    artistSourceSelect.addEventListener('change', () => {
        if (artistSourceSelect.value === 'top_artists') {
            timeRangeGroup.style.display = 'block';
        } else {
            timeRangeGroup.style.display = 'none';
        }
    });
}

/**
 * Handle login button click
 */
async function handleLogin() {
    try {
        await spotifyClient.redirectToSpotifyAuth();
    } catch (error) {
        showStatus(`Login failed: ${error.message}`, 'error');
    }
}

/**
 * Handle logout button click
 */
function handleLogout() {
    spotifyClient.logout();
    currentArtists = [];
    artistsGrid.innerHTML = '';
    showStatus('Logged out successfully', 'success');
    showLoginUI();
}

/**
 * Initialize UI for authenticated user
 */
async function initializeAuthenticatedUI() {
    try {
        console.log('Fetching user profile...');
        // Fetch user profile
        const user = await spotifyClient.getCurrentUser();
        console.log('User profile fetched:', user);
        userName.textContent = `Logged in as ${user.display_name || user.id}`;

        // Show controls, hide auth section
        authSection.classList.add('hidden');
        controlsSection.classList.remove('hidden');

        showStatus('Ready to fetch artists!', 'success');
    } catch (error) {
        console.error('Failed to initialize authenticated UI:', error);
        throw new Error(`Failed to load user profile: ${error.message}`);
    }
}

/**
 * Show login UI
 */
function showLoginUI() {
    authSection.classList.remove('hidden');
    controlsSection.classList.add('hidden');
}

/**
 * Handle fetch artists button click
 */
async function handleFetchArtists() {
    const source = artistSourceSelect.value;
    const count = parseInt(artistCountInput.value);

    // Validate count
    if (count < 1 || count > 50) {
        showStatus('Artist count must be between 1 and 50', 'error');
        return;
    }

    // Fetch based on source
    if (source === 'top_artists') {
        const timeRange = timeRangeSelect.value;
        await fetchTopArtists(count, timeRange);
    } else {
        await fetchArtistsByGenre(count);
    }
}

/**
 * Fetch user's top artists
 */
async function fetchTopArtists(count, timeRange) {
    try {
        fetchButton.disabled = true;
        fetchButton.textContent = 'Fetching...';
        showStatus('Fetching your top artists...', 'info');
        artistsGrid.innerHTML = '<div class="loading">Loading artists...</div>';

        currentArtists = await spotifyClient.getTopArtists(count, timeRange);

        displayArtists(currentArtists);

        const timeRangeText = {
            'short_term': 'last 4 weeks',
            'medium_term': 'last 6 months',
            'long_term': 'all time'
        }[timeRange];

        showStatus(`Successfully loaded ${currentArtists.length} artists from ${timeRangeText}!`, 'success');
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
        artistsGrid.innerHTML = '';

        // If authentication error, show login UI
        if (error.message.includes('Not authenticated') || error.message.includes('Session expired')) {
            setTimeout(() => showLoginUI(), 2000);
        }
    } finally {
        fetchButton.disabled = false;
        fetchButton.textContent = 'Fetch Artists';
    }
}

/**
 * Fetch artists by genre
 */
async function fetchArtistsByGenre(count) {
    const popularGenres = ['pop', 'rock', 'hip hop', 'electronic', 'indie', 'r&b'];

    try {
        fetchButton.disabled = true;
        fetchButton.textContent = 'Fetching...';
        showStatus('Fetching popular artists across genres...', 'info');
        artistsGrid.innerHTML = '<div class="loading">Loading artists...</div>';

        currentArtists = await spotifyClient.getArtistsByGenres(popularGenres, count);

        displayArtists(currentArtists);

        showStatus(`Successfully loaded ${currentArtists.length} artists!`, 'success');
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
        artistsGrid.innerHTML = '';

        // If authentication error, show login UI
        if (error.message.includes('Not authenticated') || error.message.includes('Session expired')) {
            setTimeout(() => showLoginUI(), 2000);
        }
    } finally {
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
        artistsGrid.innerHTML = '<div class="loading">No artists found. Try adjusting your settings!</div>';
        return;
    }

    artists.forEach((artist, index) => {
        const card = createArtistCard(artist, index + 1);
        artistsGrid.appendChild(card);
    });
}

/**
 * Create an artist card element
 */
function createArtistCard(artist, rank) {
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
    name.textContent = `${rank}. ${artist.name}`;

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
        const genresText = artist.genres.length > 0 ? artist.genres.join(', ') : 'No genres listed';
        alert(`${artist.name}\nPopularity: ${artist.popularity}\nGenres: ${genresText}`);
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
 * Shuffle array (for future game use)
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
