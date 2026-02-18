// ================================
// BADMINTON TRACKER - WEB APP v2.0
// ================================

const DB = {
    players: 'badminton_players',
    matches: 'badminton_matches',
    sessions: 'badminton_sessions',
    currentSession: 'badminton_current_session',
    matchCounter: 'badminton_match_counter'
};

function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            showToast('Storage full! Try removing unused player photos.', 'error');
        } else {
            console.error('saveData error:', e);
        }
    }
}
function loadData(key) { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; }

// ========== STATE ==========
let state = {
    players: loadData(DB.players) || [],
    matches: loadData(DB.matches) || [],
    sessions: loadData(DB.sessions) || [],
    currentSession: loadData(DB.currentSession) || null,
    pendingMatches: [],
    matchCounter: loadData(DB.matchCounter) || 0,

    // Modal state
    selectedPlayers: new Set(),
    editingPlayer: null,
    selectedSkill: 3,
    selectedAvatar: null,
    keepCurrentAvatar: true,

    // Match state
    matchType: 'singles',
    matchCount: 1,
    currentMatch: null,
    editingMatch: null,
    selectedWinner: 1,

    // View state
    rankingView: 'overall',
    historyView: 'sessions',

    // Undo
    undoStack: null,
    undoTimer: null,
    toastTimer: null,

    // Prevents file picker dismissal from closing modal overlay
    filePickerJustClosed: false
};

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn =>
        btn.addEventListener('click', () => switchTab(btn.dataset.tab))
    );
    render();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => {});
});

// ========== STRAVA-STYLE SESSION NAME ==========
function generateSessionName() {
    const now = new Date();
    const h = now.getHours();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
    const period = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
    return `${day} ${period}`;
}

// ========== TABS ==========
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
    render();
}

// ========== RENDER ==========
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
        document.getElementById('session-name').textContent = state.currentSession.name;
        const count = state.currentSession.playerIds.length;
        document.getElementById('session-player-count').textContent = `${count} Player${count !== 1 ? 's' : ''}`;
        renderMatchQueue();
    }
}

function renderMatchQueue() {
    const queue = document.getElementById('match-queue');
    if (state.pendingMatches.length === 0) {
        queue.innerHTML = `<div class="empty-state-small"><p>No matches in queue</p><p class="text-muted">Tap 'Generate Matches' to create matches</p></div>`;
        return;
    }
    queue.innerHTML = state.pendingMatches.map(match => `
        <div class="match-card" onclick="showRecordMatch('${match.id}')">
            <div class="match-card-header">
                <span class="match-number-label">Match #${match.matchNumber}</span>
                <span class="match-type-badge match-type-${match.matchType}">${match.matchType === 'singles' ? '⚡ Singles' : '👥 Doubles'}</span>
            </div>
            <div class="match-teams">
                <div class="match-team">${match.team1Players.map(id => renderPlayerBadge(id)).join('')}</div>
                <div class="match-vs">VS</div>
                <div class="match-team">${match.team2Players.map(id => renderPlayerBadge(id)).join('')}</div>
            </div>
            <div class="tap-hint">Tap to record result →</div>
        </div>`).join('');
}

function renderPlayerBadge(playerId) {
    const p = state.players.find(p => p.id === playerId);
    if (!p) return '';
    const av = p.avatar ? `<img src="${p.avatar}" alt="${p.name}">` : p.name.charAt(0).toUpperCase();
    return `<div class="player-badge"><div class="avatar">${av}</div><span class="player-name">${p.name}</span></div>`;
}

