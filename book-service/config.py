from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/bookshelf"
    AUTH_SERVICE_URL: str = "http://auth-service:8000"
    REDIS_URL: Optional[str] = "redis://redis:6379/0"
    FRONTEND_ORIGINS: str = "*"
    
    # Supabase (optional)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_BUCKET: Optional[str] = None

    @property
    def allow_origins(self) -> List[str]:
        return [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
