# Redis on Docker (EC2 or local)

## One-off: create network and run Redis

```bash
# Create network (once)
docker network create kc-ai-network

# Download and run Redis (use same network so backend can reach it)
docker pull redis:7-alpine
docker run -d \
  --name kc-ai_redis \
  --network kc-ai-network \
  -p 6379:6379 \
  --restart unless-stopped \
  redis:7-alpine
```

## Backend must use the same network

```bash
docker run -d \
  --name kc-ai_backend \
  --network kc-ai-network \
  -p 3001:3001 \
  -e REDIS_URL=redis://kc-ai_redis:6379 \
  --env-file /opt/kc-ai/.env.production \
  kc-ai-backend:latest
```

## Useful commands

```bash
# Check Redis is up
docker exec kc-ai_redis redis-cli ping
# PONG

# Restart Redis
docker restart kc-ai_redis
```