function renderPlayers() {
    const list = document.getElementById('players-list');
    if (state.players.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><h3>No Players</h3><p>Add players to start tracking</p></div>`;
        return;
    }
    list.innerHTML = state.players.map(player => {
        const stats = getPlayerStats(player.id);
        const av = player.avatar ? `<img src="${player.avatar}" alt="${player.name}">` : player.name.charAt(0).toUpperCase();
        return `
            <div class="player-row">
                <div class="avatar-large" onclick="editPlayer('${player.id}')">${av}</div>
                <div class="player-info" onclick="editPlayer('${player.id}')">
                    <h3>${player.name}</h3>
                    <div class="player-stats">${stats.totalWins}W − ${stats.totalLosses}L · ${stats.winRate.toFixed(0)}% win rate</div>
                </div>
                <button class="delete-btn" onclick="deletePlayer('${player.id}')">🗑</button>
            </div>`;
    }).join('');
}

function renderRankings() {
    const list = document.getElementById('rankings-list');
    const stats = getAllPlayerStats();
    if (stats.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><h3>No Rankings Yet</h3><p>Play some matches to see rankings</p></div>`;
        return;
    }
    const isSession = state.rankingView === 'session';
    stats.sort((a, b) => {
        const rA = isSession ? a.sessionWinRate : a.winRate;
        const rB = isSession ? b.sessionWinRate : b.winRate;
        if (rA === rB) return (isSession ? b.sessionWins : b.totalWins) - (isSession ? a.sessionWins : a.totalWins);
        return rB - rA;
    });
    list.innerHTML = stats.map((ps, i) => {
        const rank = i + 1;
        const medal = rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        const wins = isSession ? ps.sessionWins : ps.totalWins;
        const losses = isSession ? ps.sessionLosses : ps.totalLosses;
        const wr = isSession ? ps.sessionWinRate : ps.winRate;
        const av = ps.player.avatar ? `<img src="${ps.player.avatar}" alt="${ps.player.name}">` : ps.player.name.charAt(0).toUpperCase();
        return `
            <div class="ranking-row ${rank <= 3 ? 'top-3' : ''}">
                <div class="rank-badge rank-${rank <= 3 ? rank : 'other'}">${medal}</div>
                <div class="avatar-large">${av}</div>
                <div class="player-info"><h3>${ps.player.name}</h3><div class="player-stats">${wins}W − ${losses}L</div></div>
                <div class="player-winrate"><div class="winrate-value">${wr.toFixed(0)}%</div><div class="winrate-label">Win Rate</div></div>
            </div>`;
    }).join('');
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (state.historyView === 'sessions') {
        const sessions = [...state.sessions].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        if (!sessions.length) {
            list.innerHTML = `<div class="empty-state"><div class="empty-icon">🕐</div><h3>No Sessions Yet</h3></div>`; return;
        }
        list.innerHTML = sessions.map(session => {
            const count = state.matches.filter(m => session.matchIds.includes(m.id)).length;
            const date = new Date(session.startDate).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            return `
                <div class="history-item">
                    <div class="history-header">
                        <div><h3>${session.name}</h3><p class="text-muted">${date}</p></div>
                        <div style="display:flex;gap:0.5rem;align-items:center;">
                            ${session.isActive ? '<span class="badge-active">Active</span>' : ''}
                            <button class="icon-btn danger" onclick="deleteSession('${session.id}')">🗑</button>
                        </div>
                    </div>
                    <p class="text-muted">👥 ${session.playerIds.length} players · 🏸 ${count} matches</p>
                </div>`;
        }).join('');
    } else {
        const matches = [...state.matches].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (!matches.length) {
            list.innerHTML = `<div class="empty-state"><div class="empty-icon">🏸</div><h3>No Matches Yet</h3></div>`; return;
        }
        list.innerHTML = matches.map(match => {
            const t1 = match.team1Players.map(id => state.players.find(p => p.id === id)?.name || '?').join(' & ');
            const t2 = match.team2Players.map(id => state.players.find(p => p.id === id)?.name || '?').join(' & ');
            const t1won = match.winnerTeam === 1, t2won = match.winnerTeam === 2;
            const date = new Date(match.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const numLabel = match.matchNumber ? `<span class="text-muted" style="font-size:.75rem;">Match #${match.matchNumber}</span>` : '';
            return `
                <div class="history-item">
                    <div class="history-header">
                        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
                            <span class="match-type-badge match-type-${match.matchType}">${match.matchType === 'singles' ? '⚡ Singles' : '👥 Doubles'}</span>
                            ${numLabel}
                        </div>
                        <div style="display:flex;gap:.4rem;">
                            <button class="icon-btn" onclick="showEditMatch('${match.id}')" title="Edit">✏️</button>
                            <button class="icon-btn danger" onclick="deleteMatch('${match.id}')" title="Delete">🗑</button>
                        </div>
                    </div>
                    <div class="match-result">
                        <div class="team-result ${t1won ? 'winner' : ''}">${t1won ? '🏆 ' : ''}${t1}${match.team1Score !== undefined ? `<span class="score-chip">${match.team1Score}</span>` : ''}</div>
                        <div class="vs-divider">VS</div>
                        <div class="team-result right ${t2won ? 'winner' : ''}">${match.team2Score !== undefined ? `<span class="score-chip">${match.team2Score}</span>` : ''}${t2won ? ' 🏆' : ''}${t2}</div>
                    </div>
                    <p class="text-muted" style="font-size:.75rem;margin-top:.25rem;">${date}</p>
                </div>`;
        }).join('');
    }
}

// ========== STATS ==========
function getPlayerStats(playerId) {
    const playerMatches = state.matches.filter(m =>
        m.winnerTeam && (m.team1Players.includes(playerId) || m.team2Players.includes(playerId)));
    let tw = 0, tl = 0, sw = 0, sl = 0;
    playerMatches.forEach(m => {
        const isT1 = m.team1Players.includes(playerId);
        const won = (isT1 && m.winnerTeam === 1) || (!isT1 && m.winnerTeam === 2);
        if (won) tw++; else tl++;
        if (state.currentSession && state.currentSession.matchIds.includes(m.id)) {
            if (won) sw++; else sl++;
        }
    });
    return {
        totalWins: tw, totalLosses: tl, sessionWins: sw, sessionLosses: sl,
        winRate: tw + tl > 0 ? (tw / (tw + tl)) * 100 : 0,
        sessionWinRate: sw + sl > 0 ? (sw / (sw + sl)) * 100 : 0
    };
}
function getAllPlayerStats() { return state.players.map(p => ({ player: p, ...getPlayerStats(p.id) })); }

// ========== MATCH GENERATION ==========
function getPlayerGameCounts() {
    const counts = {};
    if (!state.currentSession) return counts;
    state.currentSession.playerIds.forEach(id => { counts[id] = 0; });
    state.matches.filter(m => state.currentSession.matchIds.includes(m.id))
        .forEach(m => [...m.team1Players, ...m.team2Players].forEach(id => { counts[id] = (counts[id] || 0) + 1; }));
    state.pendingMatches.forEach(m =>
        [...m.team1Players, ...m.team2Players].forEach(id => { counts[id] = (counts[id] || 0) + 1; }));
    return counts;
}

function generateMatchesEqualRotation(matchType, count) {
    const players = state.players.filter(p => state.currentSession.playerIds.includes(p.id));
    const needed = matchType === 'singles' ? 2 : 4;
    if (players.length < needed) { showToast(`Need ${needed}+ players for ${matchType}`, 'error'); return; }
    for (let i = 0; i < count; i++) matchType === 'singles' ? genSingles(players) : genDoubles(players);
}

function genSingles(players) {
    const counts = getPlayerGameCounts();
    const sorted = [...players].sort((a, b) => {
        const d = (counts[a.id] || 0) - (counts[b.id] || 0);
        return d !== 0 ? d : Math.random() - 0.5;
    });
    state.matchCounter++;
    saveData(DB.matchCounter, state.matchCounter);
    state.pendingMatches.push({ id: generateId(), matchType: 'singles', matchNumber: state.matchCounter, team1Players: [sorted[0].id], team2Players: [sorted[1].id] });
}

function genDoubles(players) {
    const counts = getPlayerGameCounts();
    const sorted = [...players].sort((a, b) => {
        const d = (counts[a.id] || 0) - (counts[b.id] || 0);
        return d !== 0 ? d : Math.random() - 0.5;
    });
    const s = sorted.slice(0, 4).sort(() => Math.random() - 0.5);
    state.matchCounter++;
    saveData(DB.matchCounter, state.matchCounter);
    state.pendingMatches.push({ id: generateId(), matchType: 'doubles', matchNumber: state.matchCounter, team1Players: [s[0].id, s[1].id], team2Players: [s[2].id, s[3].id] });
}

function generateMatchesSkillBased(matchType, count) {
    const players = state.players.filter(p => state.currentSession.playerIds.includes(p.id));
    const needed = matchType === 'singles' ? 2 : 4;
    if (players.length < needed) { showToast(`Need ${needed}+ players for ${matchType}`, 'error'); return; }
    const counts = getPlayerGameCounts();
    const min = Math.min(...Object.values(counts));
    const avail = players.filter(p => (counts[p.id] || 0) <= min + 1);
    for (let i = 0; i < count; i++) {
        if (matchType === 'singles') genSkillSingles(avail);
        else genSkillDoubles(avail);
    }
}

function genSkillSingles(players) {
    if (players.length < 2) return;
    const sorted = [...players].sort((a, b) => a.skillLevel - b.skillLevel);
    const mid = Math.floor(sorted.length / 2);
    const candidates = sorted.slice(Math.max(0, mid - 1), Math.min(sorted.length, mid + 2)).sort(() => Math.random() - 0.5);
    state.matchCounter++;
    saveData(DB.matchCounter, state.matchCounter);
    state.pendingMatches.push({ id: generateId(), matchType: 'singles', matchNumber: state.matchCounter, team1Players: [candidates[0].id], team2Players: [candidates[1].id] });
}

function genSkillDoubles(players) {
    if (players.length < 4) return;
    const sorted = [...players].sort((a, b) => a.skillLevel - b.skillLevel).slice(0, 4);
    state.matchCounter++;
    saveData(DB.matchCounter, state.matchCounter);
    state.pendingMatches.push({ id: generateId(), matchType: 'doubles', matchNumber: state.matchCounter, team1Players: [sorted[0].id, sorted[3].id], team2Players: [sorted[1].id, sorted[2].id] });
}

// ========== MODAL ==========
function showModal(id) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(id).classList.remove('hidden');
}
function closeModal(fromOverlay = false) {
    // If triggered by overlay click right after file picker closed, ignore it
    if (fromOverlay && state.filePickerJustClosed) return;
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    state.editingPlayer = null; state.currentMatch = null; state.editingMatch = null;
    state.selectedPlayers.clear(); state.selectedAvatar = null; state.keepCurrentAvatar = true;
}

