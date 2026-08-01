from __future__ import annotations

import atexit
import contextvars
import json
import logging
import os
import queue
import random
import secrets
import sys
import threading
import time
import urllib.error
import urllib.request

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, MutableMapping


_TRACEPARENT_PATTERN_LENGTH = 55
_DEFAULT_EXPORT_ENDPOINT = "http://127.0.0.1:4318/v1/traces"
_DEFAULT_EXPORT_TIMEOUT_SECONDS = 5.0
_MAX_QUEUE_SIZE = 2048
_MAX_BATCH_SIZE = 128
_EXPORT_INTERVAL_SECONDS = 1.0


@dataclass
class _Span:
    name: str
    kind: int
    trace_id: str
    span_id: str
    parent_span_id: str | None
    sampled: bool
    started_at_unix_nano: int
    attributes: dict[str, Any] = field(default_factory=dict)
    ended_at_unix_nano: int | None = None
    status_code: int = 0
    status_message: str = ""
    ended: bool = False


_active_span: contextvars.ContextVar[_Span | None] = (
    contextvars.ContextVar(
        "salonai_active_trace_span",
        default=None,
    )
)

_completed_spans: queue.Queue[_Span] = queue.Queue(
    maxsize=_MAX_QUEUE_SIZE
)

_exporter_thread: threading.Thread | None = None
_exporter_stop_event = threading.Event()
_exporter_lock = threading.Lock()
_last_export_warning_at = 0.0


def _read_boolean_environment_value(
    name: str,
    fallback: bool = True,
) -> bool:
    value = os.getenv(name, "").strip().lower()

    if not value:
        return fallback

    if value in {
        "false",
        "0",
        "no",
        "off",
        "disabled",
    }:
        return False

    if value in {
        "true",
        "1",
        "yes",
        "on",
        "enabled",
    }:
        return True

    return fallback


def _read_sample_ratio() -> float:
    try:
        value = float(
            os.getenv(
                "OTEL_TRACES_SAMPLER_ARG",
                "1",
            )
        )
    except (TypeError, ValueError):
        return 1.0

    return min(1.0, max(0.0, value))


def _read_export_timeout_seconds() -> float:
    try:
        milliseconds = int(
            os.getenv(
                "TRACE_EXPORT_TIMEOUT_MS",
                "5000",
            )
        )
    except (TypeError, ValueError):
        milliseconds = 5000

    milliseconds = min(
        30000,
        max(500, milliseconds),
    )

    return milliseconds / 1000


_TRACING_ENABLED = _read_boolean_environment_value(
    "TRACING_ENABLED",
    True,
)

_EXPORT_ENDPOINT = os.getenv(
    "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
    _DEFAULT_EXPORT_ENDPOINT,
).strip()

_EXPORT_TIMEOUT_SECONDS = _read_export_timeout_seconds()
_SAMPLE_RATIO = _read_sample_ratio()


def _normalise_attribute_value(
    value: Any,
) -> str | bool | int | float | list[Any] | None:
    if value is None:
        return None

    if isinstance(value, (str, bool, int, float)):
        return value

    if isinstance(value, (list, tuple)):
        values = list(value)

        if all(
            isinstance(
                item,
                (str, bool, int, float),
            )
            for item in values
        ):
            return values

    return str(value)


def _parse_resource_attributes() -> dict[str, Any]:
    attributes: dict[str, Any] = {
        "service.name": os.getenv(
            "OTEL_SERVICE_NAME",
            "salonai-ai-service",
        ),
        "service.namespace": "salonai",
        "deployment.environment.name": os.getenv(
            "ENVIRONMENT",
            os.getenv("NODE_ENV", "development"),
        ),
        "service.version": os.getenv(
            "APP_VERSION",
            "unknown",
        ),
    }

    configured = os.getenv(
        "OTEL_RESOURCE_ATTRIBUTES",
        "",
    ).strip()

    if not configured:
        return attributes

    for entry in configured.split(","):
        key, separator, value = entry.partition("=")

        if not separator:
            continue

        key = key.strip()
        value = value.strip()

        if key and value:
            attributes[key] = value

    return attributes


_RESOURCE_ATTRIBUTES = _parse_resource_attributes()


def _is_valid_hex_identifier(
    value: str,
    length: int,
) -> bool:
    if len(value) != length:
        return False

    if set(value) == {"0"}:
        return False

    try:
        int(value, 16)
    except ValueError:
        return False

    return True


