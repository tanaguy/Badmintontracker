// ================================
// BADMINTON TRACKER - WEB APP
// ================================

// ========== DATA MANAGEMENT ==========
const DB = {
    players: 'badminton_players',
    matches: 'badminton_matches',
    sessions: 'badminton_sessions',
    currentSession: 'badminton_current_session'
};

// Generate UUID
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Storage functions
function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function loadData(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

// ========== STATE ==========
let state = {
    players: loadData(DB.players) || [],
    matches: loadData(DB.matches) || [],
    sessions: loadData(DB.sessions) || [],
    currentSession: loadData(DB.currentSession) || null,
    pendingMatches: [],
    selectedPlayers: new Set(),
    editingPlayer: null,
    selectedSkill: 3,
    selectedAvatar: null,
    matchType: 'singles',
    matchCount: 1,
    useSkillMatching: false,
    currentMatch: null,
    selectedWinner: 1,
    rankingView: 'overall',
    historyView: 'sessions'
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    render();
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js');
    }
});

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

// ========== TAB NAVIGATION ==========
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Render the active tab
    render();
}

// ========== RENDER FUNCTIONS ==========
function render() {
    renderSession();
    renderPlayers();
    renderRankings();
    renderHistory();
}

function renderSession() {
    const noSession = document.getElementById('no-session-view');
    const activeSession = document.getElementById('active-session-view');
    
    if (!state.currentSession) {
        noSession.classList.remove('hidden');
        activeSession.classList.add('hidden');
    } else {
        noSession.classList.add('hidden');
        activeSession.classList.remove('hidden');
        
        const session = state.currentSession;
        document.getElementById('session-name').textContent = session.name;
        document.getElementById('session-player-count').textContent = 
            `${session.playerIds.length} Player${session.playerIds.length !== 1 ? 's' : ''}`;
        
        renderMatchQueue();
    }
}

