# Running Fete Store Manager on an IONOS VPS

This app was originally hosted by Retool. It has been converted to run
standalone: a **Node/Express** server serves a REST API (reusing the original
`backend/fete/*.ts` functions) **and** the built React frontend, backed by a
**SQLite** database file, behind an **nginx** reverse proxy.

```
Browser ──▶ nginx (:80/:443) ──▶ Node server (:8080) ──▶ fete_store.db (SQLite file)
                                   │
                                   └─ serves frontend/dist (static React app)
```

> **Security note:** As requested, the original auth model is kept as-is —
> PINs are stored in plaintext and the session lives only in the browser. This
> is fine on a trusted/internal deployment but is **not** hardened for the
> public internet. See "Hardening later" at the end.

There are two ways to deploy: **Docker** (one command, isolated) or a
**manual install** onto a bare VPS. Pick one.

---

## Option A: Docker

```bash
ssh timmi@217.154.60.212
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git curl
sudo usermod -aG docker $USER
newgrp docker
```

After reconnecting, clone the repository to `/opt/fete-store` and copy the
environment file:

```bash
sudo mkdir -p /opt/fete-store
sudo chown -R timmi:timmi /opt/fete-store
cd /opt/fete-store
git clone <your-repo-url> .
cp .env.example .env
```

`.env` only needs `NODE_ENV=production` — there's no database password to set,
the app database is a single SQLite file that lives in a Docker volume. Start
the stack:

```bash
docker compose up -d --build
```

This builds the backend (Node/Express + the SQLite file) and the frontend
(nginx serving `frontend/dist`), and creates the `fete_data` volume that holds
`fete_store.db` — it persists across `docker compose down`/`up` and image
rebuilds. On first boot the backend runs `db/init-sqlite.cjs` to create the
schema and load demo data; it no-ops on every later boot since the file
already has data.

The app should be reachable at `http://217.154.60.212/`.

To check on it:

```bash
docker compose ps
docker compose logs -f backend
```

Skip to "Updating after code changes" below once this is running — the rest
of this doc (Option B) is for a manual, non-Docker install.

---

## Option B: Manual install

### 1. Provision the VPS

On a fresh IONOS Ubuntu 22.04/24.04 server, as root (or with `sudo`):

```bash
apt update && apt upgrade -y
apt install -y nginx git curl

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Create a non-root user to run the app:

```bash
adduser --system --group --home /opt/fete-store fete
```

### 2. Get the code onto the server

Copy this project to `/opt/fete-store` (via `git clone`, `scp`, or rsync). The
layout should be:

```
/opt/fete-store/
  backend/    frontend/    server/    db/    deploy/
```

```bash
chown -R fete:fete /opt/fete-store
```

### 3. Create the database

The app database is a single SQLite file — no server, user, or password to
set up. Run the one-time init script from the repo root:

```bash
cd /opt/fete-store
node db/init-sqlite.cjs
```

This creates `/opt/fete-store/fete_store.db` with the schema and demo
users/data. It's safe to re-run — it checks for existing data and skips
seeding if the file is already populated, so it won't duplicate rows.

> Want to start with an empty store instead of the demo data? Open
> `db/init-sqlite.cjs` and remove the `INSERT` statements from the `seed`
> string before running it — the `CREATE TABLE` statements are all you need.

### 4. Configure the server

```bash
cd /opt/fete-store/server
cp .env.example .env
```

The defaults (`PORT=8080`, `HOST=127.0.0.1`) are fine for a single-VPS setup
behind nginx — nothing else needs changing.

### 5. Build the frontend and install the server

```bash
# Frontend: install deps and produce frontend/dist (uses npm; pnpm also works)
cd /opt/fete-store/frontend
npm install
npm run build

