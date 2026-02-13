from pydantic import BaseModel, ConfigDict, EmailStr, Field


# Users
class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class TokenResponse(BaseModel):
    token: str


class UserPublic(BaseModel):
    id: int
    name: str
    email: EmailStr

    model_config = ConfigDict(from_attributes=True)


# Books
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

    model_config = ConfigDict(from_attributes=True)
