#!/usr/bin/env python3
"""NBA MyLeague-style simulator with day-by-day and full-season sim."""

from __future__ import annotations

import argparse
import random
from dataclasses import dataclass
from typing import Dict, Iterable, List, Mapping, Sequence, Tuple


@dataclass(frozen=True)
class Team:
    name: str
    conference: str
    offense: float
    defense: float
    pace: float


@dataclass(frozen=True)
class Player:
    name: str
    offense: int
    defense: int
    three: int
    playmaking: int
    rebounding: int

    @property
    def overall(self) -> int:
        return int((self.offense * 0.34) + (self.defense * 0.26) + (self.three * 0.14) + (self.playmaking * 0.16) + (self.rebounding * 0.10))


@dataclass
class LeagueSession:
    session_id: str
    seed: int
    gm_team: str
    gm_move: str
    games_per_matchup: int
    teams: List[Team]
    rosters: Dict[str, List[Player]]
    schedule: List[Tuple[Team, Team]]
    wins: Dict[str, int]
    losses: Dict[str, int]
    day: int = 0
    cursor: int = 0
    completed: bool = False
    playoff: Dict[str, object] | None = None


BASE_TEAMS: Sequence[Team] = (
    Team("Boston Celtics", "East", 119.4, 111.5, 98.0), Team("Milwaukee Bucks", "East", 118.9, 113.2, 100.1),
    Team("Philadelphia 76ers", "East", 116.8, 113.8, 97.6), Team("New York Knicks", "East", 117.0, 112.4, 96.9),
    Team("Cleveland Cavaliers", "East", 115.2, 111.8, 96.1), Team("Miami Heat", "East", 113.9, 112.9, 95.3),
    Team("Indiana Pacers", "East", 120.2, 118.3, 101.7), Team("Orlando Magic", "East", 112.8, 110.7, 97.1),
    Team("Atlanta Hawks", "East", 116.0, 118.5, 101.4), Team("Brooklyn Nets", "East", 112.6, 115.2, 98.3),
    Team("Chicago Bulls", "East", 111.9, 113.3, 96.8), Team("Toronto Raptors", "East", 112.1, 116.0, 99.2),
    Team("Charlotte Hornets", "East", 109.4, 118.8, 98.6), Team("Washington Wizards", "East", 110.2, 120.4, 101.8),
    Team("Detroit Pistons", "East", 109.8, 119.1, 99.5), Team("Denver Nuggets", "West", 117.2, 111.3, 97.4),
    Team("Minnesota Timberwolves", "West", 114.1, 108.9, 97.1), Team("Oklahoma City Thunder", "West", 118.0, 111.0, 100.0),
    Team("Dallas Mavericks", "West", 117.8, 115.6, 99.0), Team("Phoenix Suns", "West", 116.4, 113.8, 97.0),
    Team("LA Clippers", "West", 116.1, 112.6, 97.2), Team("New Orleans Pelicans", "West", 114.9, 112.8, 98.5),
    Team("Sacramento Kings", "West", 116.6, 114.8, 100.3), Team("Los Angeles Lakers", "West", 115.3, 114.4, 99.4),
    Team("Golden State Warriors", "West", 116.0, 115.2, 101.1), Team("Houston Rockets", "West", 113.0, 112.7, 98.7),
    Team("Utah Jazz", "West", 114.2, 118.1, 100.2), Team("Memphis Grizzlies", "West", 110.7, 114.6, 98.0),
    Team("Portland Trail Blazers", "West", 109.5, 119.0, 98.9), Team("San Antonio Spurs", "West", 111.8, 118.0, 100.5),
)
TEAMS = BASE_TEAMS

GM_MOVES = {
    "balanced": (0.0, 0.0), "buy_shooting": (1.5, -0.2), "buy_defense": (0.4, -1.5), "all_in": (2.1, -1.0), "retool": (-0.5, 0.4),
}

STAR_PLAYERS: Mapping[str, Sequence[str]] = {t.name: (f"{t.name.split()[0]} Star 1", f"{t.name.split()[0]} Star 2", f"{t.name.split()[0]} Star 3") for t in TEAMS}
STAR_PLAYERS["Los Angeles Lakers"] = ("LeBron James", "Anthony Davis", "Austin Reaves")
STAR_PLAYERS["Golden State Warriors"] = ("Stephen Curry", "Draymond Green", "Klay Thompson")


