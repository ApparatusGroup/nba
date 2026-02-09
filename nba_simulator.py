#!/usr/bin/env python3
"""NBA regular season, play-in, and playoffs simulator."""

from __future__ import annotations

import argparse
import random
from dataclasses import dataclass
from typing import Dict, Iterable, List, Sequence, Tuple


@dataclass(frozen=True)
class Team:
    name: str
    conference: str
    offense: float
    defense: float
    pace: float


TEAMS: Sequence[Team] = (
    Team("Boston Celtics", "East", 119.4, 111.5, 98.0),
    Team("Milwaukee Bucks", "East", 118.9, 113.2, 100.1),
    Team("Philadelphia 76ers", "East", 116.8, 113.8, 97.6),
    Team("New York Knicks", "East", 117.0, 112.4, 96.9),
    Team("Cleveland Cavaliers", "East", 115.2, 111.8, 96.1),
    Team("Miami Heat", "East", 113.9, 112.9, 95.3),
    Team("Indiana Pacers", "East", 120.2, 118.3, 101.7),
    Team("Orlando Magic", "East", 112.8, 110.7, 97.1),
    Team("Atlanta Hawks", "East", 116.0, 118.5, 101.4),
    Team("Brooklyn Nets", "East", 112.6, 115.2, 98.3),
    Team("Chicago Bulls", "East", 111.9, 113.3, 96.8),
    Team("Toronto Raptors", "East", 112.1, 116.0, 99.2),
    Team("Charlotte Hornets", "East", 109.4, 118.8, 98.6),
    Team("Washington Wizards", "East", 110.2, 120.4, 101.8),
    Team("Detroit Pistons", "East", 109.8, 119.1, 99.5),
    Team("Denver Nuggets", "West", 117.2, 111.3, 97.4),
    Team("Minnesota Timberwolves", "West", 114.1, 108.9, 97.1),
    Team("Oklahoma City Thunder", "West", 118.0, 111.0, 100.0),
    Team("Dallas Mavericks", "West", 117.8, 115.6, 99.0),
    Team("Phoenix Suns", "West", 116.4, 113.8, 97.0),
    Team("LA Clippers", "West", 116.1, 112.6, 97.2),
    Team("New Orleans Pelicans", "West", 114.9, 112.8, 98.5),
    Team("Sacramento Kings", "West", 116.6, 114.8, 100.3),
    Team("Los Angeles Lakers", "West", 115.3, 114.4, 99.4),
    Team("Golden State Warriors", "West", 116.0, 115.2, 101.1),
    Team("Houston Rockets", "West", 113.0, 112.7, 98.7),
    Team("Utah Jazz", "West", 114.2, 118.1, 100.2),
    Team("Memphis Grizzlies", "West", 110.7, 114.6, 98.0),
    Team("Portland Trail Blazers", "West", 109.5, 119.0, 98.9),
    Team("San Antonio Spurs", "West", 111.8, 118.0, 100.5),
)

TEAM_BY_NAME = {team.name: team for team in TEAMS}


def simulate_game(home: Team, away: Team, rng: random.Random) -> Tuple[str, int, int]:
    possessions = max(92, min(107, int(((home.pace + away.pace) / 2) + rng.gauss(0, 2.5))))
    home_eff = (home.offense + away.defense) / 2 + 1.5
    away_eff = (away.offense + home.defense) / 2

    home_score = max(80, int((home_eff / 100) * possessions + rng.gauss(0, 7.5)))
    away_score = max(80, int((away_eff / 100) * possessions + rng.gauss(0, 7.5)))

    if home_score == away_score:
        if rng.random() < 0.52:
            home_score += rng.randint(1, 8)
        else:
            away_score += rng.randint(1, 8)

    winner = home.name if home_score > away_score else away.name
    return winner, home_score, away_score


def conference_teams(conference: str) -> List[Team]:
    return [team for team in TEAMS if team.conference == conference]


def make_schedule(games_per_matchup: int = 2) -> List[Tuple[Team, Team]]:
    schedule: List[Tuple[Team, Team]] = []
    team_list = list(TEAMS)
    for i, home in enumerate(team_list):
        for away in team_list[i + 1 :]:
            for game_i in range(games_per_matchup):
                schedule.append((home, away) if game_i % 2 == 0 else (away, home))
    return schedule


def simulate_regular_season(rng: random.Random, games_per_matchup: int) -> Tuple[Dict[str, int], Dict[str, int]]:
    wins = {team.name: 0 for team in TEAMS}
    losses = {team.name: 0 for team in TEAMS}
    schedule = make_schedule(games_per_matchup)
    rng.shuffle(schedule)

    for home, away in schedule:
        winner, _, _ = simulate_game(home, away, rng)
        loser = away.name if winner == home.name else home.name
        wins[winner] += 1
        losses[loser] += 1

    return wins, losses


def standings_by_conference(wins: Dict[str, int], losses: Dict[str, int], conference: str) -> List[str]:
    teams = conference_teams(conference)
    ranked = sorted(
        teams,
        key=lambda t: (wins[t.name], -losses[t.name], t.offense - t.defense),
        reverse=True,
    )
    return [t.name for t in ranked]


