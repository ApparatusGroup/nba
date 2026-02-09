import json
import threading
import urllib.request
from http.server import HTTPServer

from app import Handler


def test_api_simulate_works_with_team_control():
    server = HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_port
    thread = threading.Thread(target=server.handle_request)
    thread.start()
    with urllib.request.urlopen(
        f"http://127.0.0.1:{port}/api/simulate?seed=42&gpm=2&team=Los%20Angeles%20Lakers&move=all_in"
    ) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
    server.server_close()
    thread.join(timeout=1)

    assert data["gm_team"] == "Los Angeles Lakers"
    assert data["gm_move"] == "all_in"
    assert len(data["managed_roster"]) >= 10
    assert "playoff" in data
