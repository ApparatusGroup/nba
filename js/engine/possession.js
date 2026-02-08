import { clamp, weightedRandom, randFloat, randInt } from '../core/utils.js';

// Shot type constants
const THREE_POINTER = 3;
const MID_RANGE = 2;
const INSIDE = 2;
const FREE_THROW = 1;

// Action types
const ACTIONS = ['isolation', 'pickAndRoll', 'postUp', 'spotUp', 'fastBreak', 'cutToBucket'];
const ACTION_WEIGHTS = [20, 30, 15, 20, 8, 7];

function ratingToPct(rating, shotType) {
    // Convert 0-99 rating to realistic shooting percentage
    if (shotType === 'three') {
        return 0.25 + (rating / 99) * 0.22; // 25% to 47%
    } else if (shotType === 'mid') {
        return 0.32 + (rating / 99) * 0.22; // 32% to 54%
    } else if (shotType === 'inside') {
        return 0.42 + (rating / 99) * 0.28; // 42% to 70%
    } else if (shotType === 'ft') {
        return 0.55 + (rating / 99) * 0.35; // 55% to 90%
    }
    return 0.45;
}

function selectShooter(lineup, ballHandler) {
    // Weight selection by offense rating
    const weights = lineup.map(p => {
        let w = p.ratings.offense;
        if (p === ballHandler) w *= 1.3; // ball handler has higher chance
        return w;
    });
    return weightedRandom(lineup, weights);
}

function selectBallHandler(lineup) {
    // PG or highest passing rating
    const weights = lineup.map(p => {
        let w = p.ratings.passing;
        if (p.position === 'PG') w *= 1.5;
        if (p.position === 'SG') w *= 1.2;
        return w;
    });
    return weightedRandom(lineup, weights);
}

function selectDefender(defLineup, shooter) {
    // Match by position, then closest
    const posMatch = defLineup.find(p => p.position === shooter.position);
    if (posMatch) return posMatch;
    return defLineup[Math.floor(Math.random() * defLineup.length)];
}

function selectShotType(action, shooter) {
    // Determine what kind of shot based on action and player tendencies
    const three = shooter.ratings.threePoint;
    const mid = shooter.ratings.midRange;
    const inside = shooter.ratings.inside;

    let threeW, midW, insideW;

    switch (action) {
        case 'spotUp':
            threeW = three * 2.5;
            midW = mid * 0.8;
            insideW = inside * 0.2;
            break;
        case 'postUp':
            threeW = three * 0.1;
            midW = mid * 0.8;
            insideW = inside * 2.5;
            break;
        case 'fastBreak':
            threeW = three * 0.5;
            midW = mid * 0.3;
            insideW = inside * 2.0;
            break;
        case 'cutToBucket':
            threeW = three * 0.1;
            midW = mid * 0.3;
            insideW = inside * 2.5;
            break;
        case 'isolation':
            threeW = three * 1.2;
            midW = mid * 1.5;
            insideW = inside * 1.0;
            break;
        case 'pickAndRoll':
        default:
            threeW = three * 1.0;
            midW = mid * 1.2;
            insideW = inside * 1.3;
            break;
    }

    return weightedRandom(
        ['three', 'mid', 'inside'],
        [threeW, midW, insideW]
    );
}

