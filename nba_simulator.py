#!/usr/bin/env python3
"""NBA MyLeague simulator with trades, rotations, and day-by-day progression."""

from __future__ import annotations

import argparse
import random
from dataclasses import dataclass
from typing import Dict, Iterable, List, Mapping, Sequence, Tuple


@dataclass(frozen=True)
class Team:
    name: str
    conference: str
    pace: float


@dataclass
class Player:
    name: str
    pos: str
    age: int
    salary_m: float
    offense: int
    defense: int
    shooting: int
    playmaking: int
    rebounding: int

    @property
    def overall(self) -> int:
        return int(
            (self.offense * 0.29)
            + (self.defense * 0.24)
            + (self.shooting * 0.16)
            + (self.playmaking * 0.16)
            + (self.rebounding * 0.15)
        )


@dataclass
class LeagueSession:
    session_id: str
    seed: int
    gm_team: str
    games_per_matchup: int
    teams: List[Team]
    rosters: Dict[str, List[Player]]
    rotations: Dict[str, List[str]]
    schedule: List[Tuple[str, str]]
    wins: Dict[str, int]
    losses: Dict[str, int]
    day: int = 0
    cursor: int = 0
    completed: bool = False
    champion: str | None = None


TEAMS: Sequence[Team] = (
    Team("Boston Celtics", "East", 98.0), Team("Milwaukee Bucks", "East", 100.1), Team("Philadelphia 76ers", "East", 97.6),
    Team("New York Knicks", "East", 96.9), Team("Cleveland Cavaliers", "East", 96.1), Team("Miami Heat", "East", 95.3),
    Team("Indiana Pacers", "East", 101.7), Team("Orlando Magic", "East", 97.1), Team("Atlanta Hawks", "East", 101.4),
    Team("Brooklyn Nets", "East", 98.3), Team("Chicago Bulls", "East", 96.8), Team("Toronto Raptors", "East", 99.2),
    Team("Charlotte Hornets", "East", 98.6), Team("Washington Wizards", "East", 101.8), Team("Detroit Pistons", "East", 99.5),
    Team("Denver Nuggets", "West", 97.4), Team("Minnesota Timberwolves", "West", 97.1), Team("Oklahoma City Thunder", "West", 100.0),
    Team("Dallas Mavericks", "West", 99.0), Team("Phoenix Suns", "West", 97.0), Team("LA Clippers", "West", 97.2),
    Team("New Orleans Pelicans", "West", 98.5), Team("Sacramento Kings", "West", 100.3), Team("Los Angeles Lakers", "West", 99.4),
    Team("Golden State Warriors", "West", 101.1), Team("Houston Rockets", "West", 98.7), Team("Utah Jazz", "West", 100.2),
    Team("Memphis Grizzlies", "West", 98.0), Team("Portland Trail Blazers", "West", 98.9), Team("San Antonio Spurs", "West", 100.5),
)

