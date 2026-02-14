#!/bin/bash
# Сборка локально, сохранение в tar, копирование на сервер, загрузка.
# Используйте если нет Docker Registry.

set -e
SERVER="${1:-root@147.45.237.60}"
IMAGE="kovax-game-app:latest"
TAR="/tmp/kovax-game-app.tar"

echo "Building $IMAGE locally..."
docker build -t "$IMAGE" .

echo "Saving image to $TAR..."
docker save -o "$TAR" "$IMAGE"

echo "Copying to $SERVER..."
scp "$TAR" "$SERVER:/tmp/"

echo "Loading image on server..."
ssh "$SERVER" "docker load -i /tmp/kovax-game-app.tar && rm /tmp/kovax-game-app.tar"

echo ""
echo "Done! Now SSH to server and run:"
echo "  cd /var/www/kovax-game"
echo "  docker-compose -f docker-compose.prod.yml up -d"
