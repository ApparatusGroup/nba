import { getState, setState, addNews } from '../core/game-state.js';
import { simulateGameQuick } from './game-engine.js';
import { updateStandings } from './standings-manager.js';
import { TEAMS } from '../config/team-metadata.js';
import { HOME_COURT_PATTERN } from '../config/constants.js';

export function initializePlayIn(standings) {
    const state = getState();
    const playIn = { East: { games: [], results: {} }, West: { games: [], results: {} } };

    for (const conf of ['East', 'West']) {
        const seeds = standings[conf];
        const s7 = seeds.playoff.length >= 6 ? seeds.playIn[0] : null;
        const s8 = seeds.playIn[1] || null;
        const s9 = seeds.playIn[2] || null;
        const s10 = seeds.playIn[3] || null;

        if (s7 && s8 && s9 && s10) {
            playIn[conf] = {
                seed7: s7.id,
                seed8: s8.id,
                seed9: s9.id,
                seed10: s10.id,
                game78: null,
                game910: null,
                gameLoserWinner: null,
                finalSeed7: null,
                finalSeed8: null,
                phase: 'round1'
            };
        }
    }

    state.playoffs.playIn = playIn;
    setState({ playoffs: state.playoffs });
}

export function simulatePlayInRound(conf) {
    const state = getState();
    const pi = state.playoffs.playIn[conf];
    if (!pi || !pi.seed7) return;

    if (pi.phase === 'round1') {
        // 7 vs 8: winner gets 7 seed
        const result78 = simulateGameQuick(pi.seed7, pi.seed8);
        updateStandingsForPlayoff(result78);
        pi.game78 = result78;

        // 9 vs 10: winner advances to play loser of 7v8
        const result910 = simulateGameQuick(pi.seed9, pi.seed10);
        updateStandingsForPlayoff(result910);
        pi.game910 = result910;

        pi.finalSeed7 = result78.winner;
        pi.phase = 'round2';

        addNews(`Play-In: ${TEAMS[result78.winner].name} win ${result78.homeScore}-${result78.awayScore}, clinch 7th seed`, 'playoff');
        addNews(`Play-In: ${TEAMS[result910.winner].name} advance, ${TEAMS[result910.loser].name} eliminated`, 'playoff');
    }

    if (pi.phase === 'round2') {
        if (!pi.gameLoserWinner) {
            // Loser of 7v8 vs winner of 9v10 for 8th seed
            const loser78 = pi.game78.loser;
            const winner910 = pi.game910.winner;
            const resultFinal = simulateGameQuick(loser78, winner910);
            updateStandingsForPlayoff(resultFinal);
            pi.gameLoserWinner = resultFinal;
            pi.finalSeed8 = resultFinal.winner;
            pi.phase = 'complete';

            addNews(`Play-In: ${TEAMS[resultFinal.winner].name} clinch 8th seed!`, 'playoff');
            addNews(`${TEAMS[resultFinal.loser].name} eliminated from playoff contention`, 'playoff');
        }
    }

    setState({ playoffs: state.playoffs });
}

function updateStandingsForPlayoff(result) {
    // Don't update regular season standings for playoff games
}

export function initializePlayoffs(standings) {
    const state = getState();
    const bracket = {
        round1: [],
        confSemis: [],
        confFinals: [],
        finals: null
    };

    for (const conf of ['East', 'West']) {
        const topSix = standings[conf].playoff.map(t => t.id);
        const pi = state.playoffs.playIn[conf];
        const seed7 = pi?.finalSeed7 || standings[conf].playIn[0]?.id;
        const seed8 = pi?.finalSeed8 || standings[conf].playIn[1]?.id;

        const seeds = [...topSix, seed7, seed8];

        // Round 1 matchups: 1v8, 4v5, 3v6, 2v7
        bracket.round1.push(createSeries(seeds[0], seeds[7], conf, 1));
        bracket.round1.push(createSeries(seeds[3], seeds[4], conf, 2));
        bracket.round1.push(createSeries(seeds[2], seeds[5], conf, 3));
        bracket.round1.push(createSeries(seeds[1], seeds[6], conf, 4));
    }

    state.playoffs.bracket = bracket;
    setState({ playoffs: state.playoffs, phase: 'playoffs' });
}

function createSeries(higherSeed, lowerSeed, conference, matchupNum) {
    return {
        team1: higherSeed,
        team2: lowerSeed,
        team1Wins: 0,
        team2Wins: 0,
        conference,
        matchupNum,
        games: [],
        winner: null,
        homeCourtTeam: higherSeed
    };
}

