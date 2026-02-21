import type { Contract, Player, Team } from "@prisma/client";

type PlayerWithContract = Player & { contract: Contract | null };

export type TeamWithRoster = Team & {
  players: PlayerWithContract[];
};

export type SimulationInput = {
  gameId: string;
  season: number;
  day: number;
  home: TeamWithRoster;
  away: TeamWithRoster;
};

export type SimulatedPlayerLine = {
  playerId: string;
  teamId: string;
  points: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  minutes: number;
  fatigue: number;
};

export type SimulationResult = {
  homeScore: number;
  awayScore: number;
  winnerTeamId: string;
  loserTeamId: string;
  playLog: string[];
  playerLines: SimulatedPlayerLine[];
};

type LiveStatLine = {
  points: number;
  rebounds: number;
  assists: number;
  turnovers: number;
};

type LivePlayer = PlayerWithContract & {
  fatigueValue: number;
  minutesValue: number;
  statLine: LiveStatLine;
};

type TeamState = {
  team: Team;
  onCourt: LivePlayer[];
  bench: LivePlayer[];
  score: number;
};

const STARTING_POSITIONS: Array<Player["position"]> = ["PG", "SG", "SF", "PF", "C"];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createRng(seedText: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += hash << 13;
    hash ^= hash >>> 7;
    hash += hash << 3;
    hash ^= hash >>> 17;
    hash += hash << 5;
    return ((hash >>> 0) % 10000) / 10000;
  };
}

