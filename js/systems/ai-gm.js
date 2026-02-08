import { getState, setState } from '../core/game-state.js';
import { POSITIONS } from '../config/constants.js';

export function autoSetLineups(teamId) {
    const state = getState();
    const team = state.teams[teamId];
    if (!team) return;

    const players = team.roster.map(id => state.players[id]).filter(Boolean);
    if (players.length < 5) return;

    // Set starters: best player at each position
    const starters = [];
    const used = new Set();

    for (const pos of POSITIONS) {
        const candidates = players
            .filter(p => !used.has(p.id) && (p.position === pos || p.secondaryPos === pos))
            .sort((a, b) => b.ratings.overall - a.ratings.overall);

        if (candidates.length > 0) {
            starters.push(candidates[0].id);
            used.add(candidates[0].id);
        }
    }

    // Fill remaining starter spots with best available
    while (starters.length < 5) {
        const best = players
            .filter(p => !used.has(p.id))
            .sort((a, b) => b.ratings.overall - a.ratings.overall)[0];
        if (best) {
            starters.push(best.id);
            used.add(best.id);
        } else break;
    }

    // Set rotation: starters + next 3-5 best
    const bench = players
        .filter(p => !used.has(p.id))
        .sort((a, b) => b.ratings.overall - a.ratings.overall)
        .slice(0, 5);

    const rotation = [...starters, ...bench.map(p => p.id)];

    team.starters = starters;
    team.rotation = rotation;

    setState({ teams: state.teams });
}

export function autoSetAllLineups() {
    const state = getState();
    Object.keys(state.teams).forEach(teamId => {
        autoSetLineups(teamId);
    });
}

export function evaluateTeamNeeds(teamId) {
    const state = getState();
    const team = state.teams[teamId];
    if (!team) return {};

    const roster = team.roster.map(id => state.players[id]).filter(Boolean);
    const needs = {};

    POSITIONS.forEach(pos => {
        const posPlayers = roster.filter(p => p.position === pos || p.secondaryPos === pos);
        const bestOvr = posPlayers.reduce((max, p) => Math.max(max, p.ratings.overall), 0);
        const count = posPlayers.length;

        if (count === 0) needs[pos] = 'critical';
        else if (count === 1 || bestOvr < 65) needs[pos] = 'high';
        else if (bestOvr < 75) needs[pos] = 'moderate';
        else needs[pos] = 'low';
    });

    return needs;
}
