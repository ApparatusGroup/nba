import json
import threading
import urllib.request
from http.server import HTTPServer

from app import Handler


def _req(url: str):
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode())


def test_api_flow_new_league_sim_and_trade():
    server = HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_port

    t = threading.Thread(target=server.serve_forever)
    t.start()
    try:
        new_data = _req(f"http://127.0.0.1:{port}/api/new_league?seed=42&gpm=1&team=Los%20Angeles%20Lakers")
        sid = new_data["session_id"]
        day_data = _req(f"http://127.0.0.1:{port}/api/simulate_day?sid={sid}")
        trade = _req(
            f"http://127.0.0.1:{port}/api/trade?sid={sid}&from_team=Los%20Angeles%20Lakers&to_team=Boston%20Celtics&send=LeBron%20James&receive=Jayson%20Tatum"
        )
    finally:
        server.shutdown()
        server.server_close()
        t.join(timeout=2)

    assert day_data["day"] >= 1
    assert trade["result"]["ok"] is True
