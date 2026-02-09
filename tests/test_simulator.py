from nba_simulator import create_league_session, generate_rosters, simulate_days, simulate_to_end


def test_rosters_have_real_star():
    rosters = generate_rosters()
    assert any(p.name == "LeBron James" for p in rosters["Los Angeles Lakers"])


def test_day_by_day_progresses_session():
    s = create_league_session(42, "Los Angeles Lakers", "all_in", 1, "s1")
    simulate_days(s, 1)
    assert s.day == 1
    assert sum(s.wins.values()) > 0


def test_sim_to_end_completes_with_champion():
    s = create_league_session(42, "Los Angeles Lakers", "all_in", 1, "s2")
    simulate_to_end(s)
    assert s.completed is True
    assert s.playoff is not None
    assert "champion" in s.playoff