def _new_trace_id() -> str:
    trace_id = secrets.token_hex(16)

    while set(trace_id) == {"0"}:
        trace_id = secrets.token_hex(16)

    return trace_id


def _new_span_id() -> str:
    span_id = secrets.token_hex(8)

    while set(span_id) == {"0"}:
        span_id = secrets.token_hex(8)

    return span_id


def _parse_traceparent(
    value: str | None,
) -> tuple[str, str, bool] | None:
    candidate = (value or "").strip().lower()

    if len(candidate) < _TRACEPARENT_PATTERN_LENGTH:
        return None

    parts = candidate.split("-")

    if len(parts) < 4:
        return None

    version, trace_id, parent_span_id, flags = parts[:4]

    if (
        version == "ff"
        or len(version) != 2
        or len(flags) != 2
        or not _is_valid_hex_identifier(trace_id, 32)
        or not _is_valid_hex_identifier(parent_span_id, 16)
    ):
        return None

    try:
        sampled = bool(int(flags, 16) & 1)
    except ValueError:
        return None

    return trace_id, parent_span_id, sampled


def _format_traceparent(span: _Span) -> str:
    flags = "01" if span.sampled else "00"

    return (
        f"00-{span.trace_id}-"
        f"{span.span_id}-{flags}"
    )


def _should_sample_root_span() -> bool:
    if _SAMPLE_RATIO <= 0:
        return False

    if _SAMPLE_RATIO >= 1:
        return True

    return random.random() < _SAMPLE_RATIO


def _set_span_attribute(
    span: _Span,
    key: str,
    value: Any,
) -> None:
    if span.ended:
        return

    normalised = _normalise_attribute_value(value)

    if normalised is not None:
        span.attributes[str(key)] = normalised


def _finish_span(
    span: _Span,
    *,
    status_code: int | None = None,
    error: BaseException | None = None,
    aborted: bool = False,
) -> None:
    if span.ended:
        return

    span.ended_at_unix_nano = time.time_ns()

    if status_code is not None:
        _set_span_attribute(
            span,
            "http.response.status_code",
            int(status_code),
        )

    if aborted:
        _set_span_attribute(
            span,
            "salonai.request_aborted",
            True,
        )

    if error is not None:
        span.status_code = 2
        span.status_message = str(error)

        _set_span_attribute(
            span,
            "error.type",
            error.__class__.__name__,
        )

        _set_span_attribute(
            span,
            "error.message",
            str(error),
        )
    elif status_code is not None and status_code >= 500:
        span.status_code = 2
        span.status_message = f"HTTP {status_code}"
    else:
        span.status_code = 1

    span.ended = True

    if span.sampled:
        _enqueue_span(span)


def _to_otlp_any_value(value: Any) -> dict[str, Any]:
    if isinstance(value, bool):
        return {"boolValue": value}

    if isinstance(value, int):
        return {"intValue": str(value)}

    if isinstance(value, float):
        return {"doubleValue": value}

    if isinstance(value, (list, tuple)):
        return {
            "arrayValue": {
                "values": [
                    _to_otlp_any_value(item)
                    for item in value
                ]
            }
        }

    return {"stringValue": str(value)}


def _to_otlp_attributes(
    attributes: dict[str, Any],
) -> list[dict[str, Any]]:
    return [
        {
            "key": str(key),
            "value": _to_otlp_any_value(value),
        }
        for key, value in attributes.items()
        if value is not None
    ]


def _normalise_otlp_hex_identifier(
    value: str,
    expected_length: int,
) -> str:
    identifier = str(value or "").strip().lower()

    if not _is_valid_hex_identifier(
        identifier,
        expected_length,
    ):
        raise ValueError(
            "Invalid OTLP hexadecimal identifier: "
            f"{identifier}"
        )

    return identifier


