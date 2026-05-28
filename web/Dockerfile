FROM node:22-alpine AS builder
WORKDIR /app

# Copy the contract package descriptor and files first
COPY mqtt-contract/package*.json ./mqtt-contract/
COPY mqtt-contract/ ./mqtt-contract/

# Copy the web package descriptor
COPY web/package*.json ./web/

# Install dependencies for both so they can resolve correctly
RUN npm ci --prefix mqtt-contract
RUN npm ci --prefix web

# Copy the rest of the web files
COPY web/ ./web/

# Build the web application
WORKDIR /app/web
RUN npm run build
RUN npm prune --production

FROM node:22-alpine
RUN apk add --no-cache curl
WORKDIR /app

# Copy built application and production node_modules from builder
COPY --from=builder /app/web/build build/
COPY --from=builder /app/web/node_modules node_modules/
COPY --from=builder /app/mqtt-contract ../mqtt-contract
COPY web/package.json .

EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "build" ]