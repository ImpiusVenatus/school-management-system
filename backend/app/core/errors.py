"""API error envelope + FastAPI exception handlers."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)


def error_response(
    *,
    status_code: int,
    code: str,
    message: str,
    details: Any | None = None,
) -> JSONResponse:
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details is not None:
        payload["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=payload)


async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    return error_response(
        status_code=exc.status_code,
        code="http_error",
        message=str(exc.detail) if exc.detail is not None else "Request failed",
    )


async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return error_response(
        status_code=422,
        code="validation_error",
        message="Invalid request",
        details=exc.errors(),
    )


async def integrity_exception_handler(_request: Request, exc: IntegrityError) -> JSONResponse:
    logger.info("DB integrity error: %s", exc, exc_info=True)
    return error_response(
        status_code=409,
        code="db_integrity_error",
        message="Request conflicted with existing data",
    )


async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error: %s", exc, exc_info=True)
    return error_response(status_code=500, code="internal_error", message="Internal server error")

