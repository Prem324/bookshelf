## Deploy Guide (Supabase + Render + Vercel)

### 1) Backend deploy (Render)
- Create a **Web Service** from this repo.
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Set backend env vars in Render:
- `DATABASE_URL`
- `SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET` (example: `book-images`)
- `FRONTEND_ORIGINS` (your Vercel URL, comma-separated if multiple)

### 2) Frontend deploy (Vercel)
- Import this repo in Vercel.
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

Set frontend env var in Vercel:
- `VITE_API_BASE_URL=https://<your-render-backend-domain>`

### 3) Supabase storage setup
- Create bucket: `book-images` (or your chosen name).
- Make it public if you want direct image URLs.

### 4) Verify
- Open deployed frontend URL.
- Register/Login.
- Add book + upload image.
- Confirm image URL loads and CRUD works.
