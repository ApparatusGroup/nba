import { TEAMS } from '../config/team-metadata.js';
import { DIVISIONS } from '../config/constants.js';
import { getState } from '../core/game-state.js';

export function updateStandings(gameResult) {
    const state = getState();
    const winner = state.teams[gameResult.winner];
    const loser = state.teams[gameResult.loser];

    if (winner) {
        winner.wins++;
        winner.streak = winner.streak > 0 ? winner.streak + 1 : 1;
        winner.last10 = updateLast10(winner.last10 || [], true);

        // Conference record
        if (TEAMS[gameResult.winner].conference === TEAMS[gameResult.loser].conference) {
            winner.confWins++;
        }
        // Division record
        if (TEAMS[gameResult.winner].division === TEAMS[gameResult.loser].division) {
            winner.divWins++;
        }
    }

    if (loser) {
        loser.losses++;
        loser.streak = loser.streak < 0 ? loser.streak - 1 : -1;
        loser.last10 = updateLast10(loser.last10 || [], false);

        if (TEAMS[gameResult.winner].conference === TEAMS[gameResult.loser].conference) {
            loser.confLosses++;
        }
        if (TEAMS[gameResult.winner].division === TEAMS[gameResult.loser].division) {
            loser.divLosses++;
        }
    }
}

function updateLast10(arr, won) {
    const a = [...arr, won ? 1 : 0];
    if (a.length > 10) a.shift();
    return a;
}

export function getConferenceStandings(conference) {
    const state = getState();
    const confTeams = Object.keys(TEAMS)
        .filter(t => TEAMS[t].conference === conference)
        .map(t => ({
            id: t,
            ...TEAMS[t],
            ...(state.teams[t] || {}),
            winPct: getWinPct(state.teams[t]),
            gb: 0
        }));

    // Sort by win percentage, then head-to-head, then conference record
    confTeams.sort((a, b) => {
        const pctDiff = b.winPct - a.winPct;
        if (Math.abs(pctDiff) > 0.001) return pctDiff;
        // Tiebreaker: conference record
        const aConfPct = (a.confWins || 0) / Math.max(1, (a.confWins || 0) + (a.confLosses || 0));
        const bConfPct = (b.confWins || 0) / Math.max(1, (b.confWins || 0) + (b.confLosses || 0));
        return bConfPct - aConfPct;
    });

    // Calculate games behind
    if (confTeams.length > 0) {
        const leader = confTeams[0];
        confTeams.forEach(t => {
            t.gb = ((leader.wins || 0) - (t.wins || 0) + (t.losses || 0) - (leader.losses || 0)) / 2;
        });
    }

    return confTeams;
}

export function getDivisionStandings(division) {
    const state = getState();
    const divInfo = DIVISIONS[division];
    if (!divInfo) return [];

    const divTeams = divInfo.teams.map(t => ({
        id: t,
        ...TEAMS[t],
        ...(state.teams[t] || {}),
        winPct: getWinPct(state.teams[t])
    }));

    divTeams.sort((a, b) => b.winPct - a.winPct);
    return divTeams;
}

export function getWinPct(team) {
    if (!team) return 0;
    const total = (team.wins || 0) + (team.losses || 0);
    return total > 0 ? (team.wins || 0) / total : 0;
}

export function getPlayoffTeams() {
    const east = getConferenceStandings('East');
    const west = getConferenceStandings('West');

    return {
        East: {
            playoff: east.slice(0, 6),
            playIn: east.slice(6, 10),
            lottery: east.slice(10)
        },
        West: {
            playoff: west.slice(0, 6),
            playIn: west.slice(6, 10),
            lottery: west.slice(10)
        }
    };
}

export function getLeagueStandings() {
    const state = getState();
    return Object.keys(TEAMS)
        .map(t => ({
            id: t,
            ...TEAMS[t],
            ...(state.teams[t] || {}),
            winPct: getWinPct(state.teams[t])
        }))
        .sort((a, b) => b.winPct - a.winPct);
}

export function formatRecord(team) {
    return `${team.wins || 0}-${team.losses || 0}`;
}

export function formatStreak(team) {
    const s = team.streak || 0;
    if (s > 0) return `W${s}`;
    if (s < 0) return `L${Math.abs(s)}`;
    return '-';
}

export function formatLast10(team) {
    const l10 = team.last10 || [];
    const wins = l10.filter(x => x === 1).length;
    const losses = l10.length - wins;
    return `${wins}-${losses}`;
}
