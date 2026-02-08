import { getState, setState, addNews } from '../core/game-state.js';
import { simulateGame, simulateGameQuick } from './game-engine.js';
import { generateSchedule } from './schedule-generator.js';
import { updateStandings, getPlayoffTeams, getConferenceStandings } from './standings-manager.js';
import { initializePlayIn, simulatePlayInRound, initializePlayoffs, simulatePlayoffGame, advancePlayoffRound, getActiveSeries, isPlayoffsComplete, getChampion } from './playoff-manager.js';
import { recordGameStats } from '../stats/stat-tracker.js';
import { calculateAwards } from '../systems/awards.js';
import { runDraft } from '../systems/draft-system.js';
import { processPlayerProgression } from '../systems/player-progression.js';
import { processOffseasonFreeAgency } from '../systems/free-agency.js';
import { autoSave } from '../core/storage.js';
import { eventBus } from '../core/event-bus.js';
import { TEAMS } from '../config/team-metadata.js';

export function startNewSeason() {
    const state = getState();
    const schedule = generateSchedule(state.season);

    // Reset team records
    Object.keys(state.teams).forEach(tid => {
        const team = state.teams[tid];
        team.wins = 0;
        team.losses = 0;
        team.confWins = 0;
        team.confLosses = 0;
        team.divWins = 0;
        team.divLosses = 0;
        team.streak = 0;
        team.last10 = [];
    });

    setState({
        schedule,
        day: 0,
        phase: 'regular',
        seasonStats: {},
        gameLog: [],
        playoffs: { playIn: { East: {}, West: {} }, bracket: { round1: [], confSemis: [], confFinals: [], finals: null } },
        awards: { mvp: null, dpoy: null, roy: null, mip: null, sixthMan: null, allNBA: { first: [], second: [], third: [] }, allDefensive: { first: [], second: [] }, allStar: { East: [], West: [] } },
        draftResults: [],
        freeAgents: [],
        pendingOffers: []
    });

    addNews(`${state.season}-${state.season + 1} NBA season begins!`, 'info');
    autoSave();
    eventBus.emit('seasonStarted');
}

export function getNextGameDay() {
    const state = getState();
    return state.schedule.find(d => d.games.some(g => !g.played));
}

export function getUserNextGame() {
    const state = getState();
    for (const day of state.schedule) {
        for (const game of day.games) {
            if (!game.played && (game.home === state.userTeamId || game.away === state.userTeamId)) {
                return { day, game };
            }
        }
    }
    return null;
}

export function simulateDay(dayIndex) {
    const state = getState();
    const day = state.schedule[dayIndex !== undefined ? dayIndex : state.day];
    if (!day) return [];

    const results = [];

    for (const game of day.games) {
        if (game.played) continue;

        const result = simulateGameQuick(game.home, game.away);
        game.played = true;
        game.result = {
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            winner: result.winner
        };

        updateStandings(result);
        recordGameStats(result);

        state.gameLog.push({
            day: day.day,
            date: day.date,
            home: game.home,
            away: game.away,
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            winner: result.winner
        });

        results.push(result);
    }

    // Advance day
    const nextDay = state.schedule.findIndex(d => d.games.some(g => !g.played));
    if (nextDay >= 0) {
        state.day = state.schedule[nextDay].day;
    }

    setState({ schedule: state.schedule, gameLog: state.gameLog, day: state.day });
    autoSave();
    eventBus.emit('daySimulated', results);

    return results;
}

export function simulateUserGame(gameId, detailed = false) {
    const state = getState();

    let gameDay, game;
    for (const day of state.schedule) {
        game = day.games.find(g => g.id === gameId);
        if (game) { gameDay = day; break; }
    }

    if (!game || game.played) return null;

    const result = simulateGame(game.home, game.away, { detailed });
    game.played = true;
    game.result = {
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        winner: result.winner
    };

    updateStandings(result);
    recordGameStats(result);

    state.gameLog.push({
        day: gameDay.day,
        date: gameDay.date,
        home: game.home,
        away: game.away,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        winner: result.winner
    });

    setState({ schedule: state.schedule, gameLog: state.gameLog });
    eventBus.emit('gameCompleted', result);

    return result;
}

