"""Smoke-test owned local containers, with no production environment or AI requests."""

import argparse
import json
import subprocess
import time
import uuid
from urllib.error import HTTPError
from urllib.request import ProxyHandler, build_opener


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


def remove_owned(kind, name, label, run_id):
    probe = subprocess.run(
        ["docker", kind, "inspect", name], capture_output=True, text=True, check=False
    )
    if probe.returncode:
        return
    info = json.loads(probe.stdout)[0]
    labels = (
        info.get("Config", {}).get("Labels", {})
        if kind == "container"
        else info.get("Labels", {})
    )
    if labels.get(label) != run_id:
        raise RuntimeError("Container cleanup ownership verification failed")
    docker(kind, "rm", *(["--force"] if kind == "container" else []), info["Id"])


# Only the disposable test process receives this route. The application source is unchanged.
BACKEND_SCRIPT = """
import asyncio
import uvicorn
from app.main import app
async def delayed():
    await asyncio.sleep(31)
    return {"synthetic_proxy_check": True}
app.add_api_route('/api/release-proxy-check', delayed, methods=['GET'])
uvicorn.run(app, host='0.0.0.0', port=8000, access_log=False)
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-image", default="interviewai-backend:ci")
    parser.add_argument("--frontend-image", default="interviewai-frontend:ci")
    args = parser.parse_args()
    run_id = uuid.uuid4().hex[:12]
    label = "interviewai.release-check"
    network = "interviewai-release-" + run_id
    names = [network + "-backend", network + "-frontend"]
    opener = build_opener(ProxyHandler({}))

    def request(url, timeout=70):
        try:
            response = opener.open(url, timeout=timeout)
        except HTTPError as response:
            return response.code, response.read()
        with response:
            return response.status, response.read()

    try:
        docker("network", "create", "--label", label + "=" + run_id, network)
        docker(
            "run",
            "--detach",
            "--name",
            names[0],
            "--label",
            label + "=" + run_id,
            "--network",
            network,
            "--network-alias",
            "backend",
            "-p",
            "127.0.0.1:18000:8000",
            "-e",
            "APP_ENV=test",
            "-e",
            "GEMINI_API_KEY=",
            args.backend_image,
            "python",
            "-c",
            BACKEND_SCRIPT,
        )
        docker(
            "run",
            "--detach",
            "--name",
            names[1],
            "--label",
            label + "=" + run_id,
            "--network",
            network,
            "-p",
            "127.0.0.1:13000:3000",
            args.frontend_image,
        )
        for _ in range(30):
            try:
                if (
                    request("http://127.0.0.1:18000/health", 2)[0] == 200
                    and request("http://127.0.0.1:13000", 2)[0] == 200
                ):
                    break
            except OSError:
                pass
            time.sleep(1)
        else:
            raise RuntimeError("Owned container startup failed")
        assert request("http://127.0.0.1:18000/ready")[0] == 503
        assert request("http://127.0.0.1:13000/api/auth/me")[0] == 401
        started = time.monotonic()
        status, body = request("http://127.0.0.1:13000/api/release-proxy-check")
        elapsed = round(time.monotonic() - started, 2)
        assert status == 200 and json.loads(body) == {"synthetic_proxy_check": True}
        assert elapsed >= 30
        docker("exec", names[0], "python", "-c", "import os; assert os.getuid() != 0")
        docker(
            "exec", names[1], "node", "-e", "if(process.getuid()===0)process.exit(1)"
        )
        docker("exec", names[0], "python", "-m", "pip", "check")
        print(
            json.dumps(
                {
                    "backend_health": 200,
                    "frontend_home": 200,
                    "missing_database_readiness": 503,
                    "proxy_auth": 401,
                    "delayed_proxy": status,
                    "delayed_seconds": elapsed,
                    "nonroot_both": True,
                    "live_gemini_requests": 0,
                }
            )
        )
    finally:
        for name in reversed(names):
            remove_owned("container", name, label, run_id)
        remove_owned("network", network, label, run_id)


if __name__ == "__main__":
    main()