def _to_otlp_span(span: _Span) -> dict[str, Any]:
    result: dict[str, Any] = {
        "traceId": _normalise_otlp_hex_identifier(
            span.trace_id,
            32,
        ),
        "spanId": _normalise_otlp_hex_identifier(
            span.span_id,
            16,
        ),
        "traceState": "",
        "flags": 1 if span.sampled else 0,
        "name": span.name,
        "kind": span.kind,
        "startTimeUnixNano": str(
            span.started_at_unix_nano
        ),
        "endTimeUnixNano": str(
            span.ended_at_unix_nano
            or time.time_ns()
        ),
        "attributes": _to_otlp_attributes(
            span.attributes
        ),
        "droppedAttributesCount": 0,
        "droppedEventsCount": 0,
        "droppedLinksCount": 0,
        "status": {
            "message": span.status_message,
            "code": span.status_code,
        },
    }

    if span.parent_span_id:
        result["parentSpanId"] = (
            _normalise_otlp_hex_identifier(
                span.parent_span_id,
                16,
            )
        )

    return result


def _create_otlp_payload(
    spans: list[_Span],
) -> bytes:
    payload = {
        "resourceSpans": [
            {
                "resource": {
                    "attributes": _to_otlp_attributes(
                        _RESOURCE_ATTRIBUTES
                    ),
                    "droppedAttributesCount": 0,
                },
                "scopeSpans": [
                    {
                        "scope": {
                            "name": "salonai.manual-otel",
                            "version": "1.0.0",
                        },
                        "spans": [
                            _to_otlp_span(span)
                            for span in spans
                        ],
                    }
                ],
            }
        ]
    }

    return json.dumps(
        payload,
        separators=(",", ":"),
    ).encode("utf-8")


def _warn_export_failure(error: BaseException) -> None:
    global _last_export_warning_at

    now = time.monotonic()

    if now - _last_export_warning_at < 60:
        return

    _last_export_warning_at = now

    print(
        json.dumps(
            {
                "timestamp": time.strftime(
                    "%Y-%m-%dT%H:%M:%SZ",
                    time.gmtime(),
                ),
                "level": "warning",
                "service": _RESOURCE_ATTRIBUTES[
                    "service.name"
                ],
                "event": "tracing.export_failed",
                "endpoint": _EXPORT_ENDPOINT,
                "error": str(error),
            }
        ),
        file=sys.stderr,
        flush=True,
    )