# Server: install deps
cd /opt/fete-store/server
npm install
```

Quick local smoke test (optional):

```bash
cd /opt/fete-store/server
npm run start          # -> "API listening on http://127.0.0.1:8080"
curl localhost:8080/api/health      # -> {"ok":true}
curl -X POST localhost:8080/api/loginUser \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@charity.org","pin":"1234"}'   # -> the admin user
```

Stop it with Ctrl-C once verified.

### 6. Run it as a service

```bash
sudo cp /opt/fete-store/deploy/fete-store.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fete-store
journalctl -u fete-store -f      # watch logs
```

### 7. nginx + HTTPS

`deploy/nginx.conf` is the Docker Compose variant (it proxies to the
`backend` service name, which only resolves inside that network). For this
manual install, write the config directly:

```bash
sudo tee /etc/nginx/sites-available/fete-store <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name fete.example.com;

    client_max_body_size 1m;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        root /opt/fete-store/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
NGINX

sudo ln -s /etc/nginx/sites-available/fete-store /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Replace `fete.example.com` with your domain (or the VPS IP for testing).
Point your domain's DNS A record at the VPS IP, then add TLS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d fete.example.com
```

Open the firewall if needed:

```bash
sudo ufw allow 'Nginx Full' && sudo ufw allow OpenSSH && sudo ufw enable
```

Visit `https://fete.example.com` and log in with `alice@charity.org` / `1234`.

---

## Updating after code changes

**Docker:**

```bash
cd /opt/fete-store && git pull
docker compose up -d --build
```

**Manual install:**

```bash
cd /opt/fete-store && git pull
cd frontend && npm install && npm run build
cd ../server && npm install
sudo systemctl restart fete-store
```

Neither of these touches `fete_store.db`, so existing data survives updates.

## Backing up the database

The entire database is one file: `fete_store.db` at the repo root (manual
install) or inside the `fete_data` Docker volume. Back it up by copying it
while the server is stopped, or use SQLite's online backup:

```bash
# Manual install
sqlite3 /opt/fete-store/fete_store.db ".backup /opt/backups/fete_store-$(date +%F).db"

# Docker
docker compose exec backend sqlite3 /data/fete_store.db ".backup /data/backup-$(date +%F).db"
docker cp fete-store-backend:/data/backup-$(date +%F).db ./
```

## Local development (your machine)

From the repo root, `npm run dev` starts both the API and the Vite dev
server together (Vite proxies `/api` to the Node server, so there's no CORS
setup):

```bash
npm install
npm run dev    # server on :8080, frontend on http://localhost:5173
```

Or run them in two terminals if you want separate log output:

```bash
# terminal 1
cd server && cp .env.example .env
npm install && npm run dev

# terminal 2
cd frontend && npm install && npm run dev    # http://localhost:5173
```

The server expects `fete_store.db` to already have the schema loaded — it
doesn't run migrations itself. If you don't have one yet, create it first:

```bash
node db/init-sqlite.cjs
```

## How the pieces fit together

- **`server/src/index.ts`** sets a global `retoolDb` (backed by SQLite via the
  `sqlite3` driver, see `server/src/db.ts`), auto-discovers every
  `backend/fete/*.ts` file, and exposes each at `POST /api/<functionName>`.
  The original backend functions run **unchanged**.
- **`server/src/db.ts`** opens `fete_store.db` — by default at the repo root,
  or wherever `DB_PATH` points (used by the Docker setup to keep the file on
  a persistent volume).
- **`frontend/hooks/backend/fete.ts`** is a thin `fetch` client that recreates
  the `{ data, loading, error, trigger }` hooks the pages import. `trigger(p)`
  POSTs `p` to `/api/<fn>`.
- **`frontend/lib/shadcn/*`** are the UI components Retool generated at runtime.
- In production the Node server also serves `frontend/dist` with an SPA
  fallback, so the API and the app share one origin.

## Hardening later (optional)

If this goes on the public internet, consider: hashing PINs (bcrypt), issuing a
signed session cookie on login and validating it in an Express middleware on the
`/api` routes, rate-limiting `loginUser`, and adding `helmet`. None of that is
in place today — the behaviour matches the original Retool app.
