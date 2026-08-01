#!/usr/bin/env bash
# SALONAI_PHASE_7_10_BACKUP_FORMAT=1
set -Eeuo pipefail

umask 077

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
STATUS_DIR="${BACKUP_ROOT}/status"
MONGO_HOST="${MONGO_HOST:-mongo}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_DATABASE="${MONGO_DATABASE:-salonai}"
MONGO_AUTH_DATABASE="${MONGO_AUTH_DATABASE:-admin}"
MONGO_BACKUP_PREFIX="${MONGO_BACKUP_PREFIX:-salonai-mongodb}"
MONGO_BACKUP_RETENTION_DAYS="${MONGO_BACKUP_RETENTION_DAYS:-14}"
MONGO_BACKUP_MIN_COUNT="${MONGO_BACKUP_MIN_COUNT:-3}"

require_value() {
  local name="$1"
  local value="${!name:-}"

  if [[ -z "$value" ]]; then
    printf 'Required environment variable is empty: %s\n' "$name" >&2
    return 1
  fi
}

require_positive_integer() {
  local name="$1"
  local value="${!name:-}"

  if [[ ! "$value" =~ ^[0-9]+$ ]] || (( value < 1 )); then
    printf '%s must be a positive integer. Received: %s\n' "$name" "$value" >&2
    return 1
  fi
}

json_log() {
  local level="$1"
  local event="$2"
  local message="$3"
  local timestamp

  timestamp="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

  printf '{"timestamp":"%s","level":"%s","service":"salonai-mongo-backup","event":"%s","message":"%s"}\n' \
    "$timestamp" \
    "$level" \
    "$event" \
    "${message//\"/\\\"}"
}

mongo_auth_args() {
  printf '%s\n' \
    --host "$MONGO_HOST" \
    --port "$MONGO_PORT" \
    --username "$MONGO_ROOT_USERNAME" \
    --password "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase "$MONGO_AUTH_DATABASE"
}

collect_database_stats() {
  local script

  script='const names=db.getCollectionNames(); let documents=0; for (const name of names) { documents += db.getCollection(name).countDocuments({}); } print(JSON.stringify({collections:names.length,documents:documents}));'

  mongosh \
    --quiet \
    --host "$MONGO_HOST" \
    --port "$MONGO_PORT" \
    --username "$MONGO_ROOT_USERNAME" \
    --password "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase "$MONGO_AUTH_DATABASE" \
    "$MONGO_DATABASE" \
    --eval "$script" \
    2>/dev/null \
    || printf '{"collections":null,"documents":null}\n'
}

remove_backup_family() {
  local archive="$1"
  local base="${archive%.archive.gz}"

  rm -f \
    "$archive" \
    "${archive}.sha256" \
    "${base}.json"
}

