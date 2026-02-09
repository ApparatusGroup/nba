#!/usr/bin/env python3
from __future__ import annotations

import json
import random
from html import escape
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from nba_simulator import (
    simulate_playoffs_with_details,
    simulate_regular_season,
    standings_by_conference,
)


def simulate(seed: int, gpm: int):
    rng = random.Random(seed)
    wins, losses = simulate_regular_season(rng, games_per_matchup=gpm)
    playoff = simulate_playoffs_with_details(wins, losses, rng)
    return playoff["champion"], wins, losses, playoff


def standings_table(conf: str, ranked: list[str], wins: dict[str, int], losses: dict[str, int]) -> str:
    rows = "".join(
        f"<tr><td>{i}</td><td>{escape(name)}</td><td>{wins[name]}-{losses[name]}</td></tr>"
        for i, name in enumerate(ranked, start=1)
    )
    return f"<h3>{conf}</h3><table><tr><th>#</th><th>Team</th><th>Record</th></tr>{rows}</table>"


def round_html(title: str, pairs: list[dict[str, str]]) -> str:
    items = "".join(
        f"<li>{escape(p['a'])} vs {escape(p['b'])} → <b>{escape(p['winner'])}</b></li>" for p in pairs
    )
    return f"<h4>{title}</h4><ul>{items}</ul>"


def render_html(seed: int, gpm: int, champion: str, wins: dict[str, int], losses: dict[str, int], playoff: dict[str, object]) -> str:
    east_ranked = standings_by_conference(wins, losses, "East")
    west_ranked = standings_by_conference(wins, losses, "West")
    east = playoff["east"]
    west = playoff["west"]
    finals = playoff["finals"]

    return f"""<!doctype html>
<html><head><meta charset='utf-8'><title>NBA Simulator</title>
<style>
body {{ font-family: Inter, Arial, sans-serif; max-width: 1100px; margin: 24px auto; padding: 0 16px; }}
.grid {{ display:grid; grid-template-columns: 1fr 1fr; gap: 20px; }}
table {{ border-collapse: collapse; width:100%; }}
th,td {{ border:1px solid #ddd; padding:6px 8px; text-align:left; }}
.card {{ border:1px solid #ddd; border-radius:10px; padding:14px; margin:10px 0; }}
</style>
</head>
<body>
<h1>NBA Simulator</h1>
<form method='get' action='/'>
<label>Seed <input type='number' name='seed' value='{seed}'></label>
<label>Games/Matchup
<select name='gpm'>
<option value='1' {'selected' if gpm==1 else ''}>1</option>
<option value='2' {'selected' if gpm==2 else ''}>2</option>
<option value='4' {'selected' if gpm==4 else ''}>4</option>
</select></label>
<button type='submit'>Simulate</button>
</form>
<div class='card'><h2>Champion: {escape(champion)}</h2>
<p>Finals: {escape(finals['a'])} vs {escape(finals['b'])} → <b>{escape(finals['winner'])}</b></p></div>
<div class='grid'>
<div class='card'>{standings_table('East standings', east_ranked, wins, losses)}</div>
<div class='card'>{standings_table('West standings', west_ranked, wins, losses)}</div>
</div>
<div class='grid'>
<div class='card'><h3>East Bracket</h3>{round_html('Round 1', east['qf'])}{round_html('Round 2', east['sf'])}{round_html('East Finals', east['cf'])}</div>
<div class='card'><h3>West Bracket</h3>{round_html('Round 1', west['qf'])}{round_html('Round 2', west['sf'])}{round_html('West Finals', west['cf'])}</div>
</div>
</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        seed = int(params.get("seed", ["42"])[0])
        gpm = int(params.get("gpm", ["2"])[0])
        if gpm not in (1, 2, 4):
            gpm = 2
        champion, wins, losses, playoff = simulate(seed, gpm)

        if parsed.path == "/api/simulate":
            data = json.dumps(
                {
                    "champion": champion,
                    "wins": wins,
                    "losses": losses,
                    "seed": seed,
                    "games_per_matchup": gpm,
                    "playoff": playoff,
                }
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        html = render_html(seed, gpm, champion, wins, losses, playoff).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(html)))
        self.end_headers()
        self.wfile.write(html)


def run_server(host: str = "0.0.0.0", port: int = 8000):
    server = HTTPServer((host, port), Handler)
    server.serve_forever()


if __name__ == "__main__":
    run_server()
