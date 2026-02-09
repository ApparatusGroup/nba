#!/usr/bin/env python3
"""NBA regular season, play-in, and playoffs simulator with franchise control mode."""

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
TEAM_BY_NAME = {team.name: team for team in TEAMS}

STAR_PLAYERS: Mapping[str, Sequence[str]] = {
    "Boston Celtics": ("Jayson Tatum", "Jaylen Brown", "Kristaps Porzingis"),
    "Milwaukee Bucks": ("Giannis Antetokounmpo", "Damian Lillard", "Khris Middleton"),
    "Philadelphia 76ers": ("Joel Embiid", "Tyrese Maxey", "Paul George"),
    "New York Knicks": ("Jalen Brunson", "Julius Randle", "OG Anunoby"),
    "Cleveland Cavaliers": ("Donovan Mitchell", "Darius Garland", "Evan Mobley"),
    "Miami Heat": ("Jimmy Butler", "Bam Adebayo", "Tyler Herro"),
    "Indiana Pacers": ("Tyrese Haliburton", "Pascal Siakam", "Myles Turner"),
    "Orlando Magic": ("Paolo Banchero", "Franz Wagner", "Jalen Suggs"),
    "Atlanta Hawks": ("Trae Young", "Dejounte Murray", "Jalen Johnson"),
    "Brooklyn Nets": ("Mikal Bridges", "Cam Thomas", "Nic Claxton"),
    "Chicago Bulls": ("Zach LaVine", "DeMar DeRozan", "Nikola Vucevic"),
    "Toronto Raptors": ("Scottie Barnes", "RJ Barrett", "Immanuel Quickley"),
    "Charlotte Hornets": ("LaMelo Ball", "Brandon Miller", "Miles Bridges"),
    "Washington Wizards": ("Jordan Poole", "Kyle Kuzma", "Bilal Coulibaly"),
    "Detroit Pistons": ("Cade Cunningham", "Jaden Ivey", "Jalen Duren"),
    "Denver Nuggets": ("Nikola Jokic", "Jamal Murray", "Michael Porter Jr."),
    "Minnesota Timberwolves": ("Anthony Edwards", "Karl-Anthony Towns", "Rudy Gobert"),
    "Oklahoma City Thunder": ("Shai Gilgeous-Alexander", "Jalen Williams", "Chet Holmgren"),
    "Dallas Mavericks": ("Luka Doncic", "Kyrie Irving", "Dereck Lively II"),
    "Phoenix Suns": ("Kevin Durant", "Devin Booker", "Bradley Beal"),
    "LA Clippers": ("Kawhi Leonard", "Paul George", "James Harden"),
    "New Orleans Pelicans": ("Zion Williamson", "Brandon Ingram", "CJ McCollum"),
    "Sacramento Kings": ("De'Aaron Fox", "Domantas Sabonis", "Keegan Murray"),
    "Los Angeles Lakers": ("LeBron James", "Anthony Davis", "Austin Reaves"),
    "Golden State Warriors": ("Stephen Curry", "Klay Thompson", "Draymond Green"),
    "Houston Rockets": ("Alperen Sengun", "Jalen Green", "Fred VanVleet"),
    "Utah Jazz": ("Lauri Markkanen", "Collin Sexton", "Jordan Clarkson"),
    "Memphis Grizzlies": ("Ja Morant", "Jaren Jackson Jr.", "Desmond Bane"),
    "Portland Trail Blazers": ("Anfernee Simons", "Scoot Henderson", "Deandre Ayton"),
    "San Antonio Spurs": ("Victor Wembanyama", "Devin Vassell", "Keldon Johnson"),
}

GM_MOVES = {
    "balanced": (0.0, 0.0),
    "buy_shooting": (1.5, -0.2),
    "buy_defense": (0.4, -1.5),
    "all_in": (2.1, -1.0),
    "retool": (-0.5, 0.4),
}


