# Despliegue en un VPS e instalación en el teléfono

## 1. Dominio

Crea un registro DNS tipo A (por ejemplo `puraplata.tudominio.com`) que apunte a la IP del VPS. HTTPS es obligatorio: sin él no se instala la PWA ni funciona el inicio de sesión de Google. Abre los puertos 80 y 443 en el firewall.

## 2. Google Cloud (una sola vez)

1. Entra a console.cloud.google.com y crea un proyecto.
2. En "APIs y servicios", ve a "Biblioteca", busca **Gmail API** y habilítala.
3. Configura la "Pantalla de consentimiento de OAuth":
   - Tipo de usuario: **Externo**.
   - Completa el nombre de la app y el correo de soporte.
   - En **Alcances**, agrega `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` y `https://www.googleapis.com/auth/gmail.readonly`.
   - En **Usuarios de prueba**, agrega los Gmail de quienes van a probar (máximo 100).
   - Deja el estado en **Prueba**.
4. En "Credenciales", elige "Crear credenciales" y luego "ID de cliente de OAuth":
   - Tipo: **Aplicación web**.
   - Orígenes autorizados de JavaScript: `https://puraplata.tudominio.com`.
   - URI de redireccionamiento autorizados: `https://puraplata.tudominio.com/` (con la barra final).
5. Copia el **ID de cliente** al `.env`. No hace falta el secreto: la app no lo usa.

Al conectar, Google mostrará "Google no verificó esta app". Para pruebas es normal: toca "Configuración avanzada" y luego "Ir a PuraPlata".

## 3. Tipo de cambio del BCCR (opcional)

Suscríbete al servicio web de indicadores económicos del Banco Central de Costa Rica para obtener un token. Luego coloca `BCCR_EMAIL` y `BCCR_TOKEN` en el `.env`. Si no lo haces, se usa `FX_FALLBACK`.

## 4. VPS con Docker

```bash
# Ubuntu: instalar Docker (una vez)
curl -fsSL https://get.docker.com | sh

git clone https://github.com/<usuario>/puraplata.git
cd puraplata
cp .env.example .env
nano .env                       # DOMAIN y GOOGLE_CLIENT_ID
docker compose up -d --build
docker compose logs -f api      # debe decir "Google configurado"
curl https://puraplata.tudominio.com/api/health
```

Caddy obtiene el certificado HTTPS automáticamente la primera vez.

Para actualizar después de un cambio:

```bash
git pull
docker compose up -d --build
```

Si cambias archivos de `web/`, sube la versión de `VERSION` en `web/sw.js` para que los teléfonos descarguen la nueva versión.

Servidor mínimo sin respaldo: pon `CLOUD_SYNC=false` y levanta solo `docker compose up -d caddy api redis`. Así el servidor no guarda ningún dato de usuarios.

### Si el VPS ya usa Nginx

Omite el servicio `caddy`, expón la API (por ejemplo `ports: ["127.0.0.1:3000:3000"]` en `api`) y usa:

```nginx
server {
  server_name puraplata.tudominio.com;
  root /ruta/a/puraplata/web;
  location /api/ { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; }
  location = /sw.js { add_header Cache-Control "no-cache"; }
  location / { try_files $uri /index.html; }
  # + certificado con certbot
}
```

## 5. Instalar en el teléfono

En Android con Chrome:

1. Abre `https://puraplata.tudominio.com`.
2. En el menú ⋮, toca "Instalar app".
3. Abre PuraPlata y toca "Conectar con Google".
4. Marca el permiso de Gmail.

En iPhone con Safari:

1. Abre el dominio.
2. Toca Compartir y luego "Agregar a pantalla de inicio".

Si el inicio de sesión se abre en una ventana aparte, termina ahí y vuelve a la app.

## 6. Verificar

- La primera lectura revisa los últimos 45 días.
- En **Bandeja** se ven los correos leídos. Si un banco no aparece, en **Ajustes**, "Bancos que se leen", agrega `from:dominio-del-banco`.
- Los correos que el lector no entiende quedan como "Sin movimiento". Copia el texto anonimizado para crear una plantilla nueva en `web/js/parser.js`, con su prueba en `tests/client.test.mjs`.
