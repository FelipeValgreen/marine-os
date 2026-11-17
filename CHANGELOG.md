# Changelog — MarinOS

Todas las modificaciones notables de este proyecto están documentadas en este archivo según el estándar Keep a Changelog y el PRD v3 "Honesto, legible y seguro a bordo".

---

## [Fase 5 — Copiloto Marino y Push-to-Talk] - 2026-11-16
Rama: `fase-5-copiloto`

### Añadido / Mejorado (Copiloto Marino, RAG Documental Fidedigno y Entrada por Voz)
- **Push-to-Talk y Entrada por Voz para Timoneles (PRD 0.1 / R-4.13.1):**
  - Implementado botón Push-to-Talk con micrófono táctil y detección de estado de grabación.
  - Integrado con la API nativa Web Speech (`es-CL`) para dictado manos libres con guantes en timón o cabina.
- **Ruteo de Intención Náutico (PRD R-4.13.4):**
  - **Consultas Meteorológicas:** Ruteo automático al store `environment` para responder con viento verdadero ($TWS$), viento aparente ($AWS$), rumbo y altura de ola actualizados en vivo.
  - **Consultas Mecánicas:** RAG local fidedigno sobre los manuales técnicos del barco (`vessel_manual_chunks`) cruzado con el inventario de repuestos (`inventory_items`) para indicar disponibilidad y ubicación de la pieza en el pañol.
  - **Situaciones de Emergencia:** Detección de palabras clave críticas (Hombre al agua / MOB, Mayday, Incendio, Vía de agua) con banner de acción inmediata y botón de un toque para abrir la consola SOS.
- **Honestidad Radical en IA y Modo Demo Transparente (PRD R-4.13.2 / R-4.13.3 / R-4.13.6):**
  - Incorporado badge explícito: `"Modo demo — respuestas de ejemplo basadas en manuales locales"` cuando no hay clave LLM en variables de entorno.
  - Cita estricta de documentos y páginas solo cuando provienen de un manual efectivamente indexado. Si la consulta está fuera del alcance de los manuales del barco, responde honestamente: *"No encontré esto en tus manuales de a bordo"*.
  - Añadido aviso permanente en consultas de seguridad y mecánica: *"Orientación general. Ante dudas, consulta el manual del fabricante o a un técnico calificado."* (R-4.13.5).
  - Eliminados los reclamos engañosos de la UI: eliminadas referencias a "Multimodal RAG" e "IA Vision" (R-4.13.7).
- **Control Humano en el Circuito (Human-in-the-Loop — Regla 9):**
  - Ninguna acción crítica (activar alarma, despachar alerta SOS) se ejecuta de forma autónoma sin confirmación explícita del capitán en pantalla.

---

## [Fase 4 — Producto de Flota y Handover Real] - 2026-11-16
Rama: `fase-4-flota`

### Añadido / Mejorado (Gestión de Flota, Inventario Técnico y Sello de Integridad en Entrega)
- **Categorización Estricta del Inventario (PRD R-4.9.1):**
  - Separado el inventario en 3 pestañas ergonómicas:
    - **Equipos:** Motor Yanmar 4JH57, Generador Fischer Panda, Molinete Quick Dylan, con horómetros acumulados e intervalos de servicio configurables.
    - **Repuestos:** Filtros Racor, impulsores, ánodos de sacrificio, con stock actual, umbral mínimo y alertas visuales.
    - **Seguridad con Vencimiento:** Balsa salvavidas, EPIRB, extintores y pirotecnia SOLAS con semáforo preventivo a 90/30 días.
- **Corrección Técnica de Especificaciones y Fuentes (PRD R-4.9.5):**
  - Corregido: `Yanmar 4JH57` especificado como "Inyección Directa" (eliminada afirmación de "Common Rail").
  - Corregido: `Filtro Racor R20P` especificado honestamente como 30 micras según catálogo Parker Racor (eliminado el claim erróneo de 10 micras).
  - Cada repuesto incorpora campo de especificación técnica con su respectiva fuente documental (manual de taller o catálogo).
