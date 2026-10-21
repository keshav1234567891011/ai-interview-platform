"""Container/Render startup. Development continues through the root launcher."""

import os

import uvicorn


def main():
    try:
        port = int(os.environ.get("PORT", "8000"))
        if not 1 <= port <= 65535:
            raise ValueError()
    except ValueError:
        raise SystemExit("PORT must be a valid TCP port") from None
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, access_log=False, proxy_headers=False)


if __name__ == "__main__":
    main()
