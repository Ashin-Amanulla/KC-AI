#!/usr/bin/env bash
set -euo pipefail

# Safe deploy for the kc-ai backend on EC2.
# Mirrors .github/workflows/deploy-backend.yml: the backend and Redis run on a
# shared docker network (kc-ai-network) and the backend reaches Redis via the
# service name (kc-ai_redis), NOT 127.0.0.1 (which inside the container is the
# container itself and has no Redis -> bullmq "Connection is closed" 500s).

APP_DIR='/opt/kc-ai'
ENV_FILE='/opt/kc-ai/.env.production'
NETWORK_NAME='kc-ai-network'
REDIS_IMAGE='redis:7-alpine'
IMAGE_TAR="$APP_DIR/backend.tar.gz"
MIN_FREE_MB='1500'

free_mb() {
  df -Pm / | awk 'NR==2 {print $4}'
}

safe_cleanup() {
  echo '[guard] Running cleanup to free disk...'
  sudo docker system prune -af >/dev/null 2>&1 || true
  sudo apt-get clean >/dev/null 2>&1 || true
  sudo journalctl --vacuum-size=100M >/dev/null 2>&1 || true
}

ensure_space() {
  local current
  current="$(free_mb)"
  if [ "$current" -lt "$MIN_FREE_MB" ]; then
    echo "[guard] Low disk: ${current}MB free (< ${MIN_FREE_MB}MB)."
    safe_cleanup
    current="$(free_mb)"
    if [ "$current" -lt "$MIN_FREE_MB" ]; then
      echo "[guard] ERROR: still low disk after cleanup (${current}MB free). Aborting deploy."
      exit 1
    fi
    echo "[guard] Disk OK after cleanup: ${current}MB free."
  else
    echo "[guard] Disk OK: ${current}MB free."
  fi
}

echo 'Starting kc-ai backend deployment...'
mkdir -p "$APP_DIR"

ensure_space

echo 'Creating Docker network if not exists...'
sudo docker network create "$NETWORK_NAME" 2>/dev/null || true

echo 'Ensuring Redis is running on the kc-ai network...'
if ! sudo docker ps -a --format '{{.Names}}' | grep -q '^kc-ai_redis$'; then
  sudo docker pull "$REDIS_IMAGE"
  # NOTE: do NOT publish 6379 to the host. The host may already run a redis on
  # 127.0.0.1:6379; publishing would clash. The backend reaches redis by the
  # docker-network service name (kc-ai_redis), which does not need a host port.
  sudo docker run -d --name kc-ai_redis --network "$NETWORK_NAME" --restart unless-stopped "$REDIS_IMAGE"
else
  sudo docker start kc-ai_redis 2>/dev/null || true
  if ! sudo docker network inspect "$NETWORK_NAME" --format '{{range .Containers}}{{.Name}} {{end}}' | grep -q 'kc-ai_redis'; then
    sudo docker network connect "$NETWORK_NAME" kc-ai_redis 2>/dev/null || true
  fi
fi

if [ ! -f "$IMAGE_TAR" ]; then
  echo "ERROR: image tar not found: $IMAGE_TAR"
  exit 1
fi

echo 'Loading Docker image from tar...'
gunzip -c "$IMAGE_TAR" | sudo docker load

echo 'Restarting backend container...'
sudo docker stop kc-ai_backend >/dev/null 2>&1 || true
sudo docker rm kc-ai_backend >/dev/null 2>&1 || true
sudo docker run -d --name kc-ai_backend --network "$NETWORK_NAME" -p 3001:3001 --restart unless-stopped --env-file "$ENV_FILE" -e REDIS_URL=redis://kc-ai_redis:6379 kc-ai-backend:latest >/dev/null

echo 'Verifying deployment...'
sudo docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' | grep -E 'kc-ai_backend|kc-ai_redis'

echo 'kc-ai backend deployed successfully'
