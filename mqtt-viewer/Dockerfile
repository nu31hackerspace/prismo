FROM node:22-alpine

WORKDIR /app

# For dev setup, we will override command in docker-compose
# But we can still provide a default build/start for production
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
