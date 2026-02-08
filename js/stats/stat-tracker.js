import { getState, setState } from '../core/game-state.js';

export function recordGameStats(gameResult) {
    const state = getState();

    // Record stats from both box scores
    recordBoxStats(gameResult.homeBox, state);
    recordBoxStats(gameResult.awayBox, state);

    setState({ seasonStats: state.seasonStats });
}

function recordBoxStats(boxScore, state) {
    Object.entries(boxScore.players).forEach(([playerId, gameStats]) => {
        if (!state.seasonStats[playerId]) {
            state.seasonStats[playerId] = {
                gp: 0, min: 0, pts: 0, reb: 0, oreb: 0, dreb: 0,
                ast: 0, stl: 0, blk: 0, to: 0, pf: 0,
                fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0
            };
        }

        const season = state.seasonStats[playerId];
        if (gameStats.min > 0) {
            season.gp++;
        }
        season.min += gameStats.min || 0;
        season.pts += gameStats.pts || 0;
        season.reb += gameStats.reb || 0;
        season.oreb += gameStats.oreb || 0;
        season.dreb += gameStats.dreb || 0;
        season.ast += gameStats.ast || 0;
        season.stl += gameStats.stl || 0;
        season.blk += gameStats.blk || 0;
        season.to += gameStats.to || 0;
        season.pf += gameStats.pf || 0;
        season.fgm += gameStats.fgm || 0;
        season.fga += gameStats.fga || 0;
        season.tpm += gameStats.tpm || 0;
        season.tpa += gameStats.tpa || 0;
        season.ftm += gameStats.ftm || 0;
        season.fta += gameStats.fta || 0;
    });
}

export function getPlayerSeasonAvg(playerId) {
    const state = getState();
    const s = state.seasonStats[playerId];
    if (!s || s.gp === 0) return null;

    const gp = s.gp;
    return {
        gp,
        mpg: (s.min / gp).toFixed(1),
        ppg: (s.pts / gp).toFixed(1),
        rpg: (s.reb / gp).toFixed(1),
        apg: (s.ast / gp).toFixed(1),
        spg: (s.stl / gp).toFixed(1),
        bpg: (s.blk / gp).toFixed(1),
        tpg: (s.to / gp).toFixed(1),
        fgPct: s.fga > 0 ? (s.fgm / s.fga * 100).toFixed(1) : '0.0',
        tpPct: s.tpa > 0 ? (s.tpm / s.tpa * 100).toFixed(1) : '0.0',
        ftPct: s.fta > 0 ? (s.ftm / s.fta * 100).toFixed(1) : '0.0',
        // Totals
        totalPts: s.pts,
        totalReb: s.reb,
        totalAst: s.ast,
        totalStl: s.stl,
        totalBlk: s.blk,
        fgm: s.fgm,
        fga: s.fga,
        tpm: s.tpm,
        tpa: s.tpa,
        ftm: s.ftm,
        fta: s.fta
    };
}

export function getLeagueLeaders(statType, limit = 20) {
    const state = getState();
    const leaders = [];

    Object.entries(state.seasonStats).forEach(([playerId, s]) => {
        if (s.gp < 10) return;
        const player = state.players[playerId];
        if (!player || !player.team) return;

        let value;
        const gp = s.gp;

        switch (statType) {
            case 'ppg': value = s.pts / gp; break;
            case 'rpg': value = s.reb / gp; break;
            case 'apg': value = s.ast / gp; break;
            case 'spg': value = s.stl / gp; break;
            case 'bpg': value = s.blk / gp; break;
            case 'fgPct': value = s.fga > 0 ? s.fgm / s.fga : 0; break;
            case 'tpPct': value = s.tpa > 20 ? s.tpm / s.tpa : 0; break;
            case 'ftPct': value = s.fta > 20 ? s.ftm / s.fta : 0; break;
            default: value = s.pts / gp;
        }

        leaders.push({ playerId, player, value, avg: getPlayerSeasonAvg(playerId) });
    });

    leaders.sort((a, b) => b.value - a.value);
    return leaders.slice(0, limit);
}

export function getTeamStats(teamId) {
    const state = getState();
    const team = state.teams[teamId];
    if (!team) return null;

    let totalPts = 0, totalReb = 0, totalAst = 0, totalStl = 0, totalBlk = 0;
    let games = 0;

    team.roster.forEach(pid => {
        const s = state.seasonStats[pid];
        if (s) {
            totalPts += s.pts;
            totalReb += s.reb;
            totalAst += s.ast;
            totalStl += s.stl;
            totalBlk += s.blk;
            games = Math.max(games, s.gp);
        }
    });

    return games > 0 ? {
        ppg: (totalPts / games).toFixed(1),
        rpg: (totalReb / games).toFixed(1),
        apg: (totalAst / games).toFixed(1),
        spg: (totalStl / games).toFixed(1),
        bpg: (totalBlk / games).toFixed(1)
    } : null;
}
