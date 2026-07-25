#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_REVISION="$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"

: "${EC2_HOST:?EC2_HOST is required (example: ec2-xx-xx-xx-xx.compute-1.amazonaws.com)}"
: "${FERNET_KEY:?FERNET_KEY is required}"
: "${JWT_SECRET_KEY:?JWT_SECRET_KEY is required}"

if [[ ! "$FERNET_KEY" =~ ^[A-Za-z0-9_-]{43}=$ ]]; then
  echo "FERNET_KEY must be a valid 32-byte urlsafe-base64 Fernet key"
  exit 1
fi
if ! printf '%s' "$FERNET_KEY" | python3 -c '
import base64
import sys

value = sys.stdin.buffer.read()
try:
    decoded = base64.urlsafe_b64decode(value)
except Exception:
    raise SystemExit(1)
raise SystemExit(0 if len(decoded) == 32 else 1)
'; then
  echo "FERNET_KEY must decode to exactly 32 bytes"
  exit 1
fi

upsert_env_var() {
  local file="$1" key="$2" value="$3"

  [[ -n "$value" ]] || return 0
  if grep -q "^${key}=" "$file"; then
    local sed_script sed_value
    sed_script="$(mktemp "${file}.XXXXXX")"
    sed_value="${value//\\/\\\\}"
    sed_value="${sed_value//&/\\&}"
    sed_value="${sed_value//|/\\|}"
    umask 077
    printf 's|^%s=.*|%s=%s|\n' "$key" "$key" "$sed_value" > "$sed_script"
    sed -i -f "$sed_script" "$file"
    rm -f "$sed_script"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

EC2_USER="${EC2_USER:-ec2-user}"
DEPLOY_PATH="${DEPLOY_PATH:-~/topvnsport}"
PUBLIC_HOST="${PUBLIC_HOST:-$EC2_HOST}"
DOMAIN_NAME="${DOMAIN_NAME:-topvnsport.com}"
: "${PUBLIC_HOST:?PUBLIC_HOST is required}"
: "${DOMAIN_NAME:?DOMAIN_NAME is required}"
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

echo "[2.1/5] Provision deployment secrets without replacing existing host env"
ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "DEPLOY_PATH='$DEPLOY_PATH' bash -se" <<REMOTE
set -euo pipefail

if [[ "\$DEPLOY_PATH" == ~/* ]]; then
  DEPLOY_PATH="\$HOME/\${DEPLOY_PATH#~/}"
fi

$(declare -f upsert_env_var)

upsert_env_var_from_stdin() {
  local file="\$1" key="\$2" value
  IFS= read -r value || true
  upsert_env_var "\$file" "\$key" "\$value"
}

write_secret() {
  local file="\$1" key="\$2"
  umask 077
  touch "\$file"
  chmod 600 "\$file"
  upsert_env_var_from_stdin "\$file" "\$key"
}

write_secret "\$DEPLOY_PATH/OMS/.env" FERNET_KEY <<'FERNET_VALUE'
${FERNET_KEY}
FERNET_VALUE
write_secret "\$DEPLOY_PATH/OMS/.env" JWT_SECRET_KEY <<'JWT_VALUE'
${JWT_SECRET_KEY}
JWT_VALUE
write_secret "\$DEPLOY_PATH/PMI/.env" JWT_SECRET_KEY <<'JWT_VALUE'
${JWT_SECRET_KEY}
JWT_VALUE
write_secret "\$DEPLOY_PATH/WMS/.env" JWT_SECRET_KEY <<'JWT_VALUE'
${JWT_SECRET_KEY}
JWT_VALUE
write_secret "\$DEPLOY_PATH/identity-service/.env" JWT_SECRET_KEY <<'JWT_VALUE'
${JWT_SECRET_KEY}
JWT_VALUE
REMOTE

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
  sudo -E docker compose --env-file '$DEPLOY_PATH/PMI/.env' -f PMI/docker-compose.prod.yml up -d --build
  sudo -E docker compose --env-file '$DEPLOY_PATH/OMS/.env' -f OMS/docker-compose.prod.yml up -d --build
  sudo -E docker compose --env-file '$DEPLOY_PATH/WMS/.env' -f WMS/docker-compose.prod.yml up -d --build
  sudo -E docker compose --env-file '$DEPLOY_PATH/identity-service/.env' -f identity-service/docker-compose.prod.yml up -d --build
  sudo -E docker compose -f web/docker-compose.prod.yml up -d --build
  
  # Stop legacy reverse-proxy container to release port 80/443
  sudo docker stop reverse-proxy >/dev/null 2>&1 || true
  sudo docker rm reverse-proxy >/dev/null 2>&1 || true

  sudo -E docker compose -f gateway/docker-compose.prod.yml up -d --build
  echo "Waiting for Gateway to be healthy..."
  timeout 60 bash -c 'until curl -sf http://localhost/health > /dev/null 2>&1; do sleep 2; done' || true

  # Fail the deployment if any service migration fails; serving with a stale
  # schema is more dangerous than stopping the rollout for operator recovery.
  echo "Running database migrations..."
  sudo docker exec pim-api alembic upgrade head
  sudo docker exec wms-api alembic upgrade head
  sudo docker exec oms_backend alembic upgrade head
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

# Exercise Fernet decryption through the SQLAlchemy model. Do not print the
# decrypted value; a missing row is a failed smoke check because no decrypt
# path was exercised.
sudo docker exec -i oms_backend python - <<'PY'
from database import SessionLocal
from models import SystemConfig

db = SessionLocal()
try:
    row = db.query(SystemConfig).order_by(SystemConfig.id).first()
    if row is None or row.config_value is None:
        raise SystemExit("OMS Fernet smoke check found no decryptable system_configs row")
    print(f"OMS Fernet decrypt OK: {row.config_key}")
finally:
    db.close()
PY

# Generate a token with identity-service and verify OMS accepts the shared key.
smoke_token="$(sudo docker exec identity-api-prod python -c 'from utils.jwt import create_access_token; print(create_access_token(0, "deploy-smoke", "admin"))')"
smoke_status="$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $smoke_token" "http://api-oms.$DOMAIN_NAME/api/configs/sms")"
unset smoke_token
echo "Identity->OMS JWT smoke check: $smoke_status"
[[ "$smoke_status" == "200" ]] || exit 1

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
