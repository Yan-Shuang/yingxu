"""Smoke-test the built standalone proxy with local fixtures, without model calls.

Run after `cd frontend && npm run build`, using the backend virtualenv Python.
"""

import json
import os
import re
import shutil
import socket
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]


class Fixture(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.send_response(200)
        if self.path == "/api/stream-fixture":
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            for i in range(3):
                if i:
                    time.sleep(0.4)
                self.wfile.write(f"data: {i}\n\n".encode())
                self.wfile.flush()
        else:
            self.send_header("Content-Type", "application/json")
            self.send_header("Set-Cookie", "fixture_a=1; Path=/; HttpOnly")
            self.send_header("Set-Cookie", "fixture_b=2; Path=/; SameSite=Lax")
            self.end_headers()
            self.wfile.write(b'{"user":null,"ok":true}')

    def do_POST(self):
        # Node fetch streams the incoming upload using chunked transfer encoding.
        chunks = []
        if self.headers.get("Transfer-Encoding") == "chunked":
            while True:
                length = int(self.rfile.readline().strip().split(b";")[0], 16)
                if not length:
                    self.rfile.readline()
                    break
                chunks.append(self.rfile.read(length))
                self.rfile.read(2)
        else:
            chunks.append(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(
            json.dumps(
                {
                    "body": b"".join(chunks).decode(),
                    "csrf": self.headers.get("X-CSRF-Token"),
                    "origin": self.headers.get("Origin"),
                    "cookie": self.headers.get("Cookie"),
                }
            ).encode()
        )


def prepare_standalone():
    standalone = ROOT / "frontend/.next/standalone/frontend"
    if not (standalone / "server.js").exists():
        raise RuntimeError("Build the frontend first: cd frontend && npm run build")
    shutil.copytree(ROOT / "frontend/public", standalone / "public", dirs_exist_ok=True)
    shutil.copytree(
        ROOT / "frontend/.next/static", standalone / ".next/static", dirs_exist_ok=True
    )
    return standalone


def main():
    standalone = prepare_standalone()
    fixture = ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
    threading.Thread(target=fixture.serve_forever, daemon=True).start()
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    env = {
        **os.environ,
        "NODE_ENV": "production",
        "HOSTNAME": "127.0.0.1",
        "PORT": str(port),
        "NEXT_TELEMETRY_DISABLED": "1",
        "BACKEND_API_URL": f"http://127.0.0.1:{fixture.server_port}",
    }
    process = subprocess.Popen(
        ["node", "server.js"],
        cwd=standalone,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=5) as client:
            for _ in range(80):
                try:
                    page = client.get("/")
                    if page.status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                if process.poll() is not None:
                    raise RuntimeError("Standalone server exited before readiness")
                time.sleep(0.1)
            else:
                raise RuntimeError("Standalone server readiness timed out")
            assert "映序" in page.text
            assert client.get("/brand.svg").status_code == 200
            css = re.search(r'href="([^\"]+\.css[^\"]*)"', page.text)
            assert css and client.get(css.group(1)).status_code == 200
            response = client.get("/api/cookie-fixture")
            assert len(response.headers.get_list("set-cookie")) == 2, (
                response.headers.get_list("set-cookie")
            )
            body = client.post(
                "/api/body-fixture",
                content="素材上传测试",
                headers={
                    "Origin": "http://fixture.test",
                    "X-CSRF-Token": "fixture-csrf",
                    "Cookie": "fixture_session=secret",
                    "Content-Type": "text/plain",
                },
            ).json()
            assert body == {
                "body": "素材上传测试",
                "origin": "http://fixture.test",
                "csrf": "fixture-csrf",
                "cookie": "fixture_session=secret",
            }
            events = []
            start = time.monotonic()
            with client.stream("GET", "/api/stream-fixture") as stream:
                assert stream.headers["content-type"].startswith("text/event-stream")
                for line in stream.iter_lines():
                    if line:
                        events.append((line, round(time.monotonic() - start, 3)))
            assert [line for line, _ in events] == ["data: 0", "data: 1", "data: 2"]
            assert events[0][1] < 0.65 and events[-1][1] >= 0.75, events
            print(
                json.dumps(
                    {
                        "result": "passed",
                        "sse_events_seconds": events,
                        "checks": [
                            "standalone page/static files",
                            "runtime backend URL",
                            "two Set-Cookie headers",
                            "streaming POST/CSRF/Origin/cookie",
                            "incremental SSE forwarding",
                        ],
                    },
                    ensure_ascii=False,
                )
            )
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        fixture.shutdown()
        fixture.server_close()


if __name__ == "__main__":
    main()