- **Medición Real y Separada de Energía (PRD R-4.9.2):**
  - Separada la lectura de "Batería de servicio (SOC %)" de "Alternador (V)" en tarjetas independientes.
- **Registro Fidedigno de Horómetro (PRD R-4.9.3 / R-4.9.4):**
  - Muestra autor y fecha de ingreso manual. Botones de incremento manual etiquetados explícitamente con el badge `[SIMULADOR]`.
  - Próximo servicio calculado dinámicamente según horas restantes sin hardcodear garantías ficticias.
- **Handover con Fotos Reales y Doble Firma Táctil (PRD R-4.10.1 - R-4.10.6):**
  - Checklist ampliado a 12 sistemas críticos para navegación patagónica (combustible %, agua %, baterías, balsa, EPIRB, auxiliar, gas, velas, electrónica/VHF, cadena, grifos/sentina, SOLAS).
  - Eliminado generador de fotos sintéticas / canvas artificiales: solo se aceptan fotografías reales mediante `<input type="file" accept="image/*" capture="environment">`. Requiere al menos 1 foto real para sellar.
  - Doble firma táctil obligatoria: canvas individual para quien entrega (Armador/Saliente) y quien recibe (Capitán/Entrante) con nombre y RUT de ambas partes.
  - Sello de integridad SHA-256 canónico que incluye el hash de cada imagen de evidencia y los datos del acta.
  - Herramienta de "Verificar Integridad del Acta" (R-4.10.4) para recalcular y validar la integridad local del documento sellado.
- **Transparencia en Integration Hub (PRD R-4.12.1 - R-4.12.3):**
  - Signal K: rotulado como `SIMULADO` con nota técnica de Mixed Content y PNA.
  - DIRECTEMAR: rotulado como `SIMULADO` (trámites demo locales).
  - Open-Meteo: rotulado como `CONECTADO (EN VIVO)` (eliminado "PredictWind").
  - Conectividad Satelital: rotulada como `NO DISPONIBLE (EMULADOR)`.
- **Documento Entregable:**
  - Creado `docs/ARQUITECTURA_A_BORDO.md` detallando las tres opciones de ingeniería viables (TLS local con CA, app empaquetada nativa y relay en la nube) para el consumo de telemetría NMEA 2000 sin violar restricciones de navegador.

---

## [Fase 3 — Experiencia Móvil y Navegación] - 2026-11-16
Rama: `fase-3-mobile`

### Añadido / Mejorado (Navegación Móvil Ergonómica y Glosario Náutico Chileno)
- **Barra de Navegación Inferior de 5 Ítems (PRD 5.4 / R-5.4):**
  - Reemplazada la barra horizontal con scroll por una barra fija de 5 ítems: **Puente**, **Barco**, **Viajes**, **Flota**, **Más**.
  - El botón "Más" despliega una lámina táctil (Slide-up Sheet) accesible con una sola mano que agrupa los módulos secundarios: **Averías y emergencias**, **Tripulación**, **Bitácora y Pasaporte**, **Vigía de fondeo**, **Entrega y recepción (Handover)** y **Aprende**.
- **Barra Superior de Puente Responsiva a 390px (PRD 5.4 / R-5.4):**
  - Reestructurado el header superior de navegación en flexbox responsivo con envoltura dinámica.
  - Las coordenadas DMS completas (`41°31'12"S 72°58'48"W`) nunca se superponen con botones o selectores en pantallas móviles de 390px.
- **Targets Táctiles $\ge 48 \times 48$ px para Uso con Guantes (PRD 5.5 / R-5.5):**
  - Ajustados todos los controles primarios, botones de alternancia de estado y disparadores a altura mínima `min-h-[44px]` a `min-h-[48px]`.
  - Botón de SOS flotante y botones de navegación rápida con áreas de toque holgadas y accesibles.
