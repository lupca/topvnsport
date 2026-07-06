#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

: "${EC2_HOST:?EC2_HOST is required (example: ec2-xx-xx-xx-xx.compute-1.amazonaws.com)}"
EC2_USER="${EC2_USER:-ec2-user}"
DEPLOY_PATH="${DEPLOY_PATH:-~/topvnsport}"
PUBLIC_HOST="${PUBLIC_HOST:-$EC2_HOST}"
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
  export PUBLIC_HOST='$PUBLIC_HOST'
  sudo -E docker compose -f PMI/docker-compose.prod.yml up -d --build
  sudo -E docker compose -f OMS/docker-compose.prod.yml up -d --build
  sudo -E docker compose -f WMS/docker-compose.prod.yml up -d --build
  sudo -E docker compose -f web/docker-compose.prod.yml up -d --build
"

echo "[4/5] Health checks"
ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "
  set -euo pipefail
  for u in \
    http://localhost:18100/docs \
    http://localhost:18101/docs \
    http://localhost:18102/docs \
    http://localhost:13100 \
    http://localhost:13101 \
    http://localhost:13102 \
    http://localhost:13103; do
    code=\$(curl -s -o /dev/null -w '%{http_code}' \"\$u\")
    echo \"\$code \$u\"
    [[ \"\$code\" == \"200\" ]] || exit 1
  done
"

echo "[5/5] Running containers"
ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo "Deployment completed successfully."
