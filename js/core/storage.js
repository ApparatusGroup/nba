import { getFullState, loadState } from './game-state.js';

const SAVE_PREFIX = 'nba_manager_save_';
const MAX_SLOTS = 3;

export function saveGame(slot = 0) {
    if (slot < 0 || slot >= MAX_SLOTS) return false;
    try {
        const state = getFullState();
        state.savedAt = Date.now();
        const json = JSON.stringify(state);
        localStorage.setItem(SAVE_PREFIX + slot, json);
        return true;
    } catch (e) {
        console.error('Save failed:', e);
        return false;
    }
}

export function loadGame(slot = 0) {
    if (slot < 0 || slot >= MAX_SLOTS) return false;
    try {
        const json = localStorage.getItem(SAVE_PREFIX + slot);
        if (!json) return false;
        const state = JSON.parse(json);
        loadState(state);
        return true;
    } catch (e) {
        console.error('Load failed:', e);
        return false;
    }
}

export function deleteSave(slot = 0) {
    localStorage.removeItem(SAVE_PREFIX + slot);
}

export function getSaveInfo(slot = 0) {
    try {
        const json = localStorage.getItem(SAVE_PREFIX + slot);
        if (!json) return null;
        const state = JSON.parse(json);
        return {
            slot,
            userTeamId: state.userTeamId,
            season: state.season,
            phase: state.phase,
            day: state.day,
            record: state.teams[state.userTeamId] ? `${state.teams[state.userTeamId].wins}-${state.teams[state.userTeamId].losses}` : '',
            savedAt: state.savedAt
        };
    } catch (e) {
        return null;
    }
}

export function getAllSaveInfo() {
    return Array.from({ length: MAX_SLOTS }, (_, i) => getSaveInfo(i));
}

export function autoSave() {
    saveGame(0);
}
