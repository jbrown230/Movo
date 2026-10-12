# Imagen de la API de Movo.
# Se construye desde la RAÍZ del repositorio (no desde server/), porque la API comparte el
# contrato con la app (carpeta shared/):  docker build -f server/Dockerfile .
FROM node:22-alpine
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/src ./src
COPY shared /app/shared
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "src/index.js"]
