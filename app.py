#!/usr/bin/env python3
from __future__ import annotations

import json
from html import escape
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from nba_simulator import GM_MOVES, TEAMS, simulate_franchise_mode, standings_by_conference


def standings_table(conf: str, ranked: list[str], wins: dict[str, int], losses: dict[str, int]) -> str:
    rows = "".join(f"<tr><td>{i}</td><td>{escape(name)}</td><td>{wins[name]}-{losses[name]}</td></tr>" for i, name in enumerate(ranked, 1))
    return f"<h3>{conf}</h3><table><tr><th>#</th><th>Team</th><th>Record</th></tr>{rows}</table>"


def roster_table(team: str, roster: list[dict[str, object]]) -> str:
    rows = "".join(f"<tr><td>{escape(str(p['name']))}</td><td>{p['overall']}</td><td>{p['offense']}/{p['defense']}</td></tr>" for p in roster)
    return f"<h3>{escape(team)} Roster</h3><table><tr><th>Player</th><th>OVR</th><th>O/D</th></tr>{rows}</table>"


def round_html(title: str, pairs: list[dict[str, str]]) -> str:
    return f"<h4>{title}</h4><ul>" + "".join(f"<li>{escape(p['a'])} vs {escape(p['b'])} → <b>{escape(p['winner'])}</b></li>" for p in pairs) + "</ul>"


def render_html(seed: int, gpm: int, gm_team: str, gm_move: str, data: dict[str, object]) -> str:
    wins, losses = data["wins"], data["losses"]
    teams = data["teams"]
    playoff = data["playoff"]
    east_ranked = standings_by_conference(wins, losses, "East", teams)
    west_ranked = standings_by_conference(wins, losses, "West", teams)
    team_options = "".join(f"<option value='{escape(t.name)}' {'selected' if gm_team==t.name else ''}>{escape(t.name)}</option>" for t in TEAMS)
    move_options = "".join(f"<option value='{k}' {'selected' if gm_move==k else ''}>{k}</option>" for k in GM_MOVES)
    roster_obj = data["rosters"][gm_team]
    roster = [vars(p) | {"overall": p.overall} for p in sorted(roster_obj, key=lambda x: x.overall, reverse=True)[:10]]

    return f"""<!doctype html><html><head><meta charset='utf-8'><title>NBA Franchise Simulator</title>
<style>
body{{font-family:Inter,Arial,sans-serif;max-width:1200px;margin:20px auto;padding:0 16px}} .grid{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}
.card{{border:1px solid #ddd;border-radius:10px;padding:12px}} table{{border-collapse:collapse;width:100%}}th,td{{border:1px solid #ddd;padding:6px}}
</style></head><body>
<h1>NBA Franchise Simulator</h1>
<form method='get' action='/' class='card'>
<label>Seed <input type='number' name='seed' value='{seed}'></label>
<label>Games/Matchup <select name='gpm'><option value='1' {'selected' if gpm==1 else ''}>1</option><option value='2' {'selected' if gpm==2 else ''}>2</option><option value='4' {'selected' if gpm==4 else ''}>4</option></select></label>
<label>You control team <select name='team'>{team_options}</select></label>
<label>Front office move <select name='move'>{move_options}</select></label>
<button type='submit'>Run Season</button></form>
<div class='card'><h2>Champion: {escape(playoff['champion'])}</h2><p>Finals: {escape(playoff['finals']['a'])} vs {escape(playoff['finals']['b'])}</p><p>Your team: <b>{escape(gm_team)}</b> ({escape(gm_move)}) • Record: {wins[gm_team]}-{losses[gm_team]}</p></div>
<div class='grid'><div class='card'>{standings_table('East', east_ranked, wins, losses)}</div><div class='card'>{standings_table('West', west_ranked, wins, losses)}</div></div>
<div class='grid'><div class='card'>{roster_table(gm_team, roster)}</div><div class='card'><h3>Playoff Bracket</h3>{round_html('East R1', playoff['east']['qf'])}{round_html('West R1', playoff['west']['qf'])}{round_html('Finals', [playoff['finals']])}</div></div>
</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        seed = int(params.get("seed", ["42"])[0])
        gpm = int(params.get("gpm", ["2"])[0])
        if gpm not in (1, 2, 4):
            gpm = 2
        gm_team = params.get("team", [TEAMS[0].name])[0]
        if gm_team not in {t.name for t in TEAMS}:
            gm_team = TEAMS[0].name
        gm_move = params.get("move", ["balanced"])[0]
        if gm_move not in GM_MOVES:
            gm_move = "balanced"

        data = simulate_franchise_mode(seed, gpm, gm_team, gm_move)

        if parsed.path == "/api/simulate":
            roster = [{"name": p.name, "overall": p.overall, "offense": p.offense, "defense": p.defense} for p in sorted(data["rosters"][gm_team], key=lambda x: x.overall, reverse=True)[:12]]
            payload = {
                "champion": data["playoff"]["champion"],
                "wins": data["wins"],
                "losses": data["losses"],
                "seed": seed,
                "games_per_matchup": gpm,
                "gm_team": gm_team,
                "gm_move": gm_move,
                "playoff": data["playoff"],
                "managed_roster": roster,
            }
            out = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)
            return

        html = render_html(seed, gpm, gm_team, gm_move, data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(html)))
        self.end_headers()
        self.wfile.write(html)


def run_server(host: str = "0.0.0.0", port: int = 8000):
    HTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    run_server()