export function simToNextUserGame() {
    const state = getState();
    const results = [];

    for (const day of state.schedule) {
        const hasUserGame = day.games.some(g => !g.played && (g.home === state.userTeamId || g.away === state.userTeamId));

        if (hasUserGame) {
            // Simulate non-user games on this day
            for (const game of day.games) {
                if (!game.played && game.home !== state.userTeamId && game.away !== state.userTeamId) {
                    const result = simulateGameQuick(game.home, game.away);
                    game.played = true;
                    game.result = { homeScore: result.homeScore, awayScore: result.awayScore, winner: result.winner };
                    updateStandings(result);
                    recordGameStats(result);
                    state.gameLog.push({ day: day.day, date: day.date, home: game.home, away: game.away, homeScore: result.homeScore, awayScore: result.awayScore, winner: result.winner });
                    results.push(result);
                }
            }
            break;
        }

        // Simulate all games on this day
        for (const game of day.games) {
            if (!game.played) {
                const result = simulateGameQuick(game.home, game.away);
                game.played = true;
                game.result = { homeScore: result.homeScore, awayScore: result.awayScore, winner: result.winner };
                updateStandings(result);
                recordGameStats(result);
                state.gameLog.push({ day: day.day, date: day.date, home: game.home, away: game.away, homeScore: result.homeScore, awayScore: result.awayScore, winner: result.winner });
                results.push(result);
            }
        }
    }

    const nextDay = state.schedule.findIndex(d => d.games.some(g => !g.played));
    if (nextDay >= 0) state.day = state.schedule[nextDay].day;

    setState({ schedule: state.schedule, gameLog: state.gameLog, day: state.day });
    autoSave();
    eventBus.emit('daySimulated', results);
    return results;
}

export function simWeek() {
    const results = [];
    for (let i = 0; i < 7; i++) {
        const dayResults = simulateDay();
        results.push(...dayResults);
        if (isSeasonComplete()) break;
    }
    return results;
}

export function simRestOfSeason() {
    const state = getState();
    while (!isSeasonComplete()) {
        simulateDay();
    }
    return checkSeasonEnd();
}

export function isSeasonComplete() {
    const state = getState();
    return state.schedule.every(d => d.games.every(g => g.played));
}

export function checkSeasonEnd() {
    if (isSeasonComplete() && getState().phase === 'regular') {
        setState({ phase: 'playIn' });
        addNews('Regular season complete! Play-In Tournament begins.', 'info');
        eventBus.emit('regularSeasonEnd');
        return true;
    }
    return false;
}

export function runPlayIn() {
    const standings = getPlayoffTeams();
    initializePlayIn(standings);

    for (const conf of ['East', 'West']) {
        simulatePlayInRound(conf);
        simulatePlayInRound(conf);
    }

    setState({ phase: 'playoffs' });
    const updatedStandings = getPlayoffTeams();
    initializePlayoffs(updatedStandings);

    addNews('NBA Playoffs are set!', 'playoff');
    eventBus.emit('playoffsStarted');
}

export function simPlayoffRound() {
    const activeSeries = getActiveSeries();

    for (const series of activeSeries) {
        while (!series.winner) {
            const isUserSeries = series.team1 === getState().userTeamId || series.team2 === getState().userTeamId;
            if (isUserSeries) {
                // Only sim one game for user series
                simulatePlayoffGame(series);
                return { userGame: true, series };
            }
            simulatePlayoffGame(series);
        }
    }

    advancePlayoffRound();

    if (isPlayoffsComplete()) {
        const champion = getChampion();
        addNews(`${TEAMS[champion].city} ${TEAMS[champion].name} are the NBA Champions!`, 'championship');
        eventBus.emit('championCrowned', champion);
        return { complete: true, champion };
    }

    return { complete: false };
}

export function startOffseason() {
    const state = getState();
    setState({ phase: 'offseason' });

    // Awards
    calculateAwards();
    addNews('Season awards announced!', 'award');

    eventBus.emit('offseasonStarted');
}

export function runOffseason() {
    const state = getState();

    // Player progression
    processPlayerProgression();
    addNews('Players have developed during the offseason.', 'info');

    // Free agency AI moves
    processOffseasonFreeAgency();

    // Draft (simplified)
    runDraft();

    // Advance season
    setState({ season: state.season + 1 });
    addNews(`Welcome to the ${state.season + 1}-${state.season + 2} season!`, 'info');

    eventBus.emit('offseasonComplete');
}

export function getSeasonProgress() {
    const state = getState();
    const totalGames = state.schedule.reduce((sum, d) => sum + d.games.length, 0);
    const playedGames = state.schedule.reduce((sum, d) => sum + d.games.filter(g => g.played).length, 0);
    return { played: playedGames, total: totalGames, pct: totalGames > 0 ? playedGames / totalGames : 0 };
}
