# Solar estimator API (FastAPI)

Backend and internal admin for the Tatsat NRGS site. Serves public estimation endpoints and a JWT-protected admin API.

## Quick start

1. **PostgreSQL 16+** (local or Docker) with database `solar_estimator` and user `postgres` / `postgres` (or set env vars in `.env`).

2. **Python 3.11+**

   ```text
   cd backend
   python -m venv .venv
   .venv\Scripts\pip install -r requirements.txt
   ```

3. **Copy** `.env.example` to `.env` and set `JWT_SECRET` and `DATABASE_URL` / `DATABASE_URL_SYNC` if your DB differs from the defaults.

4. **Migrations and seed**

   ```text
   .venv\Scripts\alembic upgrade head
   .venv\Scripts\python -m app.scripts.seed_data
   ```

   Optional: `set ADMIN_INITIAL_PASSWORD=YourPassword` before seed to set the `admin` password (default: `changeme`).

5. **Admin UI (already built in `static/admin/`)** — to rebuild after edits:

   ```text
   cd admin
   npm install
   npm run build
   ```

6. **Run the API**

   ```text
   .venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

- Open **http://127.0.0.1:8000/manage** for the admin panel.  
- **http://127.0.0.1:8000/docs** for OpenAPI.  
- **http://127.0.0.1:8000/health** for a quick health check.

## Docker (PostgreSQL)

From `backend/`:

```text
docker compose up -d
```

Point `.env` at `postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/solar_estimator` (and matching sync URL), then `alembic upgrade head` and seed.

## Frontend (Next.js) integration

- Set `CORS_ORIGINS` to include your Next dev origin, e.g. `http://localhost:3000`.  
- Call the API (example base `http://127.0.0.1:8000`):
  - `POST /estimate` — JSON body per `app/schemas/estimate.py` `EstimateRequest`
  - `GET /states`, `GET /districts?state=Gujarat` or `?state_id=1`
- Example response shape: `system_size`, `cost_breakdown` (panels, inverter, battery, structure, installation, misc), `subsidy`, `final_cost`, `total_before_subsidy`, `details`.

## Admin API

All under `/admin/...` except the duplicate `GET /export-leads` at the app root. Send header `Authorization: Bearer <token>` from `POST /admin/login`.

- `GET/POST /admin/pricing`, `GET/POST /admin/subsidy`, `GET/POST /admin/location-pricing`, `GET /admin/leads`, `GET /admin/export-leads` or `GET /export-leads`  
- `POST /admin/estimate-pdf` — same body as public estimate, returns PDF  
- `POST /admin/whatsapp/notify` — optional forward if `WHATSAPP_API_URL` is set in `.env`

## Project layout

- `app/routes/` — public and admin routers  
- `app/models/tables.py` — SQLAlchemy models  
- `app/services/estimate_service.py` — sizing and pricing engine  
- `app/schemas/` — Pydantic request/response models  
- `alembic/` — migrations (initial revision includes all tables)  
- `admin/` — Vite + React source; production build in `static/admin/`
