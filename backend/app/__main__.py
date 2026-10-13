"""`python -m app` - run the API (and the built frontend, if present)."""

import argparse

import uvicorn

from .config import HOST, PORT


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Job Hunt Tracker server.")
    parser.add_argument("--reload", action="store_true", help="auto-reload on code changes (dev)")
    parser.add_argument("--port", type=int, default=PORT)
    args = parser.parse_args()
    # HOST is hard-coded to 127.0.0.1: this app has no auth and holds personal data.
    uvicorn.run("app.main:create_app", factory=True, host=HOST, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
