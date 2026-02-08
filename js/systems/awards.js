import { getState, setState } from '../core/game-state.js';
import { TEAMS } from '../config/team-metadata.js';
import { getConferenceStandings, getWinPct } from '../engine/standings-manager.js';
import { POSITIONS } from '../config/constants.js';

export function calculateAwards() {
    const state = getState();
    const players = Object.values(state.players).filter(p => p.team);
    const stats = state.seasonStats;

    const mvp = calculateMVP(players, stats, state);
    const dpoy = calculateDPOY(players, stats);
    const roy = calculateROY(players, stats, state);
    const mip = calculateMIP(players, stats);
    const sixthMan = calculateSixthMan(players, stats, state);
    const allNBA = calculateAllNBA(players, stats, state);
    const allStar = calculateAllStar(players, stats, state);

    state.awards = { mvp, dpoy, roy, mip, sixthMan, allNBA, allDefensive: { first: [], second: [] }, allStar };
    setState({ awards: state.awards });

    return state.awards;
}

function getPlayerAvg(pid, stats) {
    const s = stats[pid];
    if (!s || !s.gp || s.gp === 0) return null;
    return {
        ppg: s.pts / s.gp,
        rpg: s.reb / s.gp,
        apg: s.ast / s.gp,
        spg: s.stl / s.gp,
        bpg: s.blk / s.gp,
        tpg: s.to / s.gp,
        fgPct: s.fga > 0 ? s.fgm / s.fga : 0,
        tpPct: s.tpa > 0 ? s.tpm / s.tpa : 0,
        ftPct: s.fta > 0 ? s.ftm / s.fta : 0,
        mpg: s.min / s.gp,
        gp: s.gp
    };
}

function calculateMVP(players, stats, state) {
    const candidates = players.filter(p => {
        const avg = getPlayerAvg(p.id, stats);
        return avg && avg.gp >= 40 && avg.mpg >= 20;
    });

    const scored = candidates.map(p => {
        const avg = getPlayerAvg(p.id, stats);
        const team = state.teams[p.team];
        const winPct = getWinPct(team);

        const score = (avg.ppg * 2) + (avg.rpg * 1.5) + (avg.apg * 1.5) +
            (avg.spg * 3) + (avg.bpg * 3) - (avg.tpg * 1) +
            (winPct * 35) + (p.ratings.overall * 0.3);

        return { player: p, score, avg };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.player?.id || null;
}

function calculateDPOY(players, stats) {
    const candidates = players.filter(p => {
        const avg = getPlayerAvg(p.id, stats);
        return avg && avg.gp >= 40;
    });

    const scored = candidates.map(p => {
        const avg = getPlayerAvg(p.id, stats);
        const score = (avg.spg * 5) + (avg.bpg * 5) + (p.ratings.defense * 2) + (avg.rpg * 0.5);
        return { player: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.player?.id || null;
}

function calculateROY(players, stats, state) {
    const rookies = players.filter(p => p.yearsPro === 0);
    if (rookies.length === 0) return null;

    const scored = rookies.map(p => {
        const avg = getPlayerAvg(p.id, stats);
        if (!avg || avg.gp < 20) return { player: p, score: 0 };
        const score = (avg.ppg * 2) + (avg.rpg * 1.5) + (avg.apg * 1.5) + (avg.spg * 2) + (avg.bpg * 2);
        return { player: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.player?.id || null;
}

function calculateMIP(players, stats) {
    // For simplicity, pick a young player with high stats relative to their overall rating
    const candidates = players.filter(p => {
        const avg = getPlayerAvg(p.id, stats);
        return avg && avg.gp >= 40 && p.age <= 26;
    });

    const scored = candidates.map(p => {
        const avg = getPlayerAvg(p.id, stats);
        // MIP favors players who outperform their rating
        const expectedPPG = p.ratings.overall * 0.25;
        const score = (avg.ppg - expectedPPG) + avg.apg + avg.rpg * 0.5;
        return { player: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.player?.id || null;
}

function calculateSixthMan(players, stats, state) {
    const benchPlayers = players.filter(p => {
        const team = state.teams[p.team];
        const isStarter = team?.starters?.includes(p.id);
        return !isStarter;
    });

    const scored = benchPlayers.map(p => {
        const avg = getPlayerAvg(p.id, stats);
        if (!avg || avg.gp < 30) return { player: p, score: 0 };
        const score = (avg.ppg * 2) + (avg.rpg * 1) + (avg.apg * 1.5);
        return { player: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.player?.id || null;
}

function calculateAllNBA(players, stats, state) {
    const byPosition = {};
    POSITIONS.forEach(pos => { byPosition[pos] = []; });

    players.forEach(p => {
        const avg = getPlayerAvg(p.id, stats);
        if (!avg || avg.gp < 40) return;

        const winPct = getWinPct(state.teams[p.team]);
        const score = (avg.ppg * 2) + (avg.rpg * 1.5) + (avg.apg * 1.5) +
            (avg.spg * 2) + (avg.bpg * 2) + (winPct * 20) + (p.ratings.overall * 0.2);

        byPosition[p.position].push({ player: p, score });
    });

    Object.values(byPosition).forEach(arr => arr.sort((a, b) => b.score - a.score));

    const teams = { first: [], second: [], third: [] };
    const used = new Set();

    for (const team of ['first', 'second', 'third']) {
        for (const pos of POSITIONS) {
            const candidate = byPosition[pos].find(c => !used.has(c.player.id));
            if (candidate) {
                teams[team].push(candidate.player.id);
                used.add(candidate.player.id);
            }
        }
    }

    return teams;
}

function calculateAllStar(players, stats, state) {
    const allStar = { East: [], West: [] };

    for (const conf of ['East', 'West']) {
        const confPlayers = players.filter(p => p.team && TEAMS[p.team]?.conference === conf);

        const scored = confPlayers.map(p => {
            const avg = getPlayerAvg(p.id, stats);
            if (!avg || avg.gp < 20) return { player: p, score: 0 };
            const score = p.ratings.overall * 2 + (avg.ppg * 2) + (avg.rpg * 1) + (avg.apg * 1.5);
            return { player: p, score };
        });

        scored.sort((a, b) => b.score - a.score);
        allStar[conf] = scored.slice(0, 12).map(s => s.player.id);
    }

    return allStar;
}

export function getAwardPlayerName(playerId) {
    const state = getState();
    const p = state.players[playerId];
    return p ? `${p.firstName} ${p.lastName}` : 'N/A';
}
