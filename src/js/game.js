/**
 * Game Logic
 * Handles the actual gameplay
 */

let spotifyClient = null;
let gameConfig = null;
let gameState = {
    artists: [],
    currentTeamIndex: 0,
    currentPlayerIndex: 0,
    currentArtistIndex: 0,
    scores: {}, // teamId -> score
    playerStats: {}, // playerId -> { correct, passed, fastestGuess, currentStreak, bestStreak, guesses: [] }
    roundStartTime: null,
    timerInterval: null,
    remainingTime: 0,
    phase: 'ready'
};

// DOM Elements
const statusMessage = document.getElementById('status-message');

// Phase elements
const phaseReady = document.getElementById('phase-ready');
const phasePlaying = document.getElementById('phase-playing');
const phaseRoundDone = document.getElementById('phase-round-done');
const phaseTeamDone = document.getElementById('phase-team-done');
const phaseGameOver = document.getElementById('phase-game-over');

/**
 * Initialize game on page load
 */
window.addEventListener('DOMContentLoaded', async () => {
    spotifyClient = new SpotifyClient();

    // Load game config from localStorage
    const configJson = localStorage.getItem('gameConfig');
    if (!configJson) {
        showStatus('No game configuration found. Redirecting to setup...', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    gameConfig = JSON.parse(configJson);
    console.log('Game config loaded:', gameConfig);

    // Validate we're logged in
    if (!spotifyClient.isAuthenticated()) {
        showStatus('Please log in to play', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    // Initialize scores
    gameConfig.teams.forEach(team => {
        gameState.scores[team.id] = 0;
        team.members.forEach(member => {
            const playerId = `${team.id}-${member}`;
            gameState.playerStats[playerId] = {
                name: member,
                teamName: team.name,
                correct: 0,
                passed: 0,
                fastestGuess: null,
                currentStreak: 0,
                bestStreak: 0,
                guesses: []
            };
        });
    });

    // Fetch artists
    await fetchArtists();

    // Start game
    showReadyPhase();
});

/**
 * Fetch artists based on game config
 */
async function fetchArtists() {
    showStatus('Loading artists...', 'info');

    try {
        const artistsMap = new Map();

        // Fetch from each selected source
        for (const source of gameConfig.artistSources) {
            if (source === '__top_artists__') {
                const timeRange = gameConfig.timeRange || 'medium_term';
                const artists = await spotifyClient.getTopArtists(50, timeRange);
                artists.forEach(artist => artistsMap.set(artist.id, artist));
            } else if (source === '__related_artists__') {
                const artists = await spotifyClient.getRelatedArtists(50);
                artists.forEach(artist => artistsMap.set(artist.id, artist));
            } else if (source === '__global_top_50__') {
                const playlistId = spotifyClient.getTop50PlaylistId('global');
                const artists = await spotifyClient.getArtistsFromPlaylist(playlistId);
                artists.forEach(artist => artistsMap.set(artist.id, artist));
            } else if (source === '__top_usa__') {
                const playlistId = spotifyClient.getTop50PlaylistId('usa');
                const artists = await spotifyClient.getArtistsFromPlaylist(playlistId);
                artists.forEach(artist => artistsMap.set(artist.id, artist));
            } else if (source === '__top_uk__') {
                const playlistId = spotifyClient.getTop50PlaylistId('uk');
                const artists = await spotifyClient.getArtistsFromPlaylist(playlistId);
                artists.forEach(artist => artistsMap.set(artist.id, artist));
            } else if (source === '__top_sweden__') {
                const playlistId = spotifyClient.getTop50PlaylistId('sweden');
                const artists = await spotifyClient.getArtistsFromPlaylist(playlistId);
                artists.forEach(artist => artistsMap.set(artist.id, artist));
            } else if (source === '__top_japan__') {
                const playlistId = spotifyClient.getTop50PlaylistId('japan');
                const artists = await spotifyClient.getArtistsFromPlaylist(playlistId);
                artists.forEach(artist => artistsMap.set(artist.id, artist));
            } else if (source === '__top_brazil__') {
                const playlistId = spotifyClient.getTop50PlaylistId('brazil');
                const artists = await spotifyClient.getArtistsFromPlaylist(playlistId);
                artists.forEach(artist => artistsMap.set(artist.id, artist));
            } else if (source.startsWith('__decade_')) {
                const decade = source.replace('__decade_', '').replace('__', '');
                const artists = await spotifyClient.getArtistsByDecade(decade, 50);
                artists.forEach(artist => artistsMap.set(artist.id, artist));
            } else if (source === '__playlists__') {
                const artists = await spotifyClient.getArtistsFromPlaylists(gameConfig.playlistIds);
                artists.forEach(artist => artistsMap.set(artist.id, artist));
            }
        }

        // Convert to array and shuffle
        gameState.artists = Array.from(artistsMap.values());
        shuffleArray(gameState.artists);

        // Limit to requested count
        gameState.artists = gameState.artists.slice(0, gameConfig.artistCount);

        console.log(`Loaded ${gameState.artists.length} artists`);
        showStatus('Artists loaded!', 'success');
    } catch (error) {
        console.error('Failed to fetch artists:', error);
        showStatus(`Failed to load artists: ${error.message}`, 'error');
    }
}

/**
 * Shuffle array in place
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Show ready phase
 */
function showReadyPhase() {
    hideAllPhases();
    phaseReady.classList.remove('hidden');

    const team = gameConfig.teams[gameState.currentTeamIndex];
    const player = team.members[gameState.currentPlayerIndex];
    const playerDuration = Math.floor(gameConfig.roundDuration / team.members.length);

    document.getElementById('ready-player-name').textContent = player;
    document.getElementById('ready-team-name').textContent = team.name;
    document.getElementById('ready-duration').textContent = playerDuration;

    // Setup go button
    const goButton = document.getElementById('go-button');
    goButton.onclick = startRound;
}

/**
 * Start a round
 */
function startRound() {
    hideAllPhases();
    phasePlaying.classList.remove('hidden');

    const team = gameConfig.teams[gameState.currentTeamIndex];
    const player = team.members[gameState.currentPlayerIndex];
    const playerId = `${team.id}-${player}`;
    const playerDuration = Math.floor(gameConfig.roundDuration / team.members.length);

    // Reset round state
    gameState.remainingTime = playerDuration;
    gameState.roundStartTime = Date.now();
    gameState.playerStats[playerId].currentStreak = 0;

    // Show first artist
    showCurrentArtist();

    // Start timer
    startTimer();

    // Setup buttons
    document.getElementById('pass-button').onclick = handlePass;
    document.getElementById('correct-button').onclick = handleCorrect;

    // Update stats display
    updateStatsDisplay();
}

/**
 * Show current artist
 */
function showCurrentArtist() {
    if (gameState.currentArtistIndex >= gameState.artists.length) {
        // No more artists
        endRound();
        return;
    }

    const artist = gameState.artists[gameState.currentArtistIndex];
    document.getElementById('artist-image').src = artist.image || 'https://via.placeholder.com/300?text=No+Image';
    document.getElementById('artist-name').textContent = artist.name;
}

/**
 * Start countdown timer
 */
function startTimer() {
    updateTimerDisplay();

    gameState.timerInterval = setInterval(() => {
        gameState.remainingTime--;
        updateTimerDisplay();

        if (gameState.remainingTime <= 0) {
            endRound();
        }
    }, 1000);
}

/**
 * Update timer display
 */
function updateTimerDisplay() {
    const timerElement = document.getElementById('timer');
    timerElement.textContent = gameState.remainingTime;

    // Update progress bar
    const team = gameConfig.teams[gameState.currentTeamIndex];
    const playerDuration = Math.floor(gameConfig.roundDuration / team.members.length);
    const progress = (gameState.remainingTime / playerDuration) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;

    // Color changes based on time
    if (gameState.remainingTime <= 10) {
        timerElement.style.color = '#e74c3c';
    } else if (gameState.remainingTime <= 20) {
        timerElement.style.color = '#f39c12';
    } else {
        timerElement.style.color = '#1db954';
    }
}

/**
 * Update stats display during round
 */
function updateStatsDisplay() {
    const team = gameConfig.teams[gameState.currentTeamIndex];
    const player = team.members[gameState.currentPlayerIndex];
    const playerId = `${team.id}-${player}`;
    const stats = gameState.playerStats[playerId];

    document.getElementById('current-correct').textContent = stats.correct;
    document.getElementById('current-passed').textContent = stats.passed;
    document.getElementById('current-streak').textContent = stats.currentStreak;
}

/**
 * Handle pass button
 */
function handlePass() {
    const team = gameConfig.teams[gameState.currentTeamIndex];
    const player = team.members[gameState.currentPlayerIndex];
    const playerId = `${team.id}-${player}`;
    const stats = gameState.playerStats[playerId];

    stats.passed++;
    stats.currentStreak = 0; // Break streak

    // Move to next artist
    gameState.currentArtistIndex++;
    showCurrentArtist();
    updateStatsDisplay();
}

/**
 * Handle correct button
 */
function handleCorrect() {
    const team = gameConfig.teams[gameState.currentTeamIndex];
    const player = team.members[gameState.currentPlayerIndex];
    const playerId = `${team.id}-${player}`;
    const stats = gameState.playerStats[playerId];
    const artist = gameState.artists[gameState.currentArtistIndex];

    const guessTime = (Date.now() - gameState.roundStartTime) / 1000;

    // Update stats
    stats.correct++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
    }

    // Track fastest guess
    if (stats.fastestGuess === null || guessTime < stats.fastestGuess.time) {
        stats.fastestGuess = {
            time: guessTime,
            artist: artist
        };
    }

    // Add to team score
    gameState.scores[team.id]++;

    // Record guess
    stats.guesses.push({
        artist: artist,
        time: guessTime,
        wasCorrect: true
    });

    // Move to next artist
    gameState.currentArtistIndex++;
    showCurrentArtist();
    updateStatsDisplay();
}

/**
 * End current round
 */
function endRound() {
    // Stop timer
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }

    const team = gameConfig.teams[gameState.currentTeamIndex];
    const player = team.members[gameState.currentPlayerIndex];
    const playerId = `${team.id}-${player}`;
    const stats = gameState.playerStats[playerId];

    // Show round summary
    document.getElementById('summary-correct').textContent = stats.correct;
    document.getElementById('summary-passed').textContent = stats.passed;
    document.getElementById('summary-streak').textContent = stats.bestStreak;

    // Check if this team has more players
    if (gameState.currentPlayerIndex < team.members.length - 1) {
        // More players in this team
        gameState.currentPlayerIndex++;
        const nextPlayer = team.members[gameState.currentPlayerIndex];
        document.getElementById('next-player-name').textContent = nextPlayer;

        hideAllPhases();
        phaseRoundDone.classList.remove('hidden');
        document.getElementById('continue-button').onclick = startRound;
    } else {
        // Team is done
        showTeamDone();
    }
}

/**
 * Show team done phase
 */
function showTeamDone() {
    const team = gameConfig.teams[gameState.currentTeamIndex];

    document.getElementById('completed-team-name').textContent = team.name;
    document.getElementById('team-total-score').textContent = gameState.scores[team.id];

    // Check if there are more teams
    if (gameState.currentTeamIndex < gameConfig.teams.length - 1) {
        // Move to next team
        gameState.currentTeamIndex++;
        gameState.currentPlayerIndex = 0;

        const nextTeam = gameConfig.teams[gameState.currentTeamIndex];
        const nextPlayer = nextTeam.members[0];

        document.getElementById('next-team-player').textContent = nextPlayer;
        document.getElementById('next-team-name').textContent = nextTeam.name;

        hideAllPhases();
        phaseTeamDone.classList.remove('hidden');
        document.getElementById('next-team-button').onclick = showReadyPhase;
    } else {
        // Game is over
        showGameOver();
    }
}

/**
 * Show game over and final scores
 */
function showGameOver() {
    hideAllPhases();
    phaseGameOver.classList.remove('hidden');

    // Build scores list
    const scoresList = gameConfig.teams
        .map(team => ({
            team: team,
            score: gameState.scores[team.id]
        }))
        .sort((a, b) => b.score - a.score);

    const scoresHtml = scoresList.map((item, index) => `
        <div class="score-item ${index === 0 ? 'winner' : ''}">
            <span class="rank">${index + 1}.</span>
            <span class="team-name">${item.team.name}</span>
            <span class="score">${item.score}</span>
        </div>
    `).join('');

    document.getElementById('scores-list').innerHTML = scoresHtml;

    // Find fastest guess
    let fastestGuess = null;
    let fastestPlayer = null;

    Object.entries(gameState.playerStats).forEach(([playerId, stats]) => {
        if (stats.fastestGuess && (fastestGuess === null || stats.fastestGuess.time < fastestGuess.time)) {
            fastestGuess = stats.fastestGuess;
            fastestPlayer = stats;
        }
    });

    if (fastestGuess) {
        document.getElementById('fastest-guess').innerHTML = `
            <div class="highlight-content">
                <img src="${fastestGuess.artist.image}" alt="${fastestGuess.artist.name}" class="highlight-artist-image">
                <div class="highlight-text">
                    <p><strong>${fastestPlayer.name}</strong> (${fastestPlayer.teamName})</p>
                    <p>${fastestGuess.artist.name}</p>
                    <p class="time">${fastestGuess.time.toFixed(1)}s</p>
                </div>
            </div>
        `;
    } else {
        document.getElementById('fastest-guess').innerHTML = '<p>No guesses recorded</p>';
    }

    // Find best streak
    let bestStreak = 0;
    let bestStreakPlayer = null;

    Object.entries(gameState.playerStats).forEach(([playerId, stats]) => {
        if (stats.bestStreak > bestStreak) {
            bestStreak = stats.bestStreak;
            bestStreakPlayer = stats;
        }
    });

    if (bestStreakPlayer && bestStreak > 0) {
        document.getElementById('best-streak').innerHTML = `
            <div class="highlight-content">
                <div class="highlight-text">
                    <p><strong>${bestStreakPlayer.name}</strong> (${bestStreakPlayer.teamName})</p>
                    <p class="streak-number">${bestStreak} in a row!</p>
                </div>
            </div>
        `;
    } else {
        document.getElementById('best-streak').innerHTML = '<p>No streaks recorded</p>';
    }
}

/**
 * Hide all phase elements
 */
function hideAllPhases() {
    phaseReady.classList.add('hidden');
    phasePlaying.classList.add('hidden');
    phaseRoundDone.classList.add('hidden');
    phaseTeamDone.classList.add('hidden');
    phaseGameOver.classList.add('hidden');
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
