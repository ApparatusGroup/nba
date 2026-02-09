import json
import threading
import urllib.request
from http.server import HTTPServer

from app import Handler


def test_api_simulate_works():
    server = HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_port
    thread = threading.Thread(target=server.handle_request)
    thread.start()
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/simulate?seed=42&gpm=2") as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
    server.server_close()
    thread.join(timeout=1)

    assert "champion" in data
    assert len(data["wins"]) == 30
