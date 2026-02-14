from pydantic import BaseModel, Field


class BookBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    author: str = Field(min_length=1, max_length=255)
    year: int | None = Field(default=None, ge=0, le=9999)
    isbn: str | None = Field(default=None, min_length=1, max_length=32)
    description: str | None = Field(default=None, max_length=2000)


class BookCreate(BookBase):
    pass


class BookUpdate(BookBase):
    pass


class BookOut(BaseModel):
    id: int
    title: str
    author: str
    year: int | None
    isbn: str | None
    description: str | None
    image_url: str | None
    owner_id: int


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class BookListResponse(BaseModel):
    items: list[BookOut]
    meta: PaginationMeta
