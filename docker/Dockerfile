# Local development image — Vite dev server with hot module reload.
# Source is volume-mounted over this by docker-compose.local.yml, so this
# image only needs to provide the Node runtime and installed deps.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3200

CMD ["npm", "run", "dev", "--", "--host"]
