#!/usr/bin/env python3
from __future__ import annotations

import json
import random
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from nba_simulator import simulate_playoffs, simulate_regular_season


def simulate(seed: int, gpm: int):
    rng = random.Random(seed)
    wins, losses = simulate_regular_season(rng, games_per_matchup=gpm)
    champion = simulate_playoffs(wins, losses, rng)
    return champion, wins, losses


def render_html(seed: int, gpm: int, champion: str, wins: dict[str, int], losses: dict[str, int]) -> str:
    table = "\n".join(
        f"{team:<28} {w:>2}-{losses[team]:<2}" for team, w in sorted(wins.items(), key=lambda kv: kv[1], reverse=True)
    )
    return f"""<!doctype html>
<html><head><meta charset='utf-8'><title>NBA Simulator</title></head>
<body style='font-family:Arial,sans-serif;max-width:900px;margin:24px auto;'>
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
<h2>Champion: {champion}</h2>
<pre>{table}</pre>
</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        seed = int(params.get("seed", ["42"])[0])
        gpm = int(params.get("gpm", ["2"])[0])
        if gpm not in (1, 2, 4):
            gpm = 2
        champion, wins, losses = simulate(seed, gpm)

        if parsed.path == "/api/simulate":
            data = json.dumps({"champion": champion, "wins": wins, "losses": losses, "seed": seed, "games_per_matchup": gpm}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        html = render_html(seed, gpm, champion, wins, losses).encode()
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
