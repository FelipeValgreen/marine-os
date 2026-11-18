# MarinOS v3.1 — Arquitectura de Procesos BPMN y Matriz Integral de QA
> **Documento de Especificación de Procesos de Negocio (BPMN 2.0) y Auditoría de Calidad**  
> **Autor:** Lead QA Architect & Principal Systems Engineer  
> **Versión:** 3.1.0-RC  
> **Fecha:** 18 de Noviembre de 2026  
> **Alcance:** Procesos de Usuario (Operación Marítima) y Procesos de Gestión (Flota, Mantenimiento B2B y Astillero)

---

## 1. Resumen Ejecutivo de Arquitectura

MarinOS es una Progressive Web App (PWA) de alta criticidad náutica diseñada con enfoque **Local-First** (Next.js 15, Dexie IndexedDB v10, Service Worker con cache cartográfica) y sincronización oportunista hacia un backend FastAPI y Supabase PostGIS.

Para garantizar seguridad a bordo y viabilidad comercial sin incurrir en contingencias legales, el sistema se estructura en dos dominios estrictamente segregados mediante una **Arquitectura Bimodal (Tierra vs. Alta Mar)**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MARINOS BIMODAL PLATFORM                           │
├──────────────────────────────────────────┬──────────────────────────────────┤
│        MODO ALTA MAR (TÁCTICO)           │        MODO TIERRA (GESTIÓN)     │
├──────────────────────────────────────────┼──────────────────────────────────┤
│ • Gimbal UI (Horizon-Lock DeviceOrientation) • Gestor de Flota & Genesis Handover  │
│ • Telemetría NMEA 2000 / Signal K        │ • Libro de Mantenimiento Inmutable │
│ • Vigía de Fondeo & Alarma de Garreo     │ • Handover Bipartito de Charter  │
│ • Radio VHF Digital (< 10 MN, 24h TTL)   │ • Agenda de Tripulación & Licencias│
│ • Flash-Checklist (Swipes estilo Tinder) │ • Split-Bill & OCR de Boletas    │
│ • SOS / MAYDAY (VHF 16, DSC, Guion)      │ • Configuración de Integraciones │
└──────────────────────────────────────────┴──────────────────────────────────┘
```

---

## 2. BPMN: Procesos de Usuario (Operación Marítima)

### 2.1 Proceso U-01: Planificación, Verificación y E-Zarpe

```mermaid
flowchart TD
    Start([Inicio: Necesidad de Navegación]) --> Step1[Paso 1: Selección de Barco y Estimación de Ruta GPX]
    Step1 --> CalcETA[Cálculo de ETA: Distancia MN / SOG Estimada]
    CalcETA --> Step2[Paso 2: Manifiesto de Tripulación]
    
    Step2 --> CheckCapt{¿Exactamente 1 Capitán asignado?}
    CheckCapt -- No --> WarnCapt[Error: Se requiere exactamente 1 Patrón/Capitán] --> Step2
    CheckCapt -- Sí --> ValidateLic[Validar Licencias DIRECTEMAR vs Eslora LOA]
    
    ValidateLic --> LicOK{¿Licencias Vigentes y Atribución OK?}
    LicOK -- No --> AlertLic[Alerta: Licencia Vencida o Falta Atribución] --> Step2
    LicOK -- Sí --> Step3[Paso 3: Flash-Checklist Pre-Zarpe 0/6]
    
    Step3 --> SwipeCheck[Inspección Manual Ítem por Ítem con Swipe]
    SwipeCheck --> AllChecked{¿Checklist 100% Verificado?}
    AllChecked -- No --> BlockZarpe[Bloqueo: No se puede generar acta de zarpe] --> SwipeCheck
    
    AllChecked -- Sí --> Step4[Paso 4: Generación Documental de Zarpe]
    Step4 --> GenDoc[Generar Documento PDF con Resumen SHA-256]
    GenDoc --> LegalDisclaimer[Adjuntar Descargo: Presentar en Capitanía o SITPORT Oficial]
    LegalDisclaimer --> EndZarpe([Fin: Barco Listo para Soltar Amarras])