export function resolvePossession(offLineup, defLineup, context = {}) {
    const result = {
        points: 0,
        shooter: null,
        assister: null,
        rebounder: null,
        turnover: false,
        steal: false,
        block: false,
        foul: false,
        shotMade: false,
        shotType: null,
        action: null,
        freeThrows: { made: 0, attempted: 0, shooter: null },
        offRebound: false,
        stats: {} // playerId -> { pts, reb, ast, stl, blk, to, fgm, fga, tpm, tpa, ftm, fta, oreb, dreb, pf }
    };

    // Initialize stats for all players
    [...offLineup, ...defLineup].forEach(p => {
        result.stats[p.id] = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, pf: 0 };
    });

    const ballHandler = selectBallHandler(offLineup);
    const fatigueMod = context.fatigue || 0; // 0 to -0.1
    const homeBonus = context.isHome ? 0.015 : 0;

    // Check for turnover (average ~14 turnovers per game per team, ~100 possessions = 14%)
    const avgDefense = defLineup.reduce((s, p) => s + p.ratings.defense, 0) / defLineup.length;
    const turnoverChance = 0.10 + (avgDefense / 99) * 0.08 - (ballHandler.ratings.passing / 99) * 0.06 + fatigueMod * 0.5;

    if (Math.random() < clamp(turnoverChance, 0.06, 0.22)) {
        result.turnover = true;
        result.stats[ballHandler.id].to = 1;

        // Check if it's a steal
        if (Math.random() < 0.55) {
            const stealer = weightedRandom(defLineup, defLineup.map(p => p.ratings.defense));
            result.steal = true;
            result.stats[stealer.id].stl = 1;
        }
        return result;
    }

    // Select action
    const action = weightedRandom(ACTIONS, ACTION_WEIGHTS);
    result.action = action;

    // Select shooter
    const shooter = selectShooter(offLineup, ballHandler);
    result.shooter = shooter;

    // Select shot type
    const shotType = selectShotType(action, shooter);
    result.shotType = shotType;

    // Select defender
    const defender = selectDefender(defLineup, shooter);

    // Check for foul before shot (~20% of possessions have fouls, ~60% are shooting fouls)
    const foulChance = 0.18;
    const isFoul = Math.random() < foulChance;

    if (isFoul && Math.random() < 0.6) {
        // Shooting foul
        result.foul = true;
        result.stats[defender.id].pf = 1;

        const ftCount = shotType === 'three' ? 3 : 2;
        const ftPct = ratingToPct(shooter.ratings.offense * 0.4 + shooter.ratings.midRange * 0.6, 'ft');

        result.freeThrows.shooter = shooter;
        result.freeThrows.attempted = ftCount;

        for (let i = 0; i < ftCount; i++) {
            if (Math.random() < ftPct + homeBonus) {
                result.freeThrows.made++;
                result.points++;
            }
        }

        result.stats[shooter.id].ftm = result.freeThrows.made;
        result.stats[shooter.id].fta = result.freeThrows.attempted;
        result.stats[shooter.id].pts = result.freeThrows.made;

        // Rebound on missed last FT
        if (result.freeThrows.made < result.freeThrows.attempted) {
            resolveRebound(offLineup, defLineup, result);
        }

        return result;
    }

    // Non-shooting foul (clock continues, inbound - treat as wasted possession basically)
    if (isFoul) {
        result.foul = true;
        result.stats[defender.id].pf = 1;
        // Bonus free throws if in penalty (simplified: 25% chance)
        if (Math.random() < 0.25) {
            const ftPct = ratingToPct(shooter.ratings.offense * 0.4 + shooter.ratings.midRange * 0.6, 'ft');
            result.freeThrows.shooter = shooter;
            result.freeThrows.attempted = 2;
            for (let i = 0; i < 2; i++) {
                if (Math.random() < ftPct + homeBonus) {
                    result.freeThrows.made++;
                    result.points++;
                }
            }
            result.stats[shooter.id].ftm = result.freeThrows.made;
            result.stats[shooter.id].fta = result.freeThrows.attempted;
            result.stats[shooter.id].pts = result.freeThrows.made;
        }
        return result;
    }

    // Resolve shot attempt
    let shooterRating;
    let pointValue;

    if (shotType === 'three') {
        shooterRating = shooter.ratings.threePoint;
        pointValue = 3;
        result.stats[shooter.id].tpa = 1;
        result.stats[shooter.id].fga = 1;
    } else if (shotType === 'mid') {
        shooterRating = shooter.ratings.midRange;
        pointValue = 2;
        result.stats[shooter.id].fga = 1;
    } else {
        shooterRating = shooter.ratings.inside;
        pointValue = 2;
        result.stats[shooter.id].fga = 1;
    }

    // Calculate shot probability
    const basePct = ratingToPct(shooterRating, shotType === 'three' ? 'three' : shotType === 'mid' ? 'mid' : 'inside');
    const contestMod = -0.05 * (defender.ratings.defense / 99);
    const fatMod = fatigueMod * 0.8;
    const finalPct = clamp(basePct + contestMod + fatMod + homeBonus, 0.15, 0.72);

    // Check for block (before shot resolves)
    const blockChance = (defender.ratings.defense / 99) * 0.04 * (shotType === 'inside' ? 1.5 : shotType === 'mid' ? 0.8 : 0.3);
    if (Math.random() < blockChance) {
        result.block = true;
        result.stats[defender.id].blk = 1;
        resolveRebound(offLineup, defLineup, result);
        return result;
    }

    // Shot attempt
    if (Math.random() < finalPct) {
        // Made shot
        result.shotMade = true;
        result.points = pointValue;
        result.stats[shooter.id].pts = pointValue;
        result.stats[shooter.id].fgm = 1;
        if (shotType === 'three') result.stats[shooter.id].tpm = 1;

        // Assist check (if shooter != ball handler)
        if (shooter !== ballHandler && Math.random() < 0.65) {
            result.assister = ballHandler;
            result.stats[ballHandler.id].ast = 1;
        } else if (shooter !== ballHandler) {
            // Check other players for assist
            const otherPassers = offLineup.filter(p => p !== shooter && p !== ballHandler);
            if (otherPassers.length > 0 && Math.random() < 0.25) {
                const assister = weightedRandom(otherPassers, otherPassers.map(p => p.ratings.passing));
                result.assister = assister;
                result.stats[assister.id].ast = 1;
            }
        }

        // And-one foul check (5% chance on made shot)
        if (Math.random() < 0.05) {
            result.foul = true;
            result.stats[defender.id].pf = 1;
            const ftPct = ratingToPct(shooter.ratings.offense * 0.4 + shooter.ratings.midRange * 0.6, 'ft');
            result.freeThrows.shooter = shooter;
            result.freeThrows.attempted = 1;
            if (Math.random() < ftPct + homeBonus) {
                result.freeThrows.made = 1;
                result.points++;
                result.stats[shooter.id].pts++;
            }
            result.stats[shooter.id].ftm += result.freeThrows.made;
            result.stats[shooter.id].fta += result.freeThrows.attempted;
        }
    } else {
        // Missed shot - rebound
        resolveRebound(offLineup, defLineup, result);
    }

    return result;
}

