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

    // Update popularity value display and save settings
    const minPopularitySlider = document.getElementById('min-popularity');
    const popularityValueDisplay = document.getElementById('popularity-value');
    if (minPopularitySlider && popularityValueDisplay) {
        minPopularitySlider.addEventListener('input', (e) => {
            popularityValueDisplay.textContent = e.target.value;
        });
        minPopularitySlider.addEventListener('change', saveState);
    }

    // Save settings when changed
    const roundDurationInput = document.getElementById('round-duration');
    if (roundDurationInput) {
        roundDurationInput.addEventListener('change', saveState);
    }

    const timeRangeSelect = document.getElementById('time-range');
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', saveState);
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

    // Restore saved state
    restoreSavedState();

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
 * Restore saved state from localStorage
 */
function restoreSavedState() {
    try {
        // Restore teams
        const savedTeams = localStorage.getItem('savedTeams');
        if (savedTeams) {
            teams = JSON.parse(savedTeams);
            renderTeams();
            updateStartButtonState();
            console.log('Restored teams:', teams);
        }

        // Restore selected playlists
        const savedPlaylists = localStorage.getItem('savedPlaylists');
        if (savedPlaylists) {
            selectedPlaylistIds = JSON.parse(savedPlaylists);
            console.log('Restored selected playlists:', selectedPlaylistIds);
        }

        // Restore game settings
        const savedSettings = localStorage.getItem('savedSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.roundDuration !== undefined) {
                document.getElementById('round-duration').value = settings.roundDuration;
            }
            if (settings.timeRange !== undefined) {
                document.getElementById('time-range').value = settings.timeRange;
            }
            if (settings.minPopularity !== undefined) {
                document.getElementById('min-popularity').value = settings.minPopularity;
                document.getElementById('popularity-value').textContent = settings.minPopularity;
            }
            console.log('Restored settings:', settings);
        }
    } catch (error) {
        console.error('Failed to restore saved state:', error);
    }
}

/**
 * Save state to localStorage
 */
function saveState() {
    try {
        localStorage.setItem('savedTeams', JSON.stringify(teams));
        localStorage.setItem('savedPlaylists', JSON.stringify(selectedPlaylistIds));

        // Save game settings
        const settings = {
            roundDuration: parseInt(document.getElementById('round-duration').value),
            timeRange: document.getElementById('time-range').value,
            minPopularity: parseInt(document.getElementById('min-popularity').value)
        };
        localStorage.setItem('savedSettings', JSON.stringify(settings));
    } catch (error) {
        console.error('Failed to save state:', error);
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

    // Parse players - use comma if present, otherwise space
    const separator = playersText.includes(',') ? ',' : ' ';
    const members = playersText
        .split(separator)
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
        members: members,
        enabled: true
    };

    teams.push(team);
    renderTeams();
    updateStartButtonState();
    saveState();

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
    saveState();
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
        saveState();
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
        <div class="team-card ${team.enabled === false ? 'disabled' : ''}" data-team-id="${team.id}">
            <div class="team-header">
                <label class="team-checkbox-label">
                    <input
                        type="checkbox"
                        ${team.enabled !== false ? 'checked' : ''}
                        onchange="toggleTeam('${team.id}', this.checked)"
                        title="Enable/disable team"
                    />
                </label>
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
        saveState();
    }
}

/**
 * Toggle team enabled/disabled
 */
function toggleTeam(teamId, enabled) {
    const team = teams.find(t => t.id === teamId);
    if (team) {
        team.enabled = enabled;
        renderTeams();
        updateStartButtonState();
        saveState();
    }
}

/**
 * Update start button state
 */
function updateStartButtonState() {
    // Enable start button if at least one enabled team has at least 2 members
    const enabledTeams = teams.filter(team => team.enabled !== false);
    const hasValidTeam = enabledTeams.some(team => team.members.length >= 2);
    startGameButton.disabled = !hasValidTeam;

    if (!hasValidTeam && teams.length > 0) {
        if (enabledTeams.length === 0) {
            startGameButton.title = 'Enable at least one team to start';
        } else {
            startGameButton.title = 'Each enabled team needs at least 2 players';
        }
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
        renderMagicSources();
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
        renderMagicSources();
        renderPlaylists();
        renderSelectedPlaylists();
        playlistsLoading.classList.add('hidden');
        playlistsList.classList.remove('hidden');
    } catch (error) {
        console.error('Failed to load playlists:', error);

        // Show specific error message
        let errorMsg = 'Could not load your playlists. ';
        if (error.message.includes('401') || error.message.includes('Session expired')) {
            errorMsg += 'Your session may have expired. Try logging out and back in.';
        } else if (error.message.includes('403')) {
            errorMsg += 'Permission denied. Please re-authorize the app.';
        } else {
            errorMsg += 'You can still use Magic Sources (My Top Artists, Decades, Related Artists).';
        }

        showStatus(errorMsg, 'error');
        playlistsLoading.classList.add('hidden');

        // Still show magic sources even if playlists fail
        renderMagicSources();
        renderPlaylists();
        playlistsList.classList.remove('hidden');
    }
}

/**
 * Filter playlists based on search query
 */
