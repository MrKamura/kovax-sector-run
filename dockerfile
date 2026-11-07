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

# 5. Сборка Next.js и game-сервера
RUN yarn run build:all

# 6. Удаляем исходники и лишние файлы (освобождаем место на диске)
RUN rm -rf src server/game server/bootstrap.ts server/tsconfig.json server/container.ts server/reset-user-quests.js \
    tsconfig.tsbuildinfo .env.example .next/cache

# 7. Удаляем devDependencies (только production)
RUN yarn install --frozen-lockfile --production

# 8. Удаляем платформенные бинарники для других ОС (Alpine = linux-musl, оставляем только нужное)
RUN rm -rf node_modules/@next/swc-darwin-* node_modules/@next/swc-win32-* \
    node_modules/@next/swc-linux-arm* node_modules/@next/swc-linux-ia32* \
    node_modules/@next/swc-linux-ppc64* node_modules/@next/swc-linux-riscv64* \
    node_modules/@next/swc-linux-s390x* node_modules/@next/swc-linux-x64-gnu \
    node_modules/@img/sharp-darwin-* node_modules/@img/sharp-win32-* \
    node_modules/@img/sharp-linux-arm* node_modules/@img/sharp-linux-ppc64* \
    node_modules/@img/sharp-linux-riscv64* node_modules/@img/sharp-linux-s390x* \
    node_modules/@img/sharp-linuxmusl-arm64 node_modules/@img/sharp-linux-x64 \
    node_modules/@img/sharp-libvips-darwin-* node_modules/@img/sharp-libvips-win32-* \
    node_modules/@img/sharp-libvips-linux-arm* node_modules/@img/sharp-libvips-linux-ppc64* \
    node_modules/@img/sharp-libvips-linux-riscv64* node_modules/@img/sharp-libvips-linux-s390x* \
    node_modules/@img/sharp-libvips-linuxmusl-arm64 node_modules/@img/sharp-libvips-linux-x64* \
    2>/dev/null || true

# 9. Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# 10. Entrypoint (уже скопирован в COPY . .)
RUN chmod +x docker-entrypoint.sh

# 11. Владелец файлов
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 4000
ENV NODE_ENV=production
ENV PORT=4000
ENV NODE_OPTIONS="--trace-uncaught"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server/bootstrap-loader.js"]