function resolveRebound(offLineup, defLineup, result) {
    // Offensive rebound ~25% of the time
    const offRebWeights = offLineup.map(p => p.ratings.rebounding * (p.position === 'C' ? 1.4 : p.position === 'PF' ? 1.2 : 0.7));
    const defRebWeights = defLineup.map(p => p.ratings.rebounding * (p.position === 'C' ? 1.4 : p.position === 'PF' ? 1.2 : 0.8));

    const offTotal = offRebWeights.reduce((a, b) => a + b, 0);
    const defTotal = defRebWeights.reduce((a, b) => a + b, 0);
    const offRebPct = (offTotal / (offTotal + defTotal * 1.8)); // Defense has natural advantage

    if (Math.random() < clamp(offRebPct, 0.18, 0.35)) {
        // Offensive rebound
        result.offRebound = true;
        const rebounder = weightedRandom(offLineup, offRebWeights);
        result.rebounder = rebounder;
        result.stats[rebounder.id].reb = 1;
        result.stats[rebounder.id].oreb = 1;
    } else {
        // Defensive rebound
        const rebounder = weightedRandom(defLineup, defRebWeights);
        result.rebounder = rebounder;
        result.stats[rebounder.id].reb = 1;
        result.stats[rebounder.id].dreb = 1;
    }
}

export function generatePlayByPlay(result, offTeam, defTeam, clock, quarter) {
    const shooter = result.shooter;
    const time = formatClock(clock);

    if (result.turnover) {
        const by = result.shooter || { lastName: 'Team' };
        if (result.steal) {
            const stealer = Object.keys(result.stats).find(id => result.stats[id].stl > 0);
            return `${time} | Turnover by ${offTeam}. Stolen!`;
        }
        return `${time} | ${offTeam} turnover.`;
    }

    if (result.block) {
        return `${time} | ${shooter.lastName}'s shot BLOCKED!`;
    }

    if (result.foul && result.freeThrows.attempted > 0 && !result.shotMade) {
        const ft = result.freeThrows;
        return `${time} | Foul! ${ft.shooter.lastName} ${ft.made}/${ft.attempted} from the line. ${result.points > 0 ? `(+${result.points})` : ''}`;
    }

    if (result.shotMade) {
        const shotDesc = result.shotType === 'three' ? 'three-pointer' : result.shotType === 'mid' ? 'mid-range jumper' : 'layup';
        const assistTxt = result.assister ? ` (ast: ${result.assister.lastName})` : '';
        const andOne = result.freeThrows.attempted > 0 ? ' AND ONE!' : '';
        return `${time} | ${shooter.lastName} ${shotDesc} is GOOD!${assistTxt}${andOne} (+${result.points})`;
    }

    if (result.stats[shooter?.id]?.fga > 0) {
        const shotDesc = result.shotType === 'three' ? 'three' : result.shotType === 'mid' ? 'jumper' : 'shot';
        const rebTxt = result.rebounder ? ` Rebound: ${result.rebounder.lastName}${result.offRebound ? ' (OFF)' : ''}` : '';
        return `${time} | ${shooter.lastName} misses the ${shotDesc}.${rebTxt}`;
    }

    return `${time} | ${offTeam} possession.`;
}

function formatClock(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
