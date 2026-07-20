from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.config import get_settings
from app.core.errors import ApiError
from app.core.logging import configure_logging
from app.models.envelope import Meta


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="ValueLoop API", version=s.api_version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "https://web-livid-beta-ilnxxzodh3.vercel.app"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

    def error_response(code: int, message: str) -> JSONResponse:
        return JSONResponse(
            status_code=code,
            content={
                "data": None,
                "meta": Meta(version=s.api_version).model_dump(mode="json"),
                "errors": [{"code": code, "message": message}],
            },
        )

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
        return error_response(exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(422, "Request validation failed")

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        message = "Resource not found" if exc.status_code == 404 else str(exc.detail)
        return error_response(exc.status_code, message)

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
        return error_response(500, "An unexpected error occurred")

    @app.get("/healthz")
    async def healthz() -> dict:
        return {"status": "ok"}

    from app.api.v1.router import api_router
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
