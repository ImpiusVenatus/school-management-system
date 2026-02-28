"""Abstract storage backend; local implementation. Swap for S3 etc. later."""
import os
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO


class StorageBackend(ABC):
    @abstractmethod
    def save(self, file: BinaryIO, path: str) -> str:
        """Save file to path; return final path or key."""
        pass

    @abstractmethod
    def get_path(self, path: str) -> Path | None:
        """Return local Path if available (for streaming)."""
        pass

    @abstractmethod
    def delete(self, path: str) -> bool:
        """Remove file; return True if deleted."""
        pass

    def get_url(self, path: str, base_url: str = "") -> str:
        """Return URL to access file (e.g. /api/files/download/<id> or signed URL)."""
        return f"{base_url.rstrip('/')}/api/files/serve/{path}" if base_url else f"/api/files/serve/{path}"


class LocalStorageBackend(StorageBackend):
    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, file: BinaryIO, path: str) -> str:
        full = self.root / path
        full.parent.mkdir(parents=True, exist_ok=True)
        with open(full, "wb") as f:
            while chunk := file.read(64 * 1024):
                f.write(chunk)
        return path

    def get_path(self, path: str) -> Path | None:
        full = self.root / path
        return full if full.is_file() else None

    def delete(self, path: str) -> bool:
        full = self.root / path
        if full.is_file():
            full.unlink()
            return True
        return False


def get_storage() -> StorageBackend:
    from app.config import get_settings
    root = get_settings().STORAGE_PATH
    return LocalStorageBackend(root)


def unique_filename(original: str) -> str:
    ext = Path(original).suffix or ""
    return f"{uuid.uuid4().hex}{ext}"
