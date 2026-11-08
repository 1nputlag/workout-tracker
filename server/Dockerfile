FROM node:22-alpine AS build
WORKDIR /app
# openssl потрібен рушіям Prisma на Alpine
RUN apk add --no-cache openssl
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
# клієнт Prisma генерується в src/generated під час npm ci (postinstall) і компілюється разом із кодом
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# Перед стартом застосовуються міграції; довідники (групи мʼязів, вправи) заповнює сам сервер
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
