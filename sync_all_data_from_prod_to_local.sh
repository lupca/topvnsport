#!/usr/bin/env bash
set -euo pipefail

# Full prod -> local data sync for TOP VN SPORT:
# - PostgreSQL: PMI, OMS, WMS
# - MinIO bucket: pim-media
#
# Usage:
#   EC2_HOST=ec2-xx-xx-xx-xx.compute-1.amazonaws.com ./sync_all_data_from_prod_to_local.sh --yes --wipe
#
# Notes:
# - This is destructive for local data.
# - By default, image_url values pointing to prod host are normalized to localhost:19005 on local.

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

EC2_USER="${EC2_USER:-ec2-user}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$ROOT_DIR/docs/local.pem}"
SSH_KEY_PATH="${SSH_KEY_PATH/#\~/$HOME}"
SSH_KEY_PATH="${SSH_KEY_PATH//\$HOME/$HOME}"

MINIO_USER="${MINIO_USER:-minioadmin}"
MINIO_PASS="${MINIO_PASS:-minioadmin}"
MINIO_BUCKET="${MINIO_BUCKET:-pim-media}"
LOCAL_MINIO_URL="${LOCAL_MINIO_URL:-http://127.0.0.1:19005}"
PROD_MINIO_URL="${PROD_MINIO_URL:-}"
LOCAL_IMAGE_HOSTPORT="${LOCAL_IMAGE_HOSTPORT:-localhost:19005}"

WIPE_FIRST=0
AUTO_YES=0
NORMALIZE_IMAGE_URLS=1

usage() {
  cat <<'EOF'
Usage:
  EC2_HOST=<host> ./sync_all_data_from_prod_to_local.sh [options]

Options:
  --wipe                      Wipe local schemas + MinIO bucket before importing.
  --no-normalize-image-urls   Keep prod image URLs as-is (default: normalize to localhost).
  --yes                       Skip interactive confirmation.
  -h, --help                  Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wipe)
      WIPE_FIRST=1
      shift
      ;;
    --no-normalize-image-urls)
      NORMALIZE_IMAGE_URLS=0
      shift
      ;;
    --yes)
      AUTO_YES=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

: "${EC2_HOST:?EC2_HOST is required (example: ec2-xx-xx-xx-xx.compute-1.amazonaws.com)}"

if [[ -z "$PROD_MINIO_URL" ]]; then
  PROD_MINIO_URL="http://$EC2_HOST:19005"
fi

# Host:port used to identify prod image URLs for normalization.
PROD_IMAGE_HOSTPORT="$(echo "$PROD_MINIO_URL" | sed -E 's#^[a-zA-Z]+://##' | cut -d'/' -f1)"

if [[ ! -f "$SSH_KEY_PATH" ]]; then
  echo "SSH key not found: $SSH_KEY_PATH"
  exit 1
fi

SSH_OPTS=(
  -i "$SSH_KEY_PATH"
  -o BatchMode=yes
  -o StrictHostKeyChecking=yes
)

run_ssh() {
  ssh "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "$1"
}

check_local_container() {
  local c="$1"
  docker ps --format '{{.Names}}' | grep -qx "$c" || {
    echo "Local container is not running: $c"
    exit 1
  }
}

check_remote_container() {
  local c="$1"
  run_ssh "sudo docker ps --format '{{.Names}}' | grep -qx '$c'" || {
    echo "Remote container is not running: $c"
    exit 1
  }
}

dump_restore_db() {
  local remote_container="$1"
  local db_name="$2"
  local local_container="$3"

  echo "[DB] Sync $db_name ($remote_container -> $local_container)"
  run_ssh "sudo docker exec $remote_container pg_dump -U postgres -d $db_name --clean --if-exists --no-owner --no-privileges" \
    | docker exec -i "$local_container" psql -U postgres -d "$db_name"
}

compare_query() {
  local name="$1"
  local local_cmd="$2"
  local remote_cmd="$3"

  local lval
  local rval

  lval="$(eval "$local_cmd")"
  rval="$(run_ssh "$remote_cmd")"

  if [[ "$lval" != "$rval" ]]; then
    echo "[VERIFY:FAIL] $name local=$lval prod=$rval"
    return 1
  fi

  echo "[VERIFY:OK] $name = $lval"
}