// ========== SESSION ==========
function showStartSession() {
    if (!state.players.length) { showToast('Add players first!', 'error'); return; }
    const nameInput = document.getElementById('new-session-name');
    nameInput.value = generateSessionName();
    nameInput.focus(); nameInput.select();
    state.selectedPlayers.clear();
    renderSessionPlayerList();
    // Clear suggestion until players are selected
    const sugg = document.getElementById('match-suggestion');
    if (sugg) sugg.classList.add('hidden');
    showModal('start-session-modal');
}

function renderSessionPlayerList() {
    document.getElementById('selected-count').textContent = state.selectedPlayers.size;
    
    // Update select-all button text
    const allSelected = state.selectedPlayers.size === state.players.length && state.players.length > 0;
    const selectAllBtn = document.getElementById('select-all-btn');
    if (selectAllBtn) {
        selectAllBtn.textContent = allSelected ? 'Deselect All' : 'Select All';
    }
    
    document.getElementById('session-player-list').innerHTML = state.players.map(p => {
        const sel = state.selectedPlayers.has(p.id);
        const av = p.avatar ? `<img src="${p.avatar}" alt="${p.name}">` : p.name.charAt(0).toUpperCase();
        return `<div class="player-select-item ${sel ? 'selected' : ''}" onclick="togglePlayerSelection('${p.id}')">
            <div class="avatar">${av}</div><span style="flex:1">${p.name}</span>
            <span class="check-icon">${sel ? '✓' : '○'}</span></div>`;
    }).join('');
}

