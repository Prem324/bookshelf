import json
import uuid
import logging
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

import models, schemas
from database import get_db
from redis_client import get_redis_client
from config import settings

router = APIRouter(prefix="/books")
security = HTTPBearer()
logger = logging.getLogger(__name__)

def _ensure_image_uploads_enabled() -> None:
    if not (settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY and settings.SUPABASE_BUCKET):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image uploads are disabled or not configured.",
        )

def _supabase_headers(content_type: str | None = None) -> dict:
    _ensure_image_uploads_enabled()
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "x-upsert": "true",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers

def _build_public_url(object_path: str) -> str:
    _ensure_image_uploads_enabled()
    url = settings.SUPABASE_URL.rstrip("/")
    return f"{url}/storage/v1/object/public/{settings.SUPABASE_BUCKET}/{object_path}"

def _extract_object_path_from_url(image_url: str | None) -> Optional[str]:
    if not image_url or not settings.SUPABASE_URL or not settings.SUPABASE_BUCKET:
        return None
    marker = f"/storage/v1/object/public/{settings.SUPABASE_BUCKET}/"
    if marker not in image_url:
        return None
    object_path = image_url.split(marker, 1)[1].strip()
    return object_path or None

async def _delete_existing_file(image_url: str | None) -> None:
    object_path = _extract_object_path_from_url(image_url)
    if not object_path:
        return

    url = settings.SUPABASE_URL.rstrip("/")
    delete_url = f"{url}/storage/v1/object/{settings.SUPABASE_BUCKET}/{object_path}"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(delete_url, headers=_supabase_headers(), timeout=20)
            if response.status_code not in (200, 204, 404):
                logger.error(f"Failed to delete image from Supabase: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to delete existing image from storage.",
                )
        except httpx.RequestError as exc:
            logger.error(f"Error communicating with Supabase: {exc}")

async def _save_uploaded_image(image: UploadFile, user_id: int) -> str:
    _ensure_image_uploads_enabled()
    if not image.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image file")

    ext = Path(image.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image format. Use jpg, jpeg, png, webp, or gif.",
        )

    object_path = f"books/{user_id}/{uuid.uuid4().hex}{ext}"
    url = settings.SUPABASE_URL.rstrip("/")
    upload_url = f"{url}/storage/v1/object/{settings.SUPABASE_BUCKET}/{object_path}"
    
    content = await image.read()
    content_type = image.content_type or "application/octet-stream"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                upload_url,
                content=content,
                headers=_supabase_headers(content_type=content_type),
                timeout=30,
            )
            if response.status_code not in (200, 201):
                logger.error(f"Failed to upload image to Supabase: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to upload image to storage.",
                )
        except httpx.RequestError as exc:
            logger.error(f"Error communicating with Supabase: {exc}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Storage service unavailable",
            )

    return _build_public_url(object_path)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(
                f"{settings.AUTH_SERVICE_URL}/users/validate",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5,
            )
            if res.status_code != 200:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
            return res.json()
        except httpx.RequestError as exc:
            logger.error(f"Auth service communication error: {exc}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Auth service unavailable",
            )


def _invalidate_books_cache(user_id: int, role: str) -> None:
    redis_client = get_redis_client()
    if not redis_client:
        return
    try:
        pattern = f"books:{user_id}:{role}:*"
        keys = list(redis_client.scan_iter(match=pattern, count=200))
        if keys:
            redis_client.delete(*keys)
    except Exception:
        pass


# Add Book
@router.post("/", response_model=schemas.BookOut, status_code=status.HTTP_201_CREATED)
async def add_book(
    request: Request,
    book: schemas.BookCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    user_id = user["user_id"]

    new_book = models.Book(
        title=book.title,
        author=book.author,
        year=book.year,
        isbn=book.isbn,
        description=book.description,
        owner_id=user_id,
    )

    db.add(new_book)
    db.commit()
    db.refresh(new_book)

    _invalidate_books_cache(user_id, user.get("role") or "user")
    return new_book


# Get Books
@router.get("/", response_model=schemas.BookListResponse)
async def get_books(
    request: Request,
    title: str | None = Query(default=None),
    author: str | None = Query(default=None),
    year: int | None = Query(default=None),
    isbn: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    sort: str = Query(default="latest", pattern="^(latest|oldest|az)$"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    user_id = user["user_id"]
    role = user.get("role") or "user"

    cache_key = None
    redis_client = get_redis_client()
    if redis_client:
        try:
            cache_key_parts = [
                "books",
                str(user_id),
                role,
                title or "",
                author or "",
                str(year) if year is not None else "",
                isbn or "",
                str(page),
                str(page_size),
                sort,
            ]
            cache_key = ":".join(cache_key_parts)
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            cache_key = None

    query = db.query(models.Book)
    if role != "admin":
        query = query.filter(models.Book.owner_id == user_id)

    if title:
        query = query.filter(models.Book.title.ilike(f"%{title}%"))
    if author:
        query = query.filter(models.Book.author.ilike(f"%{author}%"))
    if year is not None:
        query = query.filter(models.Book.year == year)
    if isbn:
        query = query.filter(models.Book.isbn.ilike(f"%{isbn}%"))

    if sort == "oldest":
        query = query.order_by(models.Book.id.asc())
    elif sort == "az":
        query = query.order_by(models.Book.title.asc())
    else:
        query = query.order_by(models.Book.id.desc())

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    response_payload = {
        "items": items,
        "meta": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        },
    }
    encoded_payload = jsonable_encoder(response_payload)

    if redis_client and cache_key:
        try:
            # Using getattr for potential missing attr, but settings should have it
            ttl = getattr(settings, "CACHE_TTL_SECONDS", 300) 
            redis_client.setex(cache_key, ttl, json.dumps(encoded_payload))
        except Exception:
            pass

    return encoded_payload


@router.put("/{book_id}", response_model=schemas.BookOut)
async def update_book(
    request: Request,
    book_id: int,
    book: schemas.BookUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    user_id = user["user_id"]
    role = user.get("role") or "user"

    query = db.query(models.Book).filter(models.Book.id == book_id)
    if role != "admin":
        query = query.filter(models.Book.owner_id == user_id)
    db_book = query.first()

    if not db_book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    db_book.title = book.title
    db_book.author = book.author
    db_book.year = book.year
    db_book.isbn = book.isbn
    db_book.description = book.description

    db.commit()
    db.refresh(db_book)
    _invalidate_books_cache(user_id, role)
    return db_book


@router.post("/{book_id}/image", response_model=schemas.BookOut)
async def upload_book_image(
    request: Request,
    book_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    user_id = user["user_id"]
    role = user.get("role") or "user"

    query = db.query(models.Book).filter(models.Book.id == book_id)
    if role != "admin":
        query = query.filter(models.Book.owner_id == user_id)
    db_book = query.first()

    if not db_book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    await _delete_existing_file(db_book.image_url)
    db_book.image_url = await _save_uploaded_image(image, user_id)

    db.commit()
    db.refresh(db_book)
    _invalidate_books_cache(user_id, role)
    return db_book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    request: Request,
    book_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    user_id = user["user_id"]
    role = user.get("role") or "user"

    query = db.query(models.Book).filter(models.Book.id == book_id)
    if role != "admin":
        query = query.filter(models.Book.owner_id == user_id)
    db_book = query.first()

    if not db_book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    await _delete_existing_file(db_book.image_url)
    db.delete(db_book)
    db.commit()
    _invalidate_books_cache(user_id, role)
