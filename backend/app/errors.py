"""One consistent error format for the whole API.

Every error is JSON with a human-readable `detail`. Validation errors also carry
an `errors` object mapping each field to its message, in the same words the
frontend already uses ("Name cannot be empty"), so the website can show each
message under the right field.

    {"detail": "Please correct the highlighted fields.",
     "errors": {"email": "Enter a valid email address"}}
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

FIELD_LABELS = {
    "name": "Name",
    "email": "Email",
    "password": "Password",
    "current_password": "Current password",
    "new_password": "New password",
    "confirm_password": "Password confirmation",
    "sound_category": "Sound category",
    "sensitivity_level": "Relevance",
    "timestamp": "Date and time",
    "alerts_enabled": "Alerts setting",
    "alert_threshold": "Alert level",
    "preferences": "Preferences",
}

# Used when pydantic's own wording would be unfriendly (wrong type, bad value).
FALLBACK_MESSAGES = {
    "timestamp": "Enter a valid date and time",
    "confidence": "Confidence must be a number between 0 and 1",
    "sound_level_dbfs": "Sound level must be a number between -120 and 0",
    "sensitivity_level": "Relevance must be High, Medium, Low or Not relevant",
    "alert_threshold": "Alert level must be high, medium or low",
    "alerts_enabled": "Alerts setting must be true or false",
    "response": "Response must be comfortable, uncomfortable or very uncomfortable",
    "source": "Source must be manual or monitoring",
    "remember_me": "Remember me must be true or false",
}

VALIDATION_SUMMARY = "Please correct the highlighted fields."


class ApiError(Exception):
    """Raise this anywhere to return a clean JSON error."""

    def __init__(
        self,
        status_code: int,
        detail: str,
        errors: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
        **extra,
    ):
        self.status_code = status_code
        self.detail = detail
        self.errors = errors
        self.headers = headers
        self.extra = extra


def _field_name(error: dict) -> str:
    location = [str(part) for part in error["loc"] if part not in ("body", "query", "path")]
    return location[-1] if location else "body"


def _message(error: dict, field: str) -> str:
    kind = error["type"]
    label = FIELD_LABELS.get(field, field.replace("_", " ").capitalize())
    if kind == "value_error":
        return error["msg"].removeprefix("Value error, ")
    if kind == "missing" or (kind == "string_type" and error.get("input") is None):
        return f"{label} cannot be empty"
    if kind == "extra_forbidden":
        return f"Unexpected field: {field}"
    if kind in ("json_invalid", "model_attributes_type"):
        return "The request body is not valid JSON"
    return FALLBACK_MESSAGES.get(field, error["msg"])


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_request: Request, exc: ApiError):
        body: dict = {"detail": exc.detail}
        if exc.errors:
            body["errors"] = exc.errors
        body.update(exc.extra)
        return JSONResponse(body, status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_request: Request, exc: RequestValidationError):
        errors: dict[str, str] = {}
        for error in exc.errors():
            field = _field_name(error)
            errors.setdefault(field, _message(error, field))
        return JSONResponse({"detail": VALIDATION_SUMMARY, "errors": errors}, status_code=422)