def _export_batch(spans: list[_Span]) -> None:
    if not spans or not _EXPORT_ENDPOINT:
        return

    request = urllib.request.Request(
        _EXPORT_ENDPOINT,
        data=_create_otlp_payload(spans),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(
        request,
        timeout=_EXPORT_TIMEOUT_SECONDS,
    ) as response:
        status = getattr(response, "status", 200)

        if status < 200 or status >= 300:
            raise RuntimeError(
                "OTLP trace export returned "
                f"HTTP {status}."
            )


def _exporter_worker() -> None:
    while not _exporter_stop_event.is_set():
        try:
            first_span = _completed_spans.get(
                timeout=_EXPORT_INTERVAL_SECONDS
            )
        except queue.Empty:
            continue

        batch = [first_span]

        while len(batch) < _MAX_BATCH_SIZE:
            try:
                batch.append(
                    _completed_spans.get_nowait()
                )
            except queue.Empty:
                break

        try:
            _export_batch(batch)
        except (
            OSError,
            RuntimeError,
            urllib.error.URLError,
        ) as error:
            _warn_export_failure(error)
        finally:
            for _ in batch:
                _completed_spans.task_done()


def _ensure_exporter_started() -> None:
    global _exporter_thread

    if not _TRACING_ENABLED:
        return

    if (
        _exporter_thread is not None
        and _exporter_thread.is_alive()
    ):
        return

    with _exporter_lock:
        if (
            _exporter_thread is not None
            and _exporter_thread.is_alive()
        ):
            return

        _exporter_thread = threading.Thread(
            target=_exporter_worker,
            name="salonai-trace-exporter",
            daemon=True,
        )
        _exporter_thread.start()


def _enqueue_span(span: _Span) -> None:
    if not _TRACING_ENABLED:
        return

    _ensure_exporter_started()

    try:
        _completed_spans.put_nowait(span)
    except queue.Full:
        try:
            _completed_spans.get_nowait()
            _completed_spans.task_done()
        except queue.Empty:
            return

        try:
            _completed_spans.put_nowait(span)
        except queue.Full:
            return


def shutdown_tracing() -> None:
    if not _TRACING_ENABLED:
        return

    deadline = time.monotonic() + 5.0

    while (
        not _completed_spans.empty()
        and time.monotonic() < deadline
    ):
        time.sleep(0.05)

    _exporter_stop_event.set()

    if _exporter_thread is not None:
        _exporter_thread.join(timeout=1.0)


class TraceLoggingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        span = _active_span.get()

        record.trace_id = (
            span.trace_id
            if span is not None
            else "-"
        )

        record.span_id = (
            span.span_id
            if span is not None
            else "-"
        )

        return True


def configure_tracing_logging() -> None:
    trace_filter = TraceLoggingFilter()

    root_logger = logging.getLogger()

    for handler in root_logger.handlers:
        if not any(
            isinstance(
                existing_filter,
                TraceLoggingFilter,
            )
            for existing_filter in handler.filters
        ):
            handler.addFilter(trace_filter)


class TracingMiddleware:
    def __init__(
        self,
        app: Callable[
            [
                MutableMapping[str, Any],
                Callable[[], Awaitable[dict[str, Any]]],
                Callable[[dict[str, Any]], Awaitable[None]],
            ],
            Awaitable[None],
        ],
    ) -> None:
        self.app = app

    async def __call__(
        self,
        scope: MutableMapping[str, Any],
        receive: Callable[
            [],
            Awaitable[dict[str, Any]],
        ],
        send: Callable[
            [dict[str, Any]],
            Awaitable[None],
        ],
    ) -> None:
        if (
            not _TRACING_ENABLED
            or scope.get("type") != "http"
        ):
            await self.app(scope, receive, send)
            return

        raw_headers = scope.get("headers") or []

        headers = {
            key.decode("latin-1").lower(): value.decode(
                "latin-1"
            )
            for key, value in raw_headers
        }

        incoming_trace = _parse_traceparent(
            headers.get("traceparent")
        )

        if incoming_trace is not None:
            trace_id, parent_span_id, sampled = (
                incoming_trace
            )
        else:
            trace_id = _new_trace_id()
            parent_span_id = None
            sampled = _should_sample_root_span()

        method = str(
            scope.get("method") or "UNKNOWN"
        ).upper()

        path = str(scope.get("path") or "/")

        span = _Span(
            name=f"{method} {path}",
            kind=2,
            trace_id=trace_id,
            span_id=_new_span_id(),
            parent_span_id=parent_span_id,
            sampled=sampled,
            started_at_unix_nano=time.time_ns(),
            attributes={
                "http.request.method": method,
                "url.path": path,
                "url.scheme": str(
                    scope.get("scheme") or "http"
                ),
                "network.peer.address": (
                    scope.get("client") or [None]
                )[0],
                "user_agent.original": headers.get(
                    "user-agent"
                ),
                "salonai.request_id": headers.get(
                    "x-request-id"
                ),
            },
        )

        state = scope.setdefault("state", {})
        state["trace_id"] = span.trace_id
        state["span_id"] = span.span_id

        token = _active_span.set(span)
        response_status_code = 500

        async def traced_send(
            message: dict[str, Any],
        ) -> None:
            nonlocal response_status_code

            if message.get("type") == "http.response.start":
                response_status_code = int(
                    message.get("status", 200)
                )

                response_headers = list(
                    message.get("headers") or []
                )

                if not any(
                    key.lower() == b"x-trace-id"
                    for key, _ in response_headers
                ):
                    response_headers.append(
                        (
                            b"x-trace-id",
                            span.trace_id.encode("ascii"),
                        )
                    )

                message["headers"] = response_headers

            await send(message)

        try:
            await self.app(
                scope,
                receive,
                traced_send,
            )
        except BaseException as error:
            _finish_span(
                span,
                status_code=500,
                error=error,
            )
            raise
        else:
            _finish_span(
                span,
                status_code=response_status_code,
            )
        finally:
            _active_span.reset(token)


def get_active_trace_context() -> dict[str, Any] | None:
    span = _active_span.get()

    if span is None:
        return None

    return {
        "trace_id": span.trace_id,
        "span_id": span.span_id,
        "sampled": span.sampled,
        "traceparent": _format_traceparent(span),
    }


def get_tracing_status() -> dict[str, Any]:
    return {
        "enabled": _TRACING_ENABLED,
        "endpoint": _EXPORT_ENDPOINT,
        "service_name": _RESOURCE_ATTRIBUTES[
            "service.name"
        ],
        "sample_ratio": _SAMPLE_RATIO,
        "queued_spans": _completed_spans.qsize(),
    }


atexit.register(shutdown_tracing)
