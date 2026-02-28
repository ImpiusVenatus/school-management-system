"""Common schemas (IDs, pagination)."""
from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar("T")


class Message(BaseModel):
    message: str


class Paginated(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int
