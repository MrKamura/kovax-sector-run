# Одностадийная сборка — избегаем COPY node_modules между стадиями (экономия диска)
FROM node:20-alpine

WORKDIR /app

# 1. Включаем Yarn через Corepack
RUN corepack enable && corepack prepare yarn@1 --activate

# 2. Копируем файлы зависимостей
COPY package*.json ./
COPY yarn.lock* ./

# 3. Устанавливаем зависимости
RUN yarn install --frozen-lockfile

# 4. Копируем исходный код
COPY . .

# 5. Сборка клиента (Vite) и game-сервера
RUN yarn run build

# 6. Удаляем исходники и лишние файлы (освобождаем место на диске)
RUN rm -rf src server/game server/rest server/bootstrap.ts server/static.ts server/tsconfig.json \
    server/container.ts server/reset-user-quests.js vite.config.mts index.html \
    tsconfig.tsbuildinfo .env.example

# 7. Удаляем devDependencies (только production)
RUN yarn install --frozen-lockfile --production

# 8. Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# 9. Entrypoint (уже скопирован в COPY . .)
RUN chmod +x docker-entrypoint.sh

# 10. Владелец файлов
RUN chown -R appuser:nodejs /app

USER appuser

EXPOSE 4000
ENV NODE_ENV=production
ENV PORT=4000
ENV NODE_OPTIONS="--trace-uncaught"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server/bootstrap-loader.js"]
