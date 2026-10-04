# Build context is the repo root (`docker build -f client/Dockerfile .`) so
# this can resolve the `@prismo/shared` workspace dependency and the
# `mqtt-contract` file dependency.
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY shared ./shared
COPY mqtt-contract ./mqtt-contract
COPY client ./client
RUN npm install --workspace=client
RUN npm run build --workspace=client

# GOOGLE_CLIENT_ID and PUBLIC_MQTT_URL are read from the container env at
# startup and written to dist/env.js, so one image works for any deployment.
FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /repo/client/dist ./dist
COPY client/server ./server
EXPOSE 80
CMD ["node", "--experimental-strip-types", "server/start.ts"]
