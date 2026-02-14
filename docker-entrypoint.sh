#!/bin/sh
set -e
# Run DB migrations before starting the app
if [ -x "$(command -v node)" ] && [ -f /app/server/run-migrations.js ]; then
  echo "Running migrations..."
  node /app/server/run-migrations.js || exit 1
  echo "Migrations finished."
fi
exec "$@"
