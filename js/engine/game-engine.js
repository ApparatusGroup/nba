import { resolvePossession, generatePlayByPlay } from './possession.js';
import { createBoxScore, addPossessionStats, createPlayerGameStats } from './box-score.js';
import { clamp, randInt } from '../core/utils.js';
import { getState } from '../core/game-state.js';
import { QUARTER_MINUTES, OT_MINUTES } from '../config/constants.js';

export function simulateGame(homeTeamId, awayTeamId, options = {}) {
    const state = getState();
    const homeTeam = state.teams[homeTeamId];
    const awayTeam = state.teams[awayTeamId];

    const homePlayers = homeTeam.roster.map(id => state.players[id]).filter(Boolean);
    const awayPlayers = awayTeam.roster.map(id => state.players[id]).filter(Boolean);

    const homeLineup = getActiveLineup(homeTeam, homePlayers);
    const awayLineup = getActiveLineup(awayTeam, awayPlayers);
    const homeRotation = getRotation(homeTeam, homePlayers);
    const awayRotation = getRotation(awayTeam, awayPlayers);

    const homeBox = createBoxScore(homeTeamId);
    const awayBox = createBoxScore(awayTeamId);
    const playByPlay = [];

    // Initialize all players in box score
    homeRotation.forEach(p => { homeBox.players[p.id] = createPlayerGameStats(); });
    awayRotation.forEach(p => { awayBox.players[p.id] = createPlayerGameStats(); });

    let homeScore = 0;
    let awayScore = 0;
    let quarter = 1;
    let homeCurrentLineup = [...homeLineup];
    let awayCurrentLineup = [...awayLineup];

    // Fatigue tracking
    const fatigue = {};
    [...homeRotation, ...awayRotation].forEach(p => { fatigue[p.id] = 0; });

    const maxQuarters = 4;

    // Play regulation quarters
    for (quarter = 1; quarter <= maxQuarters; quarter++) {
        const qResult = simulateQuarter(
            quarter, QUARTER_MINUTES * 60,
            homeCurrentLineup, awayCurrentLineup,
            homeRotation, awayRotation,
            homeBox, awayBox, fatigue,
            homeTeamId, awayTeamId,
            playByPlay, options.detailed
        );
        homeScore += qResult.homePoints;
        awayScore += qResult.awayPoints;
        homeBox.quarterScores.push(qResult.homePoints);
        awayBox.quarterScores.push(qResult.awayPoints);
        homeCurrentLineup = qResult.homeLineup;
        awayCurrentLineup = qResult.awayLineup;
    }

    // Overtime if tied
    let otCount = 0;
    while (homeScore === awayScore) {
        otCount++;
        quarter++;
        const qResult = simulateQuarter(
            quarter, OT_MINUTES * 60,
            homeCurrentLineup, awayCurrentLineup,
            homeRotation, awayRotation,
            homeBox, awayBox, fatigue,
            homeTeamId, awayTeamId,
            playByPlay, options.detailed
        );
        homeScore += qResult.homePoints;
        awayScore += qResult.awayPoints;
        homeBox.quarterScores.push(qResult.homePoints);
        awayBox.quarterScores.push(qResult.awayPoints);
        homeCurrentLineup = qResult.homeLineup;
        awayCurrentLineup = qResult.awayLineup;
    }

    // Update minutes for all players
    homeBox.totalScore = homeScore;
    awayBox.totalScore = awayScore;

    return {
        homeTeamId,
        awayTeamId,
        homeScore,
        awayScore,
        homeBox,
        awayBox,
        playByPlay: options.detailed ? playByPlay : [],
        quarters: homeBox.quarterScores.length,
        overtime: otCount,
        winner: homeScore > awayScore ? homeTeamId : awayTeamId,
        loser: homeScore > awayScore ? awayTeamId : homeTeamId
    };
}