export function simulatePlayoffGame(series) {
    const gameNum = series.team1Wins + series.team2Wins;
    const homePattern = HOME_COURT_PATTERN[gameNum] || 0;
    const homeTeam = homePattern === 0 ? series.homeCourtTeam :
        (series.homeCourtTeam === series.team1 ? series.team2 : series.team1);
    const awayTeam = homeTeam === series.team1 ? series.team2 : series.team1;

    const result = simulateGameQuick(homeTeam, awayTeam);

    if (result.winner === series.team1) {
        series.team1Wins++;
    } else {
        series.team2Wins++;
    }

    series.games.push(result);

    if (series.team1Wins === 4) {
        series.winner = series.team1;
        addNews(`${TEAMS[series.team1].city} ${TEAMS[series.team1].name} win the series ${series.team1Wins}-${series.team2Wins}!`, 'playoff');
    } else if (series.team2Wins === 4) {
        series.winner = series.team2;
        addNews(`${TEAMS[series.team2].city} ${TEAMS[series.team2].name} win the series ${series.team2Wins}-${series.team1Wins}!`, 'playoff');
    }

    return result;
}

export function advancePlayoffRound() {
    const state = getState();
    const bracket = state.playoffs.bracket;

    // Check if current round is complete
    if (bracket.round1.length > 0 && bracket.round1.every(s => s.winner)) {
        if (bracket.confSemis.length === 0) {
            // Set up conference semis
            const eastR1 = bracket.round1.filter(s => s.conference === 'East');
            const westR1 = bracket.round1.filter(s => s.conference === 'West');

            // 1v8 winner vs 4v5 winner, 2v7 winner vs 3v6 winner
            if (eastR1[0] && eastR1[1]) bracket.confSemis.push(createSeries(eastR1[0].winner, eastR1[1].winner, 'East', 1));
            if (eastR1[2] && eastR1[3]) bracket.confSemis.push(createSeries(eastR1[3].winner, eastR1[2].winner, 'East', 2));
            if (westR1[0] && westR1[1]) bracket.confSemis.push(createSeries(westR1[0].winner, westR1[1].winner, 'West', 1));
            if (westR1[2] && westR1[3]) bracket.confSemis.push(createSeries(westR1[3].winner, westR1[2].winner, 'West', 2));

            addNews('Conference Semifinals are set!', 'playoff');
        }
    }

    if (bracket.confSemis.length > 0 && bracket.confSemis.every(s => s.winner)) {
        if (bracket.confFinals.length === 0) {
            const eastSemi = bracket.confSemis.filter(s => s.conference === 'East');
            const westSemi = bracket.confSemis.filter(s => s.conference === 'West');

            if (eastSemi[0] && eastSemi[1]) bracket.confFinals.push(createSeries(eastSemi[0].winner, eastSemi[1].winner, 'East', 1));
            if (westSemi[0] && westSemi[1]) bracket.confFinals.push(createSeries(westSemi[0].winner, westSemi[1].winner, 'West', 1));

            addNews('Conference Finals matchups are set!', 'playoff');
        }
    }

    if (bracket.confFinals.length > 0 && bracket.confFinals.every(s => s.winner)) {
        if (!bracket.finals) {
            const eastChamp = bracket.confFinals.find(s => s.conference === 'East')?.winner;
            const westChamp = bracket.confFinals.find(s => s.conference === 'West')?.winner;

            if (eastChamp && westChamp) {
                bracket.finals = createSeries(eastChamp, westChamp, 'Finals', 1);
                addNews(`NBA Finals: ${TEAMS[eastChamp].name} vs ${TEAMS[westChamp].name}!`, 'playoff');
            }
        }
    }

    setState({ playoffs: state.playoffs });
}

export function getActiveSeries() {
    const state = getState();
    const bracket = state.playoffs.bracket;

    // Return series that are still active
    const allSeries = [
        ...bracket.round1,
        ...bracket.confSemis,
        ...bracket.confFinals,
        ...(bracket.finals ? [bracket.finals] : [])
    ];

    return allSeries.filter(s => !s.winner);
}

export function isPlayoffsComplete() {
    const state = getState();
    return state.playoffs.bracket.finals?.winner != null;
}

export function getChampion() {
    const state = getState();
    return state.playoffs.bracket.finals?.winner || null;
}

export function getCurrentRoundName() {
    const state = getState();
    const b = state.playoffs.bracket;

    if (b.finals && !b.finals.winner) return 'NBA Finals';
    if (b.confFinals.length > 0 && b.confFinals.some(s => !s.winner)) return 'Conference Finals';
    if (b.confSemis.length > 0 && b.confSemis.some(s => !s.winner)) return 'Conference Semifinals';
    if (b.round1.some(s => !s.winner)) return 'First Round';
    return 'Complete';
}
