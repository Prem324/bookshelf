from typing import Optional
import redis
from config import settings

_redis_client: Optional[redis.Redis] = None

def get_redis_client() -> Optional[redis.Redis]:
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    if settings.REDIS_URL:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        return _redis_client

    return None
