#!/usr/bin/env python3
from __future__ import annotations

import json
import uuid
from html import escape
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlencode, urlparse

from nba_simulator import TEAMS, create_league_session, process_trade, session_snapshot, set_rotation, simulate_days, simulate_to_end

SESSIONS: dict[str, object] = {}


def _team_options(current: str) -> str:
    return "".join(f"<option value='{escape(t.name)}' {'selected' if t.name==current else ''}>{escape(t.name)}</option>" for t in TEAMS)


def _standings(title: str, ranked: list[str], wins: dict[str, int], losses: dict[str, int]) -> str:
    rows = "".join(f"<tr><td>{i}</td><td>{escape(team)}</td><td>{wins[team]}-{losses[team]}</td></tr>" for i, team in enumerate(ranked, 1))
    return f"<h3>{title}</h3><table><tr><th>#</th><th>Team</th><th>Record</th></tr>{rows}</table>"


def render(snapshot: dict[str, object], trade_msg: str = "") -> str:
    sid = snapshot["session_id"]
    gm_team = snapshot["gm_team"]
    wins, losses = snapshot["wins"], snapshot["losses"]
    roster = snapshot["managed_roster"]
    east, west = snapshot["east_standings"], snapshot["west_standings"]
    champion = snapshot["champion"] or "TBD"

    roster_rows = "".join(
        f"<tr><td>{escape(p['name'])}</td><td>{p['pos']}</td><td>{p['overall']}</td><td>{p['age']}</td><td>${p['salary_m']}M</td></tr>" for p in roster[:12]
    )

    day_link = "/?" + urlencode({"sid": sid, "action": "sim_day"})
    week_link = "/?" + urlencode({"sid": sid, "action": "sim_week"})
    season_link = "/?" + urlencode({"sid": sid, "action": "sim_season"})

    return f"""<!doctype html>
<html><head><meta charset='utf-8'><title>NBA GM Universe</title>
<style>
:root{{--bg:#0b1020;--panel:#121a2f;--text:#e7edf7;--muted:#a9b3c8;--accent:#4b8bff;--ok:#2ecc71}}
*{{box-sizing:border-box}} body{{margin:0;background:linear-gradient(180deg,#090f1d,#10172b);font-family:Inter,Arial,sans-serif;color:var(--text)}}
.wrap{{max-width:1320px;margin:24px auto;padding:0 16px}} .panel{{background:var(--panel);border:1px solid #26314f;border-radius:14px;padding:14px;margin-bottom:14px}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:14px}} .grid3{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}}
h1,h2,h3{{margin:0 0 10px}} p, label{{color:var(--muted)}} input,select,button{{padding:8px;border-radius:8px;border:1px solid #2d3b61;background:#0e1630;color:var(--text)}}
button,.btn{{background:var(--accent);color:#fff;border:0;text-decoration:none;display:inline-block;padding:8px 12px;border-radius:8px;margin-right:8px}}
.btn.secondary{{background:#33466f}} table{{width:100%;border-collapse:collapse}} th,td{{border:1px solid #2a3759;padding:6px}}
.notice{{color:var(--ok)}}
</style></head><body><div class='wrap'>
<h1>NBA GM Universe</h1>
<div class='panel'>
<h2>League Session: {sid}</h2>
<p>Day <b>{snapshot['day']}</b> · Completed: <b>{snapshot['completed']}</b> · Champion: <b>{escape(champion)}</b></p>
<p>Your team <b>{escape(gm_team)}</b> record: <b>{wins[gm_team]}-{losses[gm_team]}</b></p>
<a class='btn' href='{day_link}'>Sim Day</a><a class='btn secondary' href='{week_link}'>Sim Week</a><a class='btn secondary' href='{season_link}'>Sim To End</a>
</div>
<div class='panel notice'>{escape(trade_msg)}</div>
<div class='grid'>
<div class='panel'>{_standings('Eastern Conference', east, wins, losses)}</div>
<div class='panel'>{_standings('Western Conference', west, wins, losses)}</div>
</div>
<div class='grid'>
<div class='panel'><h3>{escape(gm_team)} Roster</h3><table><tr><th>Player</th><th>Pos</th><th>OVR</th><th>Age</th><th>Salary</th></tr>{roster_rows}</table></div>
<div class='panel'>
<h3>Trade Center</h3>
<form method='get' action='/'><input type='hidden' name='action' value='trade'><input type='hidden' name='sid' value='{sid}'>
<label>From Team <select name='from_team'>{_team_options(gm_team)}</select></label>
<label>To Team <select name='to_team'>{_team_options('Boston Celtics')}</select></label>
<label>Send (comma names) <input name='send' style='width:100%' placeholder='LeBron James'></label>
<label>Receive (comma names) <input name='receive' style='width:100%' placeholder='Jayson Tatum'></label>
<button type='submit'>Execute Trade</button></form>
<h3 style='margin-top:16px'>Rotation Control</h3>
<form method='get' action='/'><input type='hidden' name='action' value='rotation'><input type='hidden' name='sid' value='{sid}'>
<label>Team <select name='team'>{_team_options(gm_team)}</select></label>
<label>Rotation (10 players, comma separated) <input name='players' style='width:100%' placeholder='Player1, Player2, ...'></label>
<button type='submit'>Update Rotation</button></form>
</div>
</div>
</div></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/api/new_league":
            seed = int(params.get("seed", ["42"])[0])
            gpm = int(params.get("gpm", ["2"])[0])
            team = params.get("team", [TEAMS[0].name])[0]
            sid = str(uuid.uuid4())[:8]
            SESSIONS[sid] = create_league_session(seed, team, gpm, sid)
            self._json(session_snapshot(SESSIONS[sid]))
            return

        if parsed.path in {"/api/state", "/api/simulate_day", "/api/simulate_week", "/api/simulate_season", "/api/trade", "/api/rotation"}:
            sid = params.get("sid", [""])[0]
            if sid not in SESSIONS:
                self._json({"error": "invalid sid"})
                return
            session = SESSIONS[sid]
            if parsed.path == "/api/simulate_day":
                simulate_days(session, 1)
            elif parsed.path == "/api/simulate_week":
                simulate_days(session, 7)
            elif parsed.path == "/api/simulate_season":
                simulate_to_end(session)
            elif parsed.path == "/api/trade":
                send = [x.strip() for x in params.get("send", [""])[0].split(",") if x.strip()]
                receive = [x.strip() for x in params.get("receive", [""])[0].split(",") if x.strip()]
                result = process_trade(session, params.get("from_team", [session.gm_team])[0], params.get("to_team", ["Boston Celtics"])[0], send, receive)
                self._json({"result": result, "state": session_snapshot(session)})
                return
            elif parsed.path == "/api/rotation":
                team = params.get("team", [session.gm_team])[0]
                players = [x.strip() for x in params.get("players", [""])[0].split(",") if x.strip()]
                set_rotation(session, team, players)
            self._json(session_snapshot(session))
            return

        action = params.get("action", ["new"])[0]
        sid = params.get("sid", [""])[0]
        msg = ""
        if action == "new" or sid not in SESSIONS:
            seed = int(params.get("seed", ["42"])[0])
            gpm = int(params.get("gpm", ["2"])[0])
            team = params.get("team", ["Los Angeles Lakers"])[0]
            sid = str(uuid.uuid4())[:8]
            SESSIONS[sid] = create_league_session(seed, team, gpm, sid)
        session = SESSIONS[sid]

        if action == "sim_day":
            simulate_days(session, 1)
        elif action == "sim_week":
            simulate_days(session, 7)
        elif action == "sim_season":
            simulate_to_end(session)
        elif action == "trade":
            send = [x.strip() for x in params.get("send", [""])[0].split(",") if x.strip()]
            receive = [x.strip() for x in params.get("receive", [""])[0].split(",") if x.strip()]
            res = process_trade(session, params.get("from_team", [session.gm_team])[0], params.get("to_team", ["Boston Celtics"])[0], send, receive)
            msg = "Trade executed" if res.get("ok") else f"Trade failed: {res.get('error')}"
        elif action == "rotation":
            team = params.get("team", [session.gm_team])[0]
            players = [x.strip() for x in params.get("players", [""])[0].split(",") if x.strip()]
            set_rotation(session, team, players)
            msg = f"Rotation updated for {team}"

        html = render(session_snapshot(session), msg).encode()
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
