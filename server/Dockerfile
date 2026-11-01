# Schritt 1: Abhängigkeiten installieren (mit Build-Werkzeugen, falls
# better-sqlite3 für die CPU gebaut werden muss, z.B. auf dem Raspberry Pi)
FROM node:22-bookworm-slim AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Schritt 2: schlankes Image ohne Build-Werkzeuge (spart ca. 400 MB)
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000
EXPOSE 3000
CMD ["node", "src/index.js"]
