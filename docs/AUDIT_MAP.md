# MarinOS v3 — Mapa de Auditoría y Arquitectura (AUDIT_MAP)

Este documento mapea la estructura real del monorepo MarinOS, la ubicación de cada módulo funcional, los endpoints de la API, las tablas de IndexedDB y Supabase, el Service Worker y las discrepancias encontradas frente al PRD v3.

---

## 1. Estructura General del Monorepo

```
marine-os/
├── apps/
│   ├── web/                          # Frontend Next.js 15 (App Router, Tailwind CSS, MapLibre GL)
│   │   ├── public/
│   │   │   ├── sw.js                 # Service Worker PWA (Cache Storage y Offline First)
│   │   │   └── manifest.json         # PWA Manifest
│   │   └── src/
│   │       ├── app/
│   │       │   ├── globals.css       # Tokens CSS, variables de tema y clases base
│   │       │   ├── layout.tsx        # Shell principal, fuentes (Inter, JetBrains Mono)
│   │       │   ├── page.tsx          # Vista unificada principal (Bridge, Vessel, Passport/Logbook)
│   │       │   ├── login/page.tsx    # Pantalla de acceso / Selección de perfil
│   │       │   ├── qr/[qrSlug]/      # Vista de nodo técnico escaneado
│   │       │   ├── trip/[magicToken] # Vista pública de tripulación
│   │       │   └── vessels/[vesselId]/handover/ # Vista de inspección y traspaso
│   │       ├── components/           # Componentes UI de módulos funcionales
│   │       └── lib/
│   │           ├── api.ts            # Helper para URL base del backend
│   │           ├── integrations.ts   # Modelos y adaptadores de hardware/APIs
│   │           ├── licenses.ts       # Validador de credenciales náuticas DIRECTEMAR
│   │           ├── nautical/         # Rutas GPX, cálculo de fondeo y mareas
│   │           ├── offline/db.ts     # Instancia Dexie IndexedDB (Local-First)
│   │           ├── supabase.ts       # Cliente Supabase
│   │           └── utils.ts          # Utilidades cn (clsx + twMerge)
│   └── api/                          # Backend FastAPI (Python 3.12, stateless)
│       ├── main.py                   # Entrypoint FastAPI, CORS y registro de routers
│       └── routers/
│           ├── bosun.py              # Copiloto RAG / Consultas técnicas
│           ├── ocr.py                # OCR Tesseract para CI/Pasaportes y boletas
│           ├── signalk.py            # Telemetría NMEA 2000 / Gateway
│           ├── sync.py               # Endpoint de sincronización batch Dexie -> Postgres
│           ├── weather.py            # Fondeo score y Passage Planner con Open-Meteo
│           └── zarpe.py              # Generación de PDF de zarpe y mock DIRECTEMAR
├── supabase/
│   └── migrations/
│       ├── 0001_initial_marine_os.sql # Esquema relacional con PostGIS
│       └── 0002_seed_demo.sql         # Datos demo iniciales
├── docs/                             # Documentación de producto, contexto y arquitectura
├── render.yaml                       # Despliegue de FastAPI
└── vercel.json                       # Configuración de despliegue Vercel
```

---

## 2. Dónde vive cada Módulo

