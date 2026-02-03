# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Копируем файлы зависимостей
COPY package*.json ./
COPY package-lock.json* ./

# 2. Устанавливаем ВСЕ зависимости (dependencies + devDependencies)
RUN npm ci

# 3. Копируем весь исходный код
COPY . .

# 4. Сборка Next.js и Nest-сервера (server/dist)
RUN npm run build:all

# Production образ
FROM node:20-alpine AS runner

WORKDIR /app

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# 1. Копируем ТОЛЬКО файлы зависимостей из стадии builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/package-lock.json* ./

# 2. Устанавливаем ТОЛЬКО production зависимости (без devDependencies)
RUN npm ci --omit=dev

# 3. Копируем собранное приложение и исходный код сервера
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/server ./server
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# 4. Entrypoint (runs server/run-migrations.js then CMD)
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# 5. Устанавливаем владельца для всей папки /app на nextjs
RUN chown -R nextjs:nodejs /app

# Переключаемся на пользователя nextjs
USER nextjs

EXPOSE ${PORT:-4000}
ENV NODE_ENV=production
ENV PORT=${PORT:-4000}

ENTRYPOINT ["./docker-entrypoint.sh"]
# Nest server: WebSocket + game logic via server/dist/bootstrap.js
CMD ["node", "server/dist/bootstrap.js"]