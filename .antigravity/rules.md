# Workspace Rules — Marine OS

## Contexto y Documentación Base
- Lee siempre `/docs/CONTEXT.md`, `/docs/PRD.md`, `/supabase/migrations/0001_initial_marine_os.sql` y `/supabase/migrations/0002_seed_demo.sql` antes de proponer cambios arquitectónicos.
- Stack fijo: Next.js 15+ (App Router, TypeScript strict, Tailwind CSS, PWA) en `/apps/web`, FastAPI (Python 3.12+) en `/apps/api`, y Supabase (PostgreSQL + PostGIS + pgvector) como backend cloud.

## Restricciones Técnicas Estrictas
1. **Local-First Obligatorio:** Toda operación a bordo (check-in/out, QRs, bitácora, inventario, alarma de garreo) se guarda primero en `IndexedDB` mediante Dexie.js con cola de sincronización (`sync_queue`). Prohibido hacer `fetch` directo a Supabase desde componentes de inspección o navegación sin capa offline.
2. **Ergonomía Marina (Dual-Theme):** Todo componente de interfaz debe implementar los temas `daylight-high-contrast` y `night-red-shift` (rojo puro `#FF1E1E` sobre negro `#000000`, cero píxeles blancos en modo noche). Todos los botones táctiles operativos deben medir mínimo `56px` de alto (`min-h-14`).
3. **Verificación Autónoma:** Antes de dar por terminada una fase, ejecuta los linters (`npm run lint`, `tsc --noEmit`) y levanta el servidor local para verificar que no existan errores de compilación ni rutas rotas.
