import { TEAMS } from './config/team-metadata.js';
import { DIVISIONS, POSITIONS } from './config/constants.js';
import { getState, setState, resetState, getTeamRoster } from './core/game-state.js';
import { eventBus } from './core/event-bus.js';
import { loadGame, getAllSaveInfo } from './core/storage.js';
import { deepClone } from './core/utils.js';

// Import player data
import { PLAYERS_ATLANTIC } from './data/players-atlantic.js';
import { PLAYERS_CENTRAL } from './data/players-central.js';
import { PLAYERS_SOUTHEAST } from './data/players-southeast.js';
import { PLAYERS_NORTHWEST } from './data/players-northwest.js';
import { PLAYERS_PACIFIC } from './data/players-pacific.js';
import { PLAYERS_SOUTHWEST } from './data/players-southwest.js';

// Import UI
import { registerRoute, initRouter, navigate } from './ui/router.js';
import { renderSidebar } from './ui/components/sidebar.js';
import { renderNavbar } from './ui/components/navbar.js';

// Import views
import * as newGameView from './ui/views/new-game.js';
import * as dashboardView from './ui/views/dashboard.js';
import * as rosterView from './ui/views/roster.js';
import * as scheduleView from './ui/views/schedule.js';
import * as gameDayView from './ui/views/game-day.js';
import * as gameResultView from './ui/views/game-result.js';
import * as standingsView from './ui/views/standings.js';
import * as playoffsView from './ui/views/playoffs.js';
import * as statsView from './ui/views/stats.js';
import * as playerProfileView from './ui/views/player-profile.js';
import * as teamProfileView from './ui/views/team-profile.js';
import * as tradeView from './ui/views/trade.js';
import * as freeAgencyView from './ui/views/free-agency.js';
import * as draftView from './ui/views/draft.js';
import * as awardsView from './ui/views/awards.js';
import * as settingsView from './ui/views/settings.js';

// Import systems
import { autoSetAllLineups } from './systems/ai-gm.js';

// Combine all player data
const ALL_PLAYERS = [
    ...PLAYERS_ATLANTIC,
    ...PLAYERS_CENTRAL,
    ...PLAYERS_SOUTHEAST,
    ...PLAYERS_NORTHWEST,
    ...PLAYERS_PACIFIC,
    ...PLAYERS_SOUTHWEST
];

function initializeGameData() {
    const state = getState();

    // Build teams object
    const teams = {};
    Object.keys(TEAMS).forEach(abbr => {
        teams[abbr] = {
            id: abbr,
            wins: 0,
            losses: 0,
            confWins: 0,
            confLosses: 0,
            divWins: 0,
            divLosses: 0,
            streak: 0,
            last10: [],
            roster: [],
            starters: [],
            rotation: [],
            totalSalary: 0
        };
    });

    // Build players object and assign to teams
    const players = {};
    ALL_PLAYERS.forEach(playerData => {
        const player = deepClone(playerData);
        // Ensure player has all required fields
        if (!player.id) player.id = `${player.firstName}-${player.lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        if (!player.ratings) player.ratings = { overall: 60, offense: 60, defense: 60, threePoint: 55, midRange: 55, inside: 55, rebounding: 55, passing: 55, speed: 60, stamina: 70, basketballIQ: 60 };
        if (!player.potential) player.potential = player.ratings.overall + 3;
        if (!player.salary) player.salary = 2000000;
        if (!player.contractYears) player.contractYears = 3;
        if (!player.yearsPro) player.yearsPro = 0;
        if (!player.country) player.country = 'USA';

        players[player.id] = player;

        // Add to team roster
        if (player.team && teams[player.team]) {
            teams[player.team].roster.push(player.id);
        }
    });

    // Calculate team salaries
    Object.keys(teams).forEach(abbr => {
        teams[abbr].totalSalary = teams[abbr].roster.reduce((sum, pid) => {
            return sum + (players[pid]?.salary || 0);
        }, 0);
    });

    setState({ teams, players, phase: 'setup', season: 2024 });

    // Auto-set lineups for all teams
    autoSetAllLineups();
}

function init() {
    // Register routes
    registerRoute('/new-game', newGameView);
    registerRoute('/dashboard', dashboardView);
    registerRoute('/roster', rosterView);
    registerRoute('/schedule', scheduleView);
    registerRoute('/game', gameDayView);
    registerRoute('/game-result', gameResultView);
    registerRoute('/standings', standingsView);
    registerRoute('/playoffs', playoffsView);
    registerRoute('/stats', statsView);
    registerRoute('/player', playerProfileView);
    registerRoute('/team', teamProfileView);
    registerRoute('/trade', tradeView);
    registerRoute('/free-agency', freeAgencyView);
    registerRoute('/draft', draftView);
    registerRoute('/awards', awardsView);
    registerRoute('/settings', settingsView);

    // Check for saved game
    const saves = getAllSaveInfo();
    const hasSave = saves.some(s => s !== null);

    // Initialize game data (always needed for new game, loaded game will overwrite)
    initializeGameData();

    // Initialize router (handles URL hash)
    if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
        window.location.hash = '#/new-game';
    }

    initRouter();

    console.log('NBA Manager initialized!');
    console.log(`Loaded ${ALL_PLAYERS.length} players across ${Object.keys(TEAMS).length} teams`);
}

// Start the app - ES modules are deferred, so DOM is already parsed when this runs
init();
