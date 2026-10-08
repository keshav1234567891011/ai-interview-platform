import logging
import tempfile

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.requests import Request

from app.api.admin import router as admin_router
from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.interviews import router as interviews_router
from app.api.profile import router as profile_router
from app.api.resumes import router as resumes_router
from app.api.schedules import router as schedules_router
from app.core.body_limit import BodyLimitMiddleware
from app.core.config import BACKEND_ROOT, get_settings


def create_app() -> FastAPI:
    temporary_directory = BACKEND_ROOT / "runtime" / "tmp"
    temporary_directory.mkdir(parents=True, exist_ok=True)
    tempfile.tempdir = str(temporary_directory)
    application = FastAPI(
        title="InterviewAI API",
        description=(
            "Technical interview practice with private profiles, resume skill analysis, "
            "evaluated voice-or-text sessions, scheduling, analytics, and optional AI assistance."
        ),
        version="0.1.0",
    )
    application.include_router(health_router)
    application.include_router(auth_router)
    application.include_router(profile_router)
    application.include_router(resumes_router)
    application.include_router(interviews_router)
    application.include_router(schedules_router)
    application.include_router(analytics_router)
    application.include_router(admin_router)
    application.add_middleware(BodyLimitMiddleware)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().frontend_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization", "X-InterviewAI-Request"],
    )

    @application.middleware("http")
    async def request_safety(request: Request, call_next):
        if request.url.path.startswith("/api/") and request.method not in {
            "GET",
            "HEAD",
            "OPTIONS",
        }:
            origin = request.headers.get("origin")
            if request.headers.get("x-interviewai-request") != "1" or (
                origin and origin not in get_settings().frontend_origins
            ):
                return JSONResponse(
                    {"detail": "Request origin could not be verified."}, status_code=403
                )
        try:
            response = await call_next(request)
        except Exception:
            # Catch before Uvicorn's error logger can render sensitive exception details.
            logging.getLogger("interviewai").error("unexpected_request_failure")
            response = JSONResponse(
                {"detail": "The request could not be completed."}, status_code=500
            )
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(
            {
                "detail": [
                    {"loc": error["loc"], "msg": error["msg"], "type": error["type"]}
                    for error in exc.errors()
                ]
            },
            status_code=422,
        )

    @application.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, exc: SQLAlchemyError):
        logging.getLogger("interviewai").warning("database_request_failed")
        return JSONResponse(
            {"detail": "The database is unavailable. Please try again later."}, status_code=503
        )

    return application


app = create_app()
