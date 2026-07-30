#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_REVISION="$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"

: "${EC2_HOST:?EC2_HOST is required (example: ec2-xx-xx-xx-xx.compute-1.amazonaws.com)}"
: "${DOMAIN_NAME:?DOMAIN_NAME is required}"
: "${PIM_API_URL:?PIM_API_URL is required}"
: "${OMS_API_URL:?OMS_API_URL is required}"
: "${WMS_API_URL:?WMS_API_URL is required}"
: "${IDENTITY_API_URL:?IDENTITY_API_URL is required}"
: "${PIM_URL:?PIM_URL is required}"
: "${OMS_URL:?OMS_URL is required}"
: "${WMS_URL:?WMS_URL is required}"
: "${IDENTITY_URL:?IDENTITY_URL is required}"
: "${CORS_ALLOWED_ORIGINS:?CORS_ALLOWED_ORIGINS is required}"
: "${FERNET_KEY:?FERNET_KEY is required}"
: "${JWT_SECRET_KEY:?JWT_SECRET_KEY is required}"
: "${INTERNAL_SERVICE_TOKEN:?INTERNAL_SERVICE_TOKEN is required}"
: "${ALLOWED_SERVICE_KEYS:?ALLOWED_SERVICE_KEYS is required}"
: "${RDS_HOST:?RDS_HOST is required}"
: "${RDS_USER:?RDS_USER is required}"
: "${RDS_PASSWORD:?RDS_PASSWORD is required}"
: "${RDS_SSLMODE:?RDS_SSLMODE is required}"
: "${S3_PUBLIC_BASE_URL:?S3_PUBLIC_BASE_URL is required}"

if [[ "$RDS_SSLMODE" != "require" ]]; then
  echo "RDS_SSLMODE must be require"
  exit 1
fi

if [[ "$DOMAIN_NAME" != "voma.vn" ]]; then
  echo "DOMAIN_NAME must be voma.vn"
  exit 1
fi