| Módulo | Archivos Principales | Responsabilidad Actual |
|---|---|---|
| **Bridge (Puente & Carta)** | `apps/web/src/app/page.tsx` (`activeSection === "bridge"`), `apps/web/src/components/NauticalMap.tsx` | Visualización MapLibre GL a pantalla completa, trazado GPX, cápsula HUD de telemetría (SOG/COG/RPM), selector GPS Real vs SIM, drawer lateral con Passage Planner 48h y Vigía de Fondeo. |
| **Vessel (Barco)** | `apps/web/src/app/page.tsx` (`activeSection === "vessel"`), `apps/web/src/components/DamageControl.tsx`, `apps/web/src/components/VesselServiceBook.tsx` | Gemelo digital, inventario de repuestos, telemetría Yanmar 4JH57, Damage Control (averías y abastecimiento) y Libro de Mantenimiento inmutable. |
| **Voyages (Viajes & Zarpes)** | `apps/web/src/components/VoyagesZarpeView.tsx` | Stepper de 4 pasos (Ruta, Tripulación, Checklist, E-Zarpe), gestión de bitácora y generación de acta. |
| **Fleet (Flota)** | `apps/web/src/components/FleetManager.tsx` | CRUD de barcos en Dexie (`db.vessels`), especificaciones náuticas (LOA, manga, calado, mástil, horómetro, cadena) y Genesis Handover (Magic Link). |
| **Crew (Tripulación)** | `apps/web/src/components/CrewDirectory.tsx` | Directorio de tripulantes frecuentes (`db.crew_contacts` / `db.frequent_crew`), estado de licencias DIRECTEMAR y filtros de rol. |
| **Passport (Perfil & Bitácora)** | `apps/web/src/app/page.tsx` (`activeSection === "logbook"`) | Tarjeta Apple Wallet estilo credencial DIRECTEMAR, contador de millas náuticas, Split-Bill de gastos con OCR y vitrina de trofeos. |
| **Integraciones** | `apps/web/src/components/IntegrationHub.tsx`, `apps/web/src/lib/integrations.ts` | Galería de integraciones: Signal K, DIRECTEMAR (SITPORT), Open-Meteo y Conectividad Satelital (Iridium/Garmin). |
| **Handover (Traspaso)** | `apps/web/src/components/HandoverWizard.tsx`, `apps/web/src/app/vessels/[vesselId]/handover/page.tsx` | Checklist de entrega/recepción, subida de fotos de daños, firma digital y generación de hash SHA-256. |
| **Academy (Aprende)** | `apps/web/src/components/MarineAcademy.tsx` | Manuales náuticos de Chiloé, IALA-B y procedimientos de seguridad. |
| **SOS (Emergencias)** | `apps/web/src/components/EmergencySOSModal.tsx`, `apps/web/src/components/ThemeProvider.tsx` | Botón SOS flotante (mantener 3s) y Consola de Emergencia con guion MAYDAY VHF Can 16 y botón de emisión satelital. |
| **Copiloto** | `apps/web/src/components/MarineCopilot.tsx`, `apps/api/routers/bosun.py` | Asistente de abordo para consultas mecánicas y meteorológicas. |
| **Command Center** | `apps/web/src/components/CommandCenter.tsx` | Paleta de comandos táctica (⌘K) para navegación rápida entre módulos y acciones de emergencia. |

---

## 3. Endpoints Backend (`/api/v1/*`)

| Endpoint | Archivo | Estado Actual | Observación de Auditoría |
|---|---|---|---|
| `GET /api/v1/signalk/telemetry` | `apps/api/routers/signalk.py` | Mock estático con fluctuaciones | Declaraba falsamente `"source": "Signal K NMEA2000 Bus"`. Debe pasar a `source: simulator`. |
| `POST /api/v1/signalk/ingest` | `apps/api/routers/signalk.py` | Ingesta de telemetría | Recibe payload NMEA y actualiza estado en memoria. |
| `GET /api/v1/weather/anchorage-score` | `apps/api/routers/weather.py` | API real Open-Meteo Marine | Cruza viento, ráfagas y oleaje con calado y tenedero. |
| `GET /api/v1/weather/passage-planner` | `apps/api/routers/weather.py` | API real Open-Meteo | Evalúa 4 ventanas (now, +2h, +6h, mañana). |
| `POST /api/v1/bosun/ask` | `apps/api/routers/bosun.py` | Búsqueda por palabras clave | Respuestas hardcodeadas presentadas como RAG multimodal. Requiere campo libre y honestidad de fuente. |
| `POST /api/v1/ocr/crew-document` | `apps/api/routers/ocr.py` | PyTesseract OCR | Extracción de datos de pasaporte/CI chilena con fallback sintético. |
| `POST /api/v1/ocr/expense-receipt` | `apps/api/routers/ocr.py` | PyTesseract OCR | Extracción de montos e ítems de recibos/boletas. |
| `POST /api/v1/zarpe/generate-pdf` | `apps/api/routers/zarpe.py` | Generador de PDF en memoria | Documento de zarpe para presentación. |
| `POST /api/v1/zarpe/transmit` | `apps/api/routers/zarpe.py` | Simulación | Simulaba transmisión a DIRECTEMAR. Debe ser reemplazado por honestidad documental. |
| `GET /api/v1/sync/status` | `apps/api/routers/sync.py` | Health probe de sincronización | Devuelve timestamp y estado del broker. |
| `POST /api/v1/sync/batch` | `apps/api/routers/sync.py` | Ingesta por lotes offline | Procesa cola de mutaciones de IndexedDB. |

