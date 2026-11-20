# Estado de Motores en Vivo vs. Emulación de Hardware en MarinOS v3.2

Este documento detalla con transparencia técnica qué ramas del sistema operan con **motores algorítmicos, protocolos reales y APIs en vivo**, y cuáles requieren **hardware físico a bordo** (multiplexor NMEA o módem satelital) para conmutar de modo simulador a lectura física.

---

## 1. Matriz de Ramas del Sistema (En Vivo vs. Dependencia de Hardware Físico)

| Rama del Sistema | Estado Actual en Producción | Capacidad Real Implementada | Condición para Hardware Físico |
| :--- | :--- | :--- | :--- |
| **1. Telemetría NMEA 0183 / 2000 & Signal K** | **Híbrido (Parser NMEA Real + Oscilador Armónico)** | Decodificador real de sentencias `$GPRMC`, `$GPGGA`, `$SDDBT`, `$IIMWV` y `$YMXDR` con validación de checksum XOR (`*HH`) en `/api/v1/signalk/parse-nmea` y consola en vivo en Integration Hub. | Cuando no hay un multiplexor físico conectado por Wi-Fi/WSS, usa el oscilador armónico del Yanmar 4JH57 (`source: "simulator"`). |
| **2. OCR Multimodal & Validador DIRECTEMAR** | **Motor Algorítmico Real** | Subida real de fotos desde cámara/archivo (`FileReader` Base64), inspección binaria de cabeceras MIME y hash SHA-256, validación matemática de **RUT Chileno (Algoritmo Módulo 11)** y matriz legal de atribuciones por eslora (Bahía $\le 12\text{m}$, Costero $\le 24\text{m}$, Alta Mar ilimitado). | Operativo 100% en línea y con fallback determinista offline. |
| **3. Weather Routing 48h & Cartografía VMG** | **En Vivo (Open-Meteo API + VPP Polar)** | Consulta en tiempo real a `api.open-meteo.com` y `marine-api.open-meteo.com` para series horarias de 48h (viento, rachas, dirección y altura de ola), cálculo de curva polar VPP del *Oceanis 41.1*, plan de rizos y cálculo trigonométrico de **VMG** hacia el waypoint activo. | Caché automático offline (`open-meteo-edge-cache`) cuando se pierde cobertura celular en alta mar. |
| **4. Copiloto Náutico IA (RAG BM25 + Telemetría)** | **En Vivo + 100% Offline** | Motor de ranking léxico-semántico BM25 sobre 22 manuales técnicos (Yanmar, Volvo, Racor, Victron, B&G, Jabsco, Quick, COLREG, SAR) con detector automático de anomalías de telemetría (alerta térmica $>88^\circ\text{C}$, baja presión de aceite $<180\text{ kPa}$, bajo voltaje $<12.3\text{V}$ y peligro de varada UKC $<1.5\text{m}$). | Operativo sin internet desde `IndexedDB` y enriquecido vía `/api/v1/bosun/ask`. |
| **5. Consola de Emergencia SOLAS & MAYDAY** | **Operativa (TTS Voz + 137 + SMS 2G + WhatsApp)** | Locución automática por voz (`speechSynthesis` TTS) del guion MAYDAY oficial OMI/DIRECTEMAR para acercar al micrófono VHF Canal 16, llamada directa al **137 (Rescate Armada de Chile)**, envío de **SMS nativo por red 2G** (sin requerir datos móviles) y difusión por WhatsApp con coordenadas GPS reales. | La transmisión satelital directa (Iridium GO! / Garmin inReach) permanece honesta y bloqueada si no hay IMEI físico vinculado. |
| **6. E-Zarpe PDF & Planilla SITPORT (CSV)** | **Generación Criptográfica Real** | Compilación de PDF oficial de Rol de Tripulación con sello SHA-256 y exportador de **Planilla Oficial SITPORT (CSV)** lista para carga administrativa ante la Autoridad Marítima. | El despacho legal definitivo en Chile debe ingresarse en el portal gubernamental SITPORT de DIRECTEMAR. |
| **7. Edge-Sync Bidireccional LWW** | **Persistencia Real Push/Pull** | Reconciliación Last-Write-Wins (LWW) por marca de tiempo en `/api/v1/sync/batch` y descarga de estado multi-dispositivo en `/api/v1/sync/pull` con verificación de integridad SHA-256. | Sincroniza automáticamente al detectar reconexión en puerto. |
| **8. Cartografía Náutica MapLibre & OpenSeaMap** | **En Vivo + Caché de Teselas** | Renderizado vectorial WebGL con balizamiento náutico OpenSeaMap, círculo geodésico de borneo, bloqueo táctil contra agua salada (Touch-Lock) y modo rojo escotópico nocturno. | Incluye aviso reglamentario: *"Carta referencial — verifica siempre con cartas oficiales SHOA"*. |

---

## 2. Conmutador Global `dataMode`
- `dataMode: 'SIMULADO' | 'EN_VIVO'`
- Permite alternar en cualquier momento entre el GPS nativo del dispositivo (`navigator.geolocation.watchPosition`) y el simulador de travesía en el Seno de Reloncaví / Chiloé.