- **Eliminación Total de Jerga Técnica y Falsas Métricas (PRD 1.3 / R-1.3):**
  - Reemplazados tecnicismos en notificaciones y UI: eliminados `"IndexedDB"`, `"sync_queue"`, `"Edge-Sync"`, `"Zero Data Entry"`, `"Multimodal RAG"`.
  - Reemplazados por terminología clara: `"Base de datos local"`, `"Guardado en este dispositivo"`, `"Pendiente de envío"`, `"Asistente de a bordo"`.
- **Glosario Náutico Chileno Unificado (PRD 1.3):**
  - Bridge $\to$ **Puente**
  - Vessel $\to$ **Barco**
  - Voyages $\to$ **Viajes**
  - Fleet $\to$ **Flota**
  - Crew $\to$ **Tripulación**
  - Handover $\to$ **Entrega y recepción**
  - Damage Control $\to$ **Averías y emergencias**
  - Anchor Watch Pro $\to$ **Vigía de fondeo**
  - Marine Academy $\to$ **Aprende**
  - Copilot $\to$ **Copiloto Marino**

---

## [Fase 2 — Sistema de Diseño Marino] - 2026-11-16
Rama: `fase-2-diseno`

### Añadido / Mejorado (Tokens, Temas, Tipografía y Accesibilidad Náutica)
- **Tokens Semánticos Completos (R-5.2):**
  - Añadidos en `globals.css` para los tres temas: `--color-brand`, `--color-action`, `--color-ok`, `--color-warning`, `--color-danger`, `--color-data`, `--color-sim`.
  - Desaturación de cian cegador (`#00E5FF` $\to$ `#38BDF8`) y verde cegador (`#00E676` $\to$ `#34D399`) en el tema nocturno y de puente para evitar deslumbramiento.
- **Cumplimiento Estricto de Contraste WCAG 2.1 AA:**
  - Botón de acción principal (`.marine-btn-primary`) configurado con `--color-action: #C2410C` y texto blanco (`#FFFFFF`), logrando una relación de contraste calculada de $5.2:1$ (superando el umbral AA de $4.5:1$).
- **Tres Temas Operacionales (R-5.1):**
  - **Océano (Día):** Modo oscuro abisal de baja fatiga ocular para puente de mando.
  - **Noche (Red-Shift):** Fondo negro OLED puro (`#000000`), textos e íconos estrictamente en espectro rojo (`#FF2222` / `#CC1111`), sin píxeles blancos, verdes o cian.
  - **Sol (Alto Contraste):** Fondo hielo claro (`#F8FAFC`), texto marino carbón (`#020617`, peso $\ge 600$), sin grises claros deslavados.
  - Atajo de un toque al modo noche escotópico integrado directamente en el HUD superior del Bridge.
  - Inicialización automática respetando `prefers-color-scheme` cuando no hay preferencia guardada.
- **Accesibilidad y Anti-Mareo (R-5.7):**
  - Soporte global para `prefers-reduced-motion: reduce` que colapsa duraciones de animación para reducir la cinetosis a bordo.
  - Añadido `role="alert"` y `aria-live="assertive"` en banners de emergencia y alarma de garreo (`drag-alarm-banner`, `anchor-sog-warning-banner`).
  - Alarmas multi-sensoriales completas (color + ícono + texto explícito + sirena de audio + vibración háptica).
- **Tipografía y Legibilidad de Timón (R-5.3):**
  - Números del HUD ampliados a `text-2xl sm:text-4xl` con tipografía monoespaciada tabular (**JetBrains Mono**, `tabular-nums slashed-zero`) garantizando $CLS = 0$.
- **Documento Entregable:**
  - Creado `docs/DESIGN_SYSTEM.md` con las especificaciones cromáticas, cálculo de ratios de contraste WCAG 2.1 AA y ergonomía de pantalla táctil para uso con guantes en mar abierto.

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
