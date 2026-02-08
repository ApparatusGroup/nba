import { SALARY_CAP, LUXURY_TAX_LINE, FIRST_APRON, VET_MINIMUMS, NON_TAXPAYER_MLE, TAXPAYER_MLE, MAX_PCT_0_6, MAX_PCT_7_9, MAX_PCT_10_PLUS } from '../config/constants.js';
import { getState } from '../core/game-state.js';

export function calculateTeamSalary(teamId) {
    const state = getState();
    const team = state.teams[teamId];
    if (!team) return 0;

    return team.roster.reduce((sum, pid) => {
        const player = state.players[pid];
        return sum + (player?.salary || 0);
    }, 0);
}

export function getCapSpace(teamId) {
    return Math.max(0, SALARY_CAP - calculateTeamSalary(teamId));
}

export function isOverCap(teamId) {
    return calculateTeamSalary(teamId) > SALARY_CAP;
}

export function isOverLuxuryTax(teamId) {
    return calculateTeamSalary(teamId) > LUXURY_TAX_LINE;
}

export function getLuxuryTaxBill(teamId) {
    const salary = calculateTeamSalary(teamId);
    if (salary <= LUXURY_TAX_LINE) return 0;

    const over = salary - LUXURY_TAX_LINE;
    let tax = 0;
    let remaining = over;

    const brackets = [
        { size: 5000000, rate: 1.50 },
        { size: 5000000, rate: 1.75 },
        { size: 5000000, rate: 2.50 },
        { size: 5000000, rate: 3.25 },
        { size: 5000000, rate: 3.75 },
        { size: 5000000, rate: 4.25 },
        { size: Infinity, rate: 4.75 }
    ];

    for (const bracket of brackets) {
        const taxable = Math.min(remaining, bracket.size);
        tax += taxable * bracket.rate;
        remaining -= taxable;
        if (remaining <= 0) break;
    }

    return Math.round(tax);
}

export function getMaxSalary(yearsPro) {
    if (yearsPro >= 10) return Math.round(SALARY_CAP * MAX_PCT_10_PLUS);
    if (yearsPro >= 7) return Math.round(SALARY_CAP * MAX_PCT_7_9);
    return Math.round(SALARY_CAP * MAX_PCT_0_6);
}

export function getVetMinimum(yearsPro) {
    const idx = Math.min(yearsPro, VET_MINIMUMS.length - 1);
    return VET_MINIMUMS[idx] || VET_MINIMUMS[0];
}

export function getAvailableException(teamId) {
    if (!isOverCap(teamId)) return { type: 'capSpace', amount: getCapSpace(teamId) };
    if (!isOverLuxuryTax(teamId)) return { type: 'MLE', amount: NON_TAXPAYER_MLE };
    return { type: 'taxpayerMLE', amount: TAXPAYER_MLE };
}

export function isTradeValid(outgoingSalary, incomingSalary, teamId) {
    const teamSalary = calculateTeamSalary(teamId);

    if (teamSalary <= SALARY_CAP) {
        return incomingSalary <= SALARY_CAP - teamSalary + outgoingSalary;
    }

    // Over cap: can receive 125% + $100K of outgoing
    const maxIncoming = outgoingSalary * 1.25 + 100000;
    return incomingSalary <= maxIncoming;
}

export function getCapSummary(teamId) {
    const salary = calculateTeamSalary(teamId);
    return {
        totalSalary: salary,
        salaryCap: SALARY_CAP,
        capSpace: Math.max(0, SALARY_CAP - salary),
        overCap: salary > SALARY_CAP,
        luxuryTax: LUXURY_TAX_LINE,
        overTax: salary > LUXURY_TAX_LINE,
        taxBill: getLuxuryTaxBill(teamId),
        firstApron: FIRST_APRON,
        availableException: getAvailableException(teamId)
    };
}
