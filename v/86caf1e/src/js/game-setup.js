/**
 * Game Setup Logic
 * Handles team management and game configuration
 */

let spotifyClient = null;
let teams = [];
let userPlaylists = [];
let previouslyUsedPlaylists = [];
let selectedPlaylistIds = [];

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

    const gameModeSelect = document.getElementById('game-mode');
    if (gameModeSelect) {
        gameModeSelect.addEventListener('change', () => {
            saveState();
            updateReviewSummary();
        });
    }

    // Search playlists
    const searchButton = document.getElementById('playlist-search-button');
    const searchInput = document.getElementById('playlist-search-input');
    if (searchButton) {
        searchButton.addEventListener('click', searchPlaylists);
    }
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchPlaylists();
            }
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

    // Restore saved state
    restoreSavedState();

    // Load playlists immediately
    loadPlaylists();

    // Update button state and summary to ensure everything is in sync
    updateStartButtonState();
    updateReviewSummary();

    // Fetch user profile in background
    try {
        console.log('Fetching user profile...');
        const user = await spotifyClient.getCurrentUser();
        console.log('User profile received:', user);
        if (userName) {
            userName.textContent = `Logged in as ${user.display_name || user.id}`;
        }
        showStatus('Ready to set up your game!', 'success');
    } catch (error) {
        console.error('Failed to fetch user profile:', error);
        if (userName) {
            userName.textContent = 'Logged in';
        }
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
            // Update the selected count immediately (before playlists load)
            const selectedTabLabel = document.getElementById('selected-tab-label');
            if (selectedTabLabel) {
                selectedTabLabel.textContent = `Selected (${selectedPlaylistIds.length})`;
            }
        }

        // Restore previously used playlists
        loadPreviouslyUsedPlaylists();

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
            if (settings.gameMode !== undefined) {
                document.getElementById('game-mode').value = settings.gameMode;
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
            minPopularity: parseInt(document.getElementById('min-popularity').value),
            gameMode: document.getElementById('game-mode').value
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
    const teamNumber = teams.length + 1;
    const team = {
        id: `team-${Date.now()}`,
        name: `Team ${teamNumber}`,
        members: [],
        enabled: true
    };

    teams.push(team);
    renderTeams();
    updateStartButtonState();
    saveState();

    // Focus on the new team's input
    setTimeout(() => {
        const newTeamInput = document.querySelector(`[data-team-id="${team.id}"] .team-members-input`);
        if (newTeamInput) {
            newTeamInput.focus();
        }
    }, 50);
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
        // Split by comma if present, otherwise by whitespace for simple names
        if (membersText.includes(',')) {
            // Comma-separated: split by comma, trim each part
            team.members = membersText
                .split(',')
                .map(m => m.trim())
                .filter(m => m.length > 0);
        } else {
            // Space-separated: split by any whitespace, trim and filter
            team.members = membersText
                .trim()
                .split(/\s+/)
                .filter(m => m.length > 0);
        }
        updateStartButtonState();
        updateReviewSummary();
        saveState();
    }
}

/**
 * Render teams list
 */
