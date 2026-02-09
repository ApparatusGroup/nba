#!/usr/bin/env python3
from __future__ import annotations

import json
import uuid
from html import escape
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlencode, urlparse

from nba_simulator import GM_MOVES, TEAMS, create_league_session, session_snapshot, simulate_days, simulate_to_end

SESSIONS = {}


def _team_options(current: str) -> str:
    return "".join(f"<option value='{escape(t.name)}' {'selected' if t.name==current else ''}>{escape(t.name)}</option>" for t in TEAMS)


def _move_options(current: str) -> str:
    return "".join(f"<option value='{k}' {'selected' if k==current else ''}>{k}</option>" for k in GM_MOVES)


def _standings(title: str, ranked: list[str], wins: dict[str, int], losses: dict[str, int]) -> str:
    rows = "".join(f"<tr><td>{i}</td><td>{escape(t)}</td><td>{wins[t]}-{losses[t]}</td></tr>" for i, t in enumerate(ranked, 1))
    return f"<h3>{title}</h3><table><tr><th>#</th><th>Team</th><th>Record</th></tr>{rows}</table>"


def render_home(snapshot: dict[str, object]) -> str:
    sid = snapshot["session_id"]
    team = snapshot["gm_team"]
    move = snapshot["gm_move"]
    record = f"{snapshot['wins'][team]}-{snapshot['losses'][team]}"
    champion = snapshot["playoff"]["champion"] if snapshot["playoff"] else "TBD"

    day_link = "/?" + urlencode({"sid": sid, "action": "sim_day"})
    week_link = "/?" + urlencode({"sid": sid, "action": "sim_week"})
    season_link = "/?" + urlencode({"sid": sid, "action": "sim_season"})

    roster_rows = "".join(
        f"<tr><td>{escape(p['name'])}</td><td>{p['overall']}</td><td>{p['offense']}/{p['defense']}</td></tr>" for p in snapshot["managed_roster"]
    )

    return f"""<!doctype html><html><head><meta charset='utf-8'><title>NBA MyLeague GM</title>
<style>
body{{font-family:Arial,sans-serif;max-width:1250px;margin:20px auto;padding:0 16px}} .grid{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}
.card{{border:1px solid #ddd;border-radius:10px;padding:12px}} table{{border-collapse:collapse;width:100%}} th,td{{border:1px solid #ddd;padding:6px}}
a.btn{{display:inline-block;margin-right:8px;padding:8px 12px;background:#111;color:#fff;text-decoration:none;border-radius:6px}}
</style></head><body>
<h1>NBA MyLeague GM Simulator</h1>
<form method='get' action='/' class='card'>
<input type='hidden' name='action' value='new'>
<label>Seed <input type='number' name='seed' value='42'></label>
<label>Games/Matchup <select name='gpm'><option value='1'>1</option><option value='2' selected>2</option><option value='4'>4</option></select></label>
<label>Control Team <select name='team'>{_team_options(team)}</select></label>
<label>GM Strategy <select name='move'>{_move_options(move)}</select></label>
<button type='submit'>Start New League</button>
</form>
<div class='card'><h2>Session {sid}</h2><p>Day: <b>{snapshot['day']}</b> | Completed: <b>{snapshot['completed']}</b></p>
<p>Your Team: <b>{escape(team)}</b> ({escape(move)}) — Record: <b>{record}</b></p><p>Champion: <b>{escape(champion)}</b></p>
<a class='btn' href='{day_link}'>Sim Day</a><a class='btn' href='{week_link}'>Sim Week</a><a class='btn' href='{season_link}'>Sim To End</a></div>
<div class='grid'><div class='card'>{_standings('East', snapshot['east_standings'], snapshot['wins'], snapshot['losses'])}</div>
<div class='card'>{_standings('West', snapshot['west_standings'], snapshot['wins'], snapshot['losses'])}</div></div>
<div class='grid'><div class='card'><h3>{escape(team)} Roster</h3><table><tr><th>Player</th><th>OVR</th><th>O/D</th></tr>{roster_rows}</table></div>
<div class='card'><h3>Playoffs</h3><pre>{escape(json.dumps(snapshot['playoff'], indent=2)) if snapshot['playoff'] else 'Not started'}</pre></div></div>
</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/api/new_league":
            seed = int(params.get("seed", ["42"])[0])
            gpm = int(params.get("gpm", ["2"])[0])
            team = params.get("team", [TEAMS[0].name])[0]
            move = params.get("move", ["balanced"])[0]
            sid = str(uuid.uuid4())[:8]
            SESSIONS[sid] = create_league_session(seed, team, move, gpm, sid)
            self._json(session_snapshot(SESSIONS[sid]))
            return

        if parsed.path == "/api/state":
            sid = params.get("sid", [""])[0]
            self._json(session_snapshot(SESSIONS[sid]) if sid in SESSIONS else {"error": "invalid sid"})
            return

        if parsed.path in {"/api/simulate_day", "/api/simulate_week", "/api/simulate_season"}:
            sid = params.get("sid", [""])[0]
            if sid not in SESSIONS:
                self._json({"error": "invalid sid"})
                return
            if parsed.path.endswith("day"):
                simulate_days(SESSIONS[sid], 1)
            elif parsed.path.endswith("week"):
                simulate_days(SESSIONS[sid], 7)
            else:
                simulate_to_end(SESSIONS[sid])
            self._json(session_snapshot(SESSIONS[sid]))
            return

        action = params.get("action", ["new"])[0]
        sid = params.get("sid", [""])[0]

        if action == "new" or sid not in SESSIONS:
            seed = int(params.get("seed", ["42"])[0])
            gpm = int(params.get("gpm", ["2"])[0])
            team = params.get("team", [TEAMS[0].name])[0]
            move = params.get("move", ["balanced"])[0]
            sid = str(uuid.uuid4())[:8]
            SESSIONS[sid] = create_league_session(seed, team, move, gpm, sid)
        elif action == "sim_day":
            simulate_days(SESSIONS[sid], 1)
        elif action == "sim_week":
            simulate_days(SESSIONS[sid], 7)
        elif action == "sim_season":
            simulate_to_end(SESSIONS[sid])

        html = render_home(session_snapshot(SESSIONS[sid])).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(html)))
        self.end_headers()
        self.wfile.write(html)

    def _json(self, payload: dict[str, object]) -> None:
        out = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)


def run_server(host: str = "0.0.0.0", port: int = 8000):
    HTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    run_server()