function renderMatchQueue() {
    const queue = document.getElementById('match-queue');
    
    if (state.pendingMatches.length === 0) {
        queue.innerHTML = `
            <div class="empty-state-small">
                <p>No matches in queue</p>
                <p class="text-muted">Tap 'Generate Matches' to create matches</p>
            </div>
        `;
    } else {
        queue.innerHTML = state.pendingMatches.map(match => `
            <div class="match-card" onclick="showRecordMatch('${match.id}')">
                <div class="match-type-badge match-type-${match.matchType}">
                    ${match.matchType.charAt(0).toUpperCase() + match.matchType.slice(1)}
                </div>
                <div class="match-teams">
                    <div class="match-team">
                        ${match.team1Players.map(id => renderPlayerBadge(id)).join('')}
                    </div>
                    <div class="match-vs">VS</div>
                    <div class="match-team">
                        ${match.team2Players.map(id => renderPlayerBadge(id)).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }
}

function renderPlayerBadge(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return '';
    
    const initial = player.name.charAt(0).toUpperCase();
    const avatarContent = player.avatar 
        ? `<img src="${player.avatar}" alt="${player.name}">`
        : initial;
    
    return `
        <div class="player-badge">
            <div class="avatar">${avatarContent}</div>
            <span class="player-name">${player.name}</span>
        </div>
    `;
}

function renderPlayers() {
    const list = document.getElementById('players-list');
    
    if (state.players.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>No Players</h3>
                <p>Add players to start tracking matches</p>
            </div>
        `;
    } else {
        list.innerHTML = state.players.map(player => {
            const stats = getPlayerStats(player.id);
            const initial = player.name.charAt(0).toUpperCase();
            const avatarContent = player.avatar 
                ? `<img src="${player.avatar}" alt="${player.name}">`
                : initial;
            
            return `
                <div class="player-row" onclick="editPlayer('${player.id}')">
                    <div class="avatar-large">${avatarContent}</div>
                    <div class="player-info">
                        <h3>${player.name}</h3>
                        <div class="player-stats">${stats.totalWins}W - ${stats.totalLosses}L</div>
                    </div>
                    <div class="player-winrate">
                        <div class="winrate-value">${stats.winRate.toFixed(0)}%</div>
                        <div class="winrate-label">Win Rate</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function renderRankings() {
    const list = document.getElementById('rankings-list');
    const stats = getAllPlayerStats();
    
    if (stats.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h3>No Rankings Yet</h3>
                <p>Play some matches to see rankings</p>
            </div>
        `;
        return;
    }
    
    // Sort by win rate
    const isSession = state.rankingView === 'session';
    stats.sort((a, b) => {
        const rateA = isSession ? a.sessionWinRate : a.winRate;
        const rateB = isSession ? b.sessionWinRate : b.winRate;
        const winsA = isSession ? a.sessionWins : a.totalWins;
        const winsB = isSession ? b.sessionWins : b.totalWins;
        
        if (rateA === rateB) return winsB - winsA;
        return rateB - rateA;
    });
    
    list.innerHTML = stats.map((playerStats, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
        const isTopThree = rank <= 3;
        const medal = rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        
        const wins = isSession ? playerStats.sessionWins : playerStats.totalWins;
        const losses = isSession ? playerStats.sessionLosses : playerStats.totalLosses;
        const winRate = isSession ? playerStats.sessionWinRate : playerStats.winRate;
        
        const initial = playerStats.player.name.charAt(0).toUpperCase();
        const avatarContent = playerStats.player.avatar 
            ? `<img src="${playerStats.player.avatar}" alt="${playerStats.player.name}">`
            : initial;
        
        return `
            <div class="ranking-row ${isTopThree ? 'top-3' : ''}">
                <div class="rank-badge ${rankClass}">${medal}</div>
                <div class="avatar-large">${avatarContent}</div>
                <div class="player-info">
                    <h3>${playerStats.player.name}</h3>
                    <div class="player-stats">${wins}W - ${losses}L</div>
                </div>
                <div class="player-winrate">
                    <div class="winrate-value">${winRate.toFixed(0)}%</div>
                    <div class="winrate-label">Win Rate</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderHistory() {
    const list = document.getElementById('history-list');
    
    if (state.historyView === 'sessions') {
        const sessions = [...state.sessions].sort((a, b) => 
            new Date(b.startDate) - new Date(a.startDate)
        );
        
        if (sessions.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🕐</div>
                    <h3>No Sessions Yet</h3>
                    <p>Start a session to see history</p>
                </div>
            `;
        } else {
            list.innerHTML = sessions.map(session => {
                const sessionMatches = state.matches.filter(m => 
                    session.matchIds.includes(m.id)
                );
                const date = new Date(session.startDate).toLocaleString();
                
                return `
                    <div class="history-item">
                        <div class="history-header">
                            <div>
                                <h3>${session.name}</h3>
                                <p class="text-muted">${date}</p>
                            </div>
                            ${session.isActive ? '<span class="match-type-badge match-type-singles">Active</span>' : ''}
                        </div>
                        <p class="text-muted">
                            👥 ${session.playerIds.length} players · 
                            🏸 ${sessionMatches.length} matches
                        </p>
                    </div>
                `;
            }).join('');
        }
    } else {
        const matches = [...state.matches].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        if (matches.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🕐</div>
                    <h3>No Matches Yet</h3>
                    <p>Play some matches to see history</p>
                </div>
            `;
        } else {
            list.innerHTML = matches.map(match => renderMatchHistory(match)).join('');
        }
    }
}

function renderMatchHistory(match) {
    const team1Names = match.team1Players
        .map(id => state.players.find(p => p.id === id)?.name || 'Unknown')
        .join(' & ');
    const team2Names = match.team2Players
        .map(id => state.players.find(p => p.id === id)?.name || 'Unknown')
        .join(' & ');
    
    const team1Won = match.winnerTeam === 1;
    const team2Won = match.winnerTeam === 2;
    const date = new Date(match.date).toLocaleString();
    
    return `
        <div class="history-item">
            <div class="history-header">
                <span class="match-type-badge match-type-${match.matchType}">
                    ${match.matchType.charAt(0).toUpperCase() + match.matchType.slice(1)}
                </span>
                <p class="text-muted">${date}</p>
            </div>
            <div class="match-result">
                <div class="team-result ${team1Won ? 'winner' : ''}">
                    ${team1Names}
                    ${match.team1Score !== undefined ? `(${match.team1Score})` : ''}
                </div>
                <div>VS</div>
                <div class="team-result ${team2Won ? 'winner' : ''}" style="text-align: right;">
                    ${team2Names}
                    ${match.team2Score !== undefined ? `(${match.team2Score})` : ''}
                </div>
            </div>
            ${match.winnerTeam ? `
                <p class="text-muted">✓ Winner: Team ${match.winnerTeam}</p>
            ` : ''}
        </div>
    `;
}

// ========== STATISTICS ==========
function getPlayerStats(playerId) {
    const playerMatches = state.matches.filter(m => 
        m.winnerTeam && (m.team1Players.includes(playerId) || m.team2Players.includes(playerId))
    );
    
    let totalWins = 0;
    let totalLosses = 0;
    let sessionWins = 0;
    let sessionLosses = 0;
    
    playerMatches.forEach(match => {
        const isTeam1 = match.team1Players.includes(playerId);
        const won = (isTeam1 && match.winnerTeam === 1) || (!isTeam1 && match.winnerTeam === 2);
        
        if (won) totalWins++;
        else totalLosses++;
        
        // Session stats
        if (state.currentSession && state.currentSession.matchIds.includes(match.id)) {
            if (won) sessionWins++;
            else sessionLosses++;
        }
    });
    
    const total = totalWins + totalLosses;
    const sessionTotal = sessionWins + sessionLosses;
    
    return {
        totalWins,
        totalLosses,
        sessionWins,
        sessionLosses,
        winRate: total > 0 ? (totalWins / total) * 100 : 0,
        sessionWinRate: sessionTotal > 0 ? (sessionWins / sessionTotal) * 100 : 0
    };
}

function getAllPlayerStats() {
    return state.players.map(player => ({
        player,
        ...getPlayerStats(player.id)
    }));
}

// ========== MATCH GENERATION ==========
function getPlayerGameCounts() {
    const counts = {};
    
    // Initialize all session players
    if (state.currentSession) {
        state.currentSession.playerIds.forEach(id => {
            counts[id] = 0;
        });
        
        // Count from matches
        const sessionMatches = state.matches.filter(m => 
            state.currentSession.matchIds.includes(m.id)
        );
        
        sessionMatches.forEach(match => {
            [...match.team1Players, ...match.team2Players].forEach(id => {
                counts[id] = (counts[id] || 0) + 1;
            });
        });
        
        // Count from pending matches
        state.pendingMatches.forEach(match => {
            [...match.team1Players, ...match.team2Players].forEach(id => {
                counts[id] = (counts[id] || 0) + 1;
            });
        });
    }
    
    return counts;
}

function generateMatchesEqualRotation(matchType, count) {
    if (!state.currentSession) return;
    
    const sessionPlayers = state.players.filter(p => 
        state.currentSession.playerIds.includes(p.id)
    );
    
    const playersNeeded = matchType === 'singles' ? 2 : 4;
    if (sessionPlayers.length < playersNeeded) {
        alert(`Need at least ${playersNeeded} players for ${matchType}`);
        return;
    }
    
    for (let i = 0; i < count; i++) {
        if (matchType === 'singles') {
            generateSinglesMatch(sessionPlayers);
        } else {
            generateDoublesMatch(sessionPlayers);
        }
    }
}

function generateSinglesMatch(players) {
    const gameCounts = getPlayerGameCounts();
    
    // Sort by game count, random tiebreaker
    const sorted = [...players].sort((a, b) => {
        const countA = gameCounts[a.id] || 0;
        const countB = gameCounts[b.id] || 0;
        if (countA === countB) return Math.random() - 0.5;
        return countA - countB;
    });
    
    const player1 = sorted[0];
    const player2 = sorted[1];
    
    state.pendingMatches.push({
        id: generateId(),
        matchType: 'singles',
        team1Players: [player1.id],
        team2Players: [player2.id]
    });
}

function generateDoublesMatch(players) {
    const gameCounts = getPlayerGameCounts();
    
    // Sort by game count
    const sorted = [...players].sort((a, b) => {
        const countA = gameCounts[a.id] || 0;
        const countB = gameCounts[b.id] || 0;
        if (countA === countB) return Math.random() - 0.5;
        return countA - countB;
    });
    
    // Take 4 players who have played least
    const selected = sorted.slice(0, 4);
    
    // Randomly assign to teams
    const shuffled = selected.sort(() => Math.random() - 0.5);
    const team1 = [shuffled[0].id, shuffled[1].id];
    const team2 = [shuffled[2].id, shuffled[3].id];
    
    state.pendingMatches.push({
        id: generateId(),
        matchType: 'doubles',
        team1Players: team1,
        team2Players: team2
    });
}

function generateMatchesSkillBased(matchType, count) {
    if (!state.currentSession) return;
    
    const sessionPlayers = state.players.filter(p => 
        state.currentSession.playerIds.includes(p.id)
    );
    
    const playersNeeded = matchType === 'singles' ? 2 : 4;
    if (sessionPlayers.length < playersNeeded) {
        alert(`Need at least ${playersNeeded} players for ${matchType}`);
        return;
    }
    
    const gameCounts = getPlayerGameCounts();
    const minGames = Math.min(...Object.values(gameCounts));
    const available = sessionPlayers.filter(p => 
        (gameCounts[p.id] || 0) <= minGames + 1
    );
    
    for (let i = 0; i < count; i++) {
        if (matchType === 'singles') {
            generateSkillSingles(available);
        } else {
            generateSkillDoubles(available);
        }
    }
}

function generateSkillSingles(players) {
    if (players.length < 2) return;
    
    const sorted = [...players].sort((a, b) => a.skillLevel - b.skillLevel);
    const midIndex = Math.floor(sorted.length / 2);
    const range = sorted.slice(Math.max(0, midIndex - 1), Math.min(sorted.length, midIndex + 2));
    const shuffled = range.sort(() => Math.random() - 0.5);
    
    state.pendingMatches.push({
        id: generateId(),
        matchType: 'singles',
        team1Players: [shuffled[0].id],
        team2Players: [shuffled[1].id]
    });
}

function generateSkillDoubles(players) {
    if (players.length < 4) return;
    
    const sorted = [...players].sort((a, b) => a.skillLevel - b.skillLevel);
    const selected = sorted.slice(0, 4);
    
    // Balance teams: pair high with low
    const team1 = [selected[0].id, selected[3].id];
    const team2 = [selected[1].id, selected[2].id];
    
    state.pendingMatches.push({
        id: generateId(),
        matchType: 'doubles',
        team1Players: team1,
        team2Players: team2
    });
}

// ========== MODAL FUNCTIONS ==========
function showModal(modalId) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    resetModalState();
}

function resetModalState() {
    state.editingPlayer = null;
    state.selectedPlayers.clear();
    state.selectedSkill = 3;
    state.selectedAvatar = null;
    state.currentMatch = null;
    state.selectedWinner = 1;
}

// ========== SESSION FUNCTIONS ==========
function showStartSession() {
    if (state.players.length === 0) {
        alert('Please add players first!');
        return;
    }
    
    document.getElementById('new-session-name').value = '';
    state.selectedPlayers.clear();
    renderSessionPlayerList();
    showModal('start-session-modal');
}

function renderSessionPlayerList() {
    const list = document.getElementById('session-player-list');
    const count = document.getElementById('selected-count');
    count.textContent = state.selectedPlayers.size;
    
    if (state.players.length === 0) {
        list.innerHTML = '<p class="text-muted" style="padding: 1rem;">No players available</p>';
        return;
    }
    
    list.innerHTML = state.players.map(player => {
        const isSelected = state.selectedPlayers.has(player.id);
        const initial = player.name.charAt(0).toUpperCase();
        const avatarContent = player.avatar 
            ? `<img src="${player.avatar}" alt="${player.name}">`
            : initial;
        
        return `
            <div class="player-select-item ${isSelected ? 'selected' : ''}" 
                 onclick="togglePlayerSelection('${player.id}')">
                <div class="avatar">${avatarContent}</div>
                <span style="flex: 1;">${player.name}</span>
                <span>${isSelected ? '✓' : '○'}</span>
            </div>
        `;
    }).join('');
}

function togglePlayerSelection(playerId) {
    if (state.selectedPlayers.has(playerId)) {
        state.selectedPlayers.delete(playerId);
    } else {
        state.selectedPlayers.add(playerId);
    }
    renderSessionPlayerList();
}

function startSession() {
    const name = document.getElementById('new-session-name').value.trim();
    
    if (!name) {
        alert('Please enter a session name');
        return;
    }
    
    if (state.selectedPlayers.size < 2) {
        alert('Please select at least 2 players');
        return;
    }
    
    // End current session if exists
    if (state.currentSession) {
        state.currentSession.isActive = false;
        state.currentSession.endDate = new Date().toISOString();
        const index = state.sessions.findIndex(s => s.id === state.currentSession.id);
        if (index >= 0) state.sessions[index] = state.currentSession;
    }
    
    // Create new session
    const newSession = {
        id: generateId(),
        name,
        startDate: new Date().toISOString(),
        endDate: null,
        playerIds: Array.from(state.selectedPlayers),
        matchIds: [],
        isActive: true
    };
    
    state.sessions.push(newSession);
    state.currentSession = newSession;
    state.pendingMatches = [];
    
    saveData(DB.sessions, state.sessions);
    saveData(DB.currentSession, state.currentSession);
    
    closeModal();
    render();
}

function endSession() {
    if (!confirm('End the current session? All match data will be saved.')) return;
    
    state.currentSession.isActive = false;
    state.currentSession.endDate = new Date().toISOString();
    
    const index = state.sessions.findIndex(s => s.id === state.currentSession.id);
    if (index >= 0) state.sessions[index] = state.currentSession;
    
    state.currentSession = null;
    state.pendingMatches = [];
    
    saveData(DB.sessions, state.sessions);
    saveData(DB.currentSession, null);
    
    render();
}

// ========== PLAYER FUNCTIONS ==========
function showAddPlayer() {
    state.editingPlayer = null;
    document.getElementById('player-modal-title').textContent = 'Add Player';
    document.getElementById('player-name').value = '';
    state.selectedSkill = 3;
    state.selectedAvatar = null;
    
    // Reset avatar preview
    document.getElementById('player-avatar-preview').innerHTML = 
        '<span class="avatar-placeholder">📷</span>';
    
    // Reset skill buttons
    document.querySelectorAll('.skill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.level === '3');
    });
    
    showModal('player-modal');
}

function editPlayer(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    
    state.editingPlayer = player;
    document.getElementById('player-modal-title').textContent = 'Edit Player';
    document.getElementById('player-name').value = player.name;
    state.selectedSkill = player.skillLevel || 3;
    state.selectedAvatar = player.avatar || null;
    
    // Update avatar preview
    const preview = document.getElementById('player-avatar-preview');
    if (player.avatar) {
        preview.innerHTML = `<img src="${player.avatar}" alt="${player.name}">`;
    } else {
        preview.innerHTML = `<span style="font-size: 2rem;">${player.name.charAt(0).toUpperCase()}</span>`;
    }
    
    // Update skill buttons
    document.querySelectorAll('.skill-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.level) === player.skillLevel);
    });
    
    showModal('player-modal');
}

function selectSkill(level) {
    state.selectedSkill = level;
    document.querySelectorAll('.skill-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.level) === level);
    });
}

function handleAvatarSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        state.selectedAvatar = e.target.result;
        document.getElementById('player-avatar-preview').innerHTML = 
            `<img src="${e.target.result}" alt="Avatar">`;
    };
    reader.readAsDataURL(file);
}

function savePlayer() {
    const name = document.getElementById('player-name').value.trim();
    
    if (!name) {
        alert('Please enter a player name');
        return;
    }
    
    if (state.editingPlayer) {
        // Update existing player
        state.editingPlayer.name = name;
        state.editingPlayer.skillLevel = state.selectedSkill;
        if (state.selectedAvatar !== null) {
            state.editingPlayer.avatar = state.selectedAvatar;
        }
    } else {
        // Add new player
        const newPlayer = {
            id: generateId(),
            name,
            avatar: state.selectedAvatar,
            skillLevel: state.selectedSkill,
            createdAt: new Date().toISOString()
        };
        state.players.push(newPlayer);
    }
    
    saveData(DB.players, state.players);
    closeModal();
    render();
}

// ========== MATCH GENERATOR ==========
function showMatchGenerator() {
    if (!state.currentSession) return;
    
    state.matchType = 'singles';
    state.matchCount = 1;
    state.useSkillMatching = false;
    
    document.getElementById('match-count').textContent = '1';
    document.getElementById('skill-matching').checked = false;
    
    // Reset match type buttons
    document.querySelectorAll('[data-type]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === 'singles');
    });
    
    showModal('match-generator-modal');
}

function selectMatchType(type) {
    state.matchType = type;
    document.querySelectorAll('[data-type]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
}

function adjustMatchCount(delta) {
    state.matchCount = Math.max(1, Math.min(10, state.matchCount + delta));
    document.getElementById('match-count').textContent = state.matchCount;
}

function generateMatches() {
    state.useSkillMatching = document.getElementById('skill-matching').checked;
    
    if (state.useSkillMatching) {
        generateMatchesSkillBased(state.matchType, state.matchCount);
    } else {
        generateMatchesEqualRotation(state.matchType, state.matchCount);
    }
    
    closeModal();
    render();
}

// ========== RECORD MATCH ==========
function showRecordMatch(matchId) {
    const match = state.pendingMatches.find(m => m.id === matchId);
    if (!match) return;
    
    state.currentMatch = match;
    state.selectedWinner = 1;
    
    const details = document.getElementById('match-details');
    details.innerHTML = `
        <div style="text-align: center; margin-bottom: 1rem;">
            <span class="match-type-badge match-type-${match.matchType}">
                ${match.matchType.charAt(0).toUpperCase() + match.matchType.slice(1)}
            </span>
        </div>
        <div class="match-teams" style="margin-bottom: 1rem;">
            <div class="match-team">
                ${match.team1Players.map(id => renderPlayerBadge(id)).join('')}
            </div>
            <div class="match-vs">VS</div>
            <div class="match-team">
                ${match.team2Players.map(id => renderPlayerBadge(id)).join('')}
            </div>
        </div>
        <div class="winner-selection">
            <div class="winner-btn selected" onclick="selectWinner(1)" id="winner-btn-1">
                <h4>Team 1</h4>
                <p>✓ Winner</p>
            </div>
            <div class="winner-btn" onclick="selectWinner(2)" id="winner-btn-2">
                <h4>Team 2</h4>
                <p>○ Select</p>
            </div>
        </div>
    `;
    
    document.getElementById('add-scores').checked = false;
    document.getElementById('score-entry').classList.add('hidden');
    document.getElementById('team1-score').value = '';
    document.getElementById('team2-score').value = '';
    
    showModal('record-match-modal');
}

function selectWinner(team) {
    state.selectedWinner = team;
    document.getElementById('winner-btn-1').classList.toggle('selected', team === 1);
    document.getElementById('winner-btn-2').classList.toggle('selected', team === 2);
    document.getElementById('winner-btn-1').querySelector('p').textContent = team === 1 ? '✓ Winner' : '○ Select';
    document.getElementById('winner-btn-2').querySelector('p').textContent = team === 2 ? '✓ Winner' : '○ Select';
}

function toggleScoreEntry() {
    const checked = document.getElementById('add-scores').checked;
    document.getElementById('score-entry').classList.toggle('hidden', !checked);
}

function recordMatch() {
    if (!state.currentMatch) return;
    
    const match = {
        id: generateId(),
        matchType: state.currentMatch.matchType,
        date: new Date().toISOString(),
        team1Players: state.currentMatch.team1Players,
        team2Players: state.currentMatch.team2Players,
        winnerTeam: state.selectedWinner
    };
    
    // Add scores if provided
    if (document.getElementById('add-scores').checked) {
        const team1Score = parseInt(document.getElementById('team1-score').value);
        const team2Score = parseInt(document.getElementById('team2-score').value);
        
        if (!isNaN(team1Score) && !isNaN(team2Score)) {
            match.team1Score = team1Score;
            match.team2Score = team2Score;
        }
    }
    
    // Add to matches
    state.matches.push(match);
    
    // Add to current session
    if (state.currentSession) {
        state.currentSession.matchIds.push(match.id);
        const index = state.sessions.findIndex(s => s.id === state.currentSession.id);
        if (index >= 0) state.sessions[index] = state.currentSession;
        saveData(DB.sessions, state.sessions);
        saveData(DB.currentSession, state.currentSession);
    }
    
    // Remove from pending
    state.pendingMatches = state.pendingMatches.filter(m => m.id !== state.currentMatch.id);
    
    saveData(DB.matches, state.matches);
    
    closeModal();
    render();
}

function skipMatch() {
    if (!state.currentMatch) return;
    
    if (confirm('Skip this match?')) {
        state.pendingMatches = state.pendingMatches.filter(m => m.id !== state.currentMatch.id);
        closeModal();
        render();
    }
}

// ========== VIEW SWITCHING ==========
function switchRankingView(view) {
    state.rankingView = view;
    document.querySelectorAll('#rankings-tab .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderRankings();
}

function switchHistoryView(view) {
    state.historyView = view;
    document.querySelectorAll('#history-tab .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderHistory();
}