```

---

### 2.2 Proceso U-02: Navegación Táctica & Anti-Mareo en Alta Mar

```mermaid
flowchart TD
    NavStart([Inicio de Travesía: Toggle MODO ALTA MAR]) --> LockUI[Bloquear Módulos Administrativos]
    LockUI --> Gimbal[Activar GimbalUI: Horizon Lock vía deviceorientation]
    Gimbal --> Telemetry[Lectura Telemetría: SOG, TWS, Profundidad en JetBrains Mono text-7xl]
    
    Telemetry --> CheckSensor{¿Dato < 10 segundos?}
    CheckSensor -- No --> DimTelemetry[Atenuar Dato y Mostrar Antigüedad 'hace X min']
    CheckSensor -- Sí --> RenderActive[Renderizado Normal de Alta Visibilidad]
    
    RenderActive --> WatchRadar[Radar Social / Radio Digital VHF]
    WatchRadar --> FindBoats{¿Barcos o Alertas < 10 MN?}
    FindBoats -- Sí --> DisplayVHF[Mostrar Alerta con Coordenadas y Canal VHF]
    FindBoats -- No --> StandbyVHF[Monitoreo Pasivo]
    
    RenderActive --> PTTVoice[Push-to-Talk Manos Libres]
    PTTVoice --> VoiceInput[Dictado de Bitácora / Consulta al Copiloto]
    VoiceInput --> ToolCalling[Gemini Tool Calling / Fallback Local]
    ToolCalling --> ConfirmHuman{¿Acción sale del dispositivo?}
    ConfirmHuman -- Sí --> RequirePrompt[Solicitar Confirmación Táctil en Pantalla]
    ConfirmHuman -- No --> WriteLog[Guardar en db.logbook_entries]
    RequirePrompt --> WriteLog
    
    WriteLog --> NavLoop([Mantener Monitoreo Continuo])
```

---

### 2.3 Proceso U-03: Vigía de Fondeo & Alarma de Garreo

```mermaid
flowchart TD
    AnchorStart([Llegada a Fondeadero]) --> InputAnchor[Ingresar: Profundidad Sonda + Amplitud Marea + Cadena a Bordo]
    InputAnchor --> CalcScope[Calcular Ratio de Fondeo: 5:1 o 7:1 según Viento]
    
    CalcScope --> CheckChain{¿Cadena Recomendada <= Cadena a Bordo?}
    CheckChain -- No --> WarnChain[Alerta ATENCIÓN: Cadena Insuficiente a Bordo]
    CheckChain -- Sí --> DropAnchor[Fondear y Fijar Posición del Ancla]
    
    WarnChain --> DropAnchor
    DropAnchor --> SetWatch[Activar Vigía de Fondeo: Radio de Borneo]
    SetWatch --> StateFondeado[Transición Estado: FONDEADO]
    
    StateFondeado --> SampleGPS[Muestreo GPS cada 5 seg]
    SampleGPS --> CheckSOG{¿SOG > 0.5 kn sostenido?}
    
    CheckSOG -- Sí --> AlertMoving[Alerta WARNING: Barco en movimiento en fondeadero]
    CheckSOG -- No --> CheckRadius{¿Distancia > Radio Borneo?}
    
    CheckRadius -- Sí --> DragAlarm[ALARMA CRÍTICA: Garreo de Ancla - Alerta Sonora/Visual]
    CheckRadius -- No --> StatusSecure[Estado: SECURE 100%]
    
    AlertMoving --> Maneuver[Evaluar Maniobra o Filado de Más Cadena]
    DragAlarm --> Maneuver
    StatusSecure --> SampleGPS
```

---

### 2.4 Proceso U-04: Protocolo de Emergencia SOS / MAYDAY

```mermaid
flowchart TD
    SOSBtn([Presionar Botón SOS Flotante por 3s]) --> OpenModal[Abrir Consola SOS de Emergencia]
    OpenModal --> SelectType{Seleccionar Tipo de Emergencia}
    
    SelectType -- Hombre al Agua MOB --> StepMOB[Acciones Inmediatas: Gritar, Aro Salvavidas, Apuntar, Pulsar Botón MOB]
    SelectType -- Vía de Agua --> StepLeak[Localizar Entrada, Arrancar Bombas de Achique, Espiche]
    SelectType -- Fuego / Incendio --> StepFire[Cortar Baterías/Gas, Extintor a la Base, Ponerse al Viento]
    SelectType -- Varada / Gobierno --> StepSteer[Verificar Vía de Agua, Sondeo de Fondo, Invertir Máquina]
    
    StepMOB --> DSCStep[Paso Obligatorio: Levantar Tapa Roja y Pulsar DISTRESS en VHF DSC]
    StepLeak --> DSCStep
    StepFire --> DSCStep
    StepSteer --> DSCStep
    
    DSCStep --> VoiceMayday[Guion Fonía VHF Canal 16: MAYDAY x3 con MMSI, Nombre y Coordenadas DMS]
    VoiceMayday --> SatCheck{¿Hardware Satelital Vinculado?}
    
    SatCheck -- No --> DisableSat[Botón Satelital DESHABILITADO: 'Alerta Satelital No Disponible']
    SatCheck -- Sí --> DispatchSBD[Transmisión SBD Corta vía Iridium/Garmin]
    
    DisableSat --> StandbyMayday([Mantener Escucha VHF 16 / Espera de Auxilio])
    DispatchSBD --> StandbyMayday
