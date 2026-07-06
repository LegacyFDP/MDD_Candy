# Docker Setup Guide for Fete Store Manager

This project is now containerized using Docker and Docker Compose. All services (PostgreSQL, Node.js backend, and Nginx reverse proxy with frontend) run in isolated containers.

## Architecture

```
Browser ──▶ nginx (:80) ──▶ Node backend (:8080) ──▶ PostgreSQL (:5432)
                │
                └─ serves frontend/dist (built React app)
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v1.29+)

## Quick Start

### 1. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and change `DB_PASSWORD` to a strong password:

```ini
DB_PASSWORD=your_strong_password_here
```

> This password will be used for the PostgreSQL `fete_user` and in the `DATABASE_URL`.

### 2. Build and start all services

```bash
docker-compose up --build
```

This will:
- Pull the base images (postgres:15, node:20, nginx:alpine)
- Build the backend image from `Dockerfile.backend`
- Build the frontend image from `Dockerfile.frontend`
- Create and start all three containers
- Initialize the PostgreSQL database with schema and seed data

First run may take 2-3 minutes while building and initializing.

### 3. Verify everything is running

```bash
docker-compose ps
```

You should see three running containers:
- `fete-store-db` (PostgreSQL)
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
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f nginx
```

### Stop services

```bash
# Stop but keep data
docker-compose stop

# Stop and remove containers (data persists in volumes)
docker-compose down

# Stop and remove everything including volumes
docker-compose down -v
```

### Restart services

```bash
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Shell access

```bash
# Backend container
docker-compose exec backend sh

# PostgreSQL
docker-compose exec postgres psql -U fete_user -d fete_store

# Nginx
docker-compose exec nginx sh
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
docker-compose up --build backend
```

### Rebuilding images

If you make changes to source code:

```bash
# Rebuild specific service
docker-compose up --build backend

# Rebuild all
docker-compose up --build
```

### Database management

#### View database

```bash
docker-compose exec postgres psql -U fete_user -d fete_store
```

#### Reset database

```bash
# Remove the volume (this deletes the data)
docker-compose down -v

# Restart - schema will be reloaded from db/schema.sql
docker-compose up
```

#### Dump database

```bash
docker-compose exec postgres pg_dump -U fete_user fete_store > backup.sql
```

#### Restore database

```bash
docker-compose exec postgres psql -U fete_user fete_store < backup.sql
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

### SSL/TLS

For production, use a reverse proxy with SSL termination (e.g., Traefik, nginx-ingress, or your cloud provider's load balancer).

Alternatively, update the `deploy/nginx.conf` to include SSL configuration and mount certificates into the nginx container.

### Environment Variables

For production, use a `.env` file with strong credentials and set `NODE_ENV=production`:

```bash
docker-compose --env-file .env.prod up -d
```

## Troubleshooting

### Backend can't connect to database

**Error:** `getaddrinfo ENOTFOUND postgres`

**Solution:** Ensure PostgreSQL is healthy before backend starts:

```bash
docker-compose ps
docker-compose logs postgres
```

### Nginx can't reach backend

**Error:** `502 Bad Gateway`

**Solution:** Check backend health:

```bash
docker-compose logs backend
docker-compose exec nginx curl http://backend:8080/api/health
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

- **`Dockerfile.backend`** — Builds Node.js backend image
- **`Dockerfile.frontend`** — Multi-stage build for React frontend + Nginx
- **`docker-compose.yml`** — Orchestrates all three services
- **`.dockerignore`** — Excludes unnecessary files from Docker build context
- **`.env.example`** — Template for environment variables
- **`deploy/nginx.conf`** — Nginx reverse proxy configuration
- **`db/schema.sql`** — Automatically runs on first `postgres` container startup
- **`db/seed.sql`** — Optional demo data (loaded by default)

## Next Steps

1. Customize `.env` with production credentials
2. Update `deploy/nginx.conf` for your domain
3. For SSL, add certificates and update nginx config
4. Consider adding a CI/CD pipeline to automatically build and push images
5. Document any additional services or customizations specific to your deployment
