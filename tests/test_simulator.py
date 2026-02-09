import random

from nba_simulator import (
    TEAMS,
    build_playoff_field,
    make_schedule,
    simulate_playoffs_with_details,
    simulate_regular_season,
)


def test_team_count():
    assert len(TEAMS) == 30


def test_schedule_size_for_two_games_per_matchup():
    schedule = make_schedule(games_per_matchup=2)
    assert len(schedule) == (30 * 29 // 2) * 2


def test_regular_season_is_zero_sum():
    wins, losses = simulate_regular_season(random.Random(1), games_per_matchup=2)
    assert sum(wins.values()) == sum(losses.values())


def test_playoff_field_has_eight_unique_teams():
    east = [team.name for team in TEAMS if team.conference == "East"]
    field = build_playoff_field(east, random.Random(123))
    assert len(field) == 8
    assert len(set(field)) == 8


def test_playoff_details_include_finals_winner():
    rng = random.Random(99)
    wins, losses = simulate_regular_season(rng, games_per_matchup=1)
    details = simulate_playoffs_with_details(wins, losses, random.Random(99))
    assert details["champion"] in details["finals"].values()
