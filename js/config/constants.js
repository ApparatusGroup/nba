// NBA Rules & Constants (2024-25 Season)
export const SALARY_CAP = 140588000;
export const LUXURY_TAX_LINE = 170814000;
export const FIRST_APRON = 178132000;
export const SECOND_APRON = 188931000;
export const MIN_TEAM_SALARY = 126529000;

export const MAX_PCT_0_6 = 0.25;
export const MAX_PCT_7_9 = 0.30;
export const MAX_PCT_10_PLUS = 0.35;
export const SUPERMAX_PCT = 0.35;
export const ANNUAL_RAISE = 0.08;

export const NON_TAXPAYER_MLE = 12822000;
export const TAXPAYER_MLE = 5168000;
export const ROOM_MLE = 7983000;
export const BI_ANNUAL_EXCEPTION = 4682000;

export const VET_MINIMUMS = [
    1157153, 1836090, 2087519, 2239084, 2239084,
    2239084, 2239084, 2239084, 2239084, 2891467,
    2891467, 2891467, 2891467, 2891467, 3196448
];

export const MAX_ROSTER = 15;
export const MIN_ROSTER = 14;
export const TWO_WAY_SLOTS = 2;
export const GAMES_IN_SEASON = 82;
export const QUARTERS = 4;
export const QUARTER_MINUTES = 12;
export const OT_MINUTES = 5;
export const SHOT_CLOCK = 24;
export const TOTAL_TEAM_MINUTES = 240;

export const LOTTERY_ODDS = [14.0, 14.0, 14.0, 12.5, 10.5, 9.0, 7.5, 6.0, 4.5, 3.0, 2.0, 1.5, 1.0, 0.5];
export const DRAFT_ROUNDS = 2;
export const PICKS_PER_ROUND = 30;

export const PLAYOFF_SERIES_LENGTH = 7;
export const PLAYOFF_ROUNDS = 4;
export const PLAY_IN_SEEDS = [7, 8, 9, 10];
export const HOME_COURT_PATTERN = [0, 0, 1, 1, 0, 1, 0]; // 0 = higher seed home

export const CONFERENCES = {
    East: 'Eastern Conference',
    West: 'Western Conference'
};

export const DIVISIONS = {
    Atlantic: { conference: 'East', teams: ['BOS', 'BKN', 'NYK', 'PHI', 'TOR'] },
    Central: { conference: 'East', teams: ['CHI', 'CLE', 'DET', 'IND', 'MIL'] },
    Southeast: { conference: 'East', teams: ['ATL', 'CHA', 'MIA', 'ORL', 'WAS'] },
    Northwest: { conference: 'West', teams: ['DEN', 'MIN', 'OKC', 'POR', 'UTA'] },
    Pacific: { conference: 'West', teams: ['GSW', 'LAC', 'LAL', 'PHX', 'SAC'] },
    Southwest: { conference: 'West', teams: ['DAL', 'HOU', 'MEM', 'NOP', 'SAS'] }
};

export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

export const DIFFICULTY_MODS = {
    easy: { tradeBonus: 0.15, faBonus: 0.10, simBonus: 0.03 },
    normal: { tradeBonus: 0, faBonus: 0, simBonus: 0 },
    hard: { tradeBonus: -0.10, faBonus: -0.05, simBonus: -0.02 },
    legendary: { tradeBonus: -0.20, faBonus: -0.10, simBonus: -0.04 }
};
