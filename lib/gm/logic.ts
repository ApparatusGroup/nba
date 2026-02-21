import type { Contract, Player } from "@prisma/client";

export const SALARY_CAP = 155_000_000;
export const APRON = 190_000_000;

export type PlayerWithContract = {
  player: Player;
  contract: Contract | null;
};

export type TradeValidationInput = {
  payroll: number;
  outgoingSalary: number;
  incomingSalary: number;
};

export type TradeValidationResult = {
  isValid: boolean;
  reasons: string[];
};

export function getTradeValue(player: Player, contract: Contract | null): number {
  let value = player.overall * 3;

  if (player.age < 24) {
    value += (player.potential - player.overall) * 2;
  }

  if (player.age > 32) {
    value -= (player.age - 32) * 5;
  }

  if (contract) {
    const pctOfCap = contract.amount / SALARY_CAP;
    if (pctOfCap > 0.2 && player.overall < 80) {
      value -= 20;
    }
  }

  return Math.max(0, Math.round(value));
}

function validateSingleTeamTrade(input: TradeValidationInput): string[] {
  const reasons: string[] = [];
  const postTradePayroll = input.payroll - input.outgoingSalary + input.incomingSalary;

  if (postTradePayroll > APRON && input.incomingSalary > input.outgoingSalary) {
    reasons.push(`Post-trade payroll exceeds apron (${APRON.toLocaleString()}) without sending out enough salary.`);
  }

  if (input.payroll > SALARY_CAP) {
    const allowedIncoming = input.outgoingSalary * 1.25 + 250_000;
    if (input.incomingSalary > allowedIncoming) {
      reasons.push(
        `Incoming salary (${Math.round(input.incomingSalary).toLocaleString()}) exceeds 125% matching rule (${Math.round(
          allowedIncoming,
        ).toLocaleString()}).`,
      );
    }
  }

  return reasons;
}

export function validateSalaryCapTrade(
  userTeam: TradeValidationInput,
  aiTeam: TradeValidationInput,
): TradeValidationResult {
  const reasons = [...validateSingleTeamTrade(userTeam), ...validateSingleTeamTrade(aiTeam)];

  return {
    isValid: reasons.length === 0,
    reasons,
  };
}

export function evaluateAiTradeAcceptance(
  aiPlayersOutgoing: PlayerWithContract[],
  aiPlayersIncoming: PlayerWithContract[],
): {
  accepted: boolean;
  aiOutgoingValue: number;
  aiIncomingValue: number;
  minAcceptableValue: number;
} {
  const aiOutgoingValue = aiPlayersOutgoing.reduce(
    (sum, item) => sum + getTradeValue(item.player, item.contract),
    0,
  );
  const aiIncomingValue = aiPlayersIncoming.reduce(
    (sum, item) => sum + getTradeValue(item.player, item.contract),
    0,
  );

  const salaryRelief =
    aiPlayersOutgoing.reduce((sum, item) => sum + (item.contract?.amount ?? 0), 0) -
    aiPlayersIncoming.reduce((sum, item) => sum + (item.contract?.amount ?? 0), 0);

  const reliefBonus = salaryRelief > 0 ? Math.min(20, salaryRelief / 1_000_000) : 0;
  const minAcceptableValue = aiOutgoingValue * 0.92 - reliefBonus;

  return {
    accepted: aiIncomingValue >= minAcceptableValue,
    aiOutgoingValue,
    aiIncomingValue,
    minAcceptableValue,
  };
}
