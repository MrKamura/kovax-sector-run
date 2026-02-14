# Деплой через GitHub Actions

## 1. Настройка репозитория

1. Запушьте код в GitHub (если ещё не сделано)
2. Workflow запустится автоматически при push в `main` или `master`
3. Или запустите вручную: **Actions** → **Build and Push Docker Image** → **Run workflow**

## 2. Сделать образ публичным (опционально)

1. Откройте **Packages** в вашем GitHub профиле
2. Найдите `kovax-game-app`
3. **Package settings** → **Change visibility** → **Public**

## 3. Деплой на сервер

```bash
# Подключитесь к серверу
ssh root@147.45.237.60

cd /var/www/kovax-game

# Укажите ваш GitHub username (замените YOUR_USERNAME)
export IMAGE_APP=ghcr.io/YOUR_USERNAME/kovax-game-app:latest

# Для приватного образа — логин (создайте Personal Access Token с read:packages)
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Скачать образ и запустить
docker pull $IMAGE_APP
docker-compose -f docker-compose.prod.yml up -d
```

## 4. Обновление

При каждом push в main образ пересобирается. На сервере:

```bash
cd /var/www/kovax-game
docker pull ghcr.io/YOUR_USERNAME/kovax-game-app:latest
docker-compose -f docker-compose.prod.yml up -d
```
