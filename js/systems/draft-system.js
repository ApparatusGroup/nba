import { getState, setState, addNews } from '../core/game-state.js';
import { LOTTERY_ODDS, DRAFT_ROUNDS, PICKS_PER_ROUND } from '../config/constants.js';
import { TEAMS } from '../config/team-metadata.js';
import { getConferenceStandings } from '../engine/standings-manager.js';
import { randInt, randFloat, shuffle, gaussRandom, clamp, generateId } from '../core/utils.js';
import { DRAFT_NAMES } from '../data/draft-names.js';

export function generateDraftClass() {
    const prospects = [];
    const usedNames = new Set();

    for (let i = 0; i < 60; i++) {
        let firstName, lastName;
        do {
            firstName = DRAFT_NAMES.firstNames[randInt(0, DRAFT_NAMES.firstNames.length - 1)];
            lastName = DRAFT_NAMES.lastNames[randInt(0, DRAFT_NAMES.lastNames.length - 1)];
        } while (usedNames.has(`${firstName}-${lastName}`));
        usedNames.add(`${firstName}-${lastName}`);

        const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
        const position = positions[randInt(0, 4)];
        const secondaryPos = positions[randInt(0, 4)];

        // Ratings based on draft position tier
        let baseOvr;
        if (i < 5) baseOvr = randInt(70, 78); // Top 5
        else if (i < 14) baseOvr = randInt(62, 72); // Lottery
        else if (i < 30) baseOvr = randInt(55, 65); // First round
        else baseOvr = randInt(45, 58); // Second round

        const potential = Math.min(99, baseOvr + randInt(5, 20));
        const age = randInt(19, 22);

        const heightByPos = { PG: randInt(73, 77), SG: randInt(75, 79), SF: randInt(78, 81), PF: randInt(80, 83), C: randInt(82, 86) };
        const weightByPos = { PG: randInt(175, 195), SG: randInt(190, 210), SF: randInt(210, 230), PF: randInt(225, 250), C: randInt(240, 270) };

        const prospect = {
            id: `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${getState().season + 1}`,
            firstName,
            lastName,
            team: null,
            position,
            secondaryPos: secondaryPos !== position ? secondaryPos : null,
            age,
            height: heightByPos[position],
            weight: weightByPos[position],
            yearsPro: 0,
            country: Math.random() < 0.7 ? 'USA' : DRAFT_NAMES.countries[randInt(0, DRAFT_NAMES.countries.length - 1)],
            salary: 0,
            contractYears: 0,
            ratings: generateRatings(baseOvr, position),
            potential,
            draftProjection: i + 1,
            scoutingReport: generateScoutingReport(baseOvr, potential)
        };

        prospects.push(prospect);
    }

    return prospects;
}

function generateRatings(baseOvr, position) {
    const variance = () => randInt(-8, 8);

    const posStrengths = {
        PG: { passing: 15, speed: 10, threePoint: 5, inside: -10, rebounding: -15 },
        SG: { threePoint: 10, midRange: 8, speed: 5, rebounding: -10, passing: 0 },
        SF: { midRange: 5, threePoint: 3, rebounding: 0, passing: 0, inside: 0 },
        PF: { inside: 8, rebounding: 10, midRange: -5, threePoint: -8, passing: -5 },
        C: { inside: 15, rebounding: 15, defense: 5, threePoint: -15, speed: -10, passing: -10 }
    };

    const mods = posStrengths[position] || {};

    return {
        overall: baseOvr,
        offense: clamp(baseOvr + variance() + (mods.inside || 0) / 3, 35, 99),
        defense: clamp(baseOvr + variance() + (mods.defense || 0), 35, 99),
        threePoint: clamp(baseOvr + variance() + (mods.threePoint || 0), 25, 99),
        midRange: clamp(baseOvr + variance() + (mods.midRange || 0), 30, 99),
        inside: clamp(baseOvr + variance() + (mods.inside || 0), 30, 99),
        rebounding: clamp(baseOvr + variance() + (mods.rebounding || 0), 25, 99),
        passing: clamp(baseOvr + variance() + (mods.passing || 0), 25, 99),
        speed: clamp(baseOvr + variance() + (mods.speed || 0), 30, 99),
        stamina: clamp(baseOvr + randInt(-5, 10), 50, 99),
        basketballIQ: clamp(baseOvr + variance(), 35, 99)
    };
}

