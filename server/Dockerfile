FROM node:22-bookworm-slim

# Werkzeuge, falls better-sqlite3 für die CPU (z.B. ARM) gebaut werden muss
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src

ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000
EXPOSE 3000
CMD ["node", "src/index.js"]
