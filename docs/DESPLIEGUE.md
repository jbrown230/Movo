# Despliegue en un VPS e instalación en el teléfono

## 1. Dominio

Crea un registro DNS tipo A (por ejemplo `movo.tudominio.com`) que apunte a la IP del VPS. HTTPS es obligatorio: sin él no se instala la PWA ni funciona el inicio de sesión de Google. Abre los puertos 80 y 443 en el firewall.

## 2. Google Cloud (una sola vez)

Movo solo necesita un **ID de cliente OAuth**. No usa API key ni el secreto del cliente.

### 2.1 Crear el proyecto

1. Abre https://console.cloud.google.com/projectcreate, ponle de nombre `Movo` y crea el proyecto.
2. Confirma que quedó seleccionado en el selector de proyecto, arriba a la izquierda.

### 2.2 Habilitar la Gmail API

1. Abre https://console.cloud.google.com/apis/library/gmail.googleapis.com.
2. Toca **Habilitar**. El estado debe decir "Habilitada".

### 2.3 Pantalla de consentimiento (Google Auth Platform)

1. Abre https://console.cloud.google.com/auth/overview y toca **Comenzar**.
2. Completa el nombre de la app (`Movo`), el correo de asistencia y el correo de contacto.
3. Público: **Externo**. Acepta los términos y toca **Crear**.
4. En **Acceso a los datos** (https://console.cloud.google.com/auth/scopes), toca **Agregar o quitar permisos** y marca estos cuatro:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `https://www.googleapis.com/auth/gmail.readonly`

   `gmail.readonly` aparece al escribirlo en el filtro, o pegándolo en "Agregar permisos manualmente". Toca **Actualizar** y luego **Guardar**. Revisa que los cuatro hayan quedado en la lista.
5. En **Público** (https://console.cloud.google.com/auth/audience), deja el estado en **Prueba**. En **Usuarios de prueba**, toca **Add users** y agrega el Gmail de cada persona que va a usar la app (máximo 100). Quien no esté en la lista no puede entrar.

### 2.4 Crear el ID de cliente

1. Abre https://console.cloud.google.com/auth/clients y toca **Crear cliente**.
2. Tipo de aplicación: **Aplicación web**. Nombre: `Movo web`.
3. **Orígenes autorizados de JavaScript**:
   - `https://movo.tudominio.com`
   - `http://localhost:5173` (para desarrollo local)
4. **URIs de redireccionamiento autorizados** (con la barra final):
   - `https://movo.tudominio.com/`
   - `http://localhost:5173/`
5. Toca **Crear** y copia el **ID de cliente**, que termina en `.apps.googleusercontent.com`. Pégalo en el `.env` como `GOOGLE_CLIENT_ID`.

Google no acepta una IP pelada como origen. Si no tienes dominio, usa un nombre público con HTTPS que apunte a la IP, como `203-0-113-10.sslip.io` (la IP del VPS con guiones en vez de puntos). Ese nombre va en `DOMAIN` del `.env`, en el origen y en la URI de redireccionamiento.

### 2.5 Secreto del cliente

Al crear el cliente, Google muestra un secreto una sola vez. **No lo copies ni lo pegues en ningún lado**: la app no lo usa. Si se filtró (por ejemplo, se pegó en un chat o en el repositorio), hay que invalidarlo:

1. Abre el cliente `Movo web` en https://console.cloud.google.com/auth/clients y baja hasta **Secretos del cliente**.
2. Google solo deja desactivar un secreto cuando hay otro. Toca **Add secret** para crear uno nuevo y no lo copies.
3. En la fila del secreto viejo, toca **Inhabilitar** y confirma. Luego toca la papelera para borrarlo.
4. No toques **Borrar** arriba a la derecha: ese botón elimina el cliente completo y rompe el inicio de sesión.

### 2.6 Al conectar

Google mostrará "Google no verificó esta app". Para pruebas es normal: toca "Configuración avanzada" y luego "Ir a Movo".

### 2.7 Problemas comunes

| Mensaje | Causa y solución |
| --- | --- |
| `redirect_uri_mismatch` | La URI de redireccionamiento no coincide exactamente. Revisa el dominio, `https` y la barra final. Los cambios pueden tardar unos minutos en aplicarse. |
| `Error 403: access_denied` | El Gmail no está en **Usuarios de prueba** (paso 2.3.5). |
| Sale el modo demo en vez de Google | `GOOGLE_CLIENT_ID` está vacío en el `.env` del servidor. Revisa `https://movo.tudominio.com/api/config`: `googleClientId` no debe ser `null`. Después de cambiar el `.env`, reinicia con `bash deploy/update.sh` o `docker compose up -d --build`. |

## 3. Tipo de cambio del BCCR (opcional)

Movo consulta la API del Sistema de Divulgación de Datos Económicos (SDDE) del Banco Central de Costa Rica. Regístrate en el sitio de Indicadores Económicos del BCCR y genera un token en Mi Perfil → Generar token. Luego coloca ese token en `BCCR_TOKEN` en el `.env`. Si no lo haces, o si el token vence, se usa `FX_FALLBACK`.

Las compras en córdobas nicaragüenses se convierten solas. El BCCR no publica el córdoba, así que el servidor pide los córdobas por dólar del día al servicio público ExchangeRate-API (sin llave ni registro) y divide los colones por dólar del BCCR entre ese valor. Es una referencia de mercado: ronda un 0,5 % por encima de la tasa oficial del Banco Central de Nicaragua. Si ese servicio no responde, se usa `NIO_PER_USD` (por defecto 36,6243, la tasa oficial que el Banco Central de Nicaragua mantiene fija durante todo 2026); no hace falta tocarlo. El valor se guarda en Redis, hasta 6 horas, junto con el resto del tipo de cambio, y `GET /api/fx` dice en `nio.source` de dónde salió.

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

El respaldo en la nube viene apagado (`CLOUD_SYNC=false` en `.env.example`): la API no guarda datos de usuarios y la app oculta la sección "Respaldo en la nube" de Ajustes. Para activarlo pon `CLOUD_SYNC=true`. Servidor mínimo sin respaldo: levanta solo `docker compose up -d caddy api redis`. Así el servidor no guarda ningún dato de usuarios.

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

Si la app instalada muestra otro nombre o un ícono viejo, es porque el teléfono guarda el nombre y el ícono al instalar y no los actualiza. Desinstala la app, borra los datos del sitio en el navegador e instálala de nuevo. Los datos de Movo viven en el navegador: si no tienes el respaldo en la nube activado, exporta tus movimientos antes de borrarlos.

## 6. Verificar

- La primera lectura revisa los últimos 45 días.
- En **Bandeja** se ven los correos leídos. Si un banco no aparece, en **Ajustes**, "Bancos que se leen", agrega `from:dominio-del-banco`.
- Los correos que el lector no entiende quedan como "Sin movimiento". Anonimiza el texto del correo y crea una plantilla nueva en `web/src/domain/emailParser/templates/`, con su prueba. El paso a paso está en [CONTRIBUIR.md](CONTRIBUIR.md).