function renderTeams() {
    if (teams.length === 0) {
        teamsList.innerHTML = '<p class="empty-state">No teams yet. Click "+ New Team" to get started!</p>';
        updateReviewSummary();
        return;
    }

    teamsList.innerHTML = teams.map(team => `
        <div class="team-row ${team.enabled === false ? 'disabled' : ''}" data-team-id="${team.id}">
            <button
                class="btn-remove-inline"
                onclick="removeTeam('${team.id}')"
                title="Remove team"
            >×</button>
            <label class="team-checkbox-inline">
                <input
                    type="checkbox"
                    ${team.enabled !== false ? 'checked' : ''}
                    onchange="toggleTeam('${team.id}', this.checked)"
                    title="Enable/disable team"
                />
            </label>
            <input
                type="text"
                class="team-members-input"
                value="${team.members.join(', ')}"
                oninput="updateTeamMembers('${team.id}', this.value)"
                placeholder="Player names (e.g., Alice Bob or Alice, Bob)"
            />
        </div>
    `).join('');
    updateReviewSummary();
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
    // Start button is always enabled now - we'll handle validation in startGame()
    startGameButton.disabled = false;

    // Update button text to show team count if there are valid teams
    const validTeams = teams.filter(team =>
        team.enabled !== false &&
        team.members.length >= 2
    );

    if (validTeams.length === 0) {
        startGameButton.textContent = 'Start Game';
        startGameButton.title = '';
    } else {
        const teamText = validTeams.length === 1 ? 'team' : 'teams';
        startGameButton.textContent = `Start Game (${validTeams.length} ${teamText})`;
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
        renderPreviouslyUsed();
        return;
    }

    playlistsLoading.classList.remove('hidden');
    playlistsList.classList.add('hidden');
    playlistsEmpty.classList.add('hidden');

    try {
        userPlaylists = await spotifyClient.getUserPlaylists();

        renderPlaylists();
        renderSelectedPlaylists();
        renderPreviouslyUsed();
        playlistsLoading.classList.add('hidden');
        playlistsList.classList.remove('hidden');
    } catch (error) {
        console.error('Failed to load playlists:', error);

        // If refresh token is invalid/revoked, automatically logout and redirect to login
        if (error.message.includes('refresh token') ||
            error.message.includes('Not authenticated') ||
            error.message.includes('revoked')) {
            showStatus('Session expired. Redirecting to login...', 'error');
            setTimeout(() => {
                spotifyClient.logout();
                showLoginUI();
            }, 2000);
            return;
        }

        // Show specific error message
        let errorMsg = 'Could not load your playlists. ';
        if (error.message.includes('401') || error.message.includes('Session expired')) {
            errorMsg += 'Your session may have expired. Try logging out and back in.';
        } else if (error.message.includes('403')) {
            errorMsg += 'Permission denied. Please re-authorize the app.';
        } else {
            errorMsg += 'Please try again later.';
        }

        showStatus(errorMsg, 'error');
        playlistsLoading.classList.add('hidden');
        renderPlaylists();
        renderPreviouslyUsed();
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
 * Render selected playlists
 */
function renderSelectedPlaylists() {
    // Update the selected count in the tab label
    const selectedTabLabel = document.getElementById('selected-tab-label');
    if (selectedTabLabel) {
        selectedTabLabel.textContent = `Selected (${selectedPlaylistIds.length})`;
    }

    if (selectedPlaylistIds.length === 0) {
        selectedPlaylistsList.innerHTML = '<div class="empty-state">No sources selected yet</div>';
        updateReviewSummary();
        return;
    }

    let html = '';

    // Render selected playlists in order
    selectedPlaylistIds.forEach(id => {
        // Check user playlists first
        const playlist = userPlaylists.find(p => p.id === id);
        if (playlist) {
            html += `
                <div class="playlist-item">
                    <div class="playlist-item-content">
                        <span class="playlist-name">${playlist.name}</span>
                        <span class="playlist-info">${playlist.trackCount} tracks</span>
                    </div>
                    <button
                        class="btn-remove-playlist"
                        onclick="removePlaylist('${playlist.id}')"
                        title="Remove playlist"
                    >×</button>
                </div>
            `;
        } else {
            // Check previously used playlists
            const prevPlaylist = previouslyUsedPlaylists.find(p => p.id === id);
            if (prevPlaylist) {
                html += `
                    <div class="playlist-item">
                        <div class="playlist-item-content">
                            <span class="playlist-name">${prevPlaylist.name}</span>
                            <span class="playlist-info">${prevPlaylist.trackCount} tracks • by ${prevPlaylist.owner}</span>
                        </div>
                        <button
                            class="btn-remove-playlist"
                            onclick="removePlaylist('${prevPlaylist.id}')"
                            title="Remove playlist"
                        >×</button>
                    </div>
                `;
            }
        }
    });

    selectedPlaylistsList.innerHTML = html;
    updateReviewSummary();
}

/**
 * Add playlist to selection
 */
function addPlaylist(playlistId, playlistData = null) {
    if (!selectedPlaylistIds.includes(playlistId)) {
        selectedPlaylistIds.push(playlistId);

        // If this is a public playlist (has playlistData), save it to previously used
        if (playlistData && !userPlaylists.find(p => p.id === playlistId)) {
            // Add to previously used if not already there
            if (!previouslyUsedPlaylists.find(p => p.id === playlistId)) {
                previouslyUsedPlaylists.push(playlistData);
                savePreviouslyUsedPlaylists();
            }
        }

        const currentFilter = playlistFilter ? playlistFilter.value : '';
        renderPlaylists(currentFilter);
        renderSelectedPlaylists();
        renderPreviouslyUsed();

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
        renderPlaylists(currentFilter);
        renderSelectedPlaylists();
        renderPreviouslyUsed();
        saveState();
        console.log('Removed playlist:', playlistId);
    }
}

/**
 * Search for playlists
 */
async function searchPlaylists() {
    const searchInput = document.getElementById('playlist-search-input');
    const searchResultsList = document.getElementById('search-results-list');
    const searchResultsLoading = document.getElementById('search-results-loading');
    const query = searchInput.value.trim();

    if (!query) {
        searchResultsList.innerHTML = '<div class="empty-state">Enter a search term to find playlists</div>';
        return;
    }

    searchResultsLoading.classList.remove('hidden');
    searchResultsList.innerHTML = '';

    try {
        const results = await spotifyClient.searchPlaylists(query);

        searchResultsLoading.classList.add('hidden');

        if (results.length === 0) {
            searchResultsList.innerHTML = '<div class="empty-state">No playlists found</div>';
            return;
        }

        // Filter out already selected playlists
        const availableResults = results.filter(p => !selectedPlaylistIds.includes(p.id));

        if (availableResults.length === 0) {
            searchResultsList.innerHTML = '<div class="empty-state">All results are already added</div>';
            return;
        }

        const html = availableResults.map(playlist => `
            <div class="playlist-item">
                <div class="playlist-item-content">
                    <span class="playlist-name">${playlist.name}</span>
                    <span class="playlist-info">${playlist.trackCount} tracks • by ${playlist.owner}</span>
                </div>
                <button
                    class="btn-add-playlist"
                    onclick='addPlaylist("${playlist.id}", ${JSON.stringify(playlist).replace(/'/g, "&#39;")})'
                >Add</button>
            </div>
        `).join('');

        searchResultsList.innerHTML = html;
    } catch (error) {
        console.error('Search failed:', error);
        searchResultsLoading.classList.add('hidden');
        searchResultsList.innerHTML = '<div class="empty-state">Search failed. Please try again.</div>';
        showStatus('Failed to search playlists', 'error');
    }
}

/**
 * Render previously used playlists
 */
function renderPreviouslyUsed() {
    const previousPlaylistsList = document.getElementById('previous-playlists-list');

    // Filter out already selected playlists
    const availablePrevious = previouslyUsedPlaylists.filter(p => !selectedPlaylistIds.includes(p.id));

    if (availablePrevious.length === 0) {
        previousPlaylistsList.innerHTML = '<div class="empty-state">No previously used playlists</div>';
        return;
    }

    const html = availablePrevious.map(playlist => `
        <div class="playlist-item">
            <div class="playlist-item-content">
                <span class="playlist-name">${playlist.name}</span>
                <span class="playlist-info">${playlist.trackCount} tracks • by ${playlist.owner}</span>
            </div>
            <button
                class="btn-add-playlist"
                onclick='addPlaylist("${playlist.id}", ${JSON.stringify(playlist).replace(/'/g, "&#39;")})'
            >Add</button>
            <button
                class="btn-remove-inline"
                onclick="removePreviouslyUsed('${playlist.id}')"
                title="Remove from history"
            >×</button>
        </div>
    `).join('');

    previousPlaylistsList.innerHTML = html;
}

/**
 * Remove a playlist from previously used list
 */
function removePreviouslyUsed(playlistId) {
    previouslyUsedPlaylists = previouslyUsedPlaylists.filter(p => p.id !== playlistId);
    savePreviouslyUsedPlaylists();
    renderPreviouslyUsed();
}

/**
 * Save previously used playlists to localStorage
 */
function savePreviouslyUsedPlaylists() {
    try {
        localStorage.setItem('previouslyUsedPlaylists', JSON.stringify(previouslyUsedPlaylists));
    } catch (error) {
        console.error('Failed to save previously used playlists:', error);
    }
}

/**
 * Load previously used playlists from localStorage
 */
function loadPreviouslyUsedPlaylists() {
    try {
        const saved = localStorage.getItem('previouslyUsedPlaylists');
        if (saved) {
            previouslyUsedPlaylists = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Failed to load previously used playlists:', error);
        previouslyUsedPlaylists = [];
    }
}

/**
 * Start the game
 */
async function startGame() {
    const roundDuration = parseInt(document.getElementById('round-duration').value);
    const timeRange = document.getElementById('time-range').value;
    const minPopularity = parseInt(document.getElementById('min-popularity').value);
    const gameMode = document.getElementById('game-mode').value;

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

    // Validate at least one playlist is selected
    if (selectedPlaylistIds.length === 0) {
        showStatus('Please select at least one source from the Sources tab', 'error');
        // Switch to sources tab to help user
        switchTab('sources');
        return;
    }

    // Filter to only enabled, non-empty teams with at least 2 players
    let validTeams = teams.filter(team =>
        team.enabled !== false &&
        team.members.length >= 2
    );

    // If no valid teams, create default teams based on game mode
    if (validTeams.length === 0) {
        if (gameMode === 'swap-places') {
            // For swap-places mode, create a single team with no player names
            // The game will handle role swapping without needing names
            validTeams = [{
                id: 'default-team',
                name: 'Team',
                members: ['Player 1', 'Player 2'],
                enabled: true
            }];
        } else {
            // For individual mode, create 2 default players
            validTeams = [
                {
                    id: 'default-player-1',
                    name: 'Player 1',
                    members: ['Player 1'],
                    enabled: true
                },
                {
                    id: 'default-player-2',
                    name: 'Player 2',
                    members: ['Player 2'],
                    enabled: true
                }
            ];
        }
        console.log('No teams configured, using default setup');
    } else {
        // Warn if any teams were filtered out
        const filteredOutTeams = teams.filter(team =>
            team.enabled === false || team.members.length < 2
        );
        if (filteredOutTeams.length > 0) {
            const reasons = filteredOutTeams.map(team => {
                const teamLabel = team.members.length > 0 ? team.members.join(' & ') : 'Empty team';
                if (team.enabled === false) {
                    return `${teamLabel}: disabled`;
                } else if (team.members.length < 2) {
                    return `${teamLabel}: only ${team.members.length} player(s)`;
                }
            }).join(', ');
            console.warn('Teams excluded from game:', reasons);
        }
    }

    console.log('Valid teams for game:', validTeams.map(t => `${t.members.join(' & ')} (${t.members.length} players)`).join(', '));

    // Calculate total game time needed
    const totalPlayerCount = validTeams.reduce((sum, team) => sum + team.members.length, 0);
    const totalGameSeconds = totalPlayerCount * roundDuration;

    const gameConfig = {
        teams: validTeams,
        playerDuration: roundDuration,  // Time per player (exactly what's in the setting)
        gameMode: gameMode,  // 'individual' or 'swap-places'
        playlistIds: selectedPlaylistIds,  // Selected playlist IDs
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
 * Update review summary
 */
function updateReviewSummary() {
    const reviewTeams = document.getElementById('review-teams');
    const reviewSources = document.getElementById('review-sources');
    const reviewSettings = document.getElementById('review-settings');

    if (!reviewTeams || !reviewSources || !reviewSettings) {
        return;
    }

    // Teams summary
    const validTeams = teams.filter(team => team.enabled !== false && team.members.length >= 2);
    const gameMode = document.getElementById('game-mode').value;

    if (validTeams.length === 0) {
        if (gameMode === 'swap-places') {
            reviewTeams.innerHTML = '<p style="color: #b3b3b3;">Default: 2 players (swap places mode)</p>';
        } else {
            reviewTeams.innerHTML = '<p style="color: #b3b3b3;">Default: Player 1, Player 2</p>';
        }
    } else {
        const teamsHtml = validTeams.map(team => {
            const membersList = team.members.join(', ');
            return `<p style="color: var(--text-color); margin-bottom: 8px;">• ${membersList}</p>`;
        }).join('');
        reviewTeams.innerHTML = teamsHtml;
    }

    // Sources summary
    if (selectedPlaylistIds.length === 0) {
        reviewSources.innerHTML = '<p style="color: #b3b3b3;">No sources selected</p>';
    } else {
        const sourcesHtml = selectedPlaylistIds.map(id => {
            const playlist = userPlaylists.find(p => p.id === id);
            if (playlist) {
                return `<p style="color: var(--text-color); margin-bottom: 8px;">• ${playlist.name} <span style="color: #b3b3b3;">(${playlist.trackCount} tracks)</span></p>`;
            }
            const prevPlaylist = previouslyUsedPlaylists.find(p => p.id === id);
            if (prevPlaylist) {
                return `<p style="color: var(--text-color); margin-bottom: 8px;">• ${prevPlaylist.name} <span style="color: #b3b3b3;">(${prevPlaylist.trackCount} tracks)</span></p>`;
            }
            // Playlist not loaded yet - show loading state
            return `<p style="color: #b3b3b3; margin-bottom: 8px;">• Loading...</p>`;
        }).join('');
        reviewSources.innerHTML = sourcesHtml || '<p style="color: #b3b3b3;">Loading sources...</p>';
    }

    // Settings summary
    const roundDuration = document.getElementById('round-duration').value;
    const minPopularity = document.getElementById('min-popularity').value;

    const gameModeText = gameMode === 'individual' ? 'Individual Rounds' : 'Swap Places (Team Round)';

    reviewSettings.innerHTML = `
        <p style="color: var(--text-color); margin-bottom: 8px;">• Time per player: <strong>${roundDuration}s</strong></p>
        <p style="color: var(--text-color); margin-bottom: 8px;">• Game mode: <strong>${gameModeText}</strong></p>
        <p style="color: var(--text-color); margin-bottom: 8px;">• Difficulty: <strong>${minPopularity === '0' ? 'All artists' : 'Min popularity ' + minPopularity}</strong></p>
    `;
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

    // Update review summary when switching to play tab
    if (tabName === 'play') {
        updateReviewSummary();
    }
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
window.toggleTeam = toggleTeam;
window.addPlaylist = addPlaylist;
window.removePlaylist = removePlaylist;
window.removePreviouslyUsed = removePreviouslyUsed;
window.switchTab = switchTab;
window.switchInnerTab = switchInnerTab;