function simulateQuarter(quarter, totalSeconds, homeLineup, awayLineup, homeRot, awayRot, homeBox, awayBox, fatigue, homeId, awayId, pbp, detailed) {
    let clock = totalSeconds;
    let homePoints = 0;
    let awayPoints = 0;
    let possession = Math.random() < 0.5 ? 'home' : 'away'; // Tip off
    let subCounter = 0;

    // Target ~100 possessions per team per 48 min -> ~25 per quarter per team
    // 720s per quarter / ~50 total possessions = ~14.4s avg per possession

    while (clock > 0) {
        const isHome = possession === 'home';
        const offLineup = isHome ? homeLineup : awayLineup;
        const defLineup = isHome ? awayLineup : homeLineup;
        const offBox = isHome ? homeBox : awayBox;
        const offTeamId = isHome ? homeId : awayId;
        const defTeamId = isHome ? awayId : homeId;

        // Calculate fatigue modifier for offense
        const avgFatigue = offLineup.reduce((s, p) => s + (fatigue[p.id] || 0), 0) / 5;
        const fatigueMod = -avgFatigue * 0.08;

        const result = resolvePossession(offLineup, defLineup, {
            isHome,
            fatigue: fatigueMod,
            quarter,
            clock
        });

        // Record stats
        Object.entries(result.stats).forEach(([pid, stats]) => {
            addPossessionStats(offBox.teamId === homeBox.teamId && isHome ? homeBox : awayBox, pid, {});
            // Find correct box
            if (homeBox.players[pid]) {
                Object.keys(stats).forEach(k => { homeBox.players[pid][k] += stats[k]; });
            } else if (awayBox.players[pid]) {
                Object.keys(stats).forEach(k => { awayBox.players[pid][k] += stats[k]; });
            }
        });

        if (isHome) homePoints += result.points;
        else awayPoints += result.points;

        // Add play-by-play
        if (detailed) {
            const text = generatePlayByPlay(result, offTeamId, defTeamId, clock, quarter);
            if (text) {
                pbp.push({
                    quarter,
                    clock,
                    text,
                    homeScore: homeBox.totalScore + homePoints,
                    awayScore: awayBox.totalScore + awayPoints,
                    team: offTeamId
                });
            }
        }

        // Advance clock (~10-18s per possession, avg ~14s)
        const elapsed = 10 + randInt(0, 8);
        clock -= elapsed;

        // Track minutes and fatigue
        [...offLineup, ...defLineup].forEach(p => {
            if (homeBox.players[p.id]) homeBox.players[p.id].min += elapsed / 60;
            else if (awayBox.players[p.id]) awayBox.players[p.id].min += elapsed / 60;
            fatigue[p.id] = clamp((fatigue[p.id] || 0) + elapsed / 720, 0, 1);
        });

        // Substitutions every ~3 minutes of game time
        subCounter += elapsed;
        if (subCounter > 180) {
            subCounter = 0;
            homeLineup = makeSubstitutions(homeLineup, homeRot, fatigue, homeBox);
            awayLineup = makeSubstitutions(awayLineup, awayRot, fatigue, awayBox);
        }

        // Switch possession (unless offensive rebound)
        if (!result.offRebound) {
            possession = possession === 'home' ? 'away' : 'home';
        }
    }

    return { homePoints, awayPoints, homeLineup, awayLineup };
}

function makeSubstitutions(currentLineup, rotation, fatigue, boxScore) {
    if (rotation.length <= 5) return currentLineup;

    const newLineup = [...currentLineup];
    const bench = rotation.filter(p => !currentLineup.includes(p));

    // Find most fatigued starter
    let worstIdx = 0;
    let worstFatigue = 0;
    currentLineup.forEach((p, i) => {
        if ((fatigue[p.id] || 0) > worstFatigue) {
            worstFatigue = fatigue[p.id] || 0;
            worstIdx = i;
        }
    });

    // Sub if fatigue > 0.4
    if (worstFatigue > 0.4 && bench.length > 0) {
        // Find best available bench player for the position
        const pos = currentLineup[worstIdx].position;
        let sub = bench.find(p => p.position === pos && (fatigue[p.id] || 0) < 0.3);
        if (!sub) sub = bench.find(p => (fatigue[p.id] || 0) < 0.3);
        if (sub) {
            // Rest the subbed player
            fatigue[currentLineup[worstIdx].id] = Math.max(0, (fatigue[currentLineup[worstIdx].id] || 0) - 0.15);
            newLineup[worstIdx] = sub;
        }
    }

    return newLineup;
}

function getActiveLineup(team, players) {
    // Use starters if defined, otherwise pick best 5
    if (team.starters && team.starters.length === 5) {
        const starters = team.starters.map(id => players.find(p => p.id === id)).filter(Boolean);
        if (starters.length === 5) return starters;
    }
    // Auto-pick: best player at each position
    const lineup = [];
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const available = [...players].sort((a, b) => b.ratings.overall - a.ratings.overall);

    for (const pos of positions) {
        const pick = available.find(p => (p.position === pos || p.secondaryPos === pos) && !lineup.includes(p));
        if (pick) {
            lineup.push(pick);
        }
    }

    // Fill remaining with best available
    while (lineup.length < 5 && available.length > lineup.length) {
        const next = available.find(p => !lineup.includes(p));
        if (next) lineup.push(next);
        else break;
    }

    return lineup.slice(0, 5);
}

function getRotation(team, players) {
    if (team.rotation && team.rotation.length >= 8) {
        return team.rotation.map(id => players.find(p => p.id === id)).filter(Boolean);
    }
    // Auto: top 10 players by overall
    return [...players].sort((a, b) => b.ratings.overall - a.ratings.overall).slice(0, Math.min(10, players.length));
}

export function simulateGameQuick(homeTeamId, awayTeamId) {
    return simulateGame(homeTeamId, awayTeamId, { detailed: false });
}
