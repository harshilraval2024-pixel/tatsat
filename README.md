# Tatsat NRGS

Public marketing site and internal tools for a solar business in India.

## Repository layout

| Path | Stack | Role |
|------|--------|------|
| **`frontend/`** | Next.js 16, React, Tailwind | Public website, staff admin UI (client) |
| **`backend/`** | FastAPI, SQLAlchemy, Alembic | REST API, pricing engine, CMS data, static admin build |
| **`backend/admin/`** | Vite + React (optional) | Rebuild the `/manage` bundle into `backend/static/admin/` |

Run API and web app from two terminals (or use your own process manager).

### Frontend (from repo root)

```bash
cd frontend
npm install
npm run dev
```

Opens [http://localhost:3000](http://localhost:3000). From repository root you can also run:

```bash
npm install --prefix frontend
npm run dev
```

### Backend API

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\alembic upgrade head
.\.venv\Scripts\python -m app.scripts.seed_data
.\.venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

See **`backend/README.md`** for environment variables, Docker Postgres, and admin routes.

### Deploying the frontend (e.g. Vercel)

Set the project **Root Directory** to **`frontend`** so build commands run inside the Next.js app.
