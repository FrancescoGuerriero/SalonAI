#!/usr/bin/env bash
set -Eeuo pipefail

source /opt/salonai/mongo-backup-common.sh

MONGO_BACKUP_INTERVAL_SECONDS="${MONGO_BACKUP_INTERVAL_SECONDS:-86400}"

require_positive_integer MONGO_BACKUP_INTERVAL_SECONDS
mkdir -p "$STATUS_DIR"
printf '%s\n' "$(date +%s)" > "${STATUS_DIR}/service-started.epoch"

json_log \
  info \
  backup.scheduler_started \
  "Backup interval is ${MONGO_BACKUP_INTERVAL_SECONDS} seconds"

while true; do
  if backup_once; then
    sleep "$MONGO_BACKUP_INTERVAL_SECONDS"
  else
    retry_delay=300

    if (( MONGO_BACKUP_INTERVAL_SECONDS < retry_delay )); then
      retry_delay="$MONGO_BACKUP_INTERVAL_SECONDS"
    fi

    json_log \
      warn \
      backup.retry_scheduled \
      "Retrying backup in ${retry_delay} seconds"

    sleep "$retry_delay"
  fi
done
