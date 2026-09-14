# Build context is the repo root (`docker build -f client/Dockerfile .`) so
# this can resolve the `@prismo/shared` workspace dependency.
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY shared ./shared
COPY client ./client
RUN npm install --workspace=client
# Vite inlines VITE_* variables into the bundle at build time, so the
# Google client ID has to be supplied here, not as a runtime container env.
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build --workspace=client

FROM node:22-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /repo/client/dist ./dist
EXPOSE 80
CMD ["serve", "-s", "dist", "-l", "80"]
