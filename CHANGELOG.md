# Changelog — MarinOS

Todas las modificaciones notables de este proyecto están documentadas en este archivo según el estándar Keep a Changelog y el PRD v3 "Honesto, legible y seguro a bordo".

---

## [Fase 0 — Honestidad Radical] - 2026-11-16
Rama: `fase-0-honestidad`

### Eliminado / Corregido (Strings engañosos y falsas simulaciones)
- **Layout & Metadatos (`layout.tsx`):**
  - Eliminado: `"Apple Maps Nautical & Orca Co-Pilot"` del título de la pestaña.
  - Establecido: `"MarinOS — Sistema Operativo Náutico y Gestión de Flota"`.
- **Credenciales y Datos Personales (`supabase.ts` y `db.ts`):**
  - Reemplazado correo personal y RUT real por credenciales demo neutrales (`demo@marinos.app`, `11.111.111-1`, Capitán Demo).
- **Zarpe y Trámites Marítimos (`VoyagesZarpeView.tsx`):**
  - Eliminado: `"firma criptográfica SHA-256 legalmente vinculante ante la Armada de Chile"` y `"Transmitir E-Zarpe a DIRECTEMAR"`.
  - Reemplazado por: `"Generar documento de zarpe (PDF) para presentar ante la Autoridad Marítima"` y botón de simulación local claramente rotulado como demo.
  - Añadida advertencia explícita: `"El zarpe formal debe tramitarse por los canales oficiales de DIRECTEMAR (portal web oficial SITPORT o presencialmente en Capitanía de Puerto). Este documento es un borrador de apoyo para la tripulación."`
  - Añadido badge: `"Modo demo — aprobación simulada, no válida ante la Autoridad Marítima"`.
- **Pasaporte Náutico Digital (`page.tsx`):**
  - Eliminado: `"REPÚBLICA DE CHILE • DIRECTEMAR — APPLE WALLET NÁUTICO"` -> `"MarinOS • PERFIL NÁUTICO DIGITAL"`.
  - Eliminado: `"QR VERIFICACIÓN ARMADA"` -> `"QR IDENTIFICACIÓN TRIPULANTE"`.
  - Eliminado: `"DIRECTEMAR Verificado"` -> `"Credencial Registrada en App"`.
  - Eliminado: `"MARINOS DECENTRALIZED LEDGER"` -> `"MARINOS LOCAL STORAGE"`.
- **Emergencia SOS Náutico (`EmergencySOSModal.tsx`):**
  - R-4.5.1: Sin emergencia preseleccionada; obliga al capitán a categorizar (Vía de agua, Fuego, MOB, Gobierno/Varada, Otra).
  - R-4.5.2: Paso 1 DSC Distress (Canal 70) visible antes de la llamada de voz.
  - R-4.5.3: Guion de voz oficial ITU/DIRECTEMAR (`MAYDAY ×3, AQUÍ [NOMBRE] ×3, [CALL SIGN / MMSI]`, posición, POB, naturaleza, auxilio, CAMBIO).
  - R-4.5.4: Secuencia MOB inmediata previa al guion de voz (Grito MOB, lanzamiento de aro salvavidas, vigía permanente señalando, pulsación botón MOB plotter/GPS, maniobra de rescate Williamson/Anderson).
  - R-4.5.5: Botón satelital deshabilitado con mensaje explícito `"Alerta satelital no disponible — no hay dispositivo vinculado"`.
  - R-4.5.7: Botón de cierre visible y táctil >= 48px.
  - R-4.5.8: Coordenadas GPS del dispositivo de a bordo (100% offline).
- **Cartografía (`NauticalMap.tsx`):**
  - Añadido descargo permanente visible R-4.8.1: `"Carta referencial — no apta para navegación. Usa cartas oficiales SHOA y tu plotter."`
- **Telemetría NMEA / Signal K (`routers/signalk.py`):**
  - Reemplazado `"source": "Signal K NMEA2000 Bus (can0 / Actisense NGT-1)"` por `"source": "simulator"` cuando opera sin tramas físicas.
- **Modo Simulación Global (`ThemeProvider.tsx`):**
  - Añadido estado global `dataMode: 'SIMULADO' | 'EN_VIVO'` y cinta superior visible y persistente:
    `"⚠️ MODO SIMULACIÓN — datos ficticios, no usar para navegar"`.
- **Libro de Mantenimiento (`VesselServiceBook.tsx`):**
  - Eliminada afirmación publicitaria no demostrable `"+18% Plusvalía Reventa Certificada"`.
- **Parámetros del Barco (`db.ts`, `FleetManager.tsx`):**
  - Incorporados `chain_length_meters` (60m), `mmsi` (725001234) y `call_sign` (CB-4582).

### Documentación Añadida
- `docs/AUDIT_MAP.md`: Mapeo exhaustivo del repositorio, carpetas, endpoints y stores IndexedDB.
- `docs/LO_QUE_SIGUE_SIMULADO.md`: Inventario de datos que continúan siendo simulados y justificación.
- `docs/INTEGRACIONES.md`: Auditoría de integraciones reales vs prototipos.
