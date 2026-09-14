# Build context is the repo root (`docker build -f backend/Dockerfile .`) so
# this can resolve the `@prismo/shared` workspace dependency.
FROM node:22-alpine AS build
ARG COMMIT_SHA
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY shared ./shared
COPY backend ./backend
RUN npm install --workspace=backend
RUN npm run build --workspace=backend
RUN npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/shared ./shared
COPY --from=build /repo/backend/package.json ./backend/package.json
COPY --from=build /repo/backend/dist ./backend/dist
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/index.js"]