if [[ "$AUTO_YES" -ne 1 ]]; then
  echo "About to sync ALL production data to local from host: $EC2_HOST"
  echo "This operation is destructive for local data."
  read -r -p "Type 'SYNC' to continue: " confirm
  if [[ "$confirm" != "SYNC" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "[0/7] Pre-flight checks"
check_local_container "pim-db"
check_local_container "oms_db"
check_local_container "wms-db"
check_remote_container "pim-db"
check_remote_container "oms_db"
check_remote_container "wms-db"
check_remote_container "pim-minio"

if [[ "$WIPE_FIRST" -eq 1 ]]; then
  echo "[1/7] Wipe local schemas + MinIO bucket"
  docker exec pim-db psql -U postgres -d pim_db -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
  docker exec oms_db psql -U postgres -d oms_db -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
  docker exec wms-db psql -U postgres -d wms_db -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
  docker run --rm --network host --entrypoint /bin/sh minio/mc -c "
    set -e
    mc alias set local $LOCAL_MINIO_URL $MINIO_USER $MINIO_PASS >/dev/null
    mc rm --recursive --force local/$MINIO_BUCKET || true
  "
else
  echo "[1/7] Skip explicit wipe (pg_dump --clean + mc mirror --remove will still converge data)"
fi

echo "[2/7] Sync PostgreSQL PMI prod->local"
dump_restore_db "pim-db" "pim_db" "pim-db"

echo "[3/7] Sync PostgreSQL OMS prod->local"
dump_restore_db "oms_db" "oms_db" "oms_db"

echo "[4/7] Sync PostgreSQL WMS prod->local"
dump_restore_db "wms-db" "wms_db" "wms-db"

if [[ "$NORMALIZE_IMAGE_URLS" -eq 1 ]]; then
  echo "[5/7] Normalize local product_media URLs to local host"
  docker exec pim-db psql -U postgres -d pim_db -At -c "
    update product_media
    set image_url = replace(
      replace(
        replace(image_url, '$EC2_HOST:19005', '$LOCAL_IMAGE_HOSTPORT'),
        '$PROD_IMAGE_HOSTPORT', '$LOCAL_IMAGE_HOSTPORT'
      ),
      '127.0.0.1:19005', '$LOCAL_IMAGE_HOSTPORT'
    )
    where image_url like '%$EC2_HOST:19005%'
       or image_url like '%$PROD_IMAGE_HOSTPORT%'
       or image_url like '%127.0.0.1:19005%';
  "
else
  echo "[5/7] Skip image URL normalization"
fi

echo "[6/7] Sync MinIO bucket prod->local"
docker run --rm --network host --entrypoint /bin/sh minio/mc -c "
  set -e
  mc alias set prod $PROD_MINIO_URL $MINIO_USER $MINIO_PASS >/dev/null
  mc alias set local $LOCAL_MINIO_URL $MINIO_USER $MINIO_PASS >/dev/null
  mc mb --ignore-existing prod/$MINIO_BUCKET >/dev/null
  mc mb --ignore-existing local/$MINIO_BUCKET >/dev/null
  mc mirror --overwrite --remove prod/$MINIO_BUCKET local/$MINIO_BUCKET
"

echo "[7/7] Verify key counts"
compare_query "PMI products" \
  "docker exec pim-db psql -U postgres -d pim_db -At -c \"select count(*) from products\"" \
  "sudo docker exec pim-db psql -U postgres -d pim_db -At -c \"select count(*) from products\""

compare_query "PMI product_media" \
  "docker exec pim-db psql -U postgres -d pim_db -At -c \"select count(*) from product_media\"" \
  "sudo docker exec pim-db psql -U postgres -d pim_db -At -c \"select count(*) from product_media\""

compare_query "OMS orders" \
  "docker exec oms_db psql -U postgres -d oms_db -At -c \"select count(*) from orders\"" \
  "sudo docker exec oms_db psql -U postgres -d oms_db -At -c \"select count(*) from orders\""

compare_query "WMS stock tuple" \
  "docker exec wms-db psql -U postgres -d wms_db -At -c \"select (select count(*) from fulfillment_orders_wms),(select count(*) from pick_list_items),(select count(*) from stock_transactions)\"" \
  "sudo docker exec wms-db psql -U postgres -d wms_db -At -c \"select (select count(*) from fulfillment_orders_wms),(select count(*) from pick_list_items),(select count(*) from stock_transactions)\""

local_objs="$(docker run --rm --network host --entrypoint /bin/sh minio/mc -c "mc alias set local $LOCAL_MINIO_URL $MINIO_USER $MINIO_PASS >/dev/null; mc ls --recursive local/$MINIO_BUCKET | wc -l")"
prod_objs="$(docker run --rm --network host --entrypoint /bin/sh minio/mc -c "mc alias set prod $PROD_MINIO_URL $MINIO_USER $MINIO_PASS >/dev/null; mc ls --recursive prod/$MINIO_BUCKET | wc -l")"

if [[ "$local_objs" != "$prod_objs" ]]; then
  echo "[VERIFY:FAIL] MinIO objects local=$local_objs prod=$prod_objs"
  exit 1
fi

echo "[VERIFY:OK] MinIO objects = $local_objs"
echo "Sync completed successfully (prod -> local)."
