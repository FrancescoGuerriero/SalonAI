from hmac import compare_digest
from typing import Annotated

from fastapi import Header, HTTPException, Request, status


async def require_service_key(
    request: Request,
    x_salonai_service_key: Annotated[str | None, Header()] = None,
) -> None:
    """Authenticate server-to-server calls from the Express backend."""

    supplied = str(x_salonai_service_key or "")
    expected = str(request.app.state.settings.service_key)

    if not supplied or not compare_digest(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_SERVICE_KEY",
                "message": "A valid SalonAI service key is required.",
            },
        )
