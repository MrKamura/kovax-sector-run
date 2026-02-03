#!/bin/sh
set -e
echo "Running database migrations..."
node server/migrate.js
echo "Migrations complete. Starting app."
exec "$@"
