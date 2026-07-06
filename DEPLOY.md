# Running Fete Store Manager on an IONOS VPS

This app was originally hosted by Retool. It has been converted to run
standalone: a **Node/Express** server serves a REST API (reusing the original
`backend/fete/*.ts` functions) **and** the built React frontend, backed by a
**PostgreSQL** database, behind an **nginx** reverse proxy.

```
Browser ──▶ nginx (:80/:443) ──▶ Node server (:8080) ──▶ PostgreSQL (:5432)
                                   │
                                   └─ serves frontend/dist (static React app)
```

> **Security note:** As requested, the original auth model is kept as-is —
> PINs are stored in plaintext and the session lives only in the browser. This
> is fine on a trusted/internal deployment but is **not** hardened for the
> public internet. See "Hardening later" at the end.

---

## 1. Provision the VPS

If you want to deploy with Docker on the VPS at 217.154.60.212, use the Docker path below instead of the manual Node/Postgres setup:

```bash
ssh timmi@217.154.60.212
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git curl
sudo usermod -aG docker $USER
newgrp docker
```

After reconnecting, clone the repository to /opt/fete-store and copy the environment file:

```bash
sudo mkdir -p /opt/fete-store
sudo chown -R timmi:timmi /opt/fete-store
cd /opt/fete-store
git clone <your-repo-url> .
cp .env.example .env
```

Update .env with the Docker password you want to use, then start the stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d --build
```

The app should be reachable at http://217.154.60.212/.

---

## 1. Provision the VPS

On a fresh IONOS Ubuntu 22.04/24.04 server, as root (or with `sudo`):

```bash
apt update && apt upgrade -y
apt install -y nginx postgresql git curl

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Create a non-root user to run the app:

```bash
adduser --system --group --home /opt/fete-store fete
```

## 2. Get the code onto the server

Copy this project to `/opt/fete-store` (via `git clone`, `scp`, or rsync). The
layout should be:

```
/opt/fete-store/
  backend/    frontend/    server/    db/    deploy/
```

```bash
chown -R fete:fete /opt/fete-store
```

## 3. Create the database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER fete_user WITH PASSWORD 'CHANGE_ME_STRONG';
CREATE DATABASE fete_store OWNER fete_user;
SQL

# Load schema + demo data
psql "postgres://fete_user:CHANGE_ME_STRONG@localhost:5432/fete_store" -f /opt/fete-store/db/schema.sql
psql "postgres://fete_user:CHANGE_ME_STRONG@localhost:5432/fete_store" -f /opt/fete-store/db/seed.sql
```

> Skip `seed.sql` if you don't want the demo users/data. The seed truncates the
> tables first, so never run it against a database with real data.

## 4. Configure the server

```bash
cd /opt/fete-store/server
cp .env.example .env
```

Edit `.env`:

```ini
DATABASE_URL=postgres://fete_user:CHANGE_ME_STRONG@localhost:5432/fete_store
PGSSL=false
PORT=8080
HOST=127.0.0.1
```

## 5. Build the frontend and install the server

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

## 6. Run it as a service

```bash
sudo cp /opt/fete-store/deploy/fete-store.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fete-store
journalctl -u fete-store -f      # watch logs
```

## 7. nginx + HTTPS

```bash
sudo cp /opt/fete-store/deploy/nginx.conf /etc/nginx/sites-available/fete-store
# edit server_name to your domain
sudo ln -s /etc/nginx/sites-available/fete-store /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

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

```bash
cd /opt/fete-store && git pull
cd frontend && npm install && npm run build
cd ../server && npm install
sudo systemctl restart fete-store
```

## Local development (your machine)

Run the API and the Vite dev server in two terminals — Vite proxies `/api` to
the Node server, so there's no CORS setup:

```bash
# terminal 1
cd server && cp .env.example .env   # point DATABASE_URL at a local Postgres
npm install && npm run dev

# terminal 2
cd frontend && npm install && npm run dev    # http://localhost:5173
```

## How the pieces fit together

- **`server/src/index.ts`** sets a global `retoolDb` (backed by the `pg`
  driver, see `server/src/db.ts`), auto-discovers every `backend/fete/*.ts`
  file, and exposes each at `POST /api/<functionName>`. The original backend
  functions run **unchanged**.
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