function generateScoutingReport(ovr, potential) {
    if (potential >= 90) return 'Franchise-altering talent with elite upside.';
    if (potential >= 85) return 'Star potential. Could be a cornerstone player.';
    if (potential >= 80) return 'Solid starter potential with room to grow.';
    if (potential >= 72) return 'Good rotation player. Reliable contributor.';
    if (potential >= 65) return 'Developmental prospect. High-upside project.';
    return 'End of bench / G-League prospect.';
}

export function runLottery() {
    const east = getConferenceStandings('East');
    const west = getConferenceStandings('West');
    const allTeams = [...east, ...west].sort((a, b) => (a.winPct || 0) - (b.winPct || 0));

    // Bottom 14 teams enter lottery
    const lotteryTeams = allTeams.slice(0, 14).map(t => t.id);
    const playoffTeams = allTeams.slice(14).reverse().map(t => t.id);

    // Simulate lottery drawing for top 4 picks
    const drawn = [];
    const odds = [...LOTTERY_ODDS];

    for (let pick = 0; pick < 4; pick++) {
        const total = odds.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        let winnerIdx = 0;

        for (let i = 0; i < odds.length; i++) {
            r -= odds[i];
            if (r <= 0) { winnerIdx = i; break; }
        }

        drawn.push(lotteryTeams[winnerIdx]);
        odds[winnerIdx] = 0; // Can't win again
    }

    // Picks 5-14: remaining lottery teams in order of worst record
    const remainingLottery = lotteryTeams.filter(t => !drawn.includes(t));
    const draftOrder = [...drawn, ...remainingLottery, ...playoffTeams];

    // Second round: reverse of first round
    const secondRound = [...draftOrder].reverse();

    return { firstRound: draftOrder, secondRound, lotteryResults: drawn };
}

export function runDraft() {
    const state = getState();
    const draftClass = generateDraftClass();
    const { firstRound, secondRound, lotteryResults } = runLottery();

    state.draftBoard = draftClass;
    const results = [];
    const available = [...draftClass];

    // First round
    for (let i = 0; i < Math.min(firstRound.length, 30); i++) {
        const teamId = firstRound[i];
        const pick = aiDraftPick(teamId, available, state);

        if (pick) {
            const idx = available.indexOf(pick);
            if (idx >= 0) available.splice(idx, 1);

            // Assign rookie contract
            pick.team = teamId;
            pick.salary = getRookieSalary(i + 1);
            pick.contractYears = 4;

            // Add to team roster and game state
            state.players[pick.id] = pick;
            state.teams[teamId].roster.push(pick.id);

            results.push({ round: 1, pick: i + 1, team: teamId, player: pick });
            addNews(`R1 Pick ${i + 1}: ${TEAMS[teamId].name} select ${pick.firstName} ${pick.lastName} (${pick.position})`, 'draft');
        }
    }

    // Second round
    for (let i = 0; i < Math.min(secondRound.length, 30); i++) {
        const teamId = secondRound[i];
        if (available.length === 0) break;

        const pick = aiDraftPick(teamId, available, state);
        if (pick) {
            const idx = available.indexOf(pick);
            if (idx >= 0) available.splice(idx, 1);

            pick.team = teamId;
            pick.salary = getRookieSalary(31 + i);
            pick.contractYears = 2;

            state.players[pick.id] = pick;
            if (state.teams[teamId].roster.length < 15) {
                state.teams[teamId].roster.push(pick.id);
            }

            results.push({ round: 2, pick: i + 1, team: teamId, player: pick });
        }
    }

    setState({ draftResults: results, draftBoard: draftClass, players: state.players, teams: state.teams });
    addNews('NBA Draft complete!', 'draft');
    return results;
}

function aiDraftPick(teamId, available, state) {
    if (available.length === 0) return null;

    // Best player available with slight positional need weighting
    const team = state.teams[teamId];
    const roster = team.roster.map(id => state.players[id]).filter(Boolean);
    const posCount = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    roster.forEach(p => { posCount[p.position] = (posCount[p.position] || 0) + 1; });

    const scored = available.map(p => {
        let score = p.ratings.overall + p.potential * 0.5;
        // Bonus for positions of need
        if (posCount[p.position] < 2) score += 5;
        if (posCount[p.position] < 1) score += 10;
        return { player: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.player || available[0];
}

function getRookieSalary(pickNumber) {
    // Approximate rookie scale
    if (pickNumber === 1) return 12100000;
    if (pickNumber <= 5) return 10000000 - (pickNumber - 1) * 500000;
    if (pickNumber <= 10) return 7000000 - (pickNumber - 5) * 400000;
    if (pickNumber <= 20) return 5000000 - (pickNumber - 10) * 200000;
    if (pickNumber <= 30) return 3000000 - (pickNumber - 20) * 100000;
    return 1500000; // Second round
}