def generate_rosters() -> Dict[str, List[Player]]:
    rosters: Dict[str, List[Player]] = {}
    for team in TEAMS:
        r = random.Random(sum(ord(c) for c in team.name))
        players = [
            Player(name, 90 - i * 2 + r.randint(-2, 2), 86 - i * 2 + r.randint(-2, 2), 84 - i * 2 + r.randint(-2, 2), 85 - i * 2 + r.randint(-2, 2), 83 - i * 2 + r.randint(-2, 2))
            for i, name in enumerate(STAR_PLAYERS[team.name])
        ]
        for idx in range(9):
            base = 75 - idx
            players.append(Player(f"{team.name.split()[0]} Player {idx+1}", base + r.randint(-3, 3), base + r.randint(-3, 3), base + r.randint(-3, 3), base + r.randint(-3, 3), base + r.randint(-3, 3)))
        rosters[team.name] = players
    return rosters


def roster_team_adjustment(players: Sequence[Player]) -> Tuple[float, float]:
    top = sorted(players, key=lambda p: p.overall, reverse=True)[:8]
    off = sum((p.offense + p.three + p.playmaking) / 3 for p in top) / len(top)
    deff = sum((p.defense + p.rebounding) / 2 for p in top) / len(top)
    return (off - 80) / 3.0, (80 - deff) / 3.0


def apply_franchise_context(rosters: Mapping[str, Sequence[Player]], gm_team: str | None, gm_move: str) -> List[Team]:
    move = GM_MOVES.get(gm_move, GM_MOVES["balanced"])
    out: List[Team] = []
    for base in TEAMS:
        off_adj, def_adj = roster_team_adjustment(rosters[base.name])
        extra_off, extra_def = move if gm_team == base.name else (0.0, 0.0)
        out.append(Team(base.name, base.conference, base.offense + off_adj + extra_off, base.defense + def_adj + extra_def, base.pace))
    return out


def simulate_game(home: Team, away: Team, rng: random.Random) -> str:
    possessions = max(92, min(107, int(((home.pace + away.pace) / 2) + rng.gauss(0, 2.5))))
    home_eff = (home.offense + away.defense) / 2 + 1.5
    away_eff = (away.offense + home.defense) / 2
    home_score = max(80, int((home_eff / 100) * possessions + rng.gauss(0, 7.5)))
    away_score = max(80, int((away_eff / 100) * possessions + rng.gauss(0, 7.5)))
    if home_score == away_score:
        home_score += 1 if rng.random() < 0.52 else 0
        away_score += 0 if home_score > away_score else 1
    return home.name if home_score > away_score else away.name


def make_schedule(teams: Sequence[Team], games_per_matchup: int = 2) -> List[Tuple[Team, Team]]:
    schedule: List[Tuple[Team, Team]] = []
    for i, home in enumerate(teams):
        for away in teams[i + 1 :]:
            for game_i in range(games_per_matchup):
                schedule.append((home, away) if game_i % 2 == 0 else (away, home))
    return schedule


def standings_by_conference(wins: Dict[str, int], losses: Dict[str, int], conference: str, teams: Sequence[Team]) -> List[str]:
    conf = [t for t in teams if t.conference == conference]
    ranked = sorted(conf, key=lambda t: (wins[t.name], -losses[t.name], t.offense - t.defense), reverse=True)
    return [t.name for t in ranked]


def simulate_series(a: Team, b: Team, rng: random.Random) -> str:
    wins = {a.name: 0, b.name: 0}
    home_pattern = [a, a, b, b, a, b, a]
    while wins[a.name] < 4 and wins[b.name] < 4:
        home = home_pattern[wins[a.name] + wins[b.name]]
        away = b if home.name == a.name else a
        wins[simulate_game(home, away, rng)] += 1
    return a.name if wins[a.name] == 4 else b.name


