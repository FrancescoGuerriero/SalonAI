from __future__ import annotations

import logging

from datetime import date, datetime
from typing import Any

from fastapi import (
    FastAPI,
    HTTPException,
    Request,
)
from fastapi.exceptions import (
    RequestValidationError,
)
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import (
    Settings,
    get_settings,
)
from app.core.tracing import (
    TracingMiddleware,
    configure_tracing_logging,
)
from app.middleware.request_id import (
    RequestIdMiddleware,
)


def _json_safe(
    value: Any,
) -> Any:
    """
    Convert exception and validation metadata
    into values that JSONResponse can serialise.
    """

    if value is None or isinstance(
        value,
        (
            str,
            int,
            float,
            bool,
        ),
    ):
        return value

    if isinstance(
        value,
        (
            date,
            datetime,
        ),
    ):
        return value.isoformat()

    if isinstance(
        value,
        BaseException,
    ):
        return str(value)

    if isinstance(
        value,
        dict,
    ):
        return {
            str(key): _json_safe(item)
            for key, item in value.items()
        }

    if isinstance(
        value,
        (
            list,
            tuple,
            set,
        ),
    ):
        return [
            _json_safe(item)
            for item in value
        ]

    return str(value)


def _normalise_validation_errors(
    error: RequestValidationError,
) -> list[dict[str, Any]]:
    """
    Return concise, JSON-safe validation errors.

    The full input payload is deliberately not
    echoed back because forecasting requests may
    contain hundreds of observations.
    """

    details: list[
        dict[str, Any]
    ] = []

    for item in error.errors():
        detail: dict[str, Any] = {
            "type": str(
                item.get(
                    "type",
                    "validation_error",
                )
            ),
            "loc": [
                str(value)
                for value
                in item.get(
                    "loc",
                    [],
                )
            ],
            "msg": str(
                item.get(
                    "msg",
                    "Invalid request value.",
                )
            ),
        }

        context = item.get("ctx")

        if context:
            detail["ctx"] = (
                _json_safe(context)
            )

        details.append(detail)

    return details


def _default_http_error_code(
    status_code: int,
) -> str:
    return {
        400: "BAD_REQUEST",
        401: "UNAUTHORISED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        413: "PAYLOAD_TOO_LARGE",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
        500: "INTERNAL_SERVER_ERROR",
        502: "UPSTREAM_SERVICE_ERROR",
        503: "SERVICE_UNAVAILABLE",
        504: "UPSTREAM_TIMEOUT",
    }.get(
        status_code,
        "HTTP_ERROR",
    )


def create_app(
    settings: Settings | None = None,
) -> FastAPI:
    """
    Create a configured FastAPI application.

    Tests pass dedicated Settings instances so
    the test service key and mock provider can
    be isolated from the development environment.
    """

    runtime_settings = (
        settings
        or get_settings()
    )

    logging.basicConfig(
        level=getattr(
            logging,
            runtime_settings.log_level,
        ),
        format=(
            "%(asctime)s "
            "%(levelname)s "
            "%(name)s "
            "trace_id=%(trace_id)s "
            "span_id=%(span_id)s "
            "%(message)s"
        ),
    )

    configure_tracing_logging()

    application = FastAPI(
        title=
            runtime_settings.app_name,

        version=
            runtime_settings.app_version,

        docs_url=(
            "/docs"
            if (
                runtime_settings.environment
                != "production"
            )
            else None
        ),

        redoc_url=None,
    )

    application.state.settings = (
        runtime_settings
    )

    application.add_middleware(
        RequestIdMiddleware
    )

    # Added after RequestIdMiddleware so tracing is the
    # outermost ASGI middleware and covers every route.
    application.add_middleware(
        TracingMiddleware
    )

    application.include_router(
        api_router
    )

    @application.exception_handler(
        HTTPException
    )
    async def http_exception_handler(
        request: Request,
        error: HTTPException,
    ) -> JSONResponse:
        """
        Return a consistent SalonAI error envelope.

        The nested detail object is retained for
        compatibility with earlier Phase 4 tests,
        while code and message are also exposed
        at the top level for newer endpoints.
        """

        raw_detail = error.detail

        if isinstance(
            raw_detail,
            dict,
        ):
            code = str(
                raw_detail.get(
                    "code",
                    _default_http_error_code(
                        error.status_code
                    ),
                )
            )

            message = str(
                raw_detail.get(
                    "message",
                    raw_detail.get(
                        "detail",
                        (
                            "The request could "
                            "not be completed."
                        ),
                    ),
                )
            )

            nested_detail = (
                _json_safe(
                    raw_detail
                )
            )
        else:
            code = (
                _default_http_error_code(
                    error.status_code
                )
            )

            message = str(
                raw_detail
                or (
                    "The request could not "
                    "be completed."
                )
            )

            nested_detail = {
                "code": code,
                "message": message,
            }

        content = {
            "success": False,
            "code": code,
            "message": message,
            "detail": nested_detail,
            "requestId": getattr(
                request.state,
                "request_id",
                None,
            ),
        }

        return JSONResponse(
            status_code=
                error.status_code,

            content=content,

            headers=
                error.headers,
        )

    @application.exception_handler(
        RequestValidationError
    )
    async def validation_error_handler(
        request: Request,
        error: RequestValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,

            content={
                "success": False,

                "code":
                    "VALIDATION_ERROR",

                "message": (
                    "The AI request contains "
                    "invalid or missing fields."
                ),

                "details":
                    _normalise_validation_errors(
                        error
                    ),

                "requestId": getattr(
                    request.state,
                    "request_id",
                    None,
                ),
            },
        )

    @application.exception_handler(
        Exception
    )
    async def unexpected_error_handler(
        request: Request,
        error: Exception,
    ) -> JSONResponse:
        content: dict[
            str,
            Any,
        ] = {
            "success": False,

            "code":
                "INTERNAL_SERVER_ERROR",

            "message": (
                "The AI service encountered "
                "an unexpected error."
            ),

            "requestId": getattr(
                request.state,
                "request_id",
                None,
            ),
        }

        if (
            runtime_settings.environment
            == "development"
        ):
            content[
                "developmentDetail"
            ] = str(error)

        return JSONResponse(
            status_code=500,
            content=content,
        )

    @application.get(
        "/",
        include_in_schema=False,
    )
    async def root() -> dict[
        str,
        Any,
    ]:
        return {
            "service":
                runtime_settings.app_name,

            "version":
                runtime_settings.app_version,

            "health":
                "/health",

            "documentation": (
                "/docs"
                if (
                    runtime_settings
                    .environment
                    != "production"
                )
                else None
            ),
        }

    return application


app = create_app()