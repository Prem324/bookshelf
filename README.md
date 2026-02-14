# Books API Project

Full-stack Bookshelf app with a FastAPI microservices backend and a React (Vite) frontend. Users can register, log in, manage their book collection, search, and upload cover images.

## Features
- User registration and login (JWT auth)
- Create, read, update, delete books
- Search by title, author, year, ISBN
- Optional cover image upload (Supabase Storage)

## Tech Stack
- Backend: FastAPI, SQLAlchemy, Pydantic, JWT (auth-service + book-service)
- Frontend: React, Vite, Axios

## Project Structure
- `auth-service/` FastAPI auth service (users, JWT, refresh tokens)
- `book-service/` FastAPI book service (books)
- `backend-legacy/` archived monolith (kept for reference only)
- `frontend/` React app (Vite)
- `DEPLOY.md` deployment notes

## Prerequisites
- Python 3.10+ (backend)
- Node.js 18+ (frontend)
- A database supported by SQLAlchemy (SQLite/Postgres/MySQL, etc.)

## Backend Setup
1. Create `.env` files in `auth-service/` and `book-service/`:
```env
# auth-service/.env
DATABASE_URL=sqlite:///./books.db
SECRET_KEY=change_this_secret

# book-service/.env
DATABASE_URL=sqlite:///./books.db
AUTH_SERVICE_URL=http://localhost:8001

# Optional: only needed for image upload
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_BUCKET=your-bucket-name
```

2. Install dependencies:
```bash
pip install -r auth-service/requirements.txt
pip install -r book-service/requirements.txt
```

3. Run the API:
```bash
uvicorn auth-service.main:app --reload --port 8001
uvicorn book-service.main:app --reload --port 8002
```

Auth API runs at `http://localhost:8001`. Book API runs at `http://localhost:8002`.

## Database Migrations (Alembic)
This project uses Alembic for database migrations. To apply migrations:

1. **Auth Service**:
   ```bash
   cd auth-service
   alembic upgrade head
   ```

2. **Book Service**:
   ```bash
   cd book-service
   alembic upgrade head
   ```

To create a new migration after changing models:
```bash
alembic revision --autogenerate -m "description of changes"
```

## Frontend Setup
1. Create a `.env` file in `frontend/` (optional):
```env
VITE_AUTH_API_BASE_URL=http://localhost:8001
VITE_BOOKS_API_BASE_URL=http://localhost:8002
```

2. Install dependencies:
```bash
npm install --prefix frontend
```

3. Run the frontend:
```bash
npm run --prefix frontend dev
```

The app will run at `http://localhost:5173` by default.

## API Overview
- `POST /users/register` Create a new user
- `POST /users/login` Authenticate and return JWT token
- `POST /users/refresh` Exchange refresh token for new access token
- `GET /books` List books (supports query filters)
- `POST /books` Add a new book
- `PUT /books/{book_id}` Update a book
- `DELETE /books/{book_id}` Delete a book
- `POST /books/{book_id}/image` Upload book cover

## Notes
- Books are always scoped to the authenticated user.

## Recent Changes
- Feb 14, 2026: Frontend `Books` page formatting and layout readability improvements (no behavior changes).

## Next Steps
- Add tests
- Add pagination to the books list
- Improve error handling and validation UX