def simulate_playoffs_with_details(wins: Dict[str, int], losses: Dict[str, int], rng: random.Random, teams: Sequence[Team]) -> Dict[str, object]:
    by_name = {t.name: t for t in teams}
    east = standings_by_conference(wins, losses, "East", teams)[:8]
    west = standings_by_conference(wins, losses, "West", teams)[:8]

    def run_conf(seed: List[str]) -> Tuple[str, Dict[str, object]]:
        qf = [(seed[0], seed[7]), (seed[3], seed[4]), (seed[2], seed[5]), (seed[1], seed[6])]
        qf_winners = [{"a": a, "b": b, "winner": simulate_series(by_name[a], by_name[b], rng)} for a, b in qf]
        sf_pairs = [(qf_winners[0]["winner"], qf_winners[1]["winner"]), (qf_winners[2]["winner"], qf_winners[3]["winner"])]
        sf_winners = [{"a": a, "b": b, "winner": simulate_series(by_name[a], by_name[b], rng)} for a, b in sf_pairs]
        cf = {"a": sf_winners[0]["winner"], "b": sf_winners[1]["winner"], "winner": simulate_series(by_name[sf_winners[0]["winner"]], by_name[sf_winners[1]["winner"]], rng)}
        return cf["winner"], {"qf": qf_winners, "sf": sf_winners, "cf": [cf]}

    east_champ, east_detail = run_conf(east)
    west_champ, west_detail = run_conf(west)
    finals_winner = simulate_series(by_name[east_champ], by_name[west_champ], rng)
    return {"champion": finals_winner, "east": east_detail, "west": west_detail, "finals": {"a": east_champ, "b": west_champ, "winner": finals_winner}}


def create_league_session(seed: int, gm_team: str, gm_move: str, games_per_matchup: int, session_id: str) -> LeagueSession:
    rosters = generate_rosters()
    teams = apply_franchise_context(rosters, gm_team, gm_move)
    schedule = make_schedule(teams, games_per_matchup)
    random.Random(seed).shuffle(schedule)
    wins = {t.name: 0 for t in teams}
    losses = {t.name: 0 for t in teams}
    return LeagueSession(session_id, seed, gm_team, gm_move, games_per_matchup, teams, rosters, schedule, wins, losses)


def simulate_days(session: LeagueSession, days: int = 1) -> None:
    if session.completed:
        return
    rng = random.Random(session.seed + session.day)
    for _ in range(days):
        if session.cursor >= len(session.schedule):
            session.completed = True
            session.playoff = simulate_playoffs_with_details(session.wins, session.losses, rng, session.teams)
            return
        today = session.schedule[session.cursor : session.cursor + 15]
        session.cursor += len(today)
        session.day += 1
        for home, away in today:
            winner = simulate_game(home, away, rng)
            loser = away.name if winner == home.name else home.name
            session.wins[winner] += 1
            session.losses[loser] += 1
    if session.cursor >= len(session.schedule):
        session.completed = True
        session.playoff = simulate_playoffs_with_details(session.wins, session.losses, rng, session.teams)


def simulate_to_end(session: LeagueSession) -> None:
    while not session.completed:
        simulate_days(session, 1)


def session_snapshot(session: LeagueSession) -> Dict[str, object]:
    east = standings_by_conference(session.wins, session.losses, "East", session.teams)
    west = standings_by_conference(session.wins, session.losses, "West", session.teams)
    roster = sorted(session.rosters[session.gm_team], key=lambda p: p.overall, reverse=True)
    return {
        "session_id": session.session_id,
        "day": session.day,
        "completed": session.completed,
        "gm_team": session.gm_team,
        "gm_move": session.gm_move,
        "wins": session.wins,
        "losses": session.losses,
        "east_standings": east,
        "west_standings": west,
        "managed_roster": [{"name": p.name, "overall": p.overall, "offense": p.offense, "defense": p.defense} for p in roster[:12]],
        "playoff": session.playoff,
    }


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NBA MyLeague simulator")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--gm-team", type=str, default="Los Angeles Lakers")
    parser.add_argument("--gm-move", type=str, default="balanced", choices=list(GM_MOVES.keys()))
    parser.add_argument("--games-per-matchup", type=int, default=2, choices=[1, 2, 4])
    parser.add_argument("--sim", choices=["day", "season"], default="season")
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    session = create_league_session(args.seed, args.gm_team, args.gm_move, args.games_per_matchup, "cli")
    if args.sim == "day":
        simulate_days(session, 1)
    else:
        simulate_to_end(session)
    snap = session_snapshot(session)
    print(f"Day: {snap['day']} | Team: {snap['gm_team']} ({snap['gm_move']})")
    print(f"Record: {snap['wins'][args.gm_team]}-{snap['losses'][args.gm_team]}")
    if snap["playoff"]:
        print(f"Champion: {snap['playoff']['champion']}")


if __name__ == "__main__":
    main()
