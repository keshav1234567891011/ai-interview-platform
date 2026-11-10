"""Offline source guard. Reports file/key names only, never matched credentials."""

import re
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SECRET_ASSIGNMENT = re.compile(
    r"^(GEMINI_API_KEY|OPENAI_API_KEY|JWT_SECRET|SETTINGS_ENCRYPTION_KEY|"
    r"OWNER_BOOTSTRAP_PASSWORD|S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|S3_SESSION_TOKEN)[ \t]*=[ \t]*(.*)$",
    re.MULTILINE,
)
DATABASE_URL = re.compile(r"postgres(?:ql)?(?:\+psycopg)?://[^\s\x27\x22<>]+")


def issues_for(name: str, content: str) -> list[str]:
    issues = []
    path = Path(name)
    if path.name.startswith(".env") and not path.name.endswith(".example"):
        issues.append("private environment file must not be published")
    for match in SECRET_ASSIGNMENT.finditer(content):
        value = match[2].strip().strip("\"'")
        if value and not value.startswith(("REPLACE_", "YOUR_", "<")):
            issues.append(f"{match[1]} must be empty or a placeholder")
    if re.search(r"AIza[0-9A-Za-z_-]{35}", content):
        issues.append("Google API credential pattern")
    if re.search(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", content):
        issues.append("private key material")
    for match in DATABASE_URL.finditer(content):
        try:
            password = unquote(urlsplit(match[0]).password or "")
        except ValueError:
            continue
        placeholder = password.upper() in {"PASSWORD", "PASS", "CHANGE_ME"} or any(
            text in password.upper()
            for text in ("REPLACE_", "YOUR_", "EXAMPLE", "ENCODED")
        )
        fixture = "tests/" in name.replace("\\", "/") and password.startswith(
            "synthetic"
        )
        if password and not placeholder and not fixture:
            issues.append("database URL must not contain a credential")
    return sorted(set(issues))


def main():
    files = (
        subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
            cwd=ROOT,
        )
        .decode()
        .split("\0")
    )
    problems = []
    for name in sorted(set(files) - {""}):
        path = ROOT / name
        if path.is_file():
            problems.extend(
                (name, issue)
                for issue in issues_for(
                    name, path.read_text(encoding="utf-8", errors="ignore")
                )
            )
    if problems:
        for name, issue in problems:
            print(f"{name}: {issue}")
        raise SystemExit(1)
    print(
        "Release source guard passed: no private environment files or credential patterns found."
    )


if __name__ == "__main__":
    main()
