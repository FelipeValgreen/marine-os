# Inventario de Datos Simulados en MarinOS v3

Este documento lista de forma honesta y explícita qué módulos, variables y flujos de datos dentro de **MarinOS** se generan mediante simulación local o matemática armónica, y bajo qué condiciones pasarán a ser fuentes en vivo.

---

## 1. Módulos y Sensores Simulados

| Módulo / Dato | Fuente Actual | Razón / Condición para 'EN VIVO' |
| :--- | :--- | :--- |
| **Telemetría NMEA 2000 / Signal K** | Simulador oscilatorio armónico en FastAPI (`/api/v1/signalk/telemetry`) | Requiere conexión física a gateway NMEA (vía Actisense NGT-1, can0 o Signal K Server en red de a bordo). Declarado explícitamente como `source: "simulator"`. |
| **Viento Verdadero / Aparente (HUD)** | Cálculo trigonométrico local / Simulado | Se calcula vectorialmente a partir de SOG/COG y AWS/AWA cuando hay datos de viento aparente, o con osciladores demo en puerto. |
| **Pines Sociales de Comunidad (Waze Náutico)** | Semilla local en Dexie IndexedDB (`community_reports`) | Simula reportes de capitanes vecinos en Seno de Reloncaví / Golfo de Ancud. En producción sincronizará vía Supabase Realtime cuando exista conectividad celular/satelital. |
| **Checklist Pre-Zarpe & E-Zarpe** | Generación de documento PDF local con resumen SHA-256 | La Armada de Chile (DIRECTEMAR) exige tramitación de zarpe vía portal oficial SITPORT o presencial en Capitanía de Puerto. La app genera un **borrador de apoyo para la tripulación**, no una tramitación oficial directa. |
| **Despacho / Aprobación de Zarpe** | Simulación local en IndexedDB | Marcado como *"Modo demo — aprobación simulada, no válida ante la Autoridad Marítima"*. |
| **Alerta SOS Satelital** | Bloqueado / No disponible | Muestra explícitamente: *"Alerta satelital no disponible — no hay dispositivo vinculado"*. Nunca simula despacho a guardacostas MRCC sin hardware Iridium/Garmin inReach / Globalstar conectado. |
| **Historial de Mantenimiento (Libro Inmutable)** | Almacenamiento local en Dexie IndexedDB (`vessel_service_history`) con hash SHA-256 local | Registro verificable dentro del dispositivo de a bordo. Eliminadas afirmaciones comerciales no respaldadas de plusvalía garantizada. |
| **Cartografía en Visor Web** | OpenStreetMap / MapLibre GL / OpenSeaMap | Carta referencial para visualización táctica. Requiere siempre el descargo visible: *"Carta referencial — no apta para navegación. Usa cartas oficiales SHOA y tu plotter."* |

---

## 2. Bandera Global `dataMode`

La aplicación cuenta con una bandera global:
- `dataMode: 'SIMULADO' | 'EN_VIVO'`
- Mientras `dataMode === 'SIMULADO'`, se despliega una cinta superior permanente:
  > **⚠️ MODO SIMULACIÓN — datos ficticios, no usar para navegar**
