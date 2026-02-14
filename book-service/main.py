import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

import models
from database import engine, get_db
from routers import books
from config import settings
from logging_config import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info("Starting up book-service...")
    # migrations are now handled via Alembic
    yield
    # Shutdown logic
    logger.info("Shutting down book-service...")

app = FastAPI(
    title="Bookshelf Book Service",
    description="Microservice for book management",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check(db: Session = Depends(get_db)):
    health_status = {"status": "healthy", "service": "book-service", "components": {}}
    
    # Check database
    try:
        db.execute(text("SELECT 1"))
        health_status["components"]["database"] = "connected"
    except Exception as e:
        logger.error(f"DB health check failed: {e}")
        health_status["components"]["database"] = "unhealthy"
        health_status["status"] = "degraded"

    if health_status["status"] != "healthy":
         raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=health_status
        )
    return health_status

app.include_router(books.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
