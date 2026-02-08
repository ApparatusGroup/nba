import { getState, setState, addNews } from '../core/game-state.js';
import { clamp, randInt } from '../core/utils.js';

export function processPlayerProgression() {
    const state = getState();
    const retired = [];

    Object.values(state.players).forEach(player => {
        if (!player.team) return;

        const oldOvr = player.ratings.overall;
        player.age++;

        // Age-based development/decline
        let change = getAgeDelta(player.age);

        // Variance
        change += randInt(-2, 2);

        // Potential ceiling
        const potentialGap = player.potential - player.ratings.overall;
        if (potentialGap > 0 && player.age < 27) {
            change += Math.min(potentialGap * 0.2, 3);
        }

        // Apply to individual ratings with slight variance per skill
        const ratingKeys = ['offense', 'defense', 'threePoint', 'midRange', 'inside', 'rebounding', 'passing', 'speed', 'stamina', 'basketballIQ'];

        ratingKeys.forEach(key => {
            let skillChange = change + randInt(-1, 1);

            // Speed and stamina decline faster with age
            if ((key === 'speed' || key === 'stamina') && player.age > 30) {
                skillChange -= 1;
            }

            // Basketball IQ can improve with age
            if (key === 'basketballIQ' && player.age < 34) {
                skillChange += 1;
            }

            player.ratings[key] = clamp(player.ratings[key] + skillChange, 25, 99);
        });

        // Recalculate overall
        player.ratings.overall = calculateOverall(player.ratings);

        // Cap at potential
        if (player.ratings.overall > player.potential) {
            player.ratings.overall = player.potential;
        }

        // Retirement check
        if (player.age >= 38 && player.ratings.overall < 60) {
            if (Math.random() < 0.7) {
                retired.push(player);
            }
        } else if (player.age >= 40) {
            if (Math.random() < 0.9) {
                retired.push(player);
            }
        }

        // Contract year reduction
        if (player.contractYears > 0) {
            player.contractYears--;
        }
    });

    // Process retirements
    retired.forEach(player => {
        if (player.team && state.teams[player.team]) {
            state.teams[player.team].roster = state.teams[player.team].roster.filter(id => id !== player.id);
            state.teams[player.team].starters = (state.teams[player.team].starters || []).filter(id => id !== player.id);
            state.teams[player.team].rotation = (state.teams[player.team].rotation || []).filter(id => id !== player.id);
        }
        addNews(`${player.firstName} ${player.lastName} has retired after ${player.yearsPro} seasons.`, 'info');
        player.team = null;
        player.yearsPro++;
    });

    // Increase years pro
    Object.values(state.players).forEach(player => {
        if (player.team) player.yearsPro++;
    });

    setState({ players: state.players, teams: state.teams });
}

function getAgeDelta(age) {
    if (age <= 21) return randInt(2, 5);
    if (age <= 24) return randInt(1, 3);
    if (age <= 27) return randInt(0, 2);
    if (age <= 29) return randInt(-1, 1);
    if (age <= 31) return randInt(-2, 0);
    if (age <= 33) return randInt(-3, -1);
    if (age <= 35) return randInt(-4, -1);
    return randInt(-5, -2);
}

function calculateOverall(ratings) {
    const weights = {
        offense: 0.15,
        defense: 0.12,
        threePoint: 0.10,
        midRange: 0.10,
        inside: 0.12,
        rebounding: 0.08,
        passing: 0.10,
        speed: 0.08,
        stamina: 0.05,
        basketballIQ: 0.10
    };

    let total = 0;
    let weightSum = 0;
    Object.entries(weights).forEach(([key, weight]) => {
        if (ratings[key] !== undefined) {
            total += ratings[key] * weight;
            weightSum += weight;
        }
    });

    return Math.round(total / weightSum);
}