REAL_CORE_PLAYERS: Mapping[str, Sequence[Tuple[str, str, int]]] = {
    "Boston Celtics": (("Jayson Tatum", "SF", 96), ("Jaylen Brown", "SG", 90), ("Jrue Holiday", "PG", 86), ("Derrick White", "SG", 85), ("Kristaps Porzingis", "C", 87)),
    "Milwaukee Bucks": (("Giannis Antetokounmpo", "PF", 97), ("Damian Lillard", "PG", 91), ("Khris Middleton", "SF", 83), ("Brook Lopez", "C", 82), ("Bobby Portis", "PF", 80)),
    "Philadelphia 76ers": (("Joel Embiid", "C", 96), ("Tyrese Maxey", "PG", 88), ("Paul George", "SF", 88), ("Kelly Oubre Jr.", "SF", 79), ("Andre Drummond", "C", 77)),
    "New York Knicks": (("Jalen Brunson", "PG", 92), ("Julius Randle", "PF", 87), ("OG Anunoby", "SF", 84), ("Mikal Bridges", "SF", 86), ("Mitchell Robinson", "C", 81)),
    "Cleveland Cavaliers": (("Donovan Mitchell", "SG", 92), ("Darius Garland", "PG", 86), ("Evan Mobley", "PF", 86), ("Jarrett Allen", "C", 84), ("Caris LeVert", "SG", 80)),
    "Miami Heat": (("Jimmy Butler", "SF", 90), ("Bam Adebayo", "C", 89), ("Tyler Herro", "SG", 84), ("Terry Rozier", "PG", 80), ("Jaime Jaquez Jr.", "SF", 78)),
    "Indiana Pacers": (("Tyrese Haliburton", "PG", 91), ("Pascal Siakam", "PF", 87), ("Myles Turner", "C", 84), ("Bennedict Mathurin", "SG", 80), ("Andrew Nembhard", "PG", 79)),
    "Orlando Magic": (("Paolo Banchero", "PF", 89), ("Franz Wagner", "SF", 86), ("Jalen Suggs", "SG", 82), ("Wendell Carter Jr.", "C", 80), ("Jonathan Isaac", "PF", 78)),
    "Atlanta Hawks": (("Trae Young", "PG", 89), ("Jalen Johnson", "PF", 83), ("Clint Capela", "C", 81), ("De'Andre Hunter", "SF", 79), ("Bogdan Bogdanovic", "SG", 81)),
    "Brooklyn Nets": (("Cam Thomas", "SG", 81), ("Nic Claxton", "C", 82), ("Cameron Johnson", "SF", 80), ("Dorian Finney-Smith", "PF", 78), ("Dennis Schroder", "PG", 79)),
    "Chicago Bulls": (("Zach LaVine", "SG", 86), ("Nikola Vucevic", "C", 83), ("Coby White", "PG", 82), ("Josh Giddey", "PG", 80), ("Ayo Dosunmu", "SG", 79)),
    "Toronto Raptors": (("Scottie Barnes", "SF", 88), ("RJ Barrett", "SF", 82), ("Immanuel Quickley", "PG", 83), ("Jakob Poeltl", "C", 80), ("Gradey Dick", "SG", 76)),
    "Charlotte Hornets": (("LaMelo Ball", "PG", 87), ("Brandon Miller", "SF", 84), ("Miles Bridges", "SF", 81), ("Mark Williams", "C", 79), ("Tre Mann", "PG", 76)),
    "Washington Wizards": (("Jordan Poole", "SG", 80), ("Kyle Kuzma", "PF", 82), ("Bilal Coulibaly", "SF", 78), ("Alex Sarr", "C", 79), ("Malcolm Brogdon", "PG", 81)),
    "Detroit Pistons": (("Cade Cunningham", "PG", 87), ("Jaden Ivey", "SG", 81), ("Ausar Thompson", "SF", 79), ("Jalen Duren", "C", 82), ("Tobias Harris", "PF", 81)),
    "Denver Nuggets": (("Nikola Jokic", "C", 98), ("Jamal Murray", "PG", 88), ("Michael Porter Jr.", "SF", 84), ("Aaron Gordon", "PF", 83), ("Kentavious Caldwell-Pope", "SG", 79)),
    "Minnesota Timberwolves": (("Anthony Edwards", "SG", 93), ("Rudy Gobert", "C", 87), ("Julius Randle", "PF", 87), ("Naz Reid", "C", 82), ("Mike Conley", "PG", 80)),
    "Oklahoma City Thunder": (("Shai Gilgeous-Alexander", "PG", 96), ("Jalen Williams", "SF", 87), ("Chet Holmgren", "C", 88), ("Isaiah Hartenstein", "C", 82), ("Luguentz Dort", "SG", 80)),
    "Dallas Mavericks": (("Luka Doncic", "PG", 97), ("Kyrie Irving", "PG", 91), ("Klay Thompson", "SG", 82), ("PJ Washington", "PF", 80), ("Daniel Gafford", "C", 80)),
    "Phoenix Suns": (("Kevin Durant", "SF", 94), ("Devin Booker", "SG", 93), ("Bradley Beal", "SG", 86), ("Jusuf Nurkic", "C", 80), ("Grayson Allen", "SG", 80)),
    "LA Clippers": (("Kawhi Leonard", "SF", 92), ("James Harden", "PG", 88), ("Norman Powell", "SG", 82), ("Ivica Zubac", "C", 82), ("Terance Mann", "SF", 79)),
    "New Orleans Pelicans": (("Zion Williamson", "PF", 90), ("Brandon Ingram", "SF", 87), ("CJ McCollum", "SG", 84), ("Herb Jones", "SF", 81), ("Trey Murphy III", "SF", 80)),
    "Sacramento Kings": (("De'Aaron Fox", "PG", 89), ("Domantas Sabonis", "C", 90), ("Keegan Murray", "PF", 82), ("DeMar DeRozan", "SF", 86), ("Malik Monk", "SG", 83)),
    "Los Angeles Lakers": (("LeBron James", "SF", 94), ("Anthony Davis", "C", 93), ("Austin Reaves", "SG", 84), ("D'Angelo Russell", "PG", 81), ("Rui Hachimura", "PF", 79)),
    "Golden State Warriors": (("Stephen Curry", "PG", 95), ("Draymond Green", "PF", 83), ("Jonathan Kuminga", "SF", 82), ("Andrew Wiggins", "SF", 80), ("Buddy Hield", "SG", 79)),
    "Houston Rockets": (("Alperen Sengun", "C", 88), ("Jalen Green", "SG", 83), ("Fred VanVleet", "PG", 82), ("Amen Thompson", "PG", 81), ("Jabari Smith Jr.", "PF", 80)),
    "Utah Jazz": (("Lauri Markkanen", "PF", 87), ("Collin Sexton", "PG", 82), ("Jordan Clarkson", "SG", 80), ("Walker Kessler", "C", 80), ("Keyonte George", "PG", 79)),
    "Memphis Grizzlies": (("Ja Morant", "PG", 92), ("Jaren Jackson Jr.", "PF", 88), ("Desmond Bane", "SG", 86), ("Marcus Smart", "PG", 80), ("Brandon Clarke", "PF", 78)),
    "Portland Trail Blazers": (("Anfernee Simons", "SG", 84), ("Jerami Grant", "PF", 83), ("Scoot Henderson", "PG", 80), ("Deandre Ayton", "C", 82), ("Shaedon Sharpe", "SG", 81)),
    "San Antonio Spurs": (("Victor Wembanyama", "C", 94), ("Devin Vassell", "SG", 83), ("Keldon Johnson", "SF", 81), ("Chris Paul", "PG", 82), ("Stephon Castle", "SG", 79)),
}