def simulate_series(high_seed: Team, low_seed: Team, rng: random.Random, best_of: int = 7) -> str:
    target = best_of // 2 + 1
    wins = {high_seed.name: 0, low_seed.name: 0}
    home_pattern = [high_seed, high_seed, low_seed, low_seed, high_seed, low_seed, high_seed]

    game_idx = 0
    while wins[high_seed.name] < target and wins[low_seed.name] < target:
        home = home_pattern[game_idx]
        away = low_seed if home.name == high_seed.name else high_seed
        winner, _, _ = simulate_game(home, away, rng)
        wins[winner] += 1
        game_idx += 1

    return high_seed.name if wins[high_seed.name] == target else low_seed.name


def run_play_in(seeded_ten: Sequence[str], rng: random.Random) -> Tuple[str, str]:
    seven, eight, nine, ten = [TEAM_BY_NAME[name] for name in seeded_ten[6:10]]
    winner_7_game, _, _ = simulate_game(seven, eight, rng)
    loser_7_game = eight if winner_7_game == seven.name else seven

    winner_9v10, _, _ = simulate_game(nine, ten, rng)
    advancer = nine if winner_9v10 == nine.name else ten

    winner_final, _, _ = simulate_game(loser_7_game, advancer, rng)
    final_eight = loser_7_game.name if winner_final == loser_7_game.name else advancer.name

    return winner_7_game, final_eight


def build_playoff_field(conference_seeds: Sequence[str], rng: random.Random) -> List[str]:
    locked = list(conference_seeds[:6])
    seed_7, seed_8 = run_play_in(conference_seeds[:10], rng)
    return locked + [seed_7, seed_8]


def simulate_playoffs_with_details(wins: Dict[str, int], losses: Dict[str, int], rng: random.Random) -> Dict[str, object]:
    east_ranked = standings_by_conference(wins, losses, "East")
    west_ranked = standings_by_conference(wins, losses, "West")

    east_seeded = build_playoff_field(east_ranked, rng)
    west_seeded = build_playoff_field(west_ranked, rng)

    def run_bracket(seeded: Sequence[str], label: str) -> Tuple[str, Dict[str, List[Dict[str, str]]]]:
        qf_pairs = [(seeded[0], seeded[7]), (seeded[3], seeded[4]), (seeded[2], seeded[5]), (seeded[1], seeded[6])]
        qf_results = []
        sf_teams = []
        for a, b in qf_pairs:
            winner = simulate_series(TEAM_BY_NAME[a], TEAM_BY_NAME[b], rng)
            qf_results.append({"a": a, "b": b, "winner": winner})
            sf_teams.append(winner)

        sf_pairs = [(sf_teams[0], sf_teams[1]), (sf_teams[2], sf_teams[3])]
        sf_results = []
        finals_teams = []
        for a, b in sf_pairs:
            winner = simulate_series(TEAM_BY_NAME[a], TEAM_BY_NAME[b], rng)
            sf_results.append({"a": a, "b": b, "winner": winner})
            finals_teams.append(winner)

        conf_winner = simulate_series(TEAM_BY_NAME[finals_teams[0]], TEAM_BY_NAME[finals_teams[1]], rng)
        cf = {"a": finals_teams[0], "b": finals_teams[1], "winner": conf_winner}
        return conf_winner, {"conference": label, "qf": qf_results, "sf": sf_results, "cf": [cf]}

    east_champ, east_detail = run_bracket(east_seeded, "East")
    west_champ, west_detail = run_bracket(west_seeded, "West")

    east_team = TEAM_BY_NAME[east_champ]
    west_team = TEAM_BY_NAME[west_champ]
    high_seed = east_team if wins[east_champ] >= wins[west_champ] else west_team
    low_seed = west_team if high_seed.name == east_champ else east_team
    champion = simulate_series(high_seed, low_seed, rng)

    finals = {"a": east_champ, "b": west_champ, "winner": champion}
    return {
        "champion": champion,
        "east_seeded": east_seeded,
        "west_seeded": west_seeded,
        "east": east_detail,
        "west": west_detail,
        "finals": finals,
    }


def simulate_playoffs(wins: Dict[str, int], losses: Dict[str, int], rng: random.Random) -> str:
    return str(simulate_playoffs_with_details(wins, losses, rng)["champion"])


def print_standings(wins: Dict[str, int], losses: Dict[str, int]) -> None:
    for conf in ("East", "West"):
        print(f"\n{conf} standings")
        ranked = standings_by_conference(wins, losses, conf)
        for idx, name in enumerate(ranked, start=1):
            print(f"{idx:>2}. {name:<28} {wins[name]:>2}-{losses[name]:<2}")


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NBA season + play-in + playoffs simulator")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for reproducible results")
    parser.add_argument(
        "--games-per-matchup",
        type=int,
        default=2,
        choices=[1, 2, 4],
        help="How many regular-season games each pair of teams plays",
    )
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    rng = random.Random(args.seed)

    wins, losses = simulate_regular_season(rng, games_per_matchup=args.games_per_matchup)
    print_standings(wins, losses)
    champion = simulate_playoffs(wins, losses, rng)
    print(f"\nNBA Champion: {champion}")


if __name__ == "__main__":
    main()
