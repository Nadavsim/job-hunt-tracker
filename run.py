"""One-command helper that works the same on Windows PowerShell, macOS and Linux.

    python run.py setup   # create backend/.venv, install Python + npm dependencies
    python run.py dev     # API on :8000 (auto-reload) + Vite UI on :5173
    python run.py start   # build the UI, then serve everything from :8000
    python run.py test    # backend (pytest) + frontend (vitest) test suites

Uses only the standard library so it runs before anything is installed.
"""

import os
import shutil
import subprocess
import sys
import venv
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / ".venv"


def venv_python() -> str:
    exe = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not exe.exists():
        sys.exit("backend/.venv not found - run `python run.py setup` first.")
    return str(exe)


def npm() -> str:
    exe = shutil.which("npm")  # resolves npm.cmd on Windows
    if exe is None:
        sys.exit("npm not found - install Node.js 20+ from https://nodejs.org/")
    return exe


def run(cmd: list[str], cwd: Path) -> None:
    print(f"$ {' '.join(cmd)}  (in {cwd.name}/)", flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def setup() -> None:
    if not VENV.exists():
        print("Creating backend/.venv ...")
        venv.create(VENV, with_pip=True)
    run([venv_python(), "-m", "pip", "install", "-r", "requirements-dev.txt"], BACKEND)
    run([npm(), "install"], FRONTEND)
    print("\nSetup done. Next: python run.py dev")


def dev() -> None:
    api = subprocess.Popen([venv_python(), "-m", "app", "--reload"], cwd=BACKEND)
    ui = subprocess.Popen([npm(), "run", "dev"], cwd=FRONTEND)
    print("\nAPI: http://127.0.0.1:8000/api   UI: http://127.0.0.1:5173   (Ctrl+C stops both)\n", flush=True)
    try:
        while api.poll() is None and ui.poll() is None:
            try:
                api.wait(timeout=0.5)
            except subprocess.TimeoutExpired:
                pass
    except KeyboardInterrupt:
        pass
    finally:
        for proc in (api, ui):
            if proc.poll() is None:
                proc.terminate()


def start() -> None:
    run([npm(), "run", "build"], FRONTEND)
    print("\nOpen http://127.0.0.1:8000  (Ctrl+C to stop)\n", flush=True)
    try:
        run([venv_python(), "-m", "app"], BACKEND)
    except KeyboardInterrupt:
        pass


def test() -> None:
    run([venv_python(), "-m", "pytest"], BACKEND)
    run([npm(), "test"], FRONTEND)


COMMANDS = {"setup": setup, "dev": dev, "start": start, "test": test}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        sys.exit(2)
    try:
        COMMANDS[sys.argv[1]]()
    except subprocess.CalledProcessError as exc:
        sys.exit(exc.returncode)
