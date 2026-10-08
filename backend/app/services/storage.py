import re
from pathlib import Path
from typing import Protocol
from uuid import uuid4

from app.core.config import BACKEND_ROOT, get_settings


class ResumeStorage(Protocol):
    def save(self, data: bytes, extension: str) -> str: ...
    def delete(self, key: str) -> None: ...


class LocalResumeStorage:
    def __init__(self, directory: Path | None = None):
        self.directory = directory or BACKEND_ROOT / get_settings().storage_directory
        if not self.directory.resolve().is_relative_to(BACKEND_ROOT.parent):
            raise ValueError("Storage must remain inside the repository")

    def location(self, key: str) -> Path:
        if not re.fullmatch(r"[a-f0-9]{32}\.(pdf|docx)", key):
            raise ValueError("Invalid storage key")
        path = (self.directory / key).resolve()
        if not path.is_relative_to(self.directory.resolve()):
            raise ValueError("Invalid storage key")
        return path

    def save(self, data: bytes, extension: str) -> str:
        if extension not in {"pdf", "docx"}:
            raise ValueError("Invalid extension")
        self.directory.mkdir(parents=True, exist_ok=True)
        key = f"{uuid4().hex}.{extension}"
        self.location(key).write_bytes(data)
        return key

    def delete(self, key: str) -> None:
        self.location(key).unlink(missing_ok=True)


def get_storage() -> ResumeStorage:
    return LocalResumeStorage()
