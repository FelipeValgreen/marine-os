# Estado Real de Integraciones Náuticas — MarinOS v3

Este documento audita y especifica el estado técnico de cada integración externa en MarinOS, distinguiendo integraciones reales funcionales de aquellas que son simuladas o prototipos para demostración.

---

## 1. Matriz de Integraciones

| Integración | Estado Técnico | Hardware / API Requerida | Comportamiento Actual |
| :--- | :--- | :--- | :--- |
| **Signal K / NMEA 2000** | Prototipo con soporte de ingesta | Red NMEA 2000 a bordo, Gateway USB (Actisense NGT-1 o CAN bus socket can0), o servidor Signal K Node en LAN | El backend FastAPI expone `/api/v1/signalk/telemetry`. Si no hay tramas ingresadas en vivo, responde con `source: "simulator"` y parámetros realistas para un Yanmar 4JH57. |
| **DIRECTEMAR / SITPORT (Armada de Chile)** | Generador de Borrador / PDF de Apoyo | Portal SITPORT (DIRECTEMAR) o trámite presencial en Capitanía | No existe API pública abierta para zarpe recreativo directo en DIRECTEMAR. MarinOS compila un PDF formal con rol de tripulación y checklist para presentar ante la Autoridad Marítima. No afirma validez legal directa ni aprobación automática. |
| **Iridium Edge / Garmin inReach (SOS Satelital)** | Prototipo desconectado | Dispositivo Iridium SBD / Garmin inReach emparejado por Bluetooth o serie | El botón satelital en el modal SOS está deshabilitado con la indicación: *"Alerta satelital no disponible — no hay dispositivo vinculado"*. |
| **Meteorología Marina (Open-Meteo)** | Real (con fallback offline) | Conexión a Internet hacia `api.open-meteo.com` | Realiza consultas de viento, olas y mareas reales cuando hay red; cuando no hay conexión, usa el último caché de IndexedDB o la simulación de Golfo de Ancud. |
| **Base de Datos Local / Offline-First** | Real y Funcional | Dexie.js (IndexedDB en navegador del dispositivo) | 100% real y funcional en navegadores modernos (Safari iOS, Chrome, Firefox). Todas las operaciones de bitácora, checklist, tripulación y mantenimiento funcionan sin internet. |
| **Sincronización en la Nube** | Real (cuando está configurado) | Proyecto Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Cola `sync_queue` local en Dexie que vacía mutaciones hacia Supabase cuando se detecta conectividad online. |
| **OCR Documental de Tripulantes** | Real (con fallback heurístico) | Backend FastAPI `/api/v1/ocr/crew-document` | Extrae campos estructurados de licencias y cédulas náuticas. |
