from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.code,
            content={
                "data": None,
                "meta": Meta(version=s.api_version).model_dump(mode="json"),
                "errors": [{"code": exc.code, "message": exc.message}],
            },
        )

    @app.get("/healthz")
    async def healthz() -> dict:
        return {"status": "ok"}

    from app.api.v1.router import api_router
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