def generate_rosters() -> Dict[str, List[Player]]:
    rosters: Dict[str, List[Player]] = {}
    for team in TEAMS:
        r = random.Random(sum(ord(c) for c in team.name))
        stars = list(STAR_PLAYERS[team.name])
        players: List[Player] = []
        for i, star in enumerate(stars):
            base = 89 - i * 3
            players.append(Player(star, base + r.randint(-1, 2), base - 2 + r.randint(-2, 2), base - 3 + r.randint(-2, 2), base - 1 + r.randint(-2, 2), base - 4 + r.randint(-2, 2)))
        for idx in range(9):
            name = f"{team.name.split()[0]} Player {idx+1}"
            base = 74 - idx
            players.append(Player(name, base + r.randint(-3, 3), base + r.randint(-3, 3), base + r.randint(-3, 3), base + r.randint(-3, 3), base + r.randint(-3, 3)))
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


def simulate_game(home: Team, away: Team, rng: random.Random) -> Tuple[str, int, int]:
    possessions = max(92, min(107, int(((home.pace + away.pace) / 2) + rng.gauss(0, 2.5))))
    home_eff = (home.offense + away.defense) / 2 + 1.5
    away_eff = (away.offense + home.defense) / 2
    home_score = max(80, int((home_eff / 100) * possessions + rng.gauss(0, 7.5)))
    away_score = max(80, int((away_eff / 100) * possessions + rng.gauss(0, 7.5)))
    if home_score == away_score:
        home_score += 1 if rng.random() < 0.52 else 0
        away_score += 0 if home_score > away_score else 1
    winner = home.name if home_score > away_score else away.name
    return winner, home_score, away_score


def conference_teams(conference: str, teams: Sequence[Team]) -> List[Team]:
    return [team for team in teams if team.conference == conference]


def make_schedule(games_per_matchup: int = 2, teams: Sequence[Team] = TEAMS) -> List[Tuple[Team, Team]]:
    schedule: List[Tuple[Team, Team]] = []
    team_list = list(teams)
    for i, home in enumerate(team_list):
        for away in team_list[i + 1 :]:
            for game_i in range(games_per_matchup):
                schedule.append((home, away) if game_i % 2 == 0 else (away, home))
    return schedule


def simulate_regular_season(rng: random.Random, games_per_matchup: int, teams: Sequence[Team] = TEAMS) -> Tuple[Dict[str, int], Dict[str, int]]:
    wins = {team.name: 0 for team in teams}
    losses = {team.name: 0 for team in teams}
    schedule = make_schedule(games_per_matchup, teams)
    rng.shuffle(schedule)
    for home, away in schedule:
        winner, _, _ = simulate_game(home, away, rng)
        loser = away.name if winner == home.name else home.name
        wins[winner] += 1
        losses[loser] += 1
    return wins, losses


def standings_by_conference(wins: Dict[str, int], losses: Dict[str, int], conference: str, teams: Sequence[Team] = TEAMS) -> List[str]:
    ranked = sorted(conference_teams(conference, teams), key=lambda t: (wins[t.name], -losses[t.name], t.offense - t.defense), reverse=True)
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


def run_play_in(seeded_ten: Sequence[str], team_by_name: Mapping[str, Team], rng: random.Random) -> Tuple[str, str]:
    seven, eight, nine, ten = [team_by_name[name] for name in seeded_ten[6:10]]
    winner_7_game, _, _ = simulate_game(seven, eight, rng)
    loser_7_game = eight if winner_7_game == seven.name else seven
    winner_9v10, _, _ = simulate_game(nine, ten, rng)
    advancer = nine if winner_9v10 == nine.name else ten
    winner_final, _, _ = simulate_game(loser_7_game, advancer, rng)
    final_eight = loser_7_game.name if winner_final == loser_7_game.name else advancer.name
    return winner_7_game, final_eight


def build_playoff_field(conference_seeds: Sequence[str], team_by_name: Mapping[str, Team], rng: random.Random) -> List[str]:
    locked = list(conference_seeds[:6])
    seed_7, seed_8 = run_play_in(conference_seeds[:10], team_by_name, rng)
    return locked + [seed_7, seed_8]


