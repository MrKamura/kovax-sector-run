#!/bin/sh
set -e
# Run DB migrations only once (flag in persisted volume)
if [ -x "$(command -v node)" ] && [ -f /app/server/run-migrations.js ]; then
  if [ ! -f /app/uploads/.migrations_done ]; then
    echo "Running migrations..."
    node /app/server/run-migrations.js || exit 1
    touch /app/uploads/.migrations_done
    echo "Migrations finished."
  fi
fi
exec "$@"
