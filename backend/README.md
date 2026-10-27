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

## Deploy on Render.com

1. Create a **PostgreSQL** instance, then a **Web Service** from this repo.
2. Set **Root Directory** to `backend` (see `render.yaml` at the repo root).
3. **Build command:** `pip install -r requirements.txt`  
   **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`  
   **Release / pre-deploy (recommended):** `alembic upgrade head`
4. **Environment variables**
   - **`DATABASE_URL`** — paste the Postgres **Internal Database URL** from Render (`postgresql://…`). The app will derive the async (`asyncpg`) URL and the sync URL for migrations (you do not need a second variable unless you want to override).
   - **`JWT_SECRET`** — long random string (do not use the default).
   - **`CORS_ORIGINS`** — include your production Next.js origin(s), comma-separated, e.g. `https://your-app.vercel.app`

Render sets **`RENDER=true`** and **`PORT`** automatically. The API serves **`GET /health`** for health checks.

If the service failed before: a common issue was only setting `DATABASE_URL` while the sync URL stayed on `localhost`, so Alembic and the sync engine never used your Render database. That is normalized in `app.config` now.

## Free database on Neon

[Neon](https://neon.com) has a permanent free plan (1 GB storage, no card, no expiry; compute
suspends after 5 idle minutes and wakes on the next request).

1. Sign up at neon.com, **Create project** (pick the region closest to your Render service).
2. In the project's **Connect** panel, turn **Connection pooling OFF** and copy the connection
   string (`postgresql://…neon.tech/neondb?sslmode=require`).
3. Render dashboard → your API service → **Environment** → set `DATABASE_URL` to that string,
   plus `JWT_SECRET` (random, 32+ chars). Save to redeploy.
4. Create tables and starting data from your own machine (free Render services have no shell):

   ```powershell
   cd backend
   $env:DATABASE_URL = "<the Neon connection string>"
   .\.venv\Scripts\alembic upgrade head
   $env:ADMIN_INITIAL_PASSWORD = "<strong password, 12+ chars>"
   .\.venv\Scripts\python -m app.scripts.seed_data
   ```
5. Check `https://<your-api>/health/db` → `"database":"connected"`.

## Solar Advisor (AI chat)

An LLM chat on the website that answers solar questions using **this site's own data**: it calls
server-side tools (`estimate_system`, `get_subsidy`, `list_services`) so prices, system sizes and
subsidies come from the estimator and database, never from the model's memory.

How it works: `POST /ai/chat` → `app/services/ai/advisor.py` runs a bounded loop (max 3 model/tool
rounds, 4 tool calls) → provider adapter in `app/services/ai/providers.py` (Gemini, any
OpenAI-compatible API such as Groq/OpenAI, or an offline `fake` provider) → tools in
`app/services/ai/tools.py`. The API key stays on the server.

Environment variables (nothing is shown on the site until a provider is configured):

| Variable | Example | Notes |
|---|---|---|
| `AI_PROVIDER` | `gemini` | `gemini`, `openai` (also Groq etc.), or `fake` for an offline demo |
| `AI_API_KEY` | _(secret)_ | e.g. a free key from Google AI Studio; set it only in the host dashboard |
| `AI_MODEL` | `gemini-2.0-flash` | optional; sensible default per provider |
| `AI_BASE_URL` | `https://api.groq.com/openai/v1` | only for `openai`-style providers |
| `AI_DAILY_LIMIT` | `500` | hard cap on chat requests per day (protects your bill) |

**Bill reader:** `POST /ai/read-bill` takes a photo of an electricity bill (JPG/PNG/WebP, max 5 MB) and a
vision model returns units, amount and state, which pre-fill the calculator. The image is never stored; it
is validated by magic bytes, the reply is validated and range-checked, bi-monthly bills are converted to
monthly, and the state is matched against the states table. Stricter limits: 5/min and 20/hour per visitor.

Safeguards: per-IP rate limits (12/min, 60/hour), message length and history caps, a daily cap,
tool-argument validation, an injection-resistant system prompt, and a friendly WhatsApp fallback on any
provider failure. The advisor can be switched off instantly in Admin → Website → *Contact page &
WhatsApp card*.

Try it offline: `AI_PROVIDER=fake` (no key needed). Run the tests with
`pip install -r requirements-dev.txt` then `python -m pytest` (no network or key required).

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