def simulate_playoffs_with_details(wins: Dict[str, int], losses: Dict[str, int], rng: random.Random, teams: Sequence[Team] = TEAMS) -> Dict[str, object]:
    team_by_name = {t.name: t for t in teams}
    east_ranked = standings_by_conference(wins, losses, "East", teams)
    west_ranked = standings_by_conference(wins, losses, "West", teams)
    east_seeded = build_playoff_field(east_ranked, team_by_name, rng)
    west_seeded = build_playoff_field(west_ranked, team_by_name, rng)

    def run_bracket(seeded: Sequence[str], label: str):
        qf_pairs = [(seeded[0], seeded[7]), (seeded[3], seeded[4]), (seeded[2], seeded[5]), (seeded[1], seeded[6])]
        qf_results, sf_teams = [], []
        for a, b in qf_pairs:
            winner = simulate_series(team_by_name[a], team_by_name[b], rng)
            qf_results.append({"a": a, "b": b, "winner": winner})
            sf_teams.append(winner)
        sf_pairs = [(sf_teams[0], sf_teams[1]), (sf_teams[2], sf_teams[3])]
        sf_results, finals_teams = [], []
        for a, b in sf_pairs:
            winner = simulate_series(team_by_name[a], team_by_name[b], rng)
            sf_results.append({"a": a, "b": b, "winner": winner})
            finals_teams.append(winner)
        conf_winner = simulate_series(team_by_name[finals_teams[0]], team_by_name[finals_teams[1]], rng)
        return conf_winner, {"conference": label, "qf": qf_results, "sf": sf_results, "cf": [{"a": finals_teams[0], "b": finals_teams[1], "winner": conf_winner}]}

    east_champ, east_detail = run_bracket(east_seeded, "East")
    west_champ, west_detail = run_bracket(west_seeded, "West")
    high_seed = team_by_name[east_champ] if wins[east_champ] >= wins[west_champ] else team_by_name[west_champ]
    low_seed = team_by_name[west_champ] if high_seed.name == east_champ else team_by_name[east_champ]
    champion = simulate_series(high_seed, low_seed, rng)
    return {"champion": champion, "east_seeded": east_seeded, "west_seeded": west_seeded, "east": east_detail, "west": west_detail, "finals": {"a": east_champ, "b": west_champ, "winner": champion}}


def simulate_playoffs(wins: Dict[str, int], losses: Dict[str, int], rng: random.Random, teams: Sequence[Team] = TEAMS) -> str:
    return str(simulate_playoffs_with_details(wins, losses, rng, teams)["champion"])


def simulate_franchise_mode(seed: int, games_per_matchup: int, gm_team: str | None, gm_move: str = "balanced") -> Dict[str, object]:
    rosters = generate_rosters()
    teams = apply_franchise_context(rosters, gm_team, gm_move)
    rng = random.Random(seed)
    wins, losses = simulate_regular_season(rng, games_per_matchup=games_per_matchup, teams=teams)
    playoff = simulate_playoffs_with_details(wins, losses, rng, teams)
    return {"teams": teams, "wins": wins, "losses": losses, "playoff": playoff, "rosters": rosters, "gm_team": gm_team, "gm_move": gm_move}


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NBA season + play-in + playoffs simulator")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--games-per-matchup", type=int, default=2, choices=[1, 2, 4])
    parser.add_argument("--gm-team", type=str, default=None)
    parser.add_argument("--gm-move", type=str, default="balanced", choices=list(GM_MOVES.keys()))
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    sim = simulate_franchise_mode(args.seed, args.games_per_matchup, args.gm_team, args.gm_move)
    wins, losses, champion = sim["wins"], sim["losses"], sim["playoff"]["champion"]
    print(f"GM Team: {args.gm_team or 'None'} ({args.gm_move})")
    for conf in ("East", "West"):
        print(f"\n{conf} standings")
        for i, name in enumerate(standings_by_conference(wins, losses, conf, sim["teams"]), 1):
            print(f"{i:>2}. {name:<28} {wins[name]:>2}-{losses[name]:<2}")
    print(f"\nNBA Champion: {champion}")


if __name__ == "__main__":
    main()
