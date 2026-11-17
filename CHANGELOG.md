# Changelog — MarinOS

Todas las modificaciones notables de este proyecto están documentadas en este archivo según el estándar Keep a Changelog y el PRD v3 "Honesto, legible y seguro a bordo".

---

## [Fase 1 — Coherencia de Datos] - 2026-11-16
Rama: `fase-1-datos`

### Añadido / Mejorado (Consistencia Física y Náutica entre Módulos)
- **Máquina de Estados Operacional del Barco (R-4.2):**
  - Implementado tipo y estado compartido `VesselOperationalState` (`AMARRADO`, `FONDEADO`, `NAVEGANDO_MOTOR`, `NAVEGANDO_VELA`) en `ThemeProvider.tsx` y expuesto mediante selector interactivo en la barra superior.
  - Sincronización automática de estado según RPM y SOG: SOG > 0.5 kn y RPM > 700 conmuta a `NAVEGANDO_MOTOR`; RPM <= 700 conmuta a `NAVEGANDO_VELA`.
- **Regla Estricta Anchor Watch (R-4.4):**
  - Si `SOG > 0.5 kn`, el estado de la alarma de fondeo nunca puede indicar `SECURE`. Pasa automáticamente a `WARNING` o `DRAG_ALARM` con aviso visible: `"SOG X kn detectada — posible garreo o desfondeo en curso"`.
- **Avance de Posición en Simulador por Rumbo y Velocidad (R-4.3):**
  - Implementado avance por estima (Dead-Reckoning) en `page.tsx`: cada tick actualiza latitud y longitud según $SOG \times \Delta t$ y $COG$ ($10\text{ s a } 7\text{ kn} \approx 36\text{ m}$).
- **Store Único de Entorno y Cálculo Vectorial de Viento (R-4.4 / R-4.7):**
  - Creadas funciones trigonométricas náuticas `calculateApparentWind`, `calculateTrueWind` y `calculateTWAFromBearing` en `lib/nautical/index.ts`.
  - Cuando el barco navega a motor proa al viento ($TWA = 0^\circ$), $AWS = TWS + SOG > TWS$.
  - El HUD inferior izquierdo ahora muestra tanto el viento verdadero ($TWS$) como el viento aparente ($AWS$).
- **Largo de Cadena y Fondeo Seguro (R-4.4):**
  - Cálculo de radio de borneo y ratio ($5:1$ o $7:1$ según viento y tipo de fondo).
  - Comparación automática con `chain_length_meters` del barco; si la cadena requerida supera la disponible a bordo, se despliega: `"ATENCIÓN: cadena insuficiente a bordo (requiere X m, a bordo Y m)"`.
- **Planificador 48h con TWA Dinámico:**
  - Eliminada cualquier referencia a "PredictWind Engine".
  - Implementada función pura `evaluateDynamicRoutingWindow` que calcula el ángulo relativo de viento ($TWA$) dinámicamente según el rumbo planificado ($COG = 194^\circ$) y la dirección pronosticada, deduciendo automáticamente la polar de velocidad, el plan vélico recomendado y el índice de confort.
- **Checklist Pre-Zarpe Inicial (R-4.6):**
  - Inicialización en $0/6$ completados en lugar de $6/6$. Requiere verificación manual del capitán antes de habilitar la generación de documentos de zarpe.
- **Pruebas Automatizadas:**
  - Creada suite de pruebas unitarias náuticas en `apps/web/src/lib/nautical/nautical.test.ts` ejecutables con `npm run test:web`.

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
