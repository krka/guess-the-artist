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
    currentArtistStartTime: null,
    timerInterval: null,
    remainingTime: 0,
    initialRoundDuration: 0,  // Track the actual duration for this round (for progress bar)
    phase: 'ready'
};

// Preloaded images cache
const preloadedImages = new Map();

// DOM Elements
const statusMessage = document.getElementById('status-message');

// Phase elements
const phaseError = document.getElementById('phase-error');
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
    console.log('Number of teams in game:', gameConfig.teams.length);
    console.log('Teams:', gameConfig.teams.map(t => formatTeamName(t.members)).join(' | '));

    // Randomize team order
    shuffleArray(gameConfig.teams);

    // Randomize player order within each team
    gameConfig.teams.forEach(team => {
        shuffleArray(team.members);
    });

    console.log('Teams and players randomized:', gameConfig.teams);

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
                teamMembers: team.members,
                correct: 0,
                passed: 0,
                fastestGuess: null,
                currentStreak: 0,
                currentStreakArtists: [],
                bestStreak: 0,
                bestStreakArtists: [],
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
 * Format team name from member list
 * Examples: "Alice & Bob", "Alice, Bob & Charlie"
 */
function formatTeamName(members) {
    if (!members || members.length === 0) return '';
    if (members.length === 1) return members[0];
    if (members.length === 2) return `${members[0]} & ${members[1]}`;

    // For 3+: "Alice, Bob & Charlie"
    const lastMember = members[members.length - 1];
    const otherMembers = members.slice(0, -1);
    return `${otherMembers.join(', ')} & ${lastMember}`;
}

/**
 * Format teammates for a player (excluding the current player)
 * Examples: "with Bob", "with Bob & Charlie"
 */
function formatTeammates(allMembers, currentPlayer) {
    const teammates = allMembers.filter(m => m !== currentPlayer);
    if (teammates.length === 0) return '';
    if (teammates.length === 1) return `with ${teammates[0]}`;
    if (teammates.length === 2) return `with ${teammates[0]} & ${teammates[1]}`;

    const lastMember = teammates[teammates.length - 1];
    const otherMembers = teammates.slice(0, -1);
    return `with ${otherMembers.join(', ')} & ${lastMember}`;
}

/**
 * Fetch artists based on game config
 */
