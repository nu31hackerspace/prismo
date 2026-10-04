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
# Vite inlines VITE_* variables into the bundle at build time, so the
# Google client ID has to be supplied here, not as a runtime container env.
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ARG VITE_PUBLIC_MQTT_URL
ENV VITE_PUBLIC_MQTT_URL=$VITE_PUBLIC_MQTT_URL
RUN npm run build --workspace=client

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl && npm install -g serve
COPY --from=build /repo/client/dist ./dist
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:80/ || exit 1
CMD ["serve", "-s", "dist", "-l", "80"]