```

---

## 3. BPMN: Procesos de Gestión de Flota y Empresa (B2B)

### 3.1 Proceso G-01: Genesis Handover (Astillero / Dealer -> Propietario)

```mermaid
flowchart TD
    GStart([Inicio: Entrega de Barco Nuevo o Reventa]) --> FleetReg[Registro Técnico en Gestor de Flota: LOA, Motor, Horómetro]
    FleetReg --> GenQR[Generación de Nodos QR para Sistemas Críticos]
    GenQR --> LoadManuals[Carga de Manuales Técnicos PDF Yanmar / Beneteau]
    
    LoadManuals --> ClickGenesis[Pulsar: 'Transferir Propiedad / Genesis Transfer']
    ClickGenesis --> GenLink[Generación de Magic Link Criptográfico con Token Único]
    
    GenLink --> DeliverBuyer[Envío a Comprador Final vía Email / QR de Entrega]
    DeliverBuyer --> BuyerOpen[Comprador abre Magic Link en su Navegador/PWA]
    
    BuyerOpen --> ClaimVessel[Reclamar Propiedad del Gemelo Digital]
    ClaimVessel --> TransferDB[Transferencia de Tenancy en Supabase & Dexie Local]
    TransferDB --> GEnd([Fin: Comprador asume Control con Nodos QR y Garantías Activas])
```

---

### 3.2 Proceso G-02: Ciclo de Mantenimiento e Historial Inmutable

```mermaid
flowchart TD
    MStart([Monitoreo Continuo de Flota]) --> TrackHours[Lectura de Horómetro Motor]
    TrackHours --> EvalInterval{¿Horas >= Intervalo de Servicio?}
    
    EvalInterval -- No --> CheckCalendar{¿Fecha de Vencimiento de Seguridad < 90/30 días?}
    CheckCalendar -- Sí --> AlertSafety[Semáforo de Alerta: Balsa, EPIRB, Extintores]
    CheckCalendar -- No --> MStandby[Estado Óptimo: Operación Normal]
    
    EvalInterval -- Sí --> AlertService[Alerta: Mantenimiento Requerido en Yanmar]
    AlertService --> WorkOrder[Generar Orden de Trabajo y Retirar Repuestos de Inventario]
    
    WorkOrder --> ExecuteWork[Técnico Ejecuta Mantenimiento: Aceite, Filtros, Impulsor]
    ExecuteWork --> RecordVault[Registrar en VesselServiceBook: Tipo, Horas, Repuestos]
    
    RecordVault --> GenSign[Cálculo de Sello Criptográfico SHA-256 de la Intervención]
    GenSign --> WriteVault[Almacenar en vessel_service_history Append-Only]
    WriteVault --> MEnd([Fin: Historial Inmutable Actualizado para Auditoría])
```

---

### 3.3 Proceso G-03: Handover de Alquiler / Charter (Entrega y Recepción)

```mermaid
flowchart TD
    HStart([Inicio: Entrega de Barco a Cliente Charter]) --> Wizard[Iniciar HandoverWizard: 9 Puntos Críticos]
    Wizard --> CheckItems[Verificar: Combustible, Agua, Baterías, Balsa, EPIRB, Auxiliar, Velas, Cadena]
    
    CheckItems --> PhotoEvidence[Captura Obligatoria de Fotos con Cámara del Teléfono]
    PhotoEvidence --> PreventPlaceholders[Rechazar Placeholders: Solo Imágenes Reales]
    
    PreventPlaceholders --> DualSign[Firma Táctil Bipartita: Armador y Cliente]
    DualSign --> HashActa[Cálculo de Sello de Integridad SHA-256 del JSON Canónico]
    
    HashActa --> WriteLocal[Guardar en db.handover_inspections]
    WriteLocal --> SyncCloud[Sincronizar a Supabase tabla append-only sin UPDATE/DELETE]
    
    SyncCloud --> ViewVerify[Vista Pública: Verificación de Acta y Comparación de Hash]
    ViewVerify --> HEnd([Fin: Acta Cerrada e Inalterable ante Reclamos])
