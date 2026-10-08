"""Start both development servers and stop their process groups together."""

import errno
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from config import settings


def check_port(host: str, port: int) -> None:
    try:
        with socket.socket() as connection:
            connection.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            connection.bind((host, port))
    except OSError as error:
        if error.errno == errno.EADDRINUSE:
            raise RuntimeError(f"端口 {port} 已被占用。请调整端口后重试。") from error
        raise RuntimeError(f"无法监听端口 {port}：{error}") from error


def main() -> int:
    npm = shutil.which("npm")
    if not npm:
        print("找不到 npm，请安装 Node.js。", file=sys.stderr)
        return 1

    frontend_port = int(os.getenv("STUDIO_PORT", "3000"))
    backend_port = int(settings.PORT)
    backend_host = settings.HOST
    frontend_host = "127.0.0.1"
    api_host = "127.0.0.1" if backend_host == "0.0.0.0" else backend_host
    if frontend_port == backend_port:
        print("前后端需要使用不同端口。", file=sys.stderr)
        return 1
    try:
        check_port(backend_host, backend_port)
        check_port(frontend_host, frontend_port)
    except RuntimeError as error:
        print(error, file=sys.stderr)
        return 1

    api_url = f"http://{api_host}:{backend_port}"
    site_url = f"http://{frontend_host}:{frontend_port}"
    environment = os.environ.copy()
    environment["BACKEND_API_URL"] = api_url
    environment["NEXT_PUBLIC_API_URL"] = ""
    environment["NEXT_TELEMETRY_DISABLED"] = "1"
    extra_origins = environment.get("XYQ_CORS_ORIGINS", "")
    environment["XYQ_CORS_ORIGINS"] = ",".join(
        filter(None, [extra_origins, site_url, f"http://localhost:{frontend_port}"])
    )
    processes = []

    def request_stop(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)

    try:
        processes.append(subprocess.Popen(
            [sys.executable, "api_server.py"],
            cwd=ROOT / "backend", env=environment, start_new_session=True,
        ))
        processes.append(subprocess.Popen(
            [npm, "run", "dev", "--", "--hostname", frontend_host, "--port", str(frontend_port)],
            cwd=ROOT / "frontend", env=environment, start_new_session=True,
        ))
        print(f"\n{settings.PROJECT_NAME} 启动中", flush=True)
        print(f"网页：{site_url}\n后端：{api_url}\n按 Ctrl+C 停止两个服务。\n", flush=True)
        if not shutil.which("ffmpeg"):
            print("提示：拼接成片需要先安装 FFmpeg。\n", flush=True)
        while all(process.poll() is None for process in processes):
            time.sleep(0.5)
        return next((process.returncode or 0 for process in processes if process.poll() is not None), 1)
    except KeyboardInterrupt:
        return 0
    finally:
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        for process in processes:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait()


if __name__ == "__main__":
    sys.exit(main())
