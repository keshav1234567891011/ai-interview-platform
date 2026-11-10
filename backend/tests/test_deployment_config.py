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
    assert frontend["git"]["deploymentEnabled"] is False


def test_verified_gemini_model_and_bounded_timeout_are_prepared_for_render():
    configuration = yaml.safe_load((ROOT / "render.yaml").read_text(encoding="utf-8"))
    env = {item["key"]: item for item in configuration["services"][0]["envVars"]}
    assert env["GEMINI_MODEL"]["value"] == "gemini-3.1-flash-lite"
    assert env["GEMINI_API_KEY"] == {"key": "GEMINI_API_KEY", "sync": False}
    assert int(env["AI_TIMEOUT_SECONDS"]["value"]) == 30


def test_production_rejects_local_database_without_disclosing_credentials():
    import pytest
    from pydantic import ValidationError

    from app.core.config import Settings

    for field in ("database_url", "migration_database_url"):
        for host in (
            "127.0.0.1",
            "127.2.3.4",
            "localhost",
            "[::1]",
            "0.0.0.0",
            "host.docker.internal",
            "db.localhost",
        ):
            url = f"postgresql+psycopg://user:synthetic-private-value@{host}:55432/development"
            with pytest.raises(ValidationError) as exc:
                Settings(_env_file=None, app_env="production", **{field: url})
            assert "synthetic-private-value" not in str(exc.value)
        with pytest.raises(ValidationError):
            Settings(
                _env_file=None,
                app_env="production",
                **{field: "postgresql+psycopg:///development"},
            )
    settings = Settings(
        _env_file=None,
        app_env="development",
        database_url="postgresql+psycopg://user:synthetic@127.0.0.1:55432/development",
    )
    assert settings.database_url
    Settings(
        _env_file=None,
        app_env="production",
        database_url="postgresql+psycopg://user:synthetic@db.example.test/production?sslmode=require",
    )


def test_offline_production_check_validates_hosting_without_network():
    from cryptography.fernet import Fernet

    from app.core.config import Settings
    from app.release_check import blockers

    def check(settings):
        return blockers(settings, require_ai=True, verify_topology=True, verify_crypto=True)

    settings = Settings(
        _env_file=None,
        app_env="production",
        database_url="postgresql+psycopg://user:synthetic@ep-example-pooler.neon.tech/app?sslmode=require",
        migration_database_url="postgresql+psycopg://user:synthetic@ep-example.neon.tech/app?sslmode=require",
        jwt_secret="synthetic-production-signing-value-for-tests",
        settings_encryption_key=Fernet.generate_key().decode(),
        gemini_api_key="synthetic-gemini-test-key",
        gemini_model="gemini-3.1-flash-lite",
        frontend_origins=["https://ai-interview-platform-one-mu.vercel.app"],
        storage_backend="s3",
        s3_bucket="synthetic-private-bucket",
        s3_endpoint_url="https://example.storage.supabase.co/storage/v1/s3",
        s3_access_key_id="synthetic-access",
        s3_secret_access_key="synthetic-secret",
    )
    assert check(settings) == []
    invalid = settings.model_copy(update={"database_url": None, "storage_backend": "local"})
    assert "DATABASE_URL" in check(invalid)
    assert "durable private S3 storage configuration" in check(invalid)


def test_release_guard_catches_example_credentials_without_printing_them():
    import importlib.util
    import secrets

    spec = importlib.util.spec_from_file_location(
        "release_check", ROOT / "scripts/check_release.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    credential = secrets.token_urlsafe(32)
    issues = module.issues_for("backend/.env.example", "GEMINI_API_KEY=" + credential)
    assert issues and all(credential not in issue for issue in issues)
    assert (
        module.issues_for(
            "backend/.env.example", "GEMINI_API_KEY=\nGEMINI_MODEL=gemini-3.1-flash-lite\n"
        )
        == []
    )
    assert module.issues_for("backend/.env", "")
    assert (
        module.issues_for(
            "backend/.env.example",
            "DATABASE_URL=postgresql+psycopg://USERNAME:PASSWORD@localhost/app",
        )
        == []
    )
