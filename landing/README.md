# Landing de Movo

Página de presentación de Movo. Es un sitio estático independiente de la app (no comparte código con `web/`).

```bash
npm install
npm run dev       # http://localhost:5174
npm run build     # compila a dist/
npm run preview   # sirve dist/ en http://localhost:4174
```

## Qué hay

| Archivo | Qué hace |
|---|---|
| `index.html` | Todo el contenido: portada, cómo funciona, capítulos de color, capturas, tecnología, acceso libre, equipo y pie. |
| `src/hero3d.js` | Escena 3D de la portada (Three.js): el logo en volumen y los avisos bancarios que orbitan y caen hacia él al bajar. |
| `src/noticeTextures.js` | Dibuja en canvas las notificaciones de ejemplo que flotan en la portada. |
| `src/howItWorks.js` | La escena fija de "Cómo funciona": el teléfono pasa por Recibido, Leído, Extraído y Registrado con el scroll; el control deslizante también la mueve. |
| `src/reveals.js` | Entradas de cada sección (titulares con máscara, diagrama de arquitectura que se dibuja, contadores). |
| `src/interactions.js` | Selector de capturas y botón para copiar los comandos. |
| `public/capturas/` | Capturas de la app (copiadas de `docs/capturas`, en WebP). |

Respeta `prefers-reduced-motion`: sin animaciones de entrada ni scroll con inercia, y la escena 3D queda quieta. Sin JavaScript todo el texto se lee igual.

Todos los datos que aparecen (comercios, montos, nombres en el teléfono de ejemplo) son ficticios.
