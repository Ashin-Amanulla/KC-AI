# Redis / Backend deployment on EC2

The backend uses **bullmq** (Redis-backed) for the pay-hours compute queue.
Endpoints that touch the queue (e.g. `POST /api/pay-hours/compute`) will return
`500 { code: INTERNAL_ERROR, message: "Connection is closed." }` if the backend
cannot reach Redis.

## How Redis must be wired

The backend runs **inside a Docker container**. `127.0.0.1` *inside the container*
is the container itself — it is NOT the host. So `REDIS_URL=redis://127.0.0.1:6379`
points at nothing and bullmq fails.

Correct setup (also what `.github/workflows/deploy-backend.yml` does):

1. Create a docker network `kc-ai-network`.
2. Run a `kc-ai_redis` container **on that network** (`redis:7-alpine`).
   - Do **not** publish port 6379 to the host if the host already runs its own
     redis on `127.0.0.1:6379` (port clash). The backend reaches redis by the
     docker-network service name, which needs no host port.
3. Run the backend on the **same network** with:
   `-e REDIS_URL=redis://kc-ai_redis:6379`

If the backend logs `Redis connected` and `Pay hours worker started`, the
wiring is correct.

## Deploy

Use the safe deploy script (matches CI/CD):

```bash
sudo bash /opt/kc-ai/deploy-backend-safe.sh
```

It loads `kc-ai-backend:latest` from `/opt/kc-ai/backend.tar.gz`, ensures the
`kc-ai_redis` container is on `kc-ai-network`, and starts the backend with the
correct `REDIS_URL`.

## Local dev

`backend/docker-compose.example.yml` brings up both `redis` and `backend` on
`kc-ai-network` with `REDIS_URL=redis://redis:6379` — same principle.
