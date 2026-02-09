from nba_simulator import create_league_session, process_trade, set_rotation, simulate_days, simulate_to_end


def test_day_progresses_and_records_change():
    s = create_league_session(42, "Los Angeles Lakers", 1, "s1")
    simulate_days(s, 1)
    assert s.day == 1
    assert sum(s.wins.values()) > 0


def test_trade_moves_players_between_teams():
    s = create_league_session(42, "Los Angeles Lakers", 1, "s2")
    result = process_trade(s, "Los Angeles Lakers", "Boston Celtics", ["LeBron James"], ["Jayson Tatum"])
    assert result["ok"] is True
    lakers = {p.name for p in s.rosters["Los Angeles Lakers"]}
    celtics = {p.name for p in s.rosters["Boston Celtics"]}
    assert "Jayson Tatum" in lakers
    assert "LeBron James" in celtics


def test_set_rotation_applies_order():
    s = create_league_session(42, "Los Angeles Lakers", 1, "s3")
    set_rotation(s, "Los Angeles Lakers", ["Anthony Davis", "LeBron James"])
    assert s.rotations["Los Angeles Lakers"][0] == "Anthony Davis"


def test_sim_to_end_yields_champion():
    s = create_league_session(42, "Los Angeles Lakers", 1, "s4")
    simulate_to_end(s)
    assert s.completed is True
    assert isinstance(s.champion, str)