def _player_from_ovr(name: str, pos: str, ovr: int, rng: random.Random) -> Player:
    return Player(
        name=name,
        pos=pos,
        age=rng.randint(20, 36),
        salary_m=round(max(1.8, (ovr - 60) * 1.2 + rng.uniform(-2.0, 2.0)), 2),
        offense=max(60, min(99, ovr + rng.randint(-4, 4))),
        defense=max(55, min(99, ovr + rng.randint(-6, 3))),
        shooting=max(55, min(99, ovr + rng.randint(-5, 5))),
        playmaking=max(55, min(99, ovr + rng.randint(-7, 5))),
        rebounding=max(55, min(99, ovr + rng.randint(-7, 6))),
    )


def generate_rosters() -> Dict[str, List[Player]]:
    rosters: Dict[str, List[Player]] = {}
    for team in TEAMS:
        r = random.Random(1000 + sum(ord(c) for c in team.name))
        core = [_player_from_ovr(n, p, o, r) for n, p, o in REAL_CORE_PLAYERS[team.name]]
        bench = [_player_from_ovr(f"{team.name.split()[0]} Bench {i+1}", r.choice(["G", "F", "C"]), 75 - i, r) for i in range(10)]
        rosters[team.name] = core + bench
    return rosters


def default_rotation(roster: Sequence[Player]) -> List[str]:
    return [p.name for p in sorted(roster, key=lambda x: x.overall, reverse=True)[:10]]


