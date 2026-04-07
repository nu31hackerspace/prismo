FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npx drizzle-kit generate

FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache curl python3 py3-pip
RUN pip install --break-system-packages --no-cache-dir esptool esp-idf-nvs-partition-gen

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/build ./build
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src/lib/server/db/migrate.ts ./src/lib/server/db/migrate.ts

ARG COMMIT_SHA
ENV COMMIT_SHA=${COMMIT_SHA}

EXPOSE 3000

CMD npm run db:migrate && node build/index.js
