from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]


def test_compose_only_runs_application_and_preserves_data():
    configuration = yaml.safe_load((ROOT / "compose.yaml").read_text(encoding="utf-8"))
    assert set(configuration["services"]) == {"frontend", "backend"}
    backend = configuration["services"]["backend"]
    assert "ports" not in backend
    assert backend["environment"]["DATABASE_URL"].startswith("${DATABASE_URL:?")
    assert backend["environment"]["JWT_SECRET"].startswith("${JWT_SECRET:?")
    assert backend["volumes"] == ["resume_data:/app/backend/runtime/uploads"]
    frontend = configuration["services"]["frontend"]
    assert frontend["ports"] == ["127.0.0.1:3000:3000"]
    for service in configuration["services"].values():
        assert service["build"]["context"] == "."


def test_ci_runs_mocked_checks_without_deployment():
    workflow = yaml.load(
        (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8"), Loader=yaml.BaseLoader
    )
    assert set(workflow["on"]) == {"push", "pull_request"}
    assert workflow["permissions"] == {"contents": "read"}
    assert set(workflow["jobs"]) == {"frontend", "backend", "containers"}
    commands = "\n".join(
        step.get("run", "") for job in workflow["jobs"].values() for step in job["steps"]
    )
    for required in [
        "run lint",
        "run typecheck",
        "run build",
        "run test:e2e",
        "pytest",
        "ruff",
        "migration_check",
        "docker build",
    ]:
        assert required in commands
    assert "test:live" not in commands and "docker push" not in commands


def test_root_container_context_excludes_private_and_runtime_files():
    ignored = (ROOT / ".dockerignore").read_text(encoding="utf-8").splitlines()
    for required in [
        ".git",
        ".local",
        "**/.env",
        "**/.env.*",
        "**/node_modules",
        "**/.venv",
        "**/runtime",
        "**/test-results",
        "**/live-test-results",
    ]:
        assert required in ignored
    for directory in ["frontend", "backend"]:
        dockerfile = (ROOT / directory / "Dockerfile").read_text(encoding="utf-8")
        assert dockerfile.count("FROM ") >= 2
        assert "USER " in dockerfile and "HEALTHCHECK" in dockerfile
        assert "COPY . " not in dockerfile
        copies = [line for line in dockerfile.splitlines() if line.lstrip().startswith("COPY ")]
        assert all(".env" not in line for line in copies)


def test_hosting_preparation_has_no_automatic_deployment_or_credentials():
    import json

    blueprint = yaml.safe_load((ROOT / "render.yaml").read_text(encoding="utf-8"))
    assert "databases" not in blueprint
    service = blueprint["services"][0]
    assert service["autoDeployTrigger"] == "off" and service["plan"] == "free"
    assert service["healthCheckPath"] == "/ready"
    assert service["dockerContext"] == "." and service["dockerfilePath"] == "./backend/Dockerfile"
    environments = {item["key"]: item for item in service["envVars"]}
    for name in [
        "DATABASE_URL",
        "MIGRATION_DATABASE_URL",
        "JWT_SECRET",
        "SETTINGS_ENCRYPTION_KEY",
        "S3_SECRET_ACCESS_KEY",
    ]:
        assert environments[name] == {"key": name, "sync": False}
    frontend = json.loads((ROOT / "frontend/vercel.json").read_text(encoding="utf-8"))
    assert frontend["framework"] == "nextjs" and frontend["buildCommand"] == "npm run build"
