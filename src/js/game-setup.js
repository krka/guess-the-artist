/**
 * Game Setup Logic
 * Handles team management and game configuration
 */

let spotifyClient = null;
let teams = [];

// DOM Elements
const authSection = document.getElementById('auth-section');
const gameSetupSection = document.getElementById('game-setup-section');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userName = document.getElementById('user-name');
const addTeamButton = document.getElementById('add-team-button');
const teamsList = document.getElementById('teams-list');
const startGameButton = document.getElementById('start-game-button');
const artistSourceSelect = document.getElementById('artist-source');
const timeRangeGroup = document.getElementById('time-range-group');
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
 * Start the game
 */
function startGame() {
    const roundDuration = parseInt(document.getElementById('round-duration').value);
    const artistSource = document.getElementById('artist-source').value;
    const timeRange = document.getElementById('time-range').value;
    const artistCount = parseInt(document.getElementById('artist-count').value);

    const gameConfig = {
        teams: teams,
        roundDuration: roundDuration,
        artistSource: artistSource,
        timeRange: timeRange,
        artistCount: artistCount
    };

    // Save to localStorage for the game page
    localStorage.setItem('gameConfig', JSON.stringify(gameConfig));

    // TODO: Navigate to game page
    showStatus('Game starting soon... (game page not implemented yet)', 'info');
    console.log('Game config:', gameConfig);
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

// Make functions available globally for onclick handlers
window.removeTeam = removeTeam;
window.updateTeamMembers = updateTeamMembers;
window.updateTeamName = updateTeamName;
