import logging
import os
import sys
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from api.logging_config import setup_concurrent_logging
from config import settings

from product.accounts import initialize
from product.middleware import ProductBoundary
from api.routers.auth import router as auth_router
from api.routers.product import router as product_router

initialize()
setup_concurrent_logging()

logger = logging.getLogger(__name__)

from api.routers import (
    configuration_router,
    files_router,
    health_router,
    pipelines_router,
    sandbox_router,
    sessions_router,
    stages_router,
    workflow_router,
)

DEFAULT_CORS_ORIGINS = ["http://127.0.0.1:3000", "http://localhost:3000"]


def _cors_origins() -> list[str]:
    configured = []
    for raw_origin in os.getenv("XYQ_CORS_ORIGINS", "").split(","):
        origin = raw_origin.strip().rstrip("/")
        parsed = urlparse(origin)
        if (
            parsed.scheme.lower() in {"http", "https"}
            and parsed.netloc
            and not parsed.path
            and not parsed.params
            and not parsed.query
            and not parsed.fragment
        ):
            configured.append(origin)
    return list(dict.fromkeys(DEFAULT_CORS_ORIGINS + configured))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s API", settings.PROJECT_NAME)
    logger.info("Authenticated media routes enabled")
    yield
    logger.info("%s API shutdown complete", settings.PROJECT_NAME)


app = FastAPI(title=settings.PROJECT_NAME, version="0.1.0", lifespan=lifespan)

cors_origins = _cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("CORS enabled for origins: %s", cors_origins)

os.makedirs(settings.CODE_DIR, exist_ok=True)
app.add_middleware(ProductBoundary, origins=cors_origins)
app.include_router(auth_router)
app.include_router(product_router)

app.include_router(health_router)
app.include_router(files_router)
app.include_router(workflow_router)
app.include_router(sessions_router)
app.include_router(stages_router)
app.include_router(sandbox_router)
app.include_router(pipelines_router)
app.include_router(configuration_router)
logger.info("API routers registered")


@app.get("/")
async def root():
    return {"service": settings.PROJECT_NAME, "version": "0.1.0", "health": "/api/health"}