async function fetchArtists() {
    try {
        const artistsMap = new Map();

        // Fetch artists from playlists
        console.log('Fetching artists from playlists...', gameConfig.playlistIds);
        const progressCallback = (detail) => {
            showStatus(`Loading artists from playlists... (${detail})`, 'info');
        };
        const artists = await spotifyClient.getArtistsFromPlaylists(gameConfig.playlistIds, progressCallback);
        console.log(`Got ${artists.length} artists from playlists`);
        artists.forEach(artist => artistsMap.set(artist.id, artist));

        // Convert to array
        let allArtists = Array.from(artistsMap.values());
        console.log(`Fetched ${allArtists.length} unique artists from all sources`);

        showStatus('Processing artists...', 'info');

        // Filter by minimum popularity if set
        const minPopularity = gameConfig.minPopularity || 0;
        if (minPopularity > 0) {
            const beforeFilter = allArtists.length;
            allArtists = allArtists.filter(artist => {
                const popularity = artist.popularity || 0;
                return popularity >= minPopularity;
            });
            console.log(`Popularity filter: ${beforeFilter} → ${allArtists.length} artists (min popularity: ${minPopularity})`);
        }

        // Calculate artists needed (total game seconds)
        const artistsNeeded = gameConfig.minArtistsNeeded ||
            (gameConfig.totalTimePerTeam * gameConfig.teams.length);

        console.log(`Game duration: ${artistsNeeded}s (artists needed), available: ${allArtists.length}`);

        // Improved artist selection to avoid repetition across games
        if (allArtists.length > artistsNeeded) {
            // Sort by popularity
            allArtists.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

            // Calculate how many artists to keep
            const remaining = allArtists.length - artistsNeeded;
            const bottomTwentyPercent = Math.floor(remaining * 0.2);
            const artistsToKeep = allArtists.length - bottomTwentyPercent;

            // Remove the bottom 20% of excess artists (keeps top 80% + all needed)
            allArtists = allArtists.slice(0, artistsToKeep);
            console.log(`Artist pool: kept ${artistsToKeep} artists (removed bottom ${bottomTwentyPercent} least popular from ${allArtists.length + bottomTwentyPercent} total)`);
        }

        // Shuffle ALL remaining artists - this provides variety across games
        shuffleArray(allArtists);
        gameState.artists = allArtists;

        console.log(`Final artist pool: ${gameState.artists.length} artists (shuffled and ready)`);

        // Check if we have enough artists for the game
        const minNeeded = gameConfig.minArtistsNeeded || 20;
        if (gameState.artists.length < minNeeded) {
            const debugInfo = {
                artistsFound: gameState.artists.length,
                minNeeded: minNeeded,
                artistsNeeded: artistsNeeded,
                minPopularity: gameConfig.minPopularity,
                playlistIds: gameConfig.playlistIds,
                teams: gameConfig.teams.length,
                playerDuration: gameConfig.playerDuration
            };
            console.error('Not enough artists! Debug info:', debugInfo);

            showErrorPhase(
                `Not enough artists!\n\nFound: ${gameState.artists.length} artists\nNeeded: ${minNeeded} artists\n\nPossible fixes:\n• Add more playlists\n• Lower the popularity filter (currently: ${gameConfig.minPopularity})\n• Reduce time per player (currently: ${gameConfig.playerDuration}s)\n• Use fewer teams (currently: ${gameConfig.teams.length} teams)`,
                debugInfo
            );
            return;
        }

        if (minPopularity > 0) {
            showStatus(`Artists loaded! (filtered by popularity ≥ ${minPopularity})`, 'success');
        } else {
            showStatus('Artists loaded!', 'success');
        }
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
 * Preload artist images for smooth transitions
 */
function preloadImages(startIndex, count = 5) {
    for (let i = 0; i < count; i++) {
        const index = (startIndex + i) % gameState.artists.length;
        const artist = gameState.artists[index];

        if (artist.image && !preloadedImages.has(artist.id)) {
            const img = new Image();
            img.src = artist.image;
            preloadedImages.set(artist.id, img);
        }
    }
}

/**
 * Show ready phase
 */
function showReadyPhase() {
    hideAllPhases();
    phaseReady.classList.remove('hidden');

    const team = gameConfig.teams[gameState.currentTeamIndex];

    console.log('showReadyPhase - gameConfig:', gameConfig);
    console.log('showReadyPhase - playerDuration:', gameConfig.playerDuration);

    if (gameConfig.gameMode === 'swap-places') {
        // Swap Places mode: show team name and total team duration
        const teamDuration = gameConfig.playerDuration * team.members.length;
        document.getElementById('ready-player-name').textContent = formatTeamName(team.members);
        document.getElementById('ready-team-name').textContent = '';  // No subtitle needed
        document.getElementById('ready-duration').textContent = teamDuration;
    } else {
        // Individual mode: show current player
        const player = team.members[gameState.currentPlayerIndex];
        document.getElementById('ready-player-name').textContent = player;
        document.getElementById('ready-team-name').textContent = formatTeammates(team.members, player);
        document.getElementById('ready-duration').textContent = gameConfig.playerDuration;
    }

    // Preload first batch of images
    preloadImages(gameState.currentArtistIndex, 5);

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

    // Reset round state
    if (gameConfig.gameMode === 'swap-places') {
        // Swap Places mode: use total team duration
        gameState.remainingTime = gameConfig.playerDuration * team.members.length;
        gameState.initialRoundDuration = gameState.remainingTime;
    } else {
        // Individual mode: use player duration
        gameState.remainingTime = gameConfig.playerDuration;
        gameState.initialRoundDuration = gameState.remainingTime;
    }

    gameState.roundStartTime = Date.now();

    // Reset current player's stats
    const player = team.members[gameState.currentPlayerIndex];
    const playerId = `${team.id}-${player}`;
    gameState.playerStats[playerId].currentStreak = 0;
    gameState.playerStats[playerId].currentStreakArtists = [];

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
        // Ran out of artists - reshuffle and reuse them
        console.log('Ran out of artists, reshuffling...');
        shuffleArray(gameState.artists);
        gameState.currentArtistIndex = 0;
        preloadedImages.clear(); // Clear cache on reshuffle
    }

    const artist = gameState.artists[gameState.currentArtistIndex];

    // Use preloaded image if available, otherwise use URL directly
    const imgElement = document.getElementById('artist-image');
    const preloadedImg = preloadedImages.get(artist.id);
    if (preloadedImg && preloadedImg.complete) {
        imgElement.src = preloadedImg.src;
    } else {
        imgElement.src = artist.image || 'https://via.placeholder.com/300?text=No+Image';
    }

    document.getElementById('artist-name').textContent = artist.name;

    // Show popularity (for debugging/tuning filter)
    const popularity = artist.popularity || 0;
    document.getElementById('artist-popularity').textContent = `Popularity: ${popularity}`;

    // Track when this artist was shown (for accurate guess timing)
    gameState.currentArtistStartTime = Date.now();

    // Preload next 5 images
    preloadImages(gameState.currentArtistIndex + 1, 5);
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

    // Update progress bar (use actual initial duration, not just playerDuration)
    const progress = (gameState.remainingTime / gameState.initialRoundDuration) * 100;
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
    stats.currentStreakArtists = []; // Clear streak artists

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

    const guessTime = (Date.now() - gameState.currentArtistStartTime) / 1000;

    // Update stats
    stats.correct++;
    stats.currentStreak++;
    stats.currentStreakArtists.push(artist);

    // Update best streak if current is better
    if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
        stats.bestStreakArtists = [...stats.currentStreakArtists];
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

    // Increment artist index so next player doesn't see the same artist (spoiler fix)
    gameState.currentArtistIndex++;

    const team = gameConfig.teams[gameState.currentTeamIndex];

    // In swap-places mode, skip individual round done and go directly to team done
    if (gameConfig.gameMode === 'swap-places') {
        showTeamDone();
        return;
    }

    // Individual mode: show player's round stats
    const player = team.members[gameState.currentPlayerIndex];
    const playerId = `${team.id}-${player}`;
    const stats = gameState.playerStats[playerId];

    // Show round summary - bar chart
    const total = stats.correct + stats.passed;
    const correctPercent = total > 0 ? (stats.correct / total) * 100 : 0;
    const passedPercent = total > 0 ? (stats.passed / total) * 100 : 0;

    document.getElementById('summary-correct').textContent = stats.correct;
    document.getElementById('summary-correct-bar').style.width = `${correctPercent}%`;

    document.getElementById('summary-passed').textContent = stats.passed;
    document.getElementById('summary-passed-bar').style.width = `${passedPercent}%`;

    // Show streak with artist thumbnails (only if 2 or more)
    if (stats.bestStreak >= 2) {
        const streakArtists = stats.bestStreakArtists.slice(0, 5);
        const streakHtml = `
            <div class="streak-header">Best Streak: ${stats.bestStreak} in a row!</div>
            <div class="streak-artists-inline">
                ${streakArtists.map(artist => `
                    <img src="${artist.image || 'https://via.placeholder.com/50?text=No+Image'}"
                         alt="${artist.name}"
                         class="streak-artist-thumb"
                         title="${artist.name}"
                    />
                `).join('')}
                ${stats.bestStreak > 5 ? `<span class="streak-more-inline">+${stats.bestStreak - 5}</span>` : ''}
            </div>
        `;
        document.getElementById('round-streak-display').innerHTML = streakHtml;
    } else {
        document.getElementById('round-streak-display').innerHTML = '';
    }

    // Always show round done phase first
    hideAllPhases();
    phaseRoundDone.classList.remove('hidden');

    const playerAnnouncementDiv = phaseRoundDone.querySelector('.player-announcement');

    // Check if this team has more players
    if (gameState.currentPlayerIndex < team.members.length - 1) {
        // More players in this team
        gameState.currentPlayerIndex++;
        const nextPlayer = team.members[gameState.currentPlayerIndex];
        document.getElementById('next-player-name').textContent = nextPlayer;
        playerAnnouncementDiv.style.display = 'block';
        document.getElementById('continue-button').onclick = startRound;
    } else {
        // Last player in team - hide "next player" section and go to team done
        playerAnnouncementDiv.style.display = 'none';
        document.getElementById('continue-button').onclick = showTeamDone;
    }
}

/**
 * Show team done phase
 */
function showTeamDone() {
    const team = gameConfig.teams[gameState.currentTeamIndex];

    console.log('showTeamDone - currentTeamIndex:', gameState.currentTeamIndex);
    console.log('showTeamDone - total teams:', gameConfig.teams.length);
    console.log('showTeamDone - team:', team);

    document.getElementById('completed-team-name').textContent = formatTeamName(team.members);
    document.getElementById('team-total-score').textContent = gameState.scores[team.id];

    // Check if there are more teams
    if (gameState.currentTeamIndex < gameConfig.teams.length - 1) {
        // Move to next team
        gameState.currentTeamIndex++;
        gameState.currentPlayerIndex = 0;

        const nextTeam = gameConfig.teams[gameState.currentTeamIndex];
        const nextPlayer = nextTeam.members[0];

        console.log('showTeamDone - Moving to next team:', nextTeam);

        document.getElementById('next-team-player').textContent = nextPlayer;
        document.getElementById('next-team-name').textContent = formatTeammates(nextTeam.members, nextPlayer);

        hideAllPhases();
        phaseTeamDone.classList.remove('hidden');
        document.getElementById('next-team-button').onclick = showReadyPhase;
    } else {
        // Game is over
        console.log('showTeamDone - Game over!');
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
            <span class="team-name">${formatTeamName(item.team.members)}</span>
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
                    <p><strong>${fastestPlayer.name}</strong> (${formatTeammates(fastestPlayer.teamMembers, fastestPlayer.name)})</p>
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
        // Show up to 5 artist images from the streak
        const streakArtists = bestStreakPlayer.bestStreakArtists.slice(0, 5);
        const artistImagesHtml = streakArtists.map(artist => `
            <img src="${artist.image || 'https://via.placeholder.com/50?text=No+Image'}"
                 alt="${artist.name}"
                 class="streak-artist-image"
                 title="${artist.name}"
            />
        `).join('');

        document.getElementById('best-streak').innerHTML = `
            <div class="highlight-content">
                <div class="highlight-text">
                    <p><strong>${bestStreakPlayer.name}</strong> (${formatTeammates(bestStreakPlayer.teamMembers, bestStreakPlayer.name)})</p>
                    <p class="streak-number">${bestStreak} in a row!</p>
                    <div class="streak-artists">
                        ${artistImagesHtml}
                        ${bestStreak > 5 ? `<span class="streak-more">+${bestStreak - 5} more</span>` : ''}
                    </div>
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
    phaseError.classList.add('hidden');
    phaseReady.classList.add('hidden');
    phasePlaying.classList.add('hidden');
    phaseRoundDone.classList.add('hidden');
    phaseTeamDone.classList.add('hidden');
    phaseGameOver.classList.add('hidden');
}

/**
 * Show error phase with details
 */
function showErrorPhase(message, debugInfo) {
    hideAllPhases();
    phaseError.classList.remove('hidden');

    document.getElementById('error-message').textContent = message;
    document.getElementById('error-debug-content').textContent = JSON.stringify(debugInfo, null, 2);
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