---

## 4. Esquema de Datos e IndexedDB (`apps/web/src/lib/offline/db.ts`)

Tablas en Dexie (`MarinOSLocalFirstDB` v10):
1. `organizations`: Tenancy de empresas de charter o armadores particulares.
2. `vessels`: Ficha técnica de barcos (LOA, manga, calado, mástil, combustible, agua, horómetro).
3. `vessel_systems_qr`: Nodos QR y equipos a bordo.
4. `inventory_items`: Repuestos, lubricantes y consumibles con umbrales y garantías.
5. `anchorages_spatial`: Fondeaderos de Chiloé y Reloncaví con tenedero y orientación de reparo.
6. `voyages`: Zarpes y travesías con estatus (draft, active, completed).
7. `voyage_crew`: Manifiesto de tripulación por zarpe.
8. `handover_inspections`: Actas de entrega/recepción con evidencias y hashes.
9. `vessel_manual_chunks`: Chunks de manuales para RAG local.
10. `sync_queue`: Mutaciones pendientes de subida al servidor (offline-first).
11. `logbook_entries`: Entradas de bitácora de navegación.
12. `expenses`: Gastos de viaje y combustible para Split-Bill.
13. `voyage_tracks`: Puntos GPS registrados.
14. `user_profiles`: Cuentas de usuario y licencias náuticas.
15. `user_preferences`: Preferencias locales (barco activo, modo GPS, vista).
16. `marketplace_orders`: Pedidos de repuestos y averías.
17. `integration_settings`: Configuración de gateways (Signal K, etc.).
18. `crew_contacts` / `frequent_crew`: Directorio de tripulantes frecuentes.
19. `community_reports`: Reportes de fondeo comunitarios.
20. `vessel_service_history`: Historial de intervenciones y mantenimiento de flota.

---

## 5. Service Worker PWA (`apps/web/public/sw.js`)

- Nombre de caché actual: `marinos-app-shell-v3.3-matte-tactical`.
- Rutas precacheadas: `/`, `/login`, `/manifest.json`, rutas dinámicas clave.
- Estrategia cartográfica: Cache-First agresivo para tiles vectoriales y raster (OpenSeaMap, CARTO).
- Estrategia aplicación: Network-First con fallback a caché local para funcionamiento sin conexión.
- Purga automática de cachés antiguas al activarse y receptor `SKIP_WAITING`.

---

## 6. Discrepancias encontradas frente al PRD v3

1. **Afirmaciones legales en Zarpes**: La vista `VoyagesZarpeView.tsx` aún contiene referencias a "Firma Criptográfica SHA-256 legalmente vinculante" e integración "DIRECTEMAR SITPORT Sandbox". Esto debe eliminarse en la Fase 0 para cumplir R-4.4.1 y R-4.4.2.
2. **Passport como documento oficial**: `page.tsx` tiene un encabezado que simula un documento oficial de la República de Chile y "DIRECTEMAR Verificado". Debe convertirse en un "Perfil náutico" honesto (R-4.11.3).
3. **Modo simulación no explicitado en telemetría**: Si Signal K está desconectado, el backend devuelve un mock diciendo que proviene de `Signal K NMEA2000 Bus`. Debe decir `simulator` e implementarse la franja global persistente de simulación (R-4.1).
4. **Alerta Satelital SOS ficticia**: La modal de SOS ofrece enviar alertas satelitales prometiendo llegar al MRCC Chile cuando solo encola un registro en IndexedDB. Debe quedar deshabilitada con aviso honesto (R-4.5.5).
5. **Cadena en barcos**: En `VesselRecord` no existe actualmente el campo `chain_length_meters`. Debe agregarse a `vessels` y FleetManager para validar si la cadena recomendada excede la disponible (R-4.6.1).
6. **MMSI y Distintivo de llamada**: No existen en `VesselRecord`. Deben agregarse para el guion MAYDAY (R-4.5.3).
