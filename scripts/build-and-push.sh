#!/bin/bash
# Сборка образа локально (или на CI) и push в registry.
# На сервере: docker pull <registry>/kovax-game-app && docker-compose up -d

set -e
IMAGE_NAME="${DOCKER_REGISTRY:-ghcr.io}/kovax-game-app:latest"

echo "Building $IMAGE_NAME ..."
docker build -t "$IMAGE_NAME" .

echo "Pushing $IMAGE_NAME ..."
docker push "$IMAGE_NAME"

echo "Done. On server run: docker pull $IMAGE_NAME && docker-compose up -d"
