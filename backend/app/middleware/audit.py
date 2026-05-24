"""Log mutating API requests to the audit trail."""
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.database import SessionLocal
from app.services.audit import record_request_audit, resolve_user_from_request, should_audit_request

logger = logging.getLogger(__name__)


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if not should_audit_request(request.method.upper(), request.url.path):
            return await call_next(request)

        response = await call_next(request)
        db = SessionLocal()
        try:
            user = resolve_user_from_request(db, request)
            path = request.url.path
            method = request.method.upper()
            status = response.status_code

            # Login is logged in auth.py (needs email on failure)
            if path.rstrip("/").endswith("/auth/login"):
                pass
            elif path.rstrip("/").endswith("/auth/logout"):
                from app.services.audit import record_audit

                record_audit(
                    db,
                    action="auth.logout",
                    category="auth",
                    user=user,
                    resource_label="Sign out",
                    http_method=method,
                    path=path,
                    status_code=status,
                    ip_address=_client_ip(request),
                    user_agent=request.headers.get("user-agent"),
                )
            else:
                record_request_audit(db, request, status_code=status, user=user)
        except Exception:
            logger.exception("Failed to write audit log")
            db.rollback()
        finally:
            db.close()
        return response


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None