require_voma_https_url() {
  local name="$1" value="${!1}"
  if [[ ! "$value" =~ ^https://([a-z0-9-]+\.)*voma\.vn(/[^[:space:]]*)?$ ]]; then
    echo "$name must be an HTTPS voma.vn URL"
    exit 1
  fi
}

for https_url_name in \
  PIM_API_URL \
  OMS_API_URL \
  WMS_API_URL \
  IDENTITY_API_URL \
  PIM_URL \
  OMS_URL \
  WMS_URL \
  IDENTITY_URL \
  S3_PUBLIC_BASE_URL; do
  require_voma_https_url "$https_url_name"
done

IFS=',' read -r -a cors_origins <<< "$CORS_ALLOWED_ORIGINS"
for cors_origin in "${cors_origins[@]}"; do
  if [[ ! "$cors_origin" =~ ^https://([a-z0-9-]+\.)*voma\.vn$ ]]; then
    echo "CORS_ALLOWED_ORIGINS must contain HTTPS voma.vn origins only"
    exit 1
  fi
done

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
    if [[ -s "$file" ]] && [[ "$(tail -c 1 "$file" | od -An -t x1)" != *0a* ]]; then
      printf '\n' >> "$file"
    fi
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

EC2_USER="${EC2_USER:-ec2-user}"
DEPLOY_PATH="${DEPLOY_PATH:-~/topvnsport}"
PUBLIC_HOST="${PUBLIC_HOST:-$EC2_HOST}"
: "${PUBLIC_HOST:?PUBLIC_HOST is required}"
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
  --exclude '.env.*' \
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
write_secret "\$DEPLOY_PATH/OMS/.env" INTERNAL_SERVICE_TOKEN <<'INTERNAL_SERVICE_TOKEN_VALUE'
${INTERNAL_SERVICE_TOKEN}
INTERNAL_SERVICE_TOKEN_VALUE
write_secret "\$DEPLOY_PATH/OMS/.env" CORS_ALLOWED_ORIGINS <<'CORS_ALLOWED_ORIGINS_VALUE'
${CORS_ALLOWED_ORIGINS}
CORS_ALLOWED_ORIGINS_VALUE
write_secret "\$DEPLOY_PATH/OMS/.env" OMS_API_URL <<'OMS_API_URL_VALUE'
${OMS_API_URL}
OMS_API_URL_VALUE
write_secret "\$DEPLOY_PATH/OMS/.env" WMS_API_URL <<'WMS_API_URL_VALUE'
${WMS_API_URL}
WMS_API_URL_VALUE
write_secret "\$DEPLOY_PATH/OMS/.env" IDENTITY_URL <<'IDENTITY_URL_VALUE'
${IDENTITY_URL}
IDENTITY_URL_VALUE
write_secret "\$DEPLOY_PATH/OMS/.env" RDS_HOST <<'RDS_HOST_VALUE'
${RDS_HOST}
RDS_HOST_VALUE
write_secret "\$DEPLOY_PATH/OMS/.env" RDS_USER <<'RDS_USER_VALUE'
${RDS_USER}
RDS_USER_VALUE
write_secret "\$DEPLOY_PATH/OMS/.env" RDS_PASSWORD <<'RDS_PASSWORD_VALUE'
${RDS_PASSWORD}
RDS_PASSWORD_VALUE
write_secret "\$DEPLOY_PATH/OMS/.env" RDS_SSLMODE <<'RDS_SSLMODE_VALUE'
${RDS_SSLMODE}
RDS_SSLMODE_VALUE
write_secret "\$DEPLOY_PATH/PMI/.env" JWT_SECRET_KEY <<'JWT_VALUE'
${JWT_SECRET_KEY}
JWT_VALUE
write_secret "\$DEPLOY_PATH/PMI/.env" INTERNAL_SERVICE_TOKEN <<'INTERNAL_SERVICE_TOKEN_VALUE'
${INTERNAL_SERVICE_TOKEN}
INTERNAL_SERVICE_TOKEN_VALUE
write_secret "\$DEPLOY_PATH/PMI/.env" ALLOWED_SERVICE_KEYS <<'ALLOWED_SERVICE_KEYS_VALUE'
${ALLOWED_SERVICE_KEYS}
ALLOWED_SERVICE_KEYS_VALUE
write_secret "\$DEPLOY_PATH/PMI/.env" PIM_API_URL <<'PIM_API_URL_VALUE'
${PIM_API_URL}
PIM_API_URL_VALUE
write_secret "\$DEPLOY_PATH/PMI/.env" WMS_API_URL <<'WMS_API_URL_VALUE'
${WMS_API_URL}
WMS_API_URL_VALUE
write_secret "\$DEPLOY_PATH/PMI/.env" IDENTITY_URL <<'IDENTITY_URL_VALUE'
${IDENTITY_URL}
IDENTITY_URL_VALUE
write_secret "\$DEPLOY_PATH/WMS/.env" JWT_SECRET_KEY <<'JWT_VALUE'
${JWT_SECRET_KEY}
JWT_VALUE
write_secret "\$DEPLOY_PATH/WMS/.env" INTERNAL_SERVICE_TOKEN <<'INTERNAL_SERVICE_TOKEN_VALUE'
${INTERNAL_SERVICE_TOKEN}
INTERNAL_SERVICE_TOKEN_VALUE
write_secret "\$DEPLOY_PATH/WMS/.env" CORS_ALLOWED_ORIGINS <<'CORS_ALLOWED_ORIGINS_VALUE'
${CORS_ALLOWED_ORIGINS}
CORS_ALLOWED_ORIGINS_VALUE
write_secret "\$DEPLOY_PATH/WMS/.env" WMS_API_URL <<'WMS_API_URL_VALUE'
${WMS_API_URL}
WMS_API_URL_VALUE
write_secret "\$DEPLOY_PATH/WMS/.env" PIM_API_URL <<'PIM_API_URL_VALUE'
${PIM_API_URL}
PIM_API_URL_VALUE
write_secret "\$DEPLOY_PATH/WMS/.env" IDENTITY_URL <<'IDENTITY_URL_VALUE'
${IDENTITY_URL}
IDENTITY_URL_VALUE
write_secret "\$DEPLOY_PATH/WMS/.env" RDS_HOST <<'RDS_HOST_VALUE'
${RDS_HOST}
RDS_HOST_VALUE
write_secret "\$DEPLOY_PATH/WMS/.env" RDS_USER <<'RDS_USER_VALUE'
${RDS_USER}
RDS_USER_VALUE
write_secret "\$DEPLOY_PATH/WMS/.env" RDS_PASSWORD <<'RDS_PASSWORD_VALUE'
${RDS_PASSWORD}
RDS_PASSWORD_VALUE
write_secret "\$DEPLOY_PATH/WMS/.env" RDS_SSLMODE <<'RDS_SSLMODE_VALUE'
${RDS_SSLMODE}
RDS_SSLMODE_VALUE
write_secret "\$DEPLOY_PATH/identity-service/.env" JWT_SECRET_KEY <<'JWT_VALUE'
${JWT_SECRET_KEY}
JWT_VALUE
write_secret "\$DEPLOY_PATH/identity-service/.env" IDENTITY_API_URL <<'IDENTITY_API_URL_VALUE'
${IDENTITY_API_URL}
IDENTITY_API_URL_VALUE
write_secret "\$DEPLOY_PATH/identity-service/.env" PIM_URL <<'PIM_URL_VALUE'
${PIM_URL}
PIM_URL_VALUE
write_secret "\$DEPLOY_PATH/identity-service/.env" OMS_URL <<'OMS_URL_VALUE'
${OMS_URL}
OMS_URL_VALUE
write_secret "\$DEPLOY_PATH/identity-service/.env" WMS_URL <<'WMS_URL_VALUE'
${WMS_URL}
WMS_URL_VALUE
write_secret "\$DEPLOY_PATH/PMI/backend/.env.prod" DATABASE_URL <<'PMI_DATABASE_URL_VALUE'
postgresql://${RDS_USER}:${RDS_PASSWORD}@${RDS_HOST}:5432/pmi?sslmode=${RDS_SSLMODE}
PMI_DATABASE_URL_VALUE
write_secret "\$DEPLOY_PATH/PMI/backend/.env.prod" ENV <<'PMI_ENV_VALUE'
production
PMI_ENV_VALUE
write_secret "\$DEPLOY_PATH/PMI/backend/.env.prod" CORS_ALLOWED_ORIGINS <<'CORS_ALLOWED_ORIGINS_VALUE'
${CORS_ALLOWED_ORIGINS}
CORS_ALLOWED_ORIGINS_VALUE
write_secret "\$DEPLOY_PATH/PMI/backend/.env.prod" AWS_DEFAULT_REGION <<'PMI_AWS_DEFAULT_REGION_VALUE'
us-east-1
PMI_AWS_DEFAULT_REGION_VALUE
write_secret "\$DEPLOY_PATH/PMI/backend/.env.prod" AWS_REGION <<'PMI_AWS_REGION_VALUE'
us-east-1
PMI_AWS_REGION_VALUE
write_secret "\$DEPLOY_PATH/PMI/backend/.env.prod" S3_BUCKET <<'PMI_S3_BUCKET_VALUE'
topvnsport-assets
PMI_S3_BUCKET_VALUE
write_secret "\$DEPLOY_PATH/PMI/backend/.env.prod" AWS_S3_BUCKET <<'PMI_AWS_S3_BUCKET_VALUE'
topvnsport-assets
PMI_AWS_S3_BUCKET_VALUE
write_secret "\$DEPLOY_PATH/PMI/backend/.env.prod" S3_PRESIGNED_URL_EXPIRY <<'PMI_S3_PRESIGNED_URL_EXPIRY_VALUE'
3600
PMI_S3_PRESIGNED_URL_EXPIRY_VALUE
write_secret "\$DEPLOY_PATH/PMI/backend/.env.prod" S3_PUBLIC_BASE_URL <<'PMI_S3_PUBLIC_BASE_URL_VALUE'
${S3_PUBLIC_BASE_URL}
PMI_S3_PUBLIC_BASE_URL_VALUE
write_secret "\$DEPLOY_PATH/identity-service/.env.prod" DATABASE_URL <<'IDENTITY_DATABASE_URL_VALUE'
postgresql://${RDS_USER}:${RDS_PASSWORD}@${RDS_HOST}:5432/identity?sslmode=${RDS_SSLMODE}
IDENTITY_DATABASE_URL_VALUE
REMOTE

echo "[3/5] Build and start production stacks"
ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "
  set -euo pipefail
  cd $DEPLOY_PATH
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

  # Stop legacy reverse-proxy container to release port 80/443
  sudo docker stop reverse-proxy >/dev/null 2>&1 || true
  sudo docker rm reverse-proxy >/dev/null 2>&1 || true

  # HTTPS is mandatory for production. Certificate issuance/renewal is managed
  # outside this script and must cover voma.vn plus its service subdomains.
  sudo test -s '/etc/letsencrypt/live/voma.vn/fullchain.pem'
  sudo test -s '/etc/letsencrypt/live/voma.vn/privkey.pem'
  sudo -E docker compose -f gateway/docker-compose.prod.yml up -d --build --force-recreate
  echo "Waiting for Gateway to be healthy..."
  timeout 60 bash -c 'until curl -sf http://localhost/health > /dev/null 2>&1; do sleep 2; done' || true

  # Fail the deployment if any service migration fails; serving with a stale
  # schema is more dangerous than stopping the rollout for operator recovery.
  # Every service is attempted before we give up, though: stopping at the first
  # failure used to leave the later services on their old schema for no reason,
  # which is how a missing alembic binary in wms-api once prevented the OMS
  # migration from running at all.
  echo \"Running database migrations...\"
  migration_failures=''
  for migration_target in pim-api wms-api oms_backend; do
    if sudo docker exec \"\$migration_target\" alembic upgrade head; then
      echo \"  migration ok: \$migration_target\"
    else
      echo \"  migration FAILED: \$migration_target\"
      migration_failures=\"\$migration_failures \$migration_target\"
    fi
  done
  if [ -n \"\$migration_failures\" ]; then
    echo \"Database migrations failed for:\$migration_failures\"
    exit 1
  fi
"

echo "[4/5] Health checks"
ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "
  set -euo pipefail
  # Check /health endpoints (no auth required)
  for u in \
    https://api-pim.$DOMAIN_NAME/health \
    https://api-oms.$DOMAIN_NAME/health \
    https://api-wms.$DOMAIN_NAME/health \
    https://api-identity.$DOMAIN_NAME/health \
    https://pim.$DOMAIN_NAME/health \
    https://oms.$DOMAIN_NAME/health \
    https://wms.$DOMAIN_NAME/health \
    https://identity.$DOMAIN_NAME/health; do
    code=\$(curl -s -o /dev/null -w '%{http_code}' \"\$u\")
    echo \"\$code \$u\"
    [[ \"\$code\" == \"200\" ]] || exit 1
  done
"

echo "[4.1/5] Post-deploy smoke checks"
ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "DEPLOY_PATH='$DEPLOY_PATH' DOMAIN_NAME='$DOMAIN_NAME' bash -se" <<'REMOTE'
set -euo pipefail

if [[ "$DEPLOY_PATH" == ~/* ]]; then
  DEPLOY_PATH="$HOME/${DEPLOY_PATH#~/}"
fi

cd "$DEPLOY_PATH"

# Verify WMS can resolve and call PMI over Docker network.
sudo docker exec -i wms-api python - <<'PY'
import urllib.request
with urllib.request.urlopen('http://pim-api:8000/docs', timeout=5) as resp:
    if resp.status != 200:
        raise SystemExit(f'Unexpected PMI status: {resp.status}')
print('WMS->PMI connectivity OK')
PY

# Exercise Fernet decryption through the SQLAlchemy model. Never print the
# decrypted value.
#
# What each outcome means, and why only one of them is fatal:
#   - a stored value that will not decrypt means FERNET_KEY does not match the
#     key the data was written with. Reading config then 500s in production,
#     which is the exact bug this deploy chain exists to fix, so it must stop
#     the rollout. Accessing row.config_value raises out of the decrypt path,
#     which exits non-zero on its own.
#   - an empty table is a legitimate state for a freshly migrated database that
#     has no configuration entered yet. Nothing is broken and nothing can be
#     verified, so report it and carry on rather than holding the deploy red
#     forever over data that only an operator can supply.
sudo docker exec -i oms_backend python - <<'PY'
from database import SessionLocal
from models import SystemConfig

db = SessionLocal()
try:
    row = db.query(SystemConfig).order_by(SystemConfig.id).first()
    if row is None:
        print("OMS Fernet smoke check skipped: system_configs is empty, nothing to decrypt")
    elif row.config_value is None:
        print(f"OMS Fernet smoke check skipped: {row.config_key} has a NULL value")
    else:
        print(f"OMS Fernet decrypt OK: {row.config_key}")
finally:
    db.close()
PY

# Generate a token with identity-service and verify OMS accepts the shared key.
smoke_token="$(sudo docker exec -i identity-api-prod python - <<'PY'
from database import SessionLocal
from models import StaffAccount
from utils.jwt import create_access_token

db = SessionLocal()
try:
    staff = (
        db.query(StaffAccount)
        .filter(StaffAccount.is_active.is_(True))
        .order_by(StaffAccount.id)
        .first()
    )
    if staff is None:
        raise SystemExit("Identity JWT smoke check found no active staff account")
    print(create_access_token(staff.id, staff.username, staff.role_code or ""))
finally:
    db.close()
PY
)"
smoke_status="$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $smoke_token" "https://api-oms.$DOMAIN_NAME/api/configs/sms")"
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