function togglePlayerSelection(id) {
    state.selectedPlayers.has(id) ? state.selectedPlayers.delete(id) : state.selectedPlayers.add(id);
    renderSessionPlayerList();
    renderMatchSuggestion();
}

// ========== FEATURE: SELECT ALL / DESELECT ALL ==========
function toggleSelectAll() {
    const allSelected = state.selectedPlayers.size === state.players.length;
    if (allSelected) {
        state.selectedPlayers.clear();
    } else {
        state.players.forEach(p => state.selectedPlayers.add(p.id));
    }
    renderSessionPlayerList();
    renderMatchSuggestion();
}

// ========== FEATURE: SMART MATCH SUGGESTION ==========
function calcSuggestedMatches(playerCount, matchType) {
    if (playerCount < 2) return { singles: 0, doubles: 0 };
    // Minimum matches for everyone to play once per round
    const singles = Math.ceil(playerCount / 2);
    const doubles = playerCount >= 4 ? Math.ceil(playerCount / 4) : 0;
    return { singles, doubles };
}

function renderMatchSuggestion() {
    const el = document.getElementById('match-suggestion');
    if (!el) return;
    const n = state.selectedPlayers.size;
    if (n < 2) { el.classList.add('hidden'); return; }
    const s = calcSuggestedMatches(n, 'singles');
    const d = n >= 4 ? calcSuggestedMatches(n, 'doubles') : null;
    let html = `<div class="suggestion-header">💡 Suggested to give everyone 1 game:</div><div class="suggestion-pills">`;
    html += `<button class="suggestion-pill" onclick="applySuggestion(${s.singles},'singles')">⚡ ${s.singles} singles match${s.singles !== 1 ? 'es' : ''}</button>`;
    if (d) html += `<button class="suggestion-pill" onclick="applySuggestion(${d.doubles},'doubles')">👥 ${d.doubles} doubles match${d.doubles !== 1 ? 'es' : ''}</button>`;
    html += `</div>`;
    el.innerHTML = html;
    el.classList.remove('hidden');
}

// Called from session start modal pills — stores preference for after session starts
function applySuggestion(count, type) {
    state._suggestedCount = count;
    state._suggestedType = type;
    showToast(`After starting, generate ${count} ${type} match${count !== 1 ? 'es' : ''} for equal play 👍`);
}

function startSession() {
    const name = document.getElementById('new-session-name').value.trim() || generateSessionName();
    if (state.selectedPlayers.size < 2) { showToast('Select at least 2 players', 'error'); return; }
    if (state.currentSession) {
        state.currentSession.isActive = false;
        state.currentSession.endDate = new Date().toISOString();
        const i = state.sessions.findIndex(s => s.id === state.currentSession.id);
        if (i >= 0) state.sessions[i] = state.currentSession;
    }
    const session = { id: generateId(), name, startDate: new Date().toISOString(), endDate: null, playerIds: Array.from(state.selectedPlayers), matchIds: [], isActive: true };
    state.sessions.push(session);
    state.currentSession = session;
    state.pendingMatches = [];
    state.matchCounter = 0;
    saveData(DB.matchCounter, 0);
    saveData(DB.sessions, state.sessions);
    saveData(DB.currentSession, state.currentSession);
    closeModal(); render();
    showToast(`"${name}" started! 🏸`);
}

function endSession() {
    if (!confirm('End session? All data will be saved.')) return;
    state.currentSession.isActive = false;
    state.currentSession.endDate = new Date().toISOString();
    const i = state.sessions.findIndex(s => s.id === state.currentSession.id);
    if (i >= 0) state.sessions[i] = state.currentSession;
    state.currentSession = null; state.pendingMatches = [];
    saveData(DB.sessions, state.sessions); saveData(DB.currentSession, null);
    showToast('Session ended! Great games 🏸'); render();
}

// ========== PLAYERS ==========
function showAddPlayer() {
    state.editingPlayer = null;
    document.getElementById('player-modal-title').textContent = 'Add Player';
    document.getElementById('player-name').value = '';
    document.getElementById('player-avatar-preview').innerHTML = '<span class="avatar-placeholder">📷</span>';
    document.getElementById('delete-player-btn').classList.add('hidden');
    state.selectedSkill = 3; state.selectedAvatar = null; state.keepCurrentAvatar = false;
    document.querySelectorAll('.skill-btn').forEach(b => b.classList.toggle('active', b.dataset.level === '3'));
    showModal('player-modal');
}

