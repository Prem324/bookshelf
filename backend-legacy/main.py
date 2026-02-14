import os
import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

import models
from database import engine
from rate_limiter import limiter

from routers import users, books


models.Base.metadata.create_all(bind=engine)

# Keep existing databases compatible when adding new optional columns.
with engine.begin() as conn:
    conn.execute(text("ALTER TABLE books ADD COLUMN IF NOT EXISTS year INTEGER"))
    conn.execute(text("ALTER TABLE books ADD COLUMN IF NOT EXISTS isbn VARCHAR(32)"))
    conn.execute(text("ALTER TABLE books ADD COLUMN IF NOT EXISTS description VARCHAR"))
    conn.execute(text("ALTER TABLE books ADD COLUMN IF NOT EXISTS image_url VARCHAR"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_hash VARCHAR"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires_at TIMESTAMP"))

app = FastAPI()
frontend_origins = os.getenv("FRONTEND_ORIGINS", "*")
allow_origins = [origin.strip() for origin in frontend_origins.split(",") if origin.strip()]

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("books_api")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    logger.info(
        "%s %s -> %s (%.2f ms) ip=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        request.client.host if request.client else "unknown",
    )
    return response

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(books.router)


@app.get("/")
def home():
    return {"msg": "Books API Running"}
