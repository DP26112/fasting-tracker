# Deployment guide — Hetzner VPS + Docker Compose + Caddy

This file shows the minimal steps and exact commands to deploy the `fasting-tracker` app
to a Hetzner VPS using Docker Compose and Caddy as a reverse proxy. It assumes:

- You control the DNS for `fasting.davorinpiljic.com` and it points to the VPS IP.
- Docker and Docker Compose (v2) are installed on the VPS.
- Caddy is running on the VPS and connected to the Docker socket or is able to reach
  containers on the `caddy_default` Docker network.

Files created in this repository for deployment:

- `Dockerfile.server` — builds the Node/Express server and embeds `client/dist`.
- `Dockerfile.client` — builds the client (optional; server copies `client/dist`).
- `docker-compose.yml` — service `fasting_app` and networks (connects to `caddy_default`).
- `caddy_snippet.txt` — Caddyfile block to reverse_proxy `fasting.davorinpiljic.com` to the service.
- `.env.deploy.example` — example environment variables for deployment.

Before you start
1. On your local machine build the client production bundle (or build on VPS):

```bash
cd client
npm ci
npm run build   # or: ./node_modules/.bin/vite build
cd ..
```

This will create `client/dist` which Dockerfile.server copies into the server image.

2. Copy the repository to your Hetzner VPS (git clone or rsync). On the VPS create a
   `.env.deploy` file using the example provided:

```bash
cp .env.deploy.example .env.deploy
# edit .env.deploy and fill in MONGO_URI, JWT_SECRET, EMAIL_* etc.
```

Deployment (exact Docker Compose commands)

On the VPS, from the repository root run these exact commands:

```bash
# Build the image and start containers in detached mode
docker compose --env-file .env.deploy up -d --build

# Check container status
docker compose ps

# View logs (server)
docker compose logs -f fasting_app

# To stop and remove containers
docker compose down
```

Notes about Caddy
- If you run Caddy as a container that manages TLS, make sure it uses (or is attached to)
  the same Docker network named `caddy_default` (the snippet in `docker-compose.yml` assumes
  an external network `caddy_default`). If you run Caddy with the official image and want it
  to auto-discover containers by network alias, start Caddy with `--network caddy_default`.

Add the following block to your Caddyfile (or include `caddy_snippet.txt` contents):

```
fasting.davorinpiljic.com {
    reverse_proxy fasting_app:8080 {
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
        header_up Host {host}
    }
}
```

Troubleshooting
- If Caddy reports certificate issues, verify DNS records for the domain point to the VPS
  and that ports 80 and 443 are open.
- If the app cannot reach MongoDB, verify `MONGO_URI` in `.env.deploy` and that the MongoDB
  instance (Atlas or local) allows connections from the VPS.

Security recommendations
- Keep secrets out of git. Use `.env.deploy` on the server only and set proper filesystem
  permissions. Consider Docker secrets or a secrets manager for higher security.

That's it — if you'd like, I can also generate a small systemd unit for auto-start or a
GitHub Actions workflow to build/push images to a registry and deploy from there.