def calculate_team_profile(roster: Sequence[Player], rotation_names: Sequence[str]) -> Tuple[float, float]:
    by_name = {p.name: p for p in roster}
    minutes = [34, 34, 32, 30, 28, 20, 18, 16, 14, 12]
    rotation = [by_name[n] for n in rotation_names if n in by_name][:10]
    if len(rotation) < 10:
        for p in sorted(roster, key=lambda x: x.overall, reverse=True):
            if p not in rotation:
                rotation.append(p)
            if len(rotation) == 10:
                break
    total = float(sum(minutes))
    off = sum((((p.offense * 0.45) + (p.shooting * 0.25) + (p.playmaking * 0.30)) / 100.0) * m for p, m in zip(rotation, minutes)) / total
    deff = sum((((p.defense * 0.60) + (p.rebounding * 0.40)) / 100.0) * m for p, m in zip(rotation, minutes)) / total
    return off, deff


def make_schedule(team_names: Sequence[str], games_per_matchup: int) -> List[Tuple[str, str]]:
    schedule: List[Tuple[str, str]] = []
    for i, home in enumerate(team_names):
        for away in team_names[i + 1 :]:
            for g in range(games_per_matchup):
                schedule.append((home, away) if g % 2 == 0 else (away, home))
    return schedule


def _simulate_game(home: str, away: str, session: LeagueSession, rng: random.Random) -> str:
    pace_home = next(t.pace for t in session.teams if t.name == home)
    pace_away = next(t.pace for t in session.teams if t.name == away)
    poss = max(92, min(108, int(((pace_home + pace_away) / 2) + rng.gauss(0, 2))))

    h_off, h_def = calculate_team_profile(session.rosters[home], session.rotations[home])
    a_off, a_def = calculate_team_profile(session.rosters[away], session.rotations[away])

    hs = int((h_off * (2 - a_def)) * poss + 8 + rng.gauss(0, 7))
    as_ = int((a_off * (2 - h_def)) * poss + rng.gauss(0, 7))
    if hs == as_:
        hs += 1 if rng.random() < 0.52 else 0
        as_ += 1 if hs == as_ else 0
    return home if hs > as_ else away


def standings_by_conference(wins: Dict[str, int], losses: Dict[str, int], conference: str, teams: Sequence[Team]) -> List[str]:
    conf = [t for t in teams if t.conference == conference]
    return [t.name for t in sorted(conf, key=lambda t: (wins[t.name], -losses[t.name]), reverse=True)]


def _simulate_series(a: str, b: str, session: LeagueSession, rng: random.Random) -> str:
    w = {a: 0, b: 0}
    homes = [a, a, b, b, a, b, a]
    while w[a] < 4 and w[b] < 4:
        home = homes[w[a] + w[b]]
        away = b if home == a else a
        w[_simulate_game(home, away, session, rng)] += 1
    return a if w[a] == 4 else b


def _simulate_playoffs(session: LeagueSession) -> str:
    rng = random.Random(session.seed + 999)
    east = standings_by_conference(session.wins, session.losses, "East", session.teams)[:8]
    west = standings_by_conference(session.wins, session.losses, "West", session.teams)[:8]

    def conf(seed: List[str]) -> str:
        qf = [_simulate_series(seed[0], seed[7], session, rng), _simulate_series(seed[3], seed[4], session, rng), _simulate_series(seed[2], seed[5], session, rng), _simulate_series(seed[1], seed[6], session, rng)]
        sf = [_simulate_series(qf[0], qf[1], session, rng), _simulate_series(qf[2], qf[3], session, rng)]
        return _simulate_series(sf[0], sf[1], session, rng)

    return _simulate_series(conf(east), conf(west), session, rng)


