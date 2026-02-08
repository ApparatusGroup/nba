import { DIVISIONS, GAMES_IN_SEASON } from '../config/constants.js';
import { TEAMS } from '../config/team-metadata.js';
import { shuffle } from '../core/utils.js';

export function generateSchedule(season) {
    const allTeams = Object.keys(TEAMS);
    const games = [];
    const teamGames = {};
    allTeams.forEach(t => { teamGames[t] = []; });

    // Build matchup requirements
    const matchups = [];

    for (const teamId of allTeams) {
        const team = TEAMS[teamId];
        const divTeams = getDivisionTeams(teamId);
        const confTeams = getConferenceTeams(teamId).filter(t => !divTeams.includes(t));
        const otherConf = allTeams.filter(t => TEAMS[t].conference !== team.conference);

        // 4 games vs each division rival (16 total)
        for (const opp of divTeams) {
            for (let i = 0; i < 4; i++) {
                if (teamId < opp) { // avoid duplicates
                    matchups.push({ home: i < 2 ? teamId : opp, away: i < 2 ? opp : teamId });
                }
            }
        }

        // 10 non-division conference opponents: 4 games vs 6, 3 games vs 4
        const shuffledConf = shuffle(confTeams);
        const fourGameOpps = shuffledConf.slice(0, 6);
        const threeGameOpps = shuffledConf.slice(6, 10);

        for (const opp of fourGameOpps) {
            if (teamId < opp) {
                for (let i = 0; i < 4; i++) {
                    matchups.push({ home: i < 2 ? teamId : opp, away: i < 2 ? opp : teamId });
                }
            }
        }

        for (const opp of threeGameOpps) {
            if (teamId < opp) {
                for (let i = 0; i < 3; i++) {
                    matchups.push({ home: i < 2 ? teamId : opp, away: i < 2 ? opp : teamId });
                }
            }
        }

        // 2 games vs each opposite conference team (30 total)
        for (const opp of otherConf) {
            if (teamId < opp) {
                matchups.push({ home: teamId, away: opp });
                matchups.push({ home: opp, away: teamId });
            }
        }
    }

    // Deduplicate and limit
    const uniqueMatchups = deduplicateMatchups(matchups, allTeams);

    // Distribute into ~177 game days (late Oct to mid April)
    const schedule = distributeGames(uniqueMatchups, allTeams, season);

    return schedule;
}

function deduplicateMatchups(matchups, allTeams) {
    // Count games per team and trim to 82
    const teamCount = {};
    allTeams.forEach(t => { teamCount[t] = 0; });
    const kept = [];

    const shuffled = shuffle(matchups);

    for (const m of shuffled) {
        if (teamCount[m.home] < GAMES_IN_SEASON && teamCount[m.away] < GAMES_IN_SEASON) {
            kept.push(m);
            teamCount[m.home]++;
            teamCount[m.away]++;
        }
    }

    // Fill any teams that are short (shouldn't happen normally)
    for (const team of allTeams) {
        while (teamCount[team] < GAMES_IN_SEASON) {
            const opponents = allTeams.filter(t => t !== team && teamCount[t] < GAMES_IN_SEASON);
            if (opponents.length === 0) break;
            const opp = opponents[Math.floor(Math.random() * opponents.length)];
            const isHome = Math.random() < 0.5;
            kept.push({ home: isHome ? team : opp, away: isHome ? opp : team });
            teamCount[team]++;
            teamCount[opp]++;
        }
    }

    return kept;
}

function distributeGames(matchups, allTeams, season) {
    const schedule = [];
    const remaining = shuffle([...matchups]);
    const totalDays = 177;

    // Track last game day for each team (to prevent back-to-back-to-back)
    const lastPlayed = {};
    allTeams.forEach(t => { lastPlayed[t] = -3; });

    const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
    const daysInMonth = [9, 30, 31, 31, 28, 31, 15]; // Approximate NBA season
    let dayCounter = 0;
    let dateIndex = 0;
    let monthIdx = 0;
    let dayOfMonth = 22; // Season starts late October

    for (let d = 0; d < totalDays && remaining.length > 0; d++) {
        const dayGames = [];
        const teamsPlayingToday = new Set();

        // Target 7-8 games per day average (1230 total games / 177 days ≈ 7)
        const targetGames = 5 + Math.floor(Math.random() * 5); // 5-9 games per day

        for (let g = 0; g < remaining.length && dayGames.length < targetGames; g++) {
            const game = remaining[g];
            if (teamsPlayingToday.has(game.home) || teamsPlayingToday.has(game.away)) continue;
            // Prevent back-to-back-to-back
            if (lastPlayed[game.home] === d - 1 && lastPlayed[game.home] === d - 2) continue;
            if (lastPlayed[game.away] === d - 1 && lastPlayed[game.away] === d - 2) continue;

            dayGames.push({
                id: `g${season}-${d}-${dayGames.length}`,
                home: game.home,
                away: game.away,
                played: false,
                result: null
            });
            teamsPlayingToday.add(game.home);
            teamsPlayingToday.add(game.away);
            remaining.splice(g, 1);
            g--;

            lastPlayed[game.home] = d;
            lastPlayed[game.away] = d;
        }

        if (dayGames.length > 0) {
            // Calculate date string
            const dateStr = `${months[monthIdx]} ${dayOfMonth}`;

            schedule.push({
                day: dayCounter,
                date: dateStr,
                games: dayGames
            });
        }

        dayCounter++;
        dayOfMonth++;
        if (dayOfMonth > daysInMonth[monthIdx] + (monthIdx === 0 ? 21 : 0)) {
            dayOfMonth = 1;
            monthIdx = Math.min(monthIdx + 1, months.length - 1);
        }
    }

    // Push any remaining games into extra days
    while (remaining.length > 0) {
        const game = remaining.shift();
        const lastDay = schedule[schedule.length - 1];
        if (lastDay && lastDay.games.length < 10) {
            lastDay.games.push({
                id: `g${season}-extra-${lastDay.games.length}`,
                home: game.home,
                away: game.away,
                played: false,
                result: null
            });
        } else {
            schedule.push({
                day: dayCounter++,
                date: 'Apr 15',
                games: [{
                    id: `g${season}-extra2-0`,
                    home: game.home,
                    away: game.away,
                    played: false,
                    result: null
                }]
            });
        }
    }

    return schedule;
}

function getDivisionTeams(teamId) {
    const team = TEAMS[teamId];
    for (const [div, info] of Object.entries(DIVISIONS)) {
        if (info.teams.includes(teamId)) {
            return info.teams.filter(t => t !== teamId);
        }
    }
    return [];
}

function getConferenceTeams(teamId) {
    const team = TEAMS[teamId];
    return Object.keys(TEAMS).filter(t => t !== teamId && TEAMS[t].conference === team.conference);
}
