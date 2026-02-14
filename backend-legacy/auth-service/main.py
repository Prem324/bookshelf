import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import models
from database import engine
from routers import users


models.Base.metadata.create_all(bind=engine)

# Keep existing databases compatible when adding new optional columns.
with engine.begin() as conn:
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_hash VARCHAR"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires_at TIMESTAMP"))

app = FastAPI()
frontend_origins = os.getenv("FRONTEND_ORIGINS", "*")
allow_origins = [origin.strip() for origin in frontend_origins.split(",") if origin.strip()]

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(users.router)