function weightedPick<T>(items: T[], weight: (item: T) => number, random: () => number): T {
  if (!items.length) {
    throw new Error("weightedPick called with empty array");
  }

  const weights = items.map((item) => Math.max(0, weight(item)));
  const total = weights.reduce((acc, value) => acc + value, 0);

  if (total <= 0) {
    return items[0];
  }

  let threshold = random() * total;
  for (let i = 0; i < items.length; i += 1) {
    threshold -= weights[i];
    if (threshold <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

function fatigueMultiplier(player: LivePlayer): number {
  if (player.fatigueValue <= player.stamina) {
    return 1;
  }

  const over = Math.min(30, player.fatigueValue - player.stamina);
  return clamp(1 - (0.1 + (over / 30) * 0.1), 0.8, 0.95);
}

function playerLabel(player: LivePlayer): string {
  return `${player.firstName} ${player.lastName}`.trim();
}

function getTeamDefensePressure(team: TeamState): number {
  if (!team.onCourt.length) {
    return 0.5;
  }

  const avgDefense = team.onCourt.reduce((sum, player) => sum + player.defense, 0) / team.onCourt.length;
  return avgDefense / 100;
}

function getTeamReboundIndex(team: TeamState): number {
  return team.onCourt.reduce((sum, player) => sum + player.rebounding, 0) / team.onCourt.length;
}

function chooseDefender(offensivePlayer: LivePlayer, defense: TeamState, random: () => number): LivePlayer {
  const samePosition = defense.onCourt.find((player) => player.position === offensivePlayer.position);
  if (samePosition) {
    return samePosition;
  }

  return weightedPick(defense.onCourt, (player) => player.defense, random);
}

function pickStartingLineup(players: LivePlayer[]): { onCourt: LivePlayer[]; bench: LivePlayer[] } {
  const available = [...players].sort((a, b) => b.overall - a.overall);
  const starters: LivePlayer[] = [];

  for (const position of STARTING_POSITIONS) {
    const index = available.findIndex((player) => player.position === position);
    if (index >= 0) {
      starters.push(available[index]);
      available.splice(index, 1);
    }
  }

  while (starters.length < 5 && available.length > 0) {
    starters.push(available.shift() as LivePlayer);
  }

  return {
    onCourt: starters,
    bench: available,
  };
}

function hydratePlayers(players: PlayerWithContract[]): LivePlayer[] {
  return players.map((player) => ({
    ...player,
    fatigueValue: player.fatigue,
    minutesValue: 0,
    statLine: {
      points: 0,
      rebounds: 0,
      assists: 0,
      turnovers: 0,
    },
  }));
}

function createTeamState(team: TeamWithRoster): TeamState {
  const livePlayers = hydratePlayers(team.players);
  const rotation = pickStartingLineup(livePlayers);

  return {
    team,
    onCourt: rotation.onCourt,
    bench: rotation.bench,
    score: 0,
  };
}

function applyTickFatigueAndMinutes(team: TeamState, minutesPerTick: number): void {
  for (const player of team.onCourt) {
    player.minutesValue += minutesPerTick;
    const fatigueGain = minutesPerTick * (1.75 + player.touchShare / 95);
    player.fatigueValue = clamp(player.fatigueValue + fatigueGain, 0, 99);
  }

  for (const player of team.bench) {
    player.fatigueValue = clamp(player.fatigueValue - minutesPerTick * 1.9, 0, 99);
  }
}

function runAutoSubs(team: TeamState, playLog: string[]): void {
  const onCourtSnapshot = [...team.onCourt];

  for (const tiredPlayer of onCourtSnapshot) {
    if (tiredPlayer.fatigueValue <= 80) {
      continue;
    }

    const samePositionBench = team.bench
      .filter((player) => player.position === tiredPlayer.position)
      .sort((a, b) => b.overall - a.overall);

    const candidate =
      samePositionBench[0] ?? [...team.bench].sort((a, b) => b.overall - a.overall)[0] ?? null;

    if (!candidate) {
      continue;
    }

    team.bench = team.bench.filter((player) => player.id !== candidate.id);
    team.bench.push(tiredPlayer);
    team.onCourt = team.onCourt.map((player) => (player.id === tiredPlayer.id ? candidate : player));

    playLog.push(
      `${team.team.abbrev} sub: ${playerLabel(candidate)} replaces ${playerLabel(tiredPlayer)} (fatigue ${Math.round(
        tiredPlayer.fatigueValue,
      )})`,
    );
  }
}

function simulatePossession(offense: TeamState, defense: TeamState, random: () => number, playLog: string[]): void {
  const offensePressure = getTeamDefensePressure(offense);
  const defensePressure = getTeamDefensePressure(defense);

  const ballHandler = weightedPick(
    offense.onCourt,
    (player) => player.touchShare * fatigueMultiplier(player) * (0.85 + player.morale / 200),
    random,
  );

  let shooter = ballHandler;
  let assistPlayer: LivePlayer | null = null;
  let shotBonus = 0;

  const passChance = clamp(0.16 + ballHandler.playmaking / 180 + (offense.team.focus === "Balanced" ? 0.05 : 0), 0.18, 0.72);
  const shouldPass = random() < passChance;

  if (shouldPass && offense.onCourt.length > 1) {
    const passTargets = offense.onCourt.filter((player) => player.id !== ballHandler.id);
    shooter = weightedPick(passTargets, (player) => player.offense * fatigueMultiplier(player), random);
    assistPlayer = ballHandler;
    shotBonus += 0.05;
  }

  const primaryDefender = chooseDefender(shooter, defense, random);

  const turnoverChance = clamp(
    0.06 + (100 - ballHandler.playmaking) / 280 + defensePressure * 0.18,
    0.05,
    0.26,
  );

  if (random() < turnoverChance) {
    ballHandler.statLine.turnovers += 1;
    playLog.push(`${playerLabel(ballHandler)} turns it over.`);
    return;
  }

  let threeRate = offense.team.focus === "3PT" ? 0.46 : offense.team.focus === "Inside" ? 0.26 : 0.35;
  if (shooter.position === "PG" || shooter.position === "SG") {
    threeRate += 0.05;
  }
  if (shooter.position === "PF" || shooter.position === "C") {
    threeRate -= 0.07;
  }
  threeRate = clamp(threeRate + (shooter.shotTendency - 50) / 240, 0.14, 0.58);

  const isThree = random() < threeRate;
  const points = isThree ? 3 : 2;

  const attackIndex = shooter.offense * 0.65 + shooter.overall * 0.35;
  const defenseIndex = primaryDefender.defense * 0.68 + defensePressure * 34;

  let makeChance = isThree ? 0.35 : 0.53;
  makeChance += (attackIndex - defenseIndex) / 210;
  makeChance += shotBonus;
  makeChance *= fatigueMultiplier(shooter);
  makeChance = clamp(makeChance, 0.18, 0.74);

  if (random() < makeChance) {
    offense.score += points;
    shooter.statLine.points += points;
    if (assistPlayer && assistPlayer.id !== shooter.id && random() < 0.78) {
      assistPlayer.statLine.assists += 1;
    }

    playLog.push(`${playerLabel(shooter)} makes ${isThree ? "a 3PT shot" : "a 2PT shot"}.`);
    return;
  }

  const offenseReboundIndex = getTeamReboundIndex(offense);
  const defenseReboundIndex = getTeamReboundIndex(defense);
  const offensiveReboundChance = clamp(0.22 + (offenseReboundIndex - defenseReboundIndex) / 220, 0.12, 0.36);

  if (random() < offensiveReboundChance) {
    const rebounder = weightedPick(offense.onCourt, (player) => player.rebounding, random);
    rebounder.statLine.rebounds += 1;

    if (random() < 0.45) {
      offense.score += 2;
      rebounder.statLine.points += 2;
      playLog.push(`${playerLabel(rebounder)} gets the board and scores on a putback.`);
      return;
    }

    playLog.push(`${playerLabel(rebounder)} grabs the offensive rebound.`);
    return;
  }

  const defensiveRebounder = weightedPick(defense.onCourt, (player) => player.rebounding, random);
  defensiveRebounder.statLine.rebounds += 1;
  if (random() < 0.28 + offensePressure * 0.04) {
    defensiveRebounder.statLine.assists += defensiveRebounder.playmaking > 70 ? 1 : 0;
  }
  playLog.push(`${playerLabel(defensiveRebounder)} secures the defensive rebound.`);
}

function buildResult(home: TeamState, away: TeamState): SimulationResult {
  const winnerTeamId = home.score >= away.score ? home.team.id : away.team.id;
  const loserTeamId = winnerTeamId === home.team.id ? away.team.id : home.team.id;

  const playerLines = [...home.onCourt, ...home.bench, ...away.onCourt, ...away.bench].map((player) => ({
    playerId: player.id,
    teamId: player.teamId ?? "",
    points: player.statLine.points,
    rebounds: player.statLine.rebounds,
    assists: player.statLine.assists,
    turnovers: player.statLine.turnovers,
    minutes: Math.round(player.minutesValue),
    fatigue: Math.round(player.fatigueValue),
  }));

  return {
    homeScore: home.score,
    awayScore: away.score,
    winnerTeamId,
    loserTeamId,
    playLog: [],
    playerLines,
  };
}

export function simulateGame(input: SimulationInput): SimulationResult {
  const random = createRng(`${input.gameId}-${input.season}-${input.day}`);
  const playLog: string[] = [];

  const home = createTeamState(input.home);
  const away = createTeamState(input.away);

  const paceFactor = (input.home.pace + input.away.pace) / 200;
  const possessionsPerSide = Math.round(92 + paceFactor * 22 + random() * 5);
  const totalTicks = possessionsPerSide * 2;
  const minutesPerTick = 48 / totalTicks;

  for (let tick = 0; tick < totalTicks; tick += 1) {
    const offense = tick % 2 === 0 ? home : away;
    const defense = tick % 2 === 0 ? away : home;

    simulatePossession(offense, defense, random, playLog);
    applyTickFatigueAndMinutes(home, minutesPerTick);
    applyTickFatigueAndMinutes(away, minutesPerTick);

    if (tick > 0 && tick % 9 === 0) {
      runAutoSubs(home, playLog);
      runAutoSubs(away, playLog);
    }
  }

  let overtime = 0;
  while (home.score === away.score && overtime < 4) {
    overtime += 1;
    playLog.push(`Overtime ${overtime} begins.`);

    const overtimeTicks = 20;
    const overtimeMinutesPerTick = 5 / overtimeTicks;

    for (let tick = 0; tick < overtimeTicks; tick += 1) {
      const offense = tick % 2 === 0 ? home : away;
      const defense = tick % 2 === 0 ? away : home;

      simulatePossession(offense, defense, random, playLog);
      applyTickFatigueAndMinutes(home, overtimeMinutesPerTick);
      applyTickFatigueAndMinutes(away, overtimeMinutesPerTick);

      if (tick > 0 && tick % 5 === 0) {
        runAutoSubs(home, playLog);
        runAutoSubs(away, playLog);
      }
    }
  }

  const result = buildResult(home, away);
  result.playLog = playLog.slice(0, 220);

  return result;
}
