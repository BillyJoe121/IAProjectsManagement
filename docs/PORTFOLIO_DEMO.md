# Demo de portafolio

La rama `portfolio-demo` está aislada de la versión institucional. No requiere ni debe recibir configuración de Supabase, Google Calendar, Google Drive, OAuth o proveedores de IA.

## Comportamiento deliberado

- La sesión se simula con dos personas ficticias: docente y estudiante.
- El selector de vista permite recorrer ambas experiencias sin credenciales.
- Los tres proyectos, contactos, tareas, reuniones e incidencias son ficticios.
- Las ediciones, cargas de archivos y documentos se conservan únicamente en `localStorage` del visitante.
- Las funciones que requieren infraestructura externa se muestran como simuladas o locales.
- El control **Restablecer demo** elimina las modificaciones locales y recupera los ejemplos iniciales.

## Publicación en Render

1. En Render, selecciona **New → Static Site** y conecta el repositorio de portafolio.
2. Selecciona la rama `portfolio-demo`.
3. Render detectará `render.yaml`. Verifica `npm ci && npm run build` como comando de build y `dist` como directorio publicado.
4. No agregues `VITE_SUPABASE_URL`, claves publicables, ni ningún secreto. El único valor requerido es `VITE_DEMO_MODE=true`.
5. Cuando termine el build, abre el URL de Render y verifica la vista de docente, la vista de estudiante, una edición local, el botón de restablecimiento y una recarga de una ruta interna.

## Seguridad y mantenimiento

Los valores `VITE_*` se incorporan al bundle de un sitio estático. Por eso esta variante no contiene secretos ni URLs de infraestructura real. Antes de convertir el repositorio en público, revisa el historial completo y no solo la rama actual; un fork conserva commits anteriores.
