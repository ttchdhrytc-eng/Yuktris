# LinkedIn Browser Worker

A real Playwright browser worker that polls the Supabase execution queue, launches Chromium, and executes LinkedIn browser actions including account connection, session validation, and test connections.

## Architecture

```
Frontend (React)
    ↓
Supabase database queue (browser_execution_queue)
    ↓
THIS WORKER (Node.js + Playwright + Chromium)
    ↓
LinkedIn
    ↓
Encrypted session storage (linkedin_sessions)
    ↓
Frontend polling/realtime update
```

The worker runs as a **separate Node.js service** — it cannot run inside a Supabase Edge Function because Playwright requires a full Node.js runtime with Chromium binaries and persistent browser contexts.

## Prerequisites

- Node.js 20+
- Chromium (installed via `npm run install-browser` or provided by Docker image)
- Supabase project with service role key
- A server-side encryption secret (generate with `openssl rand -base64 32`)

## Local Setup

```bash
cd workers/linkedin-browser-worker
npm install
npm run install-browser   # installs Chromium
cp .env.example .env      # fill in your secrets
npm start
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | Yes | — | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Service role key (NEVER expose to frontend) |
| `LINKEDIN_SESSION_ENCRYPTION_KEY` | Yes | — | 32-byte base64 secret for AES-256-GCM session encryption |
| `WORKER_ID` | No | auto-generated UUID | Unique worker identifier |
| `WORKER_REGION` | No | `local` | Region label for this worker |
| `WORKER_HEARTBEAT_INTERVAL` | No | `15000` | Heartbeat interval in ms |
| `QUEUE_POLL_INTERVAL` | No | `3000` | Queue poll interval in ms |
| `PLAYWRIGHT_HEADLESS` | No | `true` | `true` for headless, `false` for visible browser |
| `CHROMIUM_PATH` | No | (Playwright bundled) | Path to custom Chromium binary (must exist on filesystem; invalid paths are ignored) |
| `CONNECTION_TIMEOUT_MS` | No | `600000` | Connection task timeout (10 min) |
| `ACTION_TIMEOUT_MS` | No | `180000` | Normal action timeout (3 min) |
| `TEST_CONNECTION_TIMEOUT_MS` | No | `120000` | Test connection timeout (2 min) |
| `WORKER_PORT` | No | `3100` | Health/readiness endpoint port |

## Health Endpoints

```bash
# Health check — returns worker status, browser/Playwright/Supabase/queue availability
curl http://localhost:3100/health

# Readiness — returns 200 only when worker is fully started
curl http://localhost:3100/ready
```

Health response example:
```json
{
  "status": "healthy",
  "worker_id": "uuid-here",
  "checks": {
    "worker": "alive",
    "chromium": "available (150.0.7871.181)",
    "playwright": "available",
    "supabase": "reachable",
    "queue": "reachable"
  }
}
```

## How the Connection Flow Works

1. User clicks "Connect LinkedIn Account" in the frontend
2. Frontend creates a `linkedin_accounts` row with `connection_state: 'pending'`
3. Frontend enqueues a `linkedin_connect` task to `browser_execution_queue`
4. **This worker** claims the task atomically (`FOR UPDATE SKIP LOCKED`)
5. Worker launches Chromium and opens `https://www.linkedin.com/login`
6. User authenticates manually in the browser window
7. Worker detects authenticated state (feed loads)
8. Worker verifies LinkedIn identity (navigates to profile, extracts name/URL)
9. Worker captures session (cookies, storage state)
10. Worker encrypts session with AES-256-GCM using `LINKEDIN_SESSION_ENCRYPTION_KEY`
11. Worker stores encrypted session in `linkedin_sessions` table
12. Worker opens a NEW browser context, restores the session, and verifies it works
13. Worker marks the account as `connection_state: 'connected'`
14. Worker marks the queue task as `completed`
15. Frontend polls and displays the connected status

## Security

- **No passwords stored**: The frontend never sends a LinkedIn password. The user enters credentials directly in the controlled browser.
- **AES-256-GCM encryption**: Session data is encrypted with a server-side secret. The key is never exposed to the frontend.
- **Allowed domains only**: The worker only navigates to `linkedin.com` domains.
- **No CAPTCHA bypass**: The worker pauses when LinkedIn presents a challenge. It never attempts to bypass security controls.
- **No VITE_ secrets**: The worker only reads `SUPABASE_SERVICE_ROLE_KEY` — never any `VITE_*` variables.

---

## Railway Deployment

### Step 1 — Create the Service

1. Go to [railway.app](https://railway.app) and create a new project
2. Choose **"Deploy from GitHub repo"**
3. Select your repository containing the `workers/linkedin-browser-worker/` directory
4. Railway will detect the `Dockerfile` automatically

### Step 2 — Configure Root Directory

In the Railway service settings:
- Set **Root Directory** to `workers/linkedin-browser-worker`

### Step 3 — Set Environment Variables

In the Railway service → **Variables** tab, add:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(from Supabase Dashboard → Settings → API → service_role)* |
| `LINKEDIN_SESSION_ENCRYPTION_KEY` | *(generate: `openssl rand -base64 32`)* |
| `PLAYWRIGHT_HEADLESS` | `true` |
| `WORKER_PORT` | `3100` |

Mark `SUPABASE_SERVICE_ROLE_KEY` and `LINKEDIN_SESSION_ENCRYPTION_KEY` as **secret** variables.

### Step 4 — Configure Health Check

In the Railway service → **Settings**:
- **Health Check Path**: `/health`
- **Health Check Grace Period**: `60` seconds (Chromium install takes time on first deploy)

### Step 5 — Deploy

Railway will build the Docker image and start the worker. The first build installs Chromium and its dependencies.

### Step 6 — Verify

```bash
# Check health (replace with your Railway domain)
curl https://your-worker.up.railway.app/health

# Expected: {"status":"healthy","worker_id":"...","checks":{"worker":"alive","chromium":"available","playwright":"available","supabase":"reachable","queue":"reachable"}}
```

### Important Notes for Railway

- **Headless mode**: Railway containers don't have a display. Set `PLAYWRIGHT_HEADLESS=true`. For interactive LinkedIn login, you need a remote browser viewing mechanism (VNC, browser streaming).
- **Persistent process**: Railway keeps the worker running as a long-lived service. The worker polls the queue every 3 seconds.
- **Chromium memory**: Railway's free tier has 512MB RAM. Chromium needs at least 1GB. Use the **Hobby plan** ($5/mo) for 8GB RAM.
- **Auto-restart**: Railway restarts the worker if it crashes or the health check fails.

---

## Docker Deployment (Alternative)

```bash
cd workers/linkedin-browser-worker
docker build -t linkedin-browser-worker .
docker run -d \
  --env-file .env \
  -p 3100:3100 \
  linkedin-browser-worker
```

## Local Development

```bash
npm run dev    # auto-reload on file changes
npm test       # validates infrastructure (NOT LinkedIn login)
```
