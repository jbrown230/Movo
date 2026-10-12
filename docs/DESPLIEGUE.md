# Despliegue en un VPS e instalación en el teléfono

## 1. Dominio

Crea un registro DNS tipo A (por ejemplo `movo.tudominio.com`) que apunte a la IP del VPS. HTTPS es obligatorio: sin él no se instala la PWA ni funciona el inicio de sesión de Google. Abre los puertos 80 y 443 en el firewall.

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
   - Orígenes autorizados de JavaScript: `https://movo.tudominio.com`.
   - URI de redireccionamiento autorizados: `https://movo.tudominio.com/` (con la barra final).
5. Copia el **ID de cliente** al `.env`. No hace falta el secreto: la app no lo usa.

Al conectar, Google mostrará "Google no verificó esta app". Para pruebas es normal: toca "Configuración avanzada" y luego "Ir a Movo".

## 3. Tipo de cambio del BCCR (opcional)

Suscríbete al servicio web de indicadores económicos del Banco Central de Costa Rica para obtener un token. Luego coloca `BCCR_EMAIL` y `BCCR_TOKEN` en el `.env`. Si no lo haces, se usa `FX_FALLBACK`.

## 4. VPS con Docker

```bash
# Ubuntu: instalar Docker (una vez)
curl -fsSL https://get.docker.com | sh

git clone https://github.com/jbrown230/Movo.git
cd Movo
cp .env.example .env
nano .env                       # DOMAIN y GOOGLE_CLIENT_ID
docker compose up -d --build
docker compose logs -f api      # debe decir "Google configurado"
curl https://movo.tudominio.com/api/health
```

Caddy obtiene el certificado HTTPS automáticamente la primera vez.

Para actualizar después de un cambio:

```bash
git pull
docker compose up -d --build
```

La app se compila sola dentro de la imagen de Docker (`Dockerfile`, con Vite). Los archivos de la app llevan un código en el nombre que cambia con cada versión, así que los teléfonos descargan la nueva versión sin que hagas nada más. Solo si cambias la lógica de `web/public/sw.js`, sube su constante `VERSION`.

Servidor mínimo sin respaldo: pon `CLOUD_SYNC=false` y levanta solo `docker compose up -d caddy api redis`. Así el servidor no guarda ningún dato de usuarios.

### Si el VPS ya usa Nginx

Si el servidor ya tiene nginx en los puertos 80 y 443 (con otras aplicaciones), no uses el servicio `caddy`. Usa estos archivos del repositorio:

- `docker-compose.nginx.yml`: la API, Redis y MongoDB, sin Caddy. La API solo escucha en `127.0.0.1:3002`.
- `deploy/nginx-movo.conf.example`: la configuración de nginx. Sirve la app compilada (`web/dist`) y reenvía `/api` a la API.
- `deploy/update.sh`: baja el código, compila la app y reinicia los servicios.

```bash
git clone <repo> /opt/movo && cd /opt/movo
cp .env.example .env && nano .env     # DOMAIN y GOOGLE_CLIENT_ID
bash deploy/update.sh
```

Después copia la configuración de nginx (instrucciones al inicio de `deploy/nginx-movo.conf.example`), revisa con `nginx -t` y recarga con `systemctl reload nginx`.

### Actualizar el servidor con git

La forma de actualizar es siempre la misma, sin copiar archivos a mano:

```bash
ssh tu-servidor "bash /opt/movo/deploy/update.sh"
```

El script hace `git fetch` y `git reset --hard origin/main` (no `git pull`, porque la historia de `main` se reescribe al publicar versiones). Por eso en el servidor **no se edita nada a mano** dentro de `/opt/movo`, salvo el archivo `.env`, que no está en git.

**Si el repositorio es privado**, el servidor necesita una llave de despliegue (solo lectura):

1. En el servidor, crea una llave sin contraseña:

   ```bash
   ssh-keygen -t ed25519 -N "" -C "movo-deploy" -f ~/.ssh/movo_deploy
   cat ~/.ssh/movo_deploy.pub
   ```

2. En GitHub, en el repositorio: **Settings > Deploy keys > Add deploy key**. Pega la llave pública y deja **desmarcado** "Allow write access".
3. Dile a ssh que use esa llave para GitHub, agregando esto a `~/.ssh/config` del servidor:

   ```
   Host github-movo
       HostName github.com
       User git
       IdentityFile ~/.ssh/movo_deploy
       IdentitiesOnly yes
   ```

4. Clona con ese nombre: `git clone git@github-movo:USUARIO/Movo.git /opt/movo`.

Si el repositorio es público no hace falta nada de esto: `git clone https://github.com/USUARIO/Movo.git`.

## 5. Instalar en el teléfono

En Android con Chrome:

1. Abre `https://movo.tudominio.com`.
2. En el menú ⋮, toca "Instalar app".
3. Abre Movo y toca "Conectar con Google".
4. Marca el permiso de Gmail.

En iPhone con Safari:

1. Abre el dominio.
2. Toca Compartir y luego "Agregar a pantalla de inicio".

Si el inicio de sesión se abre en una ventana aparte, termina ahí y vuelve a la app.

## 6. Verificar

- La primera lectura revisa los últimos 45 días.
- En **Bandeja** se ven los correos leídos. Si un banco no aparece, en **Ajustes**, "Bancos que se leen", agrega `from:dominio-del-banco`.
- Los correos que el lector no entiende quedan como "Sin movimiento". Anonimiza el texto del correo y crea una plantilla nueva en `web/src/domain/emailParser/templates/`, con su prueba. El paso a paso está en [CONTRIBUIR.md](CONTRIBUIR.md).