```

---

## 4. Matriz de Auditoría QA Experta (QA Gap Analysis)

| ID Requisito | Módulo | Estado Actual | Brecha Faltante (Gap) | Criterio de Aceptación QA (Gherkin / DoD) |
|---|---|---|---|---|
| **R-4.1.1** | Global | Implementado (`dataMode: 'SIMULADO' \| 'EN_VIVO'`) | Franja de advertencia activa. Requiere persistencia en sesión. | **GIVEN** dataMode === 'SIMULADO' **THEN** franja roja/ámbar visible en toda vista. |
| **R-4.1.3** | UI Copy | Limpio (0 instancias de "LIVE" sin respaldo) | Validar que no reaparezcan en actualizaciones futuras. | **GIVEN** inspección de código **THEN** grep de "LIVE" o "Verificado" retorna 0 resultados. |
| **R-4.2.2** | Fondeo | Implementado (`evaluateAnchorWatch`) | Requiere simulación de deriva sostenida en tests automáticos. | **GIVEN** SOG > 0.5 kn **THEN** estado nunca puede ser 'SECURE'. |
| **R-4.4.2** | Zarpe | Implementado (PDF Borrador Oficial) | Integración con portal SITPORT pendiente de API oficial DIRECTEMAR. | **GIVEN** generación de zarpe **THEN** documento indica claramente 'Borrador para Autoridad'. |
| **R-4.5.3** | SOS | Implementado (Guion MAYDAY con MMSI) | Dependencia de hardware VHF físico del usuario. | **GIVEN** modal SOS activa **THEN** guion incluye MMSI y posición en grados y minutos. |
| **R-4.5.5** | SOS | Implementado (Botón Satelital deshabilitado) | Falta conector WebUSB / Bluetooth para Garmin inReach. | **GIVEN** sin hardware satelital **THEN** botón disabled con aviso explícito. |
| **R-4.6.1** | Fondeo | Implementado (`calculateAnchorScope`) | Validado con campo `chain_length_meters`. | **GIVEN** cadena requerida > disponible **THEN** estado pasa a 'ATENCIÓN'. |
| **R-4.8.1** | Carta | Implementado (Disclaimer náutico SHOA) | Falta descarga de teselas offline en Service Worker para toda la X Región. | **GIVEN** visualización de carta **THEN** descargo de responsabilidad permanente. |
| **R-4.9.1** | Inventario| Implementado (Alertas 90/30 días) | Integración con catálogo de distribuidores locales (Puerto Montt). | **GIVEN** fecha de expiración < 30 días **THEN** semáforo en rojo. |
| **R-4.10.3**| Traspaso | Implementado (SHA-256 canónico) | Sincronización a Supabase requiere tabla PostGIS append-only. | **GIVEN** acta firmada **THEN** hash SHA-256 coincide exactamente al verificar. |
| **R-4.11.4**| Cuentas | Implementado (Datos demo ficticios) | Verificado: eliminados correos y RUTs personales reales. | **GIVEN** seeds y fallbacks **THEN** usan `demo@marinos.app` y `11.111.111-1`. |
| **R-4.13.2**| Copiloto | Implementado (Gemini Tool Calling + Fallback) | RAG de manuales completos en PDF requiere vector store en Supabase pgvector. | **GIVEN** sin API key configurada **THEN** opera en modo local rotulado como demo. |

---

## 5. Hoja de Ruta para Certificación Final (Checklist de Salida)

1. [x] **Fase 0: Honestidad y Seguridad:** Eliminación de afirmaciones legales falsas, rotulado de simulación, sanitización de datos de demo.
2. [x] **Fase 1: Coherencia de Datos:** Cálculo dinámico de ruteo, trigonometría de viento aparente, máquina de estados náuticos.
3. [x] **Fase 2: Arquitectura Bimodal:** Conmutador Tierra vs Alta Mar, Gimbal UI Horizon Lock, tipografía gigante de telemetría.
4. [x] **Fase 3: Flash-Checklist:** Deslizamiento de tarjetas Tinder-style para tripulación y motores.
5. [x] **Fase 4: Comunicación Táctica:** Push-to-Talk manos libres, Radio Comunidad con filtrado geográfico < 10 MN y expiración 24h.
6. [ ] **Fase 5 (Hardware Real - Próximo Hito):** Integración física con Actisense NGT-1 NMEA 2000 vía WebSerial o gateway WSS local a bordo.
7. [ ] **Fase 6 (Regulatorio):** Convenio de pruebas con DIRECTEMAR para transmisión digital cuando se publique la API gubernamental.
