/**
 * Game Setup Logic
 * Handles team management and game configuration
 */

let spotifyClient = null;
let teams = [];
let userPlaylists = [];
let selectedPlaylistIds = [];

// Magic source entries (always available)
const MAGIC_SOURCES = [
    { id: '__top_artists__', name: 'My Top Artists', info: 'Based on your listening history' },
    { id: '__related_artists__', name: 'Related Artists', info: 'Artists similar to your favorites' },
    { id: '__global_top_50__', name: 'Global Top 50', info: 'Most popular worldwide' },
    { id: '__top_usa__', name: 'Top 50 USA', info: 'Most popular in United States' },
    { id: '__top_uk__', name: 'Top 50 UK', info: 'Most popular in United Kingdom' },
    { id: '__top_sweden__', name: 'Top 50 Sweden', info: 'Most popular in Sweden' },
    { id: '__top_japan__', name: 'Top 50 Japan', info: 'Most popular in Japan' },
    { id: '__top_brazil__', name: 'Top 50 Brazil', info: 'Most popular in Brazil' },
    { id: '__decade_1960s__', name: 'Best of 1960s', info: 'Classic artists from the 60s' },
    { id: '__decade_1970s__', name: 'Best of 1970s', info: 'Classic artists from the 70s' },
    { id: '__decade_1980s__', name: 'Best of 1980s', info: 'Classic artists from the 80s' },
    { id: '__decade_1990s__', name: 'Best of 1990s', info: 'Classic artists from the 90s' },
    { id: '__decade_2000s__', name: 'Best of 2000s', info: 'Popular artists from the 2000s' },
    { id: '__decade_2010s__', name: 'Best of 2010s', info: 'Popular artists from the 2010s' },
    { id: '__decade_2020s__', name: 'Best of 2020s', info: 'Current popular artists' }
];

// DOM Elements
const authSection = document.getElementById('auth-section');
const gameSetupSection = document.getElementById('game-setup-section');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userName = document.getElementById('user-name');
const addTeamButton = document.getElementById('add-team-button');
const teamsList = document.getElementById('teams-list');
const startGameButton = document.getElementById('start-game-button');
const playlistsLoading = document.getElementById('playlists-loading');
const playlistsList = document.getElementById('playlists-list');
const playlistsEmpty = document.getElementById('playlists-empty');
const playlistFilter = document.getElementById('playlist-filter');
const selectedPlaylistsSection = document.getElementById('selected-playlists-section');
const selectedPlaylistsList = document.getElementById('selected-playlists-list');
const statusMessage = document.getElementById('status-message');

/**
 * Initialize app on page load
 */
window.addEventListener('DOMContentLoaded', async () => {
    spotifyClient = new SpotifyClient();

    console.log('Page loaded, checking auth state...');
    console.log('URL has code param:', window.location.search.includes('code='));
    console.log('Is authenticated:', spotifyClient.isAuthenticated());
    console.log('Refresh token exists:', !!localStorage.getItem('spotify_refresh_token'));

    // Check if this is an OAuth callback
    if (window.location.search.includes('code=')) {
        console.log('Handling OAuth callback...');
        showStatus('Completing login...', 'info');
        try {
            await spotifyClient.handleCallback();
            console.log('OAuth callback completed');
            await initializeAuthenticatedUI();
        } catch (error) {
            console.error('OAuth callback failed:', error);
            showStatus(`Login failed: ${error.message}`, 'error');
            showLoginUI();
        }
    }
    // Check if user is already logged in
    else if (spotifyClient.isAuthenticated()) {
        console.log('User is authenticated, initializing UI...');
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
        console.log('User not authenticated, showing login UI');
        showLoginUI();
    }

    setupEventListeners();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
    loginButton.addEventListener('click', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    addTeamButton.addEventListener('click', addTeam);
    startGameButton.addEventListener('click', startGame);

    // Add team on Enter key
    const newTeamPlayersInput = document.getElementById('new-team-players');
    if (newTeamPlayersInput) {
        newTeamPlayersInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addTeam();
            }
        });
    }

    // Filter playlists as user types
    if (playlistFilter) {
        playlistFilter.addEventListener('input', (e) => {
            filterPlaylists(e.target.value);
        });
    }
}


