export function createBoxScore(teamId) {
    return {
        teamId,
        players: {},
        quarterScores: [],
        totalScore: 0
    };
}

export function createPlayerGameStats() {
    return {
        min: 0, pts: 0, reb: 0, oreb: 0, dreb: 0,
        ast: 0, stl: 0, blk: 0, to: 0, pf: 0,
        fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0
    };
}

export function addPossessionStats(boxScore, playerId, possStats) {
    if (!boxScore.players[playerId]) {
        boxScore.players[playerId] = createPlayerGameStats();
    }
    const ps = boxScore.players[playerId];
    Object.keys(possStats).forEach(k => {
        if (k in ps) ps[k] += possStats[k];
    });
}

export function calculateBoxScoreTotals(boxScore) {
    let totalPts = 0;
    Object.values(boxScore.players).forEach(ps => {
        totalPts += ps.pts;
    });
    boxScore.totalScore = totalPts;
    return boxScore;
}

export function getPlayerFGPct(stats) {
    return stats.fga > 0 ? (stats.fgm / stats.fga) : 0;
}

export function getPlayerTPPct(stats) {
    return stats.tpa > 0 ? (stats.tpm / stats.tpa) : 0;
}

export function getPlayerFTPct(stats) {
    return stats.fta > 0 ? (stats.ftm / stats.fta) : 0;
}

export function formatBoxScoreForDisplay(boxScore, players) {
    const rows = [];
    Object.entries(boxScore.players).forEach(([playerId, stats]) => {
        const player = players[playerId];
        if (!player) return;
        rows.push({
            id: playerId,
            name: `${player.firstName} ${player.lastName}`,
            pos: player.position,
            ...stats,
            fgPct: getPlayerFGPct(stats),
            tpPct: getPlayerTPPct(stats),
            ftPct: getPlayerFTPct(stats)
        });
    });
    // Sort by minutes played desc
    rows.sort((a, b) => b.min - a.min);
    return rows;
}
