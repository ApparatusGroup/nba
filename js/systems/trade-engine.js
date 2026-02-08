import { getState, setState, addNews } from '../core/game-state.js';
import { isTradeValid, calculateTeamSalary } from './salary-cap.js';
import { MAX_ROSTER, MIN_ROSTER } from '../config/constants.js';
import { TEAMS } from '../config/team-metadata.js';

export function evaluatePlayer(player) {
    if (!player) return 0;
    const r = player.ratings;
    let value = r.overall * 3;

    // Age factor
    if (player.age < 23) value += 20;
    else if (player.age < 26) value += 15;
    else if (player.age < 29) value += 5;
    else if (player.age < 32) value -= 5;
    else if (player.age < 35) value -= 15;
    else value -= 30;

    // Potential
    value += (player.potential - r.overall) * 2;

    // Contract value (good player on cheap deal = more valuable)
    const expectedSalary = r.overall >= 85 ? 30000000 : r.overall >= 75 ? 15000000 : r.overall >= 65 ? 5000000 : 2000000;
    if (player.salary < expectedSalary * 0.7) value += 15;
    else if (player.salary > expectedSalary * 1.5) value -= 15;

    return Math.max(0, value);
}

export function evaluateTrade(team1Players, team2Players) {
    const team1Value = team1Players.reduce((sum, p) => sum + evaluatePlayer(p), 0);
    const team2Value = team2Players.reduce((sum, p) => sum + evaluatePlayer(p), 0);

    return {
        team1Value,
        team2Value,
        differential: team1Value - team2Value,
        fairness: Math.min(team1Value, team2Value) / Math.max(team1Value, team2Value, 1)
    };
}

export function proposeTrade(team1Id, team1PlayerIds, team2Id, team2PlayerIds) {
    const state = getState();

    // Validate roster sizes
    const team1 = state.teams[team1Id];
    const team2 = state.teams[team2Id];

    const team1AfterSize = team1.roster.length - team1PlayerIds.length + team2PlayerIds.length;
    const team2AfterSize = team2.roster.length - team2PlayerIds.length + team1PlayerIds.length;

    if (team1AfterSize > MAX_ROSTER || team2AfterSize > MAX_ROSTER) {
        return { success: false, reason: 'Trade would exceed roster limit (15 players).' };
    }
    if (team1AfterSize < MIN_ROSTER || team2AfterSize < MIN_ROSTER) {
        return { success: false, reason: 'Trade would leave a team below minimum roster size.' };
    }

    // Validate salaries
    const team1OutSalary = team1PlayerIds.reduce((sum, id) => sum + (state.players[id]?.salary || 0), 0);
    const team2OutSalary = team2PlayerIds.reduce((sum, id) => sum + (state.players[id]?.salary || 0), 0);

    if (!isTradeValid(team1OutSalary, team2OutSalary, team1Id)) {
        return { success: false, reason: 'Trade does not satisfy salary matching rules for your team.' };
    }
    if (!isTradeValid(team2OutSalary, team1OutSalary, team2Id)) {
        return { success: false, reason: 'Trade does not satisfy salary matching rules for the other team.' };
    }

    // Evaluate fairness
    const team1Players = team1PlayerIds.map(id => state.players[id]);
    const team2Players = team2PlayerIds.map(id => state.players[id]);
    const evaluation = evaluateTrade(team1Players, team2Players);

    // AI acceptance: based on fairness and difficulty
    const difficulty = state.difficulty || 'normal';
    const diffMod = { easy: 0.15, normal: 0, hard: -0.08, legendary: -0.15 }[difficulty] || 0;

    // AI accepts if they're getting good value
    const aiGettingTeam1 = team2Id !== state.userTeamId;
    const aiValue = aiGettingTeam1 ? evaluation.team1Value : evaluation.team2Value;
    const aiGivingValue = aiGettingTeam1 ? evaluation.team2Value : evaluation.team1Value;

    const acceptThreshold = 0.80 + diffMod; // AI needs at least 80% value
    const accepted = (aiValue / Math.max(aiGivingValue, 1)) >= acceptThreshold;

    if (!accepted) {
        return { success: false, reason: `${TEAMS[team2Id].name} rejected the trade. They want more value in return.`, evaluation };
    }

    // Execute trade
    executeTrade(team1Id, team1PlayerIds, team2Id, team2PlayerIds);

    return { success: true, evaluation };
}

export function executeTrade(team1Id, team1PlayerIds, team2Id, team2PlayerIds) {
    const state = getState();

    // Move players
    team1PlayerIds.forEach(pid => {
        state.teams[team1Id].roster = state.teams[team1Id].roster.filter(id => id !== pid);
        state.teams[team2Id].roster.push(pid);
        state.players[pid].team = team2Id;

        // Remove from starters/rotation if needed
        state.teams[team1Id].starters = (state.teams[team1Id].starters || []).filter(id => id !== pid);
        state.teams[team1Id].rotation = (state.teams[team1Id].rotation || []).filter(id => id !== pid);
    });

    team2PlayerIds.forEach(pid => {
        state.teams[team2Id].roster = state.teams[team2Id].roster.filter(id => id !== pid);
        state.teams[team1Id].roster.push(pid);
        state.players[pid].team = team1Id;

        state.teams[team2Id].starters = (state.teams[team2Id].starters || []).filter(id => id !== pid);
        state.teams[team2Id].rotation = (state.teams[team2Id].rotation || []).filter(id => id !== pid);
    });

    const team1Names = team1PlayerIds.map(id => state.players[id]?.lastName).join(', ');
    const team2Names = team2PlayerIds.map(id => state.players[id]?.lastName).join(', ');
    addNews(`Trade: ${TEAMS[team1Id].name} send ${team1Names} to ${TEAMS[team2Id].name} for ${team2Names}`, 'trade');

    setState({ teams: state.teams, players: state.players });
}

export function generateAITradeOffer(userTeamId) {
    const state = getState();
    const otherTeams = Object.keys(state.teams).filter(t => t !== userTeamId);
    const userRoster = state.teams[userTeamId].roster.map(id => state.players[id]).filter(Boolean);

    // Pick a random AI team to propose a trade
    const aiTeamId = otherTeams[Math.floor(Math.random() * otherTeams.length)];
    const aiRoster = state.teams[aiTeamId].roster.map(id => state.players[id]).filter(Boolean);

    if (aiRoster.length < 2 || userRoster.length < 2) return null;

    // AI wants a player from user's team
    const wantedPlayers = userRoster
        .filter(p => p.ratings.overall >= 65)
        .sort((a, b) => b.ratings.overall - a.ratings.overall);

    if (wantedPlayers.length === 0) return null;

    // Pick a target (not the best player usually)
    const target = wantedPlayers[Math.min(1 + Math.floor(Math.random() * 3), wantedPlayers.length - 1)];

    // AI offers players of similar value
    const targetValue = evaluatePlayer(target);
    const offerPlayers = [];
    let offerValue = 0;

    const sortedAI = [...aiRoster].sort((a, b) => evaluatePlayer(b) - evaluatePlayer(a));

    for (const p of sortedAI) {
        if (offerValue >= targetValue * 0.85) break;
        if (evaluatePlayer(p) < targetValue * 0.6) {
            offerPlayers.push(p);
            offerValue += evaluatePlayer(p);
        }
    }

    if (offerPlayers.length === 0 || offerValue < targetValue * 0.6) return null;

    return {
        fromTeam: aiTeamId,
        toTeam: userTeamId,
        offering: offerPlayers.map(p => p.id),
        requesting: [target.id],
        evaluation: evaluateTrade(offerPlayers, [target])
    };
}
