import { eventBus } from './event-bus.js';
import { deepClone } from './utils.js';

const DEFAULT_STATE = {
    version: '1.0.0',
    created: null,
    userTeamId: null,
    difficulty: 'normal',
    simSpeed: 'normal',
    season: 2024,
    phase: 'setup',
    day: 0,
    teams: {},
    players: {},
    schedule: [],
    playoffs: { playIn: { East: {}, West: {} }, bracket: { round1: [], confSemis: [], confFinals: [], finals: null } },
    seasonStats: {},
    gameLog: [],
    history: [],
    awards: { mvp: null, dpoy: null, roy: null, mip: null, sixthMan: null, allNBA: { first: [], second: [], third: [] }, allDefensive: { first: [], second: [] }, allStar: { East: [], West: [] } },
    draftBoard: [],
    draftResults: [],
    freeAgents: [],
    userBids: [],
    pendingOffers: [],
    newsLog: []
};

let state = deepClone(DEFAULT_STATE);

export function getState() {
    return state;
}

export function setState(patch) {
    Object.assign(state, patch);
    eventBus.emit('stateChanged', state);
}

export function updateTeam(teamId, patch) {
    state.teams[teamId] = { ...state.teams[teamId], ...patch };
    eventBus.emit('teamUpdated', { teamId, team: state.teams[teamId] });
}

export function updatePlayer(playerId, patch) {
    state.players[playerId] = { ...state.players[playerId], ...patch };
    eventBus.emit('playerUpdated', { playerId, player: state.players[playerId] });
}

export function addNews(text, type = 'info') {
    state.newsLog.unshift({ text, type, day: state.day, season: state.season, time: Date.now() });
    if (state.newsLog.length > 200) state.newsLog.length = 200;
    eventBus.emit('newsAdded', state.newsLog[0]);
}

export function resetState() {
    state = deepClone(DEFAULT_STATE);
    eventBus.emit('stateReset');
}

export function getFullState() {
    return deepClone(state);
}

export function loadState(saved) {
    state = saved;
    eventBus.emit('stateChanged', state);
}

export function getTeamRoster(teamId) {
    return (state.teams[teamId]?.roster || []).map(pid => state.players[pid]).filter(Boolean);
}

export function getPlayerSeasonStats(playerId) {
    return state.seasonStats[playerId] || null;
}

export function getUserTeam() {
    return state.teams[state.userTeamId];
}

export function getUserTeamId() {
    return state.userTeamId;
}
