#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_REVISION="$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"

: "${EC2_HOST:?EC2_HOST is required (example: ec2-xx-xx-xx-xx.compute-1.amazonaws.com)}"
EC2_USER="${EC2_USER:-ec2-user}"
DEPLOY_PATH="${DEPLOY_PATH:-~/topvnsport}"
PUBLIC_HOST="${PUBLIC_HOST:-$EC2_HOST}"
DOMAIN_NAME="${DOMAIN_NAME:-topvnsport.com}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_ed25519}"
SSH_KEY_PATH="${SSH_KEY_PATH/#\~/$HOME}"
SSH_KEY_PATH="${SSH_KEY_PATH//\$HOME/$HOME}"

if [[ ! -f "$SSH_KEY_PATH" ]]; then
  echo "SSH key not found at $SSH_KEY_PATH"
  exit 1
fi

SSH_OPTS=(
  -i "$SSH_KEY_PATH"
  -o BatchMode=yes
  -o StrictHostKeyChecking=yes
)

RSYNC_RSH="ssh ${SSH_OPTS[*]}"

echo "[1/5] Sync source to $EC2_USER@$EC2_HOST:$DEPLOY_PATH"
rsync -az --delete \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '*.env' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'dist' \
  --exclude '__pycache__' \
  -e "$RSYNC_RSH" \
  "$ROOT_DIR/" "$EC2_USER@$EC2_HOST:$DEPLOY_PATH/"
ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "printf '%s\n' '$DEPLOY_REVISION' > $DEPLOY_PATH/.deploy_revision"

echo "[2/5] Ensure Docker + Compose plugin are available on server"
ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "
  set -euo pipefail
  if ! command -v docker >/dev/null 2>&1; then
    sudo yum install -y docker
    sudo systemctl enable --now docker
    sudo usermod -aG docker $EC2_USER || true
  fi
  if ! sudo docker compose version >/dev/null 2>&1; then
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    sudo curl -fsSL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 -o /tmp/docker-compose
    sudo install -m 0755 /tmp/docker-compose /usr/local/lib/docker/cli-plugins/docker-compose
    rm -f /tmp/docker-compose
  fi
"

echo "[3/5] Build and start production stacks"
ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "
  set -euo pipefail
  cd $DEPLOY_PATH
  if [[ ! -f web/.env ]]; then
    if [[ -f web/.env.example ]]; then
      cp web/.env.example web/.env
    else
      touch web/.env
    fi
  fi
  sudo docker network create pmi_default >/dev/null 2>&1 || true
  sudo docker network create oms_default >/dev/null 2>&1 || true
  sudo docker network create wms_default >/dev/null 2>&1 || true
  sudo docker network create identity_default >/dev/null 2>&1 || true
  sudo docker network create gateway_network >/dev/null 2>&1 || true
  export PUBLIC_HOST='$PUBLIC_HOST'
  sudo -E docker compose -f PMI/docker-compose.prod.yml up -d --build
  sudo -E docker compose -f OMS/docker-compose.prod.yml up -d --build
  sudo -E docker compose -f WMS/docker-compose.prod.yml up -d --build
  sudo -E docker compose -f identity-service/docker-compose.prod.yml up -d --build
  sudo -E docker compose -f web/docker-compose.prod.yml up -d --build
  
  # Stop legacy reverse-proxy container to release port 80/443
  sudo docker stop reverse-proxy >/dev/null 2>&1 || true
  sudo docker rm reverse-proxy >/dev/null 2>&1 || true

  sudo -E docker compose -f gateway/docker-compose.prod.yml up -d --build
  echo "Waiting for Gateway to be healthy..."
  timeout 60 bash -c 'until curl -sf http://localhost/health > /dev/null 2>&1; do sleep 2; done' || true
"

echo "[4/5] Health checks"
ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "
  set -euo pipefail
  for u in \
    http://api-pmi.$DOMAIN_NAME/docs \
    http://api-oms.$DOMAIN_NAME/docs \
    http://api-wms.$DOMAIN_NAME/docs \
    http://api-identity.$DOMAIN_NAME/health \
    http://pmi.$DOMAIN_NAME \
    http://oms.$DOMAIN_NAME \
    http://wms.$DOMAIN_NAME \
    http://identity.$DOMAIN_NAME \
    http://$DOMAIN_NAME; do
    code=\$(curl -s -o /dev/null -w '%{http_code}' \"\$u\")
    echo \"\$code \$u\"
    [[ \"\$code\" == \"200\" ]] || exit 1
  done
"

echo "[4.1/5] Post-deploy smoke checks"
ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "DEPLOY_PATH='$DEPLOY_PATH' bash -se" <<'REMOTE'
set -euo pipefail

if [[ "$DEPLOY_PATH" == ~/* ]]; then
  DEPLOY_PATH="$HOME/${DEPLOY_PATH#~/}"
fi

cd "$DEPLOY_PATH"

# Ensure storefront bundle does not carry localhost API URLs.
sudo docker exec web_frontend sh -lc "if grep -R -E 'localhost:18100|localhost:18101' -n /usr/share/nginx/html >/tmp/web_localhost_hits 2>/dev/null; then if [ -s /tmp/web_localhost_hits ]; then cat /tmp/web_localhost_hits; exit 1; fi; fi"

# Verify WMS can resolve and call PMI over Docker network.
sudo docker exec -i wms-api python - <<'PY'
import urllib.request
with urllib.request.urlopen('http://pim-api:8000/docs', timeout=5) as resp:
    if resp.status != 200:
        raise SystemExit(f'Unexpected PMI status: {resp.status}')
print('WMS->PMI connectivity OK')
PY

# Mark deployed revision for observability.
if [[ -f .deploy_revision ]]; then
  echo "Deployed revision: $(cat .deploy_revision)"
else
  echo "Deployed revision: missing"
fi
REMOTE

echo "[5/5] Running containers"
ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo "Deployment completed successfully."
