import { getState, setState, addNews } from '../core/game-state.js';
import { SALARY_CAP, MAX_ROSTER } from '../config/constants.js';
import { calculateTeamSalary, getCapSpace, getVetMinimum, getMaxSalary } from './salary-cap.js';
import { TEAMS } from '../config/team-metadata.js';
import { evaluatePlayer } from './trade-engine.js';
import { randInt, shuffle } from '../core/utils.js';

export function generateFreeAgents() {
    const state = getState();
    const freeAgents = [];

    // Players with expiring contracts become free agents
    Object.values(state.players).forEach(player => {
        if (player.contractYears <= 1 && Math.random() < 0.3) {
            // Some players become free agents
            freeAgents.push(player.id);
            // Remove from team
            const team = state.teams[player.team];
            if (team) {
                team.roster = team.roster.filter(id => id !== player.id);
                team.starters = (team.starters || []).filter(id => id !== player.id);
                team.rotation = (team.rotation || []).filter(id => id !== player.id);
            }
            player.team = null;
        } else if (player.contractYears > 0) {
            player.contractYears--;
        }
    });

    setState({ freeAgents, players: state.players, teams: state.teams });
    return freeAgents;
}

export function signFreeAgent(teamId, playerId, years, salary) {
    const state = getState();
    const player = state.players[playerId];
    const team = state.teams[teamId];

    if (!player || !team) return { success: false, reason: 'Invalid player or team.' };
    if (team.roster.length >= MAX_ROSTER) return { success: false, reason: 'Roster is full (15 players).' };

    const teamSalary = calculateTeamSalary(teamId);
    const maxOffer = getMaxSalary(player.yearsPro);

    if (salary > maxOffer) return { success: false, reason: 'Salary exceeds max contract.' };

    // Check if team has cap space or exception
    if (teamSalary + salary > SALARY_CAP) {
        // Need exception
        const vetMin = getVetMinimum(player.yearsPro);
        if (salary > vetMin * 1.1) {
            return { success: false, reason: 'Over the salary cap. Can only offer veteran minimum.' };
        }
    }

    // Sign the player
    player.team = teamId;
    player.salary = salary;
    player.contractYears = years;
    team.roster.push(playerId);

    // Remove from free agents
    state.freeAgents = state.freeAgents.filter(id => id !== playerId);

    addNews(`${player.firstName} ${player.lastName} signs with ${TEAMS[teamId].name} (${years}yr/$${(salary/1000000).toFixed(1)}M)`, 'signing');
    setState({ freeAgents: state.freeAgents, players: state.players, teams: state.teams });

    return { success: true };
}

export function processOffseasonFreeAgency() {
    const state = getState();
    const freeAgents = generateFreeAgents();

    // AI teams sign free agents
    const aiTeams = Object.keys(state.teams).filter(t => t !== state.userTeamId);

    for (const faId of [...freeAgents]) {
        const player = state.players[faId];
        if (!player || player.team) continue;

        // Find best fit among AI teams
        const interestedTeams = shuffle(aiTeams).filter(tid => {
            const team = state.teams[tid];
            return team.roster.length < MAX_ROSTER;
        });

        if (interestedTeams.length === 0) continue;

        // Best team (needs + cap space) signs the player
        const signingTeam = interestedTeams[0];
        const salary = estimateSalary(player);
        const years = player.age > 32 ? 1 : player.age > 28 ? randInt(1, 3) : randInt(2, 4);

        player.team = signingTeam;
        player.salary = salary;
        player.contractYears = years;
        state.teams[signingTeam].roster.push(faId);
        state.freeAgents = state.freeAgents.filter(id => id !== faId);
    }

    setState({ freeAgents: state.freeAgents, players: state.players, teams: state.teams });
}

function estimateSalary(player) {
    const ovr = player.ratings.overall;
    if (ovr >= 88) return randInt(30000000, 45000000);
    if (ovr >= 80) return randInt(15000000, 30000000);
    if (ovr >= 72) return randInt(6000000, 15000000);
    if (ovr >= 65) return randInt(3000000, 6000000);
    return getVetMinimum(player.yearsPro);
}

export function getAvailableFreeAgents() {
    const state = getState();
    return state.freeAgents
        .map(id => state.players[id])
        .filter(p => p && !p.team)
        .sort((a, b) => b.ratings.overall - a.ratings.overall);
}