def create_league_session(seed: int, gm_team: str, games_per_matchup: int, session_id: str) -> LeagueSession:
    rosters = generate_rosters()
    rotations = {team: default_rotation(roster) for team, roster in rosters.items()}
    schedule = make_schedule([t.name for t in TEAMS], games_per_matchup)
    random.Random(seed).shuffle(schedule)
    wins = {t.name: 0 for t in TEAMS}
    losses = {t.name: 0 for t in TEAMS}
    return LeagueSession(session_id, seed, gm_team, games_per_matchup, list(TEAMS), rosters, rotations, schedule, wins, losses)


def set_rotation(session: LeagueSession, team: str, ordered_players: Sequence[str]) -> None:
    roster_names = {p.name for p in session.rosters[team]}
    clean = [p for p in ordered_players if p in roster_names]
    for p in session.rosters[team]:
        if p.name not in clean:
            clean.append(p.name)
    session.rotations[team] = clean[:10]


def process_trade(session: LeagueSession, from_team: str, to_team: str, send_players: Sequence[str], receive_players: Sequence[str]) -> Dict[str, object]:
    if not send_players or not receive_players:
        return {"ok": False, "error": "both sides must include players"}

    from_roster = session.rosters[from_team]
    to_roster = session.rosters[to_team]
    from_map = {p.name: p for p in from_roster}
    to_map = {p.name: p for p in to_roster}
    if any(p not in from_map for p in send_players) or any(p not in to_map for p in receive_players):
        return {"ok": False, "error": "invalid player in trade"}

    outgoing = [from_map[p] for p in send_players]
    incoming = [to_map[p] for p in receive_players]

    session.rosters[from_team] = [p for p in from_roster if p.name not in send_players] + incoming
    session.rosters[to_team] = [p for p in to_roster if p.name not in receive_players] + outgoing
    set_rotation(session, from_team, session.rotations[from_team])
    set_rotation(session, to_team, session.rotations[to_team])
    return {"ok": True, "from_team": from_team, "to_team": to_team, "sent": list(send_players), "received": list(receive_players)}


def simulate_days(session: LeagueSession, days: int) -> None:
    if session.completed:
        return
    rng = random.Random(session.seed + session.day)
    for _ in range(days):
        if session.cursor >= len(session.schedule):
            session.completed = True
            session.champion = _simulate_playoffs(session)
            break
        today = session.schedule[session.cursor : session.cursor + 15]
        session.cursor += len(today)
        session.day += 1
        for home, away in today:
            winner = _simulate_game(home, away, session, rng)
            loser = away if winner == home else home
            session.wins[winner] += 1
            session.losses[loser] += 1
    if session.cursor >= len(session.schedule) and not session.completed:
        session.completed = True
        session.champion = _simulate_playoffs(session)


def simulate_to_end(session: LeagueSession) -> None:
    while not session.completed:
        simulate_days(session, 1)


def session_snapshot(session: LeagueSession) -> Dict[str, object]:
    east = standings_by_conference(session.wins, session.losses, "East", session.teams)
    west = standings_by_conference(session.wins, session.losses, "West", session.teams)
    gm_roster = sorted(session.rosters[session.gm_team], key=lambda p: p.overall, reverse=True)
    return {
        "session_id": session.session_id,
        "day": session.day,
        "completed": session.completed,
        "champion": session.champion,
        "gm_team": session.gm_team,
        "wins": session.wins,
        "losses": session.losses,
        "east_standings": east,
        "west_standings": west,
        "rotations": session.rotations,
        "managed_roster": [vars(p) | {"overall": p.overall} for p in gm_roster],
    }


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NBA MyLeague simulator")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--team", type=str, default="Los Angeles Lakers")
    parser.add_argument("--games-per-matchup", type=int, default=2, choices=[1, 2, 4])
    parser.add_argument("--sim", choices=["day", "season"], default="season")
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    s = create_league_session(args.seed, args.team, args.games_per_matchup, "cli")
    simulate_days(s, 1) if args.sim == "day" else simulate_to_end(s)
    snap = session_snapshot(s)
    print(f"Day {snap['day']} - {args.team}: {snap['wins'][args.team]}-{snap['losses'][args.team]}")
    if snap["champion"]:
        print(f"Champion: {snap['champion']}")


if __name__ == "__main__":
    main()