function editPlayer(playerId) {
    const p = state.players.find(p => p.id === playerId);
    if (!p) return;
    state.editingPlayer = p;
    document.getElementById('player-modal-title').textContent = 'Edit Player';
    document.getElementById('player-name').value = p.name;
    state.selectedSkill = p.skillLevel || 3; state.selectedAvatar = null; state.keepCurrentAvatar = true;
    document.getElementById('player-avatar-preview').innerHTML = p.avatar
        ? `<img src="${p.avatar}" alt="${p.name}">` : `<span style="font-size:2rem;">${p.name.charAt(0).toUpperCase()}</span>`;
    document.getElementById('delete-player-btn').classList.remove('hidden');
    document.querySelectorAll('.skill-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.level) === p.skillLevel));
    showModal('player-modal');
}

function selectSkill(level) {
    state.selectedSkill = level;
    document.querySelectorAll('.skill-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.level) === level));
}

// Compress image to max 200x200px JPEG (~15-30KB) before storing
// Fixes: localStorage quota exceeded causing silent save failures
function compressImage(file, maxSize = 200, quality = 0.75) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                // Scale down keeping aspect ratio
                if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
                else       { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function handleAvatarSelect(event) {
    // Flag prevents file-picker dismissal from triggering the overlay close
    state.filePickerJustClosed = true;
    setTimeout(() => { state.filePickerJustClosed = false; }, 800);

    const file = event.target.files[0];
    if (!file) return;

    compressImage(file).then(compressed => {
        state.selectedAvatar = compressed;
        state.keepCurrentAvatar = false;
        document.getElementById('player-avatar-preview').innerHTML =
            `<img src="${compressed}" alt="Avatar">`;
    });
}

function savePlayer() {
    const name = document.getElementById('player-name').value.trim();
    if (!name) { showToast('Enter a player name', 'error'); return; }
    if (state.editingPlayer) {
        state.editingPlayer.name = name;
        state.editingPlayer.skillLevel = state.selectedSkill;
        if (!state.keepCurrentAvatar) state.editingPlayer.avatar = state.selectedAvatar;
        saveData(DB.players, state.players);
        showToast(`${name} updated!`);
    } else {
        state.players.push({ id: generateId(), name, avatar: state.selectedAvatar, skillLevel: state.selectedSkill, createdAt: new Date().toISOString() });
        saveData(DB.players, state.players);
        showToast(`${name} added! 👋`);
    }
    closeModal(); render();
}

// ========== FEATURE 1: DELETE PLAYER + UNDO ==========
function deletePlayer(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    const snapshot = { type: 'deletePlayer', player: JSON.parse(JSON.stringify(player)) };
    state.players = state.players.filter(p => p.id !== playerId);
    state.sessions = state.sessions.map(s => ({ ...s, playerIds: s.playerIds.filter(id => id !== playerId) }));
    if (state.currentSession) state.currentSession.playerIds = state.currentSession.playerIds.filter(id => id !== playerId);
    state.pendingMatches = state.pendingMatches.filter(m => !m.team1Players.includes(playerId) && !m.team2Players.includes(playerId));
    saveData(DB.players, state.players); saveData(DB.sessions, state.sessions); saveData(DB.currentSession, state.currentSession);
    closeModal(); render();
    showUndoToast(`${player.name} deleted`, snapshot);
}

function deletePlayerFromModal() {
    if (!state.editingPlayer) return;
    if (!confirm(`Delete ${state.editingPlayer.name}? Their match history will remain.`)) return;
    deletePlayer(state.editingPlayer.id);
}

// ========== FEATURE 2: DELETE SESSION + UNDO ==========
function deleteSession(sessionId) {
    const session = state.sessions.find(s => s.id === sessionId);
    if (!session) return;
    const sessionMatches = state.matches.filter(m => session.matchIds.includes(m.id));
    const msg = sessionMatches.length
        ? `Delete "${session.name}"? This removes ${sessionMatches.length} match(es) and recalculates rankings.`
        : `Delete "${session.name}"?`;
    if (!confirm(msg)) return;
    const snapshot = { type: 'deleteSession', session: JSON.parse(JSON.stringify(session)), matches: sessionMatches.map(m => JSON.parse(JSON.stringify(m))) };
    state.matches = state.matches.filter(m => !session.matchIds.includes(m.id));
    state.sessions = state.sessions.filter(s => s.id !== sessionId);
    if (state.currentSession && state.currentSession.id === sessionId) {
        state.currentSession = null; state.pendingMatches = [];
        saveData(DB.currentSession, null);
    }
    saveData(DB.matches, state.matches); saveData(DB.sessions, state.sessions);
    render();
    showUndoToast(`"${session.name}" deleted`, snapshot);
}

// ========== FEATURE 2: DELETE MATCH + UNDO ==========
function deleteMatch(matchId) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;
    const t1 = match.team1Players.map(id => state.players.find(p => p.id === id)?.name || '?').join(' & ');
    const t2 = match.team2Players.map(id => state.players.find(p => p.id === id)?.name || '?').join(' & ');
    if (!confirm(`Delete: ${t1} vs ${t2}?\nRankings will be recalculated.`)) return;
    const ownerSession = state.sessions.find(s => s.matchIds.includes(matchId));
    const snapshot = { type: 'deleteMatch', match: JSON.parse(JSON.stringify(match)), sessionId: ownerSession?.id };
    state.matches = state.matches.filter(m => m.id !== matchId);
    state.sessions = state.sessions.map(s => ({ ...s, matchIds: s.matchIds.filter(id => id !== matchId) }));
    if (state.currentSession) {
        state.currentSession.matchIds = state.currentSession.matchIds.filter(id => id !== matchId);
        saveData(DB.currentSession, state.currentSession);
    }
    saveData(DB.matches, state.matches); saveData(DB.sessions, state.sessions);
    render();
    showUndoToast('Match deleted', snapshot);
}

// ========== FEATURE 5: EDIT RECORDED MATCH ==========
function showEditMatch(matchId) {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;
    state.editingMatch = match;
    state.selectedWinner = match.winnerTeam || 1;
    const t1 = match.team1Players.map(id => state.players.find(p => p.id === id)?.name || '?').join(' & ');
    const t2 = match.team2Players.map(id => state.players.find(p => p.id === id)?.name || '?').join(' & ');
    document.getElementById('edit-match-details').innerHTML = `
        <div style="text-align:center;margin-bottom:.75rem;">
            <span class="match-type-badge match-type-${match.matchType}">${match.matchType === 'singles' ? '⚡ Singles' : '👥 Doubles'}</span>
            ${match.matchNumber ? `<span class="text-muted" style="margin-left:.5rem;font-size:.85rem;">Match #${match.matchNumber}</span>` : ''}
        </div>
        <div class="winner-selection">
            <div class="winner-btn ${match.winnerTeam === 1 ? 'selected' : ''}" onclick="selectEditWinner(1)" id="edit-winner-btn-1">
                <h4>Team 1</h4><p class="team-names">${t1}</p>
                <p class="winner-label">${match.winnerTeam === 1 ? '🏆 Winner' : '○ Select'}</p>
            </div>
            <div class="winner-btn ${match.winnerTeam === 2 ? 'selected' : ''}" onclick="selectEditWinner(2)" id="edit-winner-btn-2">
                <h4>Team 2</h4><p class="team-names">${t2}</p>
                <p class="winner-label">${match.winnerTeam === 2 ? '🏆 Winner' : '○ Select'}</p>
            </div>
        </div>`;
    const hasScores = match.team1Score !== undefined;
    document.getElementById('edit-add-scores').checked = hasScores;
    document.getElementById('edit-team1-score').value = hasScores ? match.team1Score : '';
    document.getElementById('edit-team2-score').value = hasScores ? match.team2Score : '';
    document.getElementById('edit-score-entry').classList.toggle('hidden', !hasScores);
    showModal('edit-match-modal');
}

function selectEditWinner(team) {
    state.selectedWinner = team;
    [1, 2].forEach(t => {
        document.getElementById(`edit-winner-btn-${t}`).classList.toggle('selected', t === team);
        document.getElementById(`edit-winner-btn-${t}`).querySelector('.winner-label').textContent = t === team ? '🏆 Winner' : '○ Select';
    });
}

function toggleEditScoreEntry() {
    document.getElementById('edit-score-entry').classList.toggle('hidden', !document.getElementById('edit-add-scores').checked);
}

function saveEditMatch() {
    if (!state.editingMatch) return;
    const idx = state.matches.findIndex(m => m.id === state.editingMatch.id);
    if (idx < 0) return;
    state.matches[idx].winnerTeam = state.selectedWinner;
    if (document.getElementById('edit-add-scores').checked) {
        const s1 = parseInt(document.getElementById('edit-team1-score').value);
        const s2 = parseInt(document.getElementById('edit-team2-score').value);
        if (!isNaN(s1) && !isNaN(s2)) { state.matches[idx].team1Score = s1; state.matches[idx].team2Score = s2; }
    } else { delete state.matches[idx].team1Score; delete state.matches[idx].team2Score; }
    saveData(DB.matches, state.matches);
    closeModal(); render();
    showToast('Match updated! ✅');
}

// ========== MATCH GENERATOR ==========
function showMatchGenerator() {
    state.matchType = 'singles'; state.matchCount = 1;
    document.getElementById('match-count').textContent = '1';
    document.getElementById('skill-matching').checked = false;
    document.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('active', b.dataset.type === 'singles'));
    renderGeneratorSuggestion('singles');
    renderPlayPrediction('singles', 1);
    showModal('match-generator-modal');
}

function renderGeneratorSuggestion(matchType) {
    const el = document.getElementById('generator-suggestion');
    if (!el || !state.currentSession) return;
    const n = state.currentSession.playerIds.length;
    const needed = matchType === 'singles' ? Math.ceil(n / 2) : Math.ceil(n / 4);
    const playersPerMatch = matchType === 'singles' ? 2 : 4;
    if (n < playersPerMatch) { el.classList.add('hidden'); return; }
    el.innerHTML = `
        <div class="generator-suggestion">
            <span class="suggestion-text">💡 <strong>${needed} match${needed !== 1 ? 'es' : ''}</strong> = everyone plays once (${n} players)</span>
            <button class="suggestion-apply-btn" onclick="applySuggestedCount(${needed})">Use this</button>
        </div>`;
    el.classList.remove('hidden');
}

function applySuggestedCount(count) {
    state.matchCount = count;
    document.getElementById('match-count').textContent = count;
    renderPlayPrediction(state.matchType, count);
    showToast(`Set to ${count} match${count !== 1 ? 'es' : ''} ✓`);
}

// ========== FEATURE: PLAY COUNT PREDICTION ==========
function renderPlayPrediction(matchType, matchCount) {
    const el = document.getElementById('play-prediction');
    if (!el || !state.currentSession) return;
    const sessionPlayers = state.players.filter(p => state.currentSession.playerIds.includes(p.id));
    if (sessionPlayers.length < 2) { el.classList.add('hidden'); return; }

    // Get current game counts (played + pending already in queue)
    const currentCounts = getPlayerGameCounts();
    
    // Simulate adding `matchCount` more matches using the same rotation logic
    const simCounts = {};
    sessionPlayers.forEach(p => { simCounts[p.id] = currentCounts[p.id] || 0; });

    const playersPerMatch = matchType === 'singles' ? 2 : 4;
    if (sessionPlayers.length < playersPerMatch) { el.classList.add('hidden'); return; }

    for (let i = 0; i < matchCount; i++) {
        // Pick the players with fewest simulated games (same rotation logic)
        const sorted = [...sessionPlayers].sort((a, b) => {
            const d = simCounts[a.id] - simCounts[b.id];
            return d !== 0 ? d : 0; // stable sort for prediction (no random)
        });
        const chosen = sorted.slice(0, playersPerMatch);
        chosen.forEach(p => { simCounts[p.id] += 1; });
    }

    // Build a compact bar chart per player
    const maxGames = Math.max(...Object.values(simCounts), 1);
    const rows = sessionPlayers
        .sort((a, b) => simCounts[b.id] - simCounts[a.id])
        .map(p => {
            const current = currentCounts[p.id] || 0;
            const after = simCounts[p.id];
            const added = after - current;
            const barPct = Math.round((after / maxGames) * 100);
            const addedBadge = added > 0 ? `<span class="pred-added">+${added}</span>` : `<span class="pred-none">+0</span>`;
            const initial = p.avatar ? `<img src="${p.avatar}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;">` : `<span class="pred-initial">${p.name.charAt(0)}</span>`;
            return `
                <div class="pred-row">
                    <div class="pred-avatar">${initial}</div>
                    <div class="pred-name">${p.name}</div>
                    <div class="pred-bar-wrap">
                        <div class="pred-bar" style="width:${barPct}%"></div>
                    </div>
                    <div class="pred-count">${after} ${addedBadge}</div>
                </div>`;
        }).join('');

    el.innerHTML = `
        <div class="pred-header">📈 Predicted play count after ${matchCount} more match${matchCount !== 1 ? 'es' : ''}</div>
        <div class="pred-list">${rows}</div>`;
    el.classList.remove('hidden');
}
function selectMatchType(type) {
    state.matchType = type;
    document.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    renderGeneratorSuggestion(type);
    renderPlayPrediction(type, state.matchCount);
}
function adjustMatchCount(delta) {
    state.matchCount = Math.max(1, Math.min(30, state.matchCount + delta));
    document.getElementById('match-count').textContent = state.matchCount;
    renderPlayPrediction(state.matchType, state.matchCount);
}
// ========== FEATURE: SHUFFLE MATCHES ==========
function shuffleMatches() {
    if (state.pendingMatches.length === 0) {
        showToast('No matches to shuffle!', 'error');
        return;
    }
    // Fisher-Yates shuffle
    const arr = [...state.pendingMatches];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    state.pendingMatches = arr;
    render();
    showToast(`${arr.length} match${arr.length !== 1 ? 'es' : ''} shuffled! 🎲`);
}

function generateMatches() {
    const before = state.pendingMatches.length;
    document.getElementById('skill-matching').checked
        ? generateMatchesSkillBased(state.matchType, state.matchCount)
        : generateMatchesEqualRotation(state.matchType, state.matchCount);
    const added = state.pendingMatches.length - before;
    closeModal(); render();
    if (added > 0) showToast(`${added} match${added !== 1 ? 'es' : ''} added! 🏸`);
}

// ========== RECORD MATCH ==========
function showRecordMatch(matchId) {
    const match = state.pendingMatches.find(m => m.id === matchId);
    if (!match) return;
    state.currentMatch = match; state.selectedWinner = 1;
    const t1 = match.team1Players.map(id => state.players.find(p => p.id === id)?.name || '?').join(' & ');
    const t2 = match.team2Players.map(id => state.players.find(p => p.id === id)?.name || '?').join(' & ');
    document.getElementById('match-details').innerHTML = `
        <div style="text-align:center;margin-bottom:.75rem;">
            <span class="match-type-badge match-type-${match.matchType}">${match.matchType === 'singles' ? '⚡ Singles' : '👥 Doubles'}</span>
            <span style="margin-left:.5rem;font-weight:600;color:#6B7280;font-size:.9rem;">Match #${match.matchNumber}</span>
        </div>
        <div class="winner-selection">
            <div class="winner-btn selected" onclick="selectWinner(1)" id="winner-btn-1">
                <h4>Team 1</h4><p class="team-names">${t1}</p><p class="winner-label">🏆 Winner</p>
            </div>
            <div class="winner-btn" onclick="selectWinner(2)" id="winner-btn-2">
                <h4>Team 2</h4><p class="team-names">${t2}</p><p class="winner-label">○ Select</p>
            </div>
        </div>`;
    document.getElementById('add-scores').checked = false;
    document.getElementById('score-entry').classList.add('hidden');
    document.getElementById('team1-score').value = '';
    document.getElementById('team2-score').value = '';
    showModal('record-match-modal');
}

function selectWinner(team) {
    state.selectedWinner = team;
    [1, 2].forEach(t => {
        document.getElementById(`winner-btn-${t}`).classList.toggle('selected', t === team);
        document.getElementById(`winner-btn-${t}`).querySelector('.winner-label').textContent = t === team ? '🏆 Winner' : '○ Select';
    });
}

function toggleScoreEntry() {
    document.getElementById('score-entry').classList.toggle('hidden', !document.getElementById('add-scores').checked);
}

function recordMatch() {
    if (!state.currentMatch) return;
    const match = {
        id: generateId(), matchType: state.currentMatch.matchType,
        matchNumber: state.currentMatch.matchNumber, date: new Date().toISOString(),
        team1Players: state.currentMatch.team1Players, team2Players: state.currentMatch.team2Players,
        winnerTeam: state.selectedWinner
    };
    if (document.getElementById('add-scores').checked) {
        const s1 = parseInt(document.getElementById('team1-score').value);
        const s2 = parseInt(document.getElementById('team2-score').value);
        if (!isNaN(s1) && !isNaN(s2)) { match.team1Score = s1; match.team2Score = s2; }
    }
    state.matches.push(match);
    if (state.currentSession) {
        state.currentSession.matchIds.push(match.id);
        const i = state.sessions.findIndex(s => s.id === state.currentSession.id);
        if (i >= 0) state.sessions[i] = state.currentSession;
        saveData(DB.sessions, state.sessions); saveData(DB.currentSession, state.currentSession);
    }
    state.pendingMatches = state.pendingMatches.filter(m => m.id !== state.currentMatch.id);
    saveData(DB.matches, state.matches);
    closeModal(); render();
    showToast('Match recorded! ✅');
}

function skipMatch() {
    if (!state.currentMatch) return;
    if (confirm('Skip this match?')) {
        state.pendingMatches = state.pendingMatches.filter(m => m.id !== state.currentMatch.id);
        closeModal(); render();
    }
}

// ========== UNDO SYSTEM ==========
function showUndoToast(message, snapshot) {
    if (state.undoTimer) clearTimeout(state.undoTimer);
    state.undoStack = snapshot;
    document.getElementById('undo-toast-msg').textContent = message;
    const toast = document.getElementById('undo-toast');
    toast.classList.remove('hidden'); toast.classList.add('show');
    state.undoTimer = setTimeout(dismissUndoToast, 6000);
}

function dismissUndoToast() {
    const t = document.getElementById('undo-toast');
    t.classList.remove('show'); t.classList.add('hidden');
    state.undoStack = null;
}

function undoAction() {
    if (!state.undoStack) return;
    const { type } = state.undoStack;
    if (type === 'deletePlayer') {
        state.players.push(state.undoStack.player);
        saveData(DB.players, state.players);
        showToast(`${state.undoStack.player.name} restored! 👋`);
    } else if (type === 'deleteSession') {
        state.matches.push(...state.undoStack.matches);
        state.sessions.push(state.undoStack.session);
        if (state.undoStack.session.isActive) { state.currentSession = state.undoStack.session; saveData(DB.currentSession, state.currentSession); }
        saveData(DB.matches, state.matches); saveData(DB.sessions, state.sessions);
        showToast(`"${state.undoStack.session.name}" restored!`);
    } else if (type === 'deleteMatch') {
        state.matches.push(state.undoStack.match);
        if (state.undoStack.sessionId) {
            state.sessions = state.sessions.map(s => s.id === state.undoStack.sessionId ? { ...s, matchIds: [...s.matchIds, state.undoStack.match.id] } : s);
            if (state.currentSession?.id === state.undoStack.sessionId) {
                state.currentSession.matchIds.push(state.undoStack.match.id); saveData(DB.currentSession, state.currentSession);
            }
        }
        saveData(DB.matches, state.matches); saveData(DB.sessions, state.sessions);
        showToast('Match restored!');
    }
    dismissUndoToast(); render();
}

// ========== TOAST ==========
function showToast(msg, type = 'success') {
    if (state.toastTimer) clearTimeout(state.toastTimer);
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = `toast show ${type}`;
    state.toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ========== VIEW SWITCHING ==========
function switchRankingView(view) {
    state.rankingView = view;
    document.querySelectorAll('#rankings-tab .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    renderRankings();
}
function switchHistoryView(view) {
    state.historyView = view;
    document.querySelectorAll('#history-tab .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    renderHistory();
}
