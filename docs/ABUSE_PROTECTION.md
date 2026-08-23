# Protección contra abuso

## Política aplicada

| Superficie | Límite | Dónde se aplica | Finalidad |
| --- | --- | --- | --- |
| Inicio de sesión | 10 solicitudes por IP cada 5 minutos | Supabase Auth (`supabase/config.toml`) | Barrera confiable contra intentos repetidos desde una red. |
| Inicio de sesión | 5 intentos por navegador cada 10 minutos | Cliente, en `sessionStorage` | Explicar el enfriamiento antes de enviar más solicitudes. No sustituye al límite de Supabase. |
| Sincronización de datos | Una hidratación remota concurrente; se reutiliza una respuesta exitosa por 1.5 s | Cliente | Evitar ráfagas internas generadas por cambios en tiempo real. |

Los contadores del navegador contienen solo marcas de tiempo; nunca correo, código de estudiante, contraseña, token ni contenido de documentos. Se eliminan al cerrar la sesión del navegador o tras un inicio de sesión correcto.

## Despliegue obligatorio

`supabase/config.toml` documenta y versiona el límite para entornos locales. Antes de declarar esta protección activa en producción, una persona con acceso al proyecto alojado debe configurar el mismo valor en **Supabase Dashboard → Authentication → Rate Limits** (o aplicar la configuración con la CLI autenticada) y comprobarlo desde una IP de prueba.

Prueba de aceptación: realizar 10 inicios de sesión en una ventana de cinco minutos y verificar que el siguiente recibe una respuesta limitada (429). La interfaz debe mostrar el mensaje genérico de espera, sin revelar si el correo o código existen.

La app se despliega como sitio estático de Render: el navegador no puede imponer una limitación confiable sobre recargas maliciosas. Render aporta mitigación de red/CDN, pero los abusos de capa de aplicación deben limitarse en el proveedor que recibe la operación (Supabase Auth, funciones Edge y, si se introduce un backend, su middleware).

## Operación y observabilidad

- No se registran credenciales ni documentos en telemetría.
- Los límites de IA y sus incidencias privadas se gestionan en las funciones Edge y la base de datos; esta política no cambia sus cuotas.
- Si el límite legítimo resulta restrictivo, ajuste el valor alojado y esta configuración versionada en el mismo cambio, conserve las métricas de denegación y vuelva a ejecutar la prueba de aceptación.
