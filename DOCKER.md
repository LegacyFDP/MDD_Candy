# Docker Setup Guide for Fete Store Manager

This project is containerized using Docker and Docker Compose. Two services
run in isolated containers: the Node.js backend (with its SQLite database
file on a persistent volume) and an Nginx reverse proxy serving the built
frontend.

## Architecture

```
Browser ──▶ nginx (:80) ──▶ Node backend (:8080) ──▶ fete_store.db (SQLite, on the fete_data volume)
                │
                └─ serves frontend/dist (built React app)
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)

## Quick Start

### 1. Set up environment variables

```bash
cp .env.example .env
```

There's no database password to configure — the app database is a single
SQLite file that lives on the `fete_data` volume. `.env` only needs
`NODE_ENV=production` (the default if you skip this step).

### 2. Build and start all services

```bash
docker compose up --build
```

This will:
- Build the backend image from `Dockerfile.backend`
- Build the frontend image from `Dockerfile.frontend`
- Create and start both containers
- On first boot, the backend runs `db/init-sqlite.cjs` to create the schema
  and load demo data into `fete_store.db` on the `fete_data` volume (it
  no-ops on later boots since the file already has data)

First run may take a minute or two while building.

### 3. Verify everything is running

```bash
docker compose ps
```

You should see two running containers:
- `fete-store-backend` (Node.js server)
- `fete-store-proxy` (Nginx)

### 4. Access the application

Open your browser and navigate to:

```
http://localhost
```

The Nginx reverse proxy will serve the frontend and route API calls to the backend.

## Common Commands

### View logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f nginx
```

### Stop services

```bash
# Stop but keep data
docker compose stop

# Stop and remove containers (data persists in the fete_data volume)
docker compose down

# Stop and remove everything including the database volume
docker compose down -v
```

### Restart services

```bash
docker compose restart

# Restart specific service
docker compose restart backend
```

### Shell access

```bash
# Backend container
docker compose exec backend sh

# Nginx
docker compose exec nginx sh
```

## Development Workflow

### Running in development mode

Edit `docker-compose.yml` and modify the backend service:

```yaml
backend:
  # ... other settings ...
  environment:
    NODE_ENV: development  # Changed from production
  # Add this to rebuild on code changes:
  volumes:
    - ./server/src:/app/src
```

Then restart:

```bash
docker compose up --build backend
```

### Rebuilding images

If you make changes to source code:

```bash
# Rebuild specific service
docker compose up --build backend

# Rebuild all
docker compose up --build
```

### Database management

The database is a single file, `/data/fete_store.db` inside the backend
container, persisted on the `fete_data` volume.

#### Open a shell into the database

```bash
docker compose exec backend sh -c "apt-get install -y sqlite3 2>/dev/null; sqlite3 /data/fete_store.db"
```

(the backend image is `node:22-bookworm-slim` and doesn't ship the `sqlite3`
CLI by default — the one-liner above installs it on demand inside the
running container; it doesn't persist across rebuilds.)

#### Reset the database

```bash
# Remove the volume (this deletes the data)
docker compose down -v

# Restart — db/init-sqlite.cjs recreates the schema and demo data
docker compose up
```

#### Back up the database

```bash
docker compose exec backend sqlite3 /data/fete_store.db ".backup /data/backup-$(date +%F).db"
docker cp fete-store-backend:/data/backup-$(date +%F).db ./
```

#### Restore from a backup

```bash
docker cp ./backup-2026-01-01.db fete-store-backend:/data/fete_store.db
docker compose restart backend
```

## Production Deployment

### Using Docker Swarm or Kubernetes

The images created here can be pushed to a registry and deployed on production clusters.

```bash
# Build and tag images
docker build -f Dockerfile.backend -t your-registry/fete-backend:latest .
docker build -f Dockerfile.frontend -t your-registry/fete-frontend:latest .

# Push to registry
docker push your-registry/fete-backend:latest
docker push your-registry/fete-frontend:latest
```

> Note: a single SQLite file doesn't support multiple backend replicas
> writing concurrently. Keep the backend at one replica, or migrate to a
> networked database first.

### SSL/TLS

For production, use a reverse proxy with SSL termination (e.g., Traefik, nginx-ingress, or your cloud provider's load balancer).

Alternatively, update the `deploy/nginx.conf` to include SSL configuration and mount certificates into the nginx container.

### Environment Variables

For production, use a `.env` file with `NODE_ENV=production`:

```bash
docker compose --env-file .env.prod up -d
```

## Troubleshooting

### Nginx can't reach backend

**Error:** `502 Bad Gateway`

**Solution:** Check backend health:

```bash
docker compose logs backend
docker compose exec nginx curl http://backend:8080/api/health
```

### Permission denied errors

**Solution:** Ensure Docker daemon is running and you have permissions. On Linux:

```bash
sudo usermod -aG docker $USER
# Log out and back in, or:
newgrp docker
```

### Port already in use

**Error:** `port is already in use`

**Solution:** Change port mappings in `docker-compose.yml`:

```yaml
services:
  nginx:
    ports:
      - "8000:80"  # Changed from 80
```

Or stop the service using the port:

```bash
# Find what's using port 80
sudo lsof -i :80
# Kill it or change docker-compose.yml
```

## Files Reference

- **`Dockerfile.backend`** — Builds the Node.js backend image; runs
  `db/init-sqlite.cjs` on first boot, then starts the server
- **`Dockerfile.frontend`** — Multi-stage build for React frontend + Nginx
- **`docker-compose.yml`** — Orchestrates the backend and nginx services
- **`.dockerignore`** — Excludes unnecessary files from Docker build context
- **`.env.example`** — Template for environment variables
- **`deploy/nginx.conf`** — Nginx reverse proxy configuration
- **`db/init-sqlite.cjs`** — Creates `fete_store.db` (schema + demo data) on
  first boot; safe to re-run, it skips seeding if data already exists
- **`db/schema.sql` / `db/seed.sql`** — Reference-only Postgres equivalents,
  not used by this Docker setup (see the note at the top of each file)

## Next Steps

1. Update `deploy/nginx.conf` for your domain
2. For SSL, add certificates and update nginx config
3. Set up a periodic backup of the `fete_data` volume (see "Back up the
   database" above)
4. Consider adding a CI/CD pipeline to automatically build and push images