apply_retention() {
  local cutoff_epoch
  local index
  local archive
  local modified_epoch

  cutoff_epoch="$(( $(date +%s) - (MONGO_BACKUP_RETENTION_DAYS * 86400) ))"

  mapfile -t archives < <(
    find "$BACKUP_ROOT" \
      -maxdepth 1 \
      -type f \
      -name "${MONGO_BACKUP_PREFIX}-*.archive.gz" \
      -printf '%T@ %p\n' \
      | sort -nr \
      | cut -d' ' -f2-
  )

  for (( index=MONGO_BACKUP_MIN_COUNT; index<${#archives[@]}; index++ )); do
    archive="${archives[$index]}"
    modified_epoch="$(stat -c '%Y' "$archive")"

    if (( modified_epoch < cutoff_epoch )); then
      json_log \
        info \
        backup.retention_delete \
        "Removing expired backup $(basename "$archive")"

      remove_backup_family "$archive"
    fi
  done
}

backup_once() (
  local timestamp
  local epoch
  local base_name
  local partial_path
  local archive_path
  local checksum_path
  local manifest_path
  local checksum
  local size_bytes
  local database_stats
  local lock_dir
  local lock_acquired
  local lock_attempt
  local lock_wait_seconds
  local lock_age

  require_value MONGO_ROOT_USERNAME
  require_value MONGO_ROOT_PASSWORD
  require_positive_integer MONGO_BACKUP_RETENTION_DAYS
  require_positive_integer MONGO_BACKUP_MIN_COUNT

  lock_wait_seconds="${MONGO_BACKUP_LOCK_WAIT_SECONDS:-300}"
  MONGO_BACKUP_LOCK_WAIT_SECONDS="$lock_wait_seconds"
  require_positive_integer MONGO_BACKUP_LOCK_WAIT_SECONDS

  mkdir -p "$BACKUP_ROOT" "$STATUS_DIR"

  lock_dir="${STATUS_DIR}/backup.lock"
  lock_acquired=false

  if [[ -d "$lock_dir" ]]; then
    lock_age="$(( $(date +%s) - $(stat -c '%Y' "$lock_dir") ))"

    if (( lock_age > 7200 )); then
      json_log \
        warn \
        backup.stale_lock_removed \
        "Removing backup lock older than two hours"

      rm -rf "$lock_dir"
    fi
  fi

  for (( lock_attempt=1; lock_attempt<=MONGO_BACKUP_LOCK_WAIT_SECONDS; lock_attempt+=5 )); do
    if mkdir "$lock_dir" 2>/dev/null; then
      lock_acquired=true
      break
    fi

    sleep 5
  done

  if [[ "$lock_acquired" != true ]]; then
    json_log \
      warn \
      backup.lock_timeout \
      "Another backup is still running after ${MONGO_BACKUP_LOCK_WAIT_SECONDS} seconds"

    return 75
  fi

  trap 'rm -rf "$lock_dir"' EXIT

  timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
  epoch="$(date +%s)"
  base_name="${MONGO_BACKUP_PREFIX}-${timestamp}"
  partial_path="${BACKUP_ROOT}/${base_name}.archive.gz.partial"
  archive_path="${BACKUP_ROOT}/${base_name}.archive.gz"
  checksum_path="${archive_path}.sha256"
  manifest_path="${BACKUP_ROOT}/${base_name}.json"

  rm -f "$partial_path"

  json_log \
    info \
    backup.started \
    "Creating backup for database ${MONGO_DATABASE}"

  if ! mongodump \
    --host "$MONGO_HOST" \
    --port "$MONGO_PORT" \
    --username "$MONGO_ROOT_USERNAME" \
    --password "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase "$MONGO_AUTH_DATABASE" \
    --db "$MONGO_DATABASE" \
    --archive="$partial_path" \
    --gzip; then

    rm -f "$partial_path"

    printf '%s\n' "$epoch" > "${STATUS_DIR}/last-failure.epoch"
    printf '%s\n' "mongodump failed" > "${STATUS_DIR}/last-failure.txt"

    json_log \
      error \
      backup.failed \
      "mongodump failed for database ${MONGO_DATABASE}"

    return 1
  fi

  mv "$partial_path" "$archive_path"

  checksum="$(sha256sum "$archive_path" | awk '{print $1}')"
  size_bytes="$(stat -c '%s' "$archive_path")"
  database_stats="$(collect_database_stats | tail -n 1)"

  printf '%s  %s\n' \
    "$checksum" \
    "$(basename "$archive_path")" \
    > "$checksum_path"

  cat > "$manifest_path" <<MANIFEST
{
  "schemaVersion": 1,
  "application": "salonai",
  "backupType": "mongodb-logical",
  "database": "${MONGO_DATABASE}",
  "createdAtUtc": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "createdAtEpoch": ${epoch},
  "archive": "$(basename "$archive_path")",
  "sha256": "${checksum}",
  "sizeBytes": ${size_bytes},
  "sourceDatabaseStatsObservedAfterDump": ${database_stats},
  "retentionDays": ${MONGO_BACKUP_RETENTION_DAYS},
  "minimumBackupCount": ${MONGO_BACKUP_MIN_COUNT}
}
MANIFEST

  cp "$manifest_path" "${STATUS_DIR}/last-success.json"
  printf '%s\n' "$epoch" > "${STATUS_DIR}/last-success.epoch"
  printf '%s\n' "$archive_path" > "${STATUS_DIR}/last-success.path"
  rm -f "${STATUS_DIR}/last-failure.txt"

  apply_retention

  json_log \
    info \
    backup.completed \
    "Created $(basename "$archive_path") (${size_bytes} bytes)"

  printf '%s\n' "$archive_path"
)
