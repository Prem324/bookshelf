import json
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.encoders import jsonable_encoder
import requests
from sqlalchemy.orm import Session

import auth, models, schemas
from database import SessionLocal
from redis_client import get_redis_client

router = APIRouter(prefix="/books")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "")
CACHE_TTL_SECONDS = 300


def _supabase_headers(content_type: str | None = None) -> dict:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or not SUPABASE_BUCKET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Supabase storage is not configured. Set SUPABASE_URL, "
                "SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_BUCKET in backend/.env."
            ),
        )

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "x-upsert": "true",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _build_public_url(object_path: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{object_path}"


def _extract_object_path_from_url(image_url: str | None) -> str | None:
    if not image_url or not SUPABASE_URL or not SUPABASE_BUCKET:
        return None
    marker = f"/storage/v1/object/public/{SUPABASE_BUCKET}/"
    if marker not in image_url:
        return None
    object_path = image_url.split(marker, 1)[1].strip()
    return object_path or None


def _delete_existing_file(image_url: str | None) -> None:
    object_path = _extract_object_path_from_url(image_url)
    if not object_path:
        return

    delete_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{object_path}"
    response = requests.delete(delete_url, headers=_supabase_headers(), timeout=20)
    # Ignore 404; the object may already be gone.
    if response.status_code not in (200, 204, 404):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to delete existing image from Supabase storage.",
        )


def _save_uploaded_image(image: UploadFile, user_id: int) -> str:
    if not image.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image file")

    ext = Path(image.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image format. Use jpg, jpeg, png, webp, or gif.",
        )

    object_path = f"books/{user_id}/{uuid.uuid4().hex}{ext}"
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{object_path}"
    file_bytes = image.file.read()
    content_type = image.content_type or "application/octet-stream"

    response = requests.post(
        upload_url,
        data=file_bytes,
        headers=_supabase_headers(content_type=content_type),
        timeout=30,
    )
    if response.status_code not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upload image to Supabase storage.",
        )

    return _build_public_url(object_path)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Add Book
@router.post("/", response_model=schemas.BookOut, status_code=status.HTTP_201_CREATED)
def add_book(
    book: schemas.BookCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(auth.get_current_user_id),
):

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

    return new_book


# Get Books
@router.get("/", response_model=schemas.BookListResponse)
def get_books(
    title: str | None = Query(default=None),
    author: str | None = Query(default=None),
    year: int | None = Query(default=None),
    isbn: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    sort: str = Query(default="latest", pattern="^(latest|oldest|az)$"),
    db: Session = Depends(get_db),
    user_id: int = Depends(auth.get_current_user_id),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    cache_key = None
    redis_client = get_redis_client()
    if redis_client:
        try:
            cache_key_parts = [
                "books",
                str(user_id),
                user.role or "user",
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
    if user.role != "admin":
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
            redis_client.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(encoded_payload))
        except Exception:
            pass

    return encoded_payload


@router.put("/{book_id}", response_model=schemas.BookOut)
def update_book(
    book_id: int,
    book: schemas.BookUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(auth.get_current_user_id),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    query = db.query(models.Book).filter(models.Book.id == book_id)
    if user.role != "admin":
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
    return db_book


@router.post("/{book_id}/image", response_model=schemas.BookOut)
def upload_book_image(
    book_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: int = Depends(auth.get_current_user_id),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    query = db.query(models.Book).filter(models.Book.id == book_id)
    if user.role != "admin":
        query = query.filter(models.Book.owner_id == user_id)
    db_book = query.first()

    if not db_book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    _delete_existing_file(db_book.image_url)
    db_book.image_url = _save_uploaded_image(image, user_id)

    db.commit()
    db.refresh(db_book)
    return db_book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(auth.get_current_user_id),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    query = db.query(models.Book).filter(models.Book.id == book_id)
    if user.role != "admin":
        query = query.filter(models.Book.owner_id == user_id)
    db_book = query.first()

    if not db_book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    _delete_existing_file(db_book.image_url)
    db.delete(db_book)
    db.commit()
