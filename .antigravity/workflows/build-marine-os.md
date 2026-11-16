---
description: Construye la arquitectura completa de Marine OS (PWA Offline-First + FastAPI + PostGIS) paso a paso
---

1. **Inicialización del Monorepo:**
   - Crea `/apps/web` con Next.js 15 (TypeScript, Tailwind CSS, App Router) y configura el soporte PWA offline.
   - Crea `/apps/api` con FastAPI, Pydantic v2, `uvicorn` y estructura modular (`routers/`, `services/`, `templates/`).

2. **Capa Offline & Gemelo Digital (`/apps/web`):**
   - Instala `dexie` y `dexie-react-hooks`.
   - Implementa `/apps/web/src/lib/offline/db.ts` replicando las tablas de `/supabase/migrations/0001_initial_marine_os.sql` más `sync_queue`, pre-poblando los datos demo de `0002_seed_demo.sql` para pruebas offline inmediatas.
   - Crea el proveedor de tema global (`ThemeProvider`) con soporte instantáneo para `daylight-high-contrast` y `night-red-shift`.

3. **Módulo Gatekeeper (Zarpe OCR + Handover Offline + QRs):**
   - Construye la vista pública sin login `/apps/web/src/app/trip/[magicToken]/page.tsx` para que los tripulantes suban documentos y firmen exención de responsabilidad.
   - Construye el flujo guiado offline `/apps/web/src/app/vessels/[vesselId]/handover/page.tsx` con captura de fotos comprimidas en cliente, firma táctil en canvas y generación de hash SHA-256.
   - Construye la vista de escaneo QR `/apps/web/src/app/qr/[qrSlug]/page.tsx` optimizada para carga instantánea desde caché local.

4. **Módulo Copiloto Táctico (`/apps/web/src/lib/nautical/`):**
   - Implementa funciones puras y testeadas para: parsing de archivos `.gpx`, cálculo exacto de cadena de fondeo (profundidad + amplitud de marea + ratio de seguridad), y cálculo de radio de garreo GPS (`AnchorWatch`).
   - Integra MapLibre GL JS con visualización de ruta GPX y fondeaderos.

5. **Backend IA y Meteorología (`/apps/api`):**
   - Crea endpoint `POST /api/v1/ocr/crew-document` usando Gemini/Claude Multimodal para extraer RUT/Pasaporte, número de licencia náutica y fecha de vencimiento en JSON estructurado.
   - Crea endpoint `GET /api/v1/weather/anchorage-score` que consulte Open-Meteo Marine API y cruce viento/oleaje con los `exposed_bearings` del fondeadero y el `draft_meters` del barco.
   - Crea endpoint `POST /api/v1/zarpe/generate-pdf` para compilar el Rol de Tripulación / Zarpe oficial.

6. **Verificación Final:**
   - Ejecuta `npm run build` en `/apps/web` y valida que no haya errores de TypeScript.
   - Inicia ambos servidores en local y verifica en el navegador integrado que el flujo de Handover funciona con la red desconectada.
