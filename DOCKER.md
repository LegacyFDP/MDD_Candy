# Docker notes

Docker is no longer part of the recommended deployment path for this app.

The supported setup is now:

- Node.js + Express for the API and the built frontend
- Caddy as the reverse proxy
- SQLite as the database file

Use [DEPLOY.md](DEPLOY.md) for the production setup. The Docker files in this repository are only left in place for legacy experimentation and are not required for the simplified deployment.
