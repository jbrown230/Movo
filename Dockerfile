# Imagen de la app web (la PWA) servida con Caddy y HTTPS automático.
# Etapa 1 compila la app con Vite; etapa 2 solo lleva los archivos ya compilados.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.js ./
COPY shared ./shared
COPY web ./web
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/web/dist /srv/web