function filterPlaylists(query) {
    // Note: Only filters playlists, not magic sources
    // Magic sources are in a separate tab
    renderPlaylists(query);
}

/**
 * Render available magic sources (not selected)
 */
function renderMagicSources(filterQuery = '') {
    const query = filterQuery.toLowerCase();
    const magicSourcesList = document.getElementById('magic-sources-list');

    const availableMagicSources = MAGIC_SOURCES.filter(source => {
        const matchesFilter = source.name.toLowerCase().includes(query);
        const notSelected = !selectedPlaylistIds.includes(source.id);
        return matchesFilter && notSelected;
    });

    if (availableMagicSources.length === 0) {
        magicSourcesList.innerHTML = '<div class="empty-state">No magic sources found</div>';
        return;
    }

    const html = availableMagicSources.map(source => `
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
    `).join('');

    magicSourcesList.innerHTML = html;
}

/**
 * Render available playlists (not selected)
 */
function renderPlaylists(filterQuery = '') {
    const query = filterQuery.toLowerCase();

    const availablePlaylists = userPlaylists
        .filter(playlist => {
            const matchesFilter = playlist.name.toLowerCase().includes(query);
            const notSelected = !selectedPlaylistIds.includes(playlist.id);
            return matchesFilter && notSelected;
        })
        .sort((a, b) => b.trackCount - a.trackCount); // Sort by track count descending (biggest first)

    if (availablePlaylists.length === 0) {
        playlistsList.innerHTML = '<div class="empty-state">No playlists found</div>';
        return;
    }

    const html = availablePlaylists.map(playlist => `
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
    `).join('');

    playlistsList.innerHTML = html;
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

        const currentFilter = playlistFilter ? playlistFilter.value : '';
        renderMagicSources(currentFilter);
        renderPlaylists(currentFilter);
        renderSelectedPlaylists();

        // If filter resulted in empty view, clear it
        if (currentFilter && playlistsList.querySelector('.empty-state')) {
            if (playlistFilter) {
                playlistFilter.value = '';
            }
            renderPlaylists('');
        }

        saveState();
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
        const currentFilter = playlistFilter ? playlistFilter.value : '';
        renderMagicSources(currentFilter);
        renderPlaylists(currentFilter);
        renderSelectedPlaylists();
        saveState();
        console.log('Removed playlist:', playlistId);
    }
}

/**
 * Start the game
 */
async function startGame() {
    const roundDuration = parseInt(document.getElementById('round-duration').value);
    const timeRange = document.getElementById('time-range').value;
    const minPopularity = parseInt(document.getElementById('min-popularity').value);

    // Validate authentication BEFORE navigating
    try {
        showStatus('Checking session...', 'info');
        await spotifyClient.ensureAuthenticated();
    } catch (error) {
        console.error('Authentication check failed:', error);
        console.error('Error details:', {
            message: error.message,
            hasRefreshToken: !!localStorage.getItem('spotify_refresh_token'),
            hasAccessToken: !!spotifyClient.accessToken,
            tokenExpiry: spotifyClient.tokenExpiry ? new Date(spotifyClient.tokenExpiry).toISOString() : 'none'
        });

        // Show user-friendly error message
        let userMessage = error.message;
        if (error.message.includes('server_error') || error.message.includes('Failed to remove token')) {
            userMessage = 'Spotify is having temporary issues. Please try again in a moment.';
        } else if (error.message.includes('Session expired') || error.message.includes('No refresh token')) {
            userMessage = 'Your session has expired. Please log out and log back in.';
        }

        showStatus(userMessage, 'error');
        return;
    }

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

    // Filter to only enabled teams
    const enabledTeams = teams.filter(team => team.enabled !== false);

    // Calculate fair time distribution
    const maxTeamSize = Math.max(...enabledTeams.map(t => t.members.length));
    const totalTimePerTeam = roundDuration * maxTeamSize;

    // Calculate minimum artists needed for the entire game
    const totalGameSeconds = enabledTeams.length * totalTimePerTeam;

    const gameConfig = {
        teams: enabledTeams,
        playerDuration: roundDuration,  // Time per player in largest team
        maxTeamSize: maxTeamSize,  // Largest team size
        totalTimePerTeam: totalTimePerTeam,  // Total time each team gets
        artistSources: selectedSources,  // Array: ['top_artists', 'playlists', 'genres']
        playlistIds: actualPlaylistIds,  // Only actual playlist IDs
        timeRange: timeRange,  // For top artists
        minPopularity: minPopularity,  // Filter out obscure artists
        minArtistsNeeded: totalGameSeconds  // Minimum to avoid running out
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

/**
 * Switch between inner tabs (Magic Sources vs Your Playlists)
 */
function switchInnerTab(tabName) {
    // Update inner tab buttons
    document.querySelectorAll('.inner-tab-button').forEach(button => {
        if (button.getAttribute('data-inner-tab') === tabName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Update inner tab panes
    document.querySelectorAll('.inner-tab-pane').forEach(pane => {
        if (pane.id === `inner-tab-${tabName}`) {
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
window.toggleTeam = toggleTeam;
window.addPlaylist = addPlaylist;
window.removePlaylist = removePlaylist;
window.switchTab = switchTab;
window.switchInnerTab = switchInnerTab;
