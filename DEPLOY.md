## Deploy Guide (Microservices + Render + Vercel)

### 1) Auth service deploy (Render)

- Create a **Web Service** from this repo.
- Root directory: `auth-service`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Set auth-service env vars in Render:

- `DATABASE_URL`
- `SECRET_KEY`

### 2) Book service deploy (Render)

- Create a **Web Service** from this repo.
- Root directory: `book-service`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Set book-service env vars in Render:

- `DATABASE_URL`
- `AUTH_SERVICE_URL` (your auth-service Render URL)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET`

### 3) Frontend deploy (Vercel)

- Import this repo in Vercel.
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

Set frontend env var in Vercel:

- `VITE_AUTH_API_BASE_URL=https://<your-auth-service-domain>`
- `VITE_BOOKS_API_BASE_URL=https://<your-book-service-domain>`

### 4) Supabase storage setup

- Create bucket: `book-images` (or any of your chosen name).
- Make it public if you want direct image URLs.

### 5) Verify

- Open deployed frontend URL.
- Register/Login.
- Add book + upload image.
- Confirm image URL loads and CRUD works.
