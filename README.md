# Projects Management — demo de portafolio

Aplicación React para visualizar una experiencia de gestión colaborativa de proyectos: equipos, tareas, reuniones, incidencias, documentos y exportación organizada.

Esta rama (`portfolio-demo`) usa exclusivamente datos ficticios y funciona sin Supabase, credenciales externas ni servicios de IA remotos. Los cambios que haga cada visitante se guardan únicamente en su navegador y se pueden restablecer desde el demo.

## Ejecutar el demo

```bash
npm ci
Copy-Item .env.portfolio.example .env.local
npm run dev
```

## Despliegue en Render

El archivo `render.yaml` incluye la configuración para un Static Site. La rama ya incorpora `VITE_DEMO_MODE=true` en `.env.production`, por lo que Render siempre construirá el demo aunque el Static Site se haya creado manualmente. No configures variables de Supabase.

La guía detallada está en [docs/PORTFOLIO_DEMO.md](docs/PORTFOLIO_DEMO.md).

Plataforma de seguimiento de proyectos académicos para monitores, profesores y estudiantes. Centraliza equipos, asignación exclusiva de estudiantes, incidentes, reuniones, tareas y generación/revisión de documentos institucionales con IA.

## Funcionalidad principal

- Gestión de proyectos, postulaciones y equipos.
- Un estudiante pertenece como máximo a un proyecto; una reasignación lo retira del anterior.
- Incidentes, tareas, reuniones, evidencias y seguimiento por proyecto.
- Generación de contexto del proyecto, plan de actividades, acta de reunión y reporte de entregables.
- Entrada desde transcripciones TXT/VTT y fuentes PDF/DOCX, según el tipo documental.
- Previsualización, versionado, revisión con IA, PDF almacenado y descarga firmada.
- Autenticación real con Supabase, roles y políticas RLS.
- Integración de calendario y recordatorios mediante Supabase Edge Functions.

## Arquitectura

- Frontend: React 18, TypeScript, Vite y Tailwind CSS.
- Backend: Supabase Auth, Postgres, Storage y Edge Functions.
- IA: OpenAI llamada únicamente desde Edge Functions; la clave nunca llega al navegador.
- Despliegue web: Render Static Site definido en `render.yaml`.
- Verificación: Vitest, Playwright, TypeScript y build de producción.

## Desarrollo local

Requisitos: Node.js 24.14.x y npm.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Complete `.env.local` con la URL y la clave publicable de Supabase. La aplicación no incluye un catálogo ni registros ficticios: cada inicio carga únicamente la información autorizada de Supabase.

## Verificación

```bash
npm run test:all
```

Ese comando ejecuta comprobación de tipos, pruebas unitarias/de contrato, pruebas E2E y compilación de producción. GitHub Actions repite la misma verificación en cada push y pull request a `main`.

## Despliegue

La guía completa, incluidos los valores que deben configurarse manualmente y las pruebas posteriores, está en [GUIA_DESPLIEGUE_RENDER.md](GUIA_DESPLIEGUE_RENDER.md).

Nunca agregue claves secretas a variables `VITE_*`, archivos `.env` versionados ni código fuente. El navegador solo necesita la clave publicable de Supabase; `OPENAI_API_KEY`, credenciales administrativas y tokens de integraciones viven en Supabase Edge Function Secrets.
