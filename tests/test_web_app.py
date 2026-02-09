import json
import threading
import urllib.request
from http.server import HTTPServer

from app import Handler


def test_api_myleague_flow():
    server = HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_port

    t1 = threading.Thread(target=server.handle_request)
    t1.start()
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/new_league?seed=42&gpm=1&team=Los%20Angeles%20Lakers&move=all_in") as resp:
        data = json.loads(resp.read().decode())
    sid = data["session_id"]
    t1.join(timeout=1)

    t2 = threading.Thread(target=server.handle_request)
    t2.start()
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/simulate_day?sid={sid}") as resp:
        day_data = json.loads(resp.read().decode())
    t2.join(timeout=1)

    server.server_close()
    assert day_data["day"] >= 1
    assert day_data["gm_team"] == "Los Angeles Lakers"
