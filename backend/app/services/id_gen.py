"""Simple ID generation (can be replaced with naming series later)."""
import uuid
from datetime import datetime


def new_id(prefix: str = "") -> str:
    """Generate a unique id; optional prefix e.g. EDU-STU."""
    short = uuid.uuid4().hex[:12]
    if prefix:
        return f"{prefix}-{short}"
    return short


def student_name(first: str, middle: str | None, last: str | None) -> str:
    parts = [p for p in (first, middle, last) if p]
    return " ".join(parts) if parts else first