/**
 * Handle login
 */
async function handleLogin() {
    try {
        await spotifyClient.redirectToSpotifyAuth();
    } catch (error) {
        showStatus(`Login failed: ${error.message}`, 'error');
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    spotifyClient.logout();
    teams = [];
    teamsList.innerHTML = '';
    showStatus('Logged out successfully', 'success');
    showLoginUI();
}

/**
 * Initialize UI for authenticated user
 */
async function initializeAuthenticatedUI() {
    console.log('initializeAuthenticatedUI called');

    // Show game UI immediately
    authSection.classList.add('hidden');
    gameSetupSection.classList.remove('hidden');
    console.log('UI sections toggled');

    // Load playlists immediately
    loadPlaylists();

    // Fetch user profile in background
    try {
        console.log('Fetching user profile...');
        const user = await spotifyClient.getCurrentUser();
        console.log('User profile received:', user);
        userName.textContent = `Logged in as ${user.display_name || user.id}`;
        showStatus('Ready to set up your game!', 'success');
    } catch (error) {
        console.error('Failed to fetch user profile:', error);
        userName.textContent = 'Logged in';
        showStatus('Ready to set up your game!', 'success');
    }
}

/**
 * Show login UI
 */
function showLoginUI() {
    authSection.classList.remove('hidden');
    gameSetupSection.classList.add('hidden');
}

/**
 * Add a new team
 */
function addTeam() {
    const newTeamPlayersInput = document.getElementById('new-team-players');
    const playersText = newTeamPlayersInput.value.trim();

    if (!playersText) {
        showStatus('Please enter player names', 'error');
        return;
    }

    // Parse players from comma-separated input
    const members = playersText
        .split(',')
        .map(m => m.trim())
        .filter(m => m.length > 0);

    if (members.length < 2) {
        showStatus('A team needs at least 2 players', 'error');
        return;
    }

    const teamNumber = teams.length + 1;
    const team = {
        id: `team-${Date.now()}`,
        name: `Team ${teamNumber}`,
        members: members
    };

    teams.push(team);
    renderTeams();
    updateStartButtonState();

    // Clear input
    newTeamPlayersInput.value = '';
    showStatus(`Team ${teamNumber} added with ${members.length} players!`, 'success');
}

/**
 * Remove a team
 */
function removeTeam(teamId) {
    teams = teams.filter(t => t.id !== teamId);
    renderTeams();
    updateStartButtonState();
}

/**
 * Update team members
 */
function updateTeamMembers(teamId, membersText) {
    const team = teams.find(t => t.id === teamId);
    if (team) {
        // Split by comma and trim whitespace
        team.members = membersText
            .split(',')
            .map(m => m.trim())
            .filter(m => m.length > 0);
        updateStartButtonState();
    }
}

/**
 * Render teams list
 */
function renderTeams() {
    if (teams.length === 0) {
        teamsList.innerHTML = '<p class="empty-state">No teams yet. Click "+ Add Team" to get started!</p>';
        return;
    }

    teamsList.innerHTML = teams.map(team => `
        <div class="team-card" data-team-id="${team.id}">
            <div class="team-header">
                <input
                    type="text"
                    class="team-name-input"
                    value="${team.name}"
                    onchange="updateTeamName('${team.id}', this.value)"
                    placeholder="Team name"
                />
                <button
                    class="btn-remove"
                    onclick="removeTeam('${team.id}')"
                    title="Remove team"
                >×</button>
            </div>
            <div class="team-members">
                <label>Players (comma-separated):</label>
                <input
                    type="text"
                    class="members-input"
                    value="${team.members.join(', ')}"
                    onchange="updateTeamMembers('${team.id}', this.value)"
                    placeholder="e.g., Alice, Bob"
                />
                <div class="member-count">${team.members.length} player${team.members.length === 1 ? '' : 's'}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Update team name
 */
function updateTeamName(teamId, newName) {
    const team = teams.find(t => t.id === teamId);
    if (team) {
        team.name = newName.trim() || `Team ${teams.indexOf(team) + 1}`;
    }
}

/**
 * Update start button state
 */
function updateStartButtonState() {
    // Enable start button if at least one team has at least 2 members
    const hasValidTeam = teams.some(team => team.members.length >= 2);
    startGameButton.disabled = !hasValidTeam;

    if (!hasValidTeam && teams.length > 0) {
        startGameButton.title = 'Each team needs at least 2 players';
    } else {
        startGameButton.title = '';
    }
}

/**
 * Load user's playlists
 */
async function loadPlaylists() {
    if (userPlaylists.length > 0) {
        // Already loaded, just render
        renderPlaylists();
        renderSelectedPlaylists();
        return;
    }

    playlistsLoading.classList.remove('hidden');
    playlistsList.classList.add('hidden');
    playlistsEmpty.classList.add('hidden');

    try {
        userPlaylists = await spotifyClient.getUserPlaylists();

        // Always render - magic sources are always available
        renderPlaylists();
        renderSelectedPlaylists();
        playlistsLoading.classList.add('hidden');
        playlistsList.classList.remove('hidden');
    } catch (error) {
        console.error('Failed to load playlists:', error);
        showStatus(`Failed to load playlists: ${error.message}`, 'error');
        playlistsLoading.classList.add('hidden');
        // Still show magic sources even if playlists fail
        renderPlaylists();
        playlistsList.classList.remove('hidden');
    }
}

/**
 * Filter playlists based on search query
 */
function filterPlaylists(query) {
    renderPlaylists(query);
}

/**
 * Render available sources (magic entries + playlists not selected)
 */
function renderPlaylists(filterQuery = '') {
    const query = filterQuery.toLowerCase();

    let html = '';

    // Add magic sources (always at top)
    const availableMagicSources = MAGIC_SOURCES.filter(source => {
        const matchesFilter = source.name.toLowerCase().includes(query);
        const notSelected = !selectedPlaylistIds.includes(source.id);
        return matchesFilter && notSelected;
    });

    availableMagicSources.forEach(source => {
        html += `
            <div class="playlist-item magic-source">
                <div class="playlist-item-content">
                    <span class="playlist-name">${source.name}</span>
                    <span class="playlist-info">${source.info}</span>
                </div>
                <button
                    class="btn-add-playlist"
                    onclick="addPlaylist('${source.id}')"
                >Add</button>
            </div>
        `;
    });

    // Add separator if we have both magic sources and playlists
    const availablePlaylists = userPlaylists
        .filter(playlist => {
            const matchesFilter = playlist.name.toLowerCase().includes(query);
            const notSelected = !selectedPlaylistIds.includes(playlist.id);
            return matchesFilter && notSelected;
        })
        .sort((a, b) => b.trackCount - a.trackCount); // Sort by track count descending (biggest first)

    if (availableMagicSources.length > 0 && availablePlaylists.length > 0) {
        html += '<div class="source-separator"></div>';
    }

    // Add regular playlists
    availablePlaylists.forEach(playlist => {
        html += `
            <div class="playlist-item">
                <div class="playlist-item-content">
                    <span class="playlist-name">${playlist.name}</span>
                    <span class="playlist-info">${playlist.trackCount} tracks</span>
                </div>
                <button
                    class="btn-add-playlist"
                    onclick="addPlaylist('${playlist.id}')"
                >Add</button>
            </div>
        `;
    });

    if (html === '') {
        playlistsList.innerHTML = '<div class="empty-state">No sources found</div>';
    } else {
        playlistsList.innerHTML = html;
    }
}

/**
 * Render selected sources (magic sources + playlists)
 */
function renderSelectedPlaylists() {
    if (selectedPlaylistIds.length === 0) {
        selectedPlaylistsSection.classList.add('hidden');
        return;
    }

    selectedPlaylistsSection.classList.remove('hidden');

    let html = '';

    // Render selected sources in order
    selectedPlaylistIds.forEach(id => {
        // Check if it's a magic source
        const magicSource = MAGIC_SOURCES.find(s => s.id === id);
        if (magicSource) {
            html += `
                <div class="selected-playlist-item magic-source">
                    <span class="playlist-name">${magicSource.name}</span>
                    <span class="playlist-info">${magicSource.info}</span>
                    <button
                        class="btn-remove-playlist"
                        onclick="removePlaylist('${magicSource.id}')"
                        title="Remove source"
                    >×</button>
                </div>
            `;
        } else {
            // It's a regular playlist
            const playlist = userPlaylists.find(p => p.id === id);
            if (playlist) {
                html += `
                    <div class="selected-playlist-item">
                        <span class="playlist-name">${playlist.name}</span>
                        <span class="playlist-info">${playlist.trackCount} tracks</span>
                        <button
                            class="btn-remove-playlist"
                            onclick="removePlaylist('${playlist.id}')"
                            title="Remove playlist"
                        >×</button>
                    </div>
                `;
            }
        }
    });

    selectedPlaylistsList.innerHTML = html;
}

/**
 * Add playlist to selection
 */
function addPlaylist(playlistId) {
    if (!selectedPlaylistIds.includes(playlistId)) {
        selectedPlaylistIds.push(playlistId);

        const currentFilter = playlistFilter.value;
        renderPlaylists(currentFilter);
        renderSelectedPlaylists();

        // If filter resulted in empty view, clear it
        if (currentFilter && playlistsList.querySelector('.empty-state')) {
            playlistFilter.value = '';
            renderPlaylists('');
        }

        console.log('Added playlist:', playlistId);
    }
}

/**
 * Remove playlist from selection
 */
function removePlaylist(playlistId) {
    const index = selectedPlaylistIds.indexOf(playlistId);
    if (index !== -1) {
        selectedPlaylistIds.splice(index, 1);
        renderPlaylists(playlistFilter.value);
        renderSelectedPlaylists();
        console.log('Removed playlist:', playlistId);
    }
}

/**
 * Start the game
 */
function startGame() {
    const roundDuration = parseInt(document.getElementById('round-duration').value);
    const artistCount = parseInt(document.getElementById('artist-count').value);
    const timeRange = document.getElementById('time-range').value;

    // Validate at least one source is selected
    if (selectedPlaylistIds.length === 0) {
        showStatus('Please select at least one artist source', 'error');
        return;
    }

    // Separate magic sources from playlist IDs
    const selectedSources = [];
    const actualPlaylistIds = [];

    selectedPlaylistIds.forEach(id => {
        if (id.startsWith('__')) {
            // Magic source - pass through the ID as-is
            selectedSources.push(id);
        } else {
            // Regular playlist ID
            actualPlaylistIds.push(id);
            if (!selectedSources.includes('__playlists__')) {
                selectedSources.push('__playlists__');
            }
        }
    });

    const gameConfig = {
        teams: teams,
        roundDuration: roundDuration,
        artistSources: selectedSources,  // Array: ['top_artists', 'playlists', 'genres']
        artistCount: artistCount,
        playlistIds: actualPlaylistIds,  // Only actual playlist IDs
        timeRange: timeRange  // For top artists
    };

    // Save to localStorage for the game page
    localStorage.setItem('gameConfig', JSON.stringify(gameConfig));

    // Navigate to game page
    console.log('Game config:', gameConfig);
    window.location.href = 'game.html';
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = type;
    statusMessage.classList.remove('hidden');

    if (type === 'success') {
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 3000);
    }
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        if (button.getAttribute('data-tab') === tabName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane.id === `tab-${tabName}`) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });
}

// Make functions available globally for onclick handlers
window.removeTeam = removeTeam;
window.updateTeamMembers = updateTeamMembers;
window.updateTeamName = updateTeamName;
window.addPlaylist = addPlaylist;
window.removePlaylist = removePlaylist;
window.switchTab = switchTab;
