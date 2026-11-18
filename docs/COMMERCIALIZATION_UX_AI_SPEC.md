# MarinOS v3.1 — Especificación Comercial, Historias de Usuario, Wireframes y Análisis UX + IA
> **Documento Estratégico de Producto, Diseño de Experiencia e Ingeniería de Monetización**  
> **Autor:** Lead Product Designer, Principal Staff Architect & Senior QA Lead  
> **Versión:** 3.1.0-COMMERCIAL  
> **Fecha:** 18 de Noviembre de 2026  
> **Estado:** Listo para Comercialización y Despliegue B2B/B2C

---

## 1. Resumen Ejecutivo y Matriz de Monetización

MarinOS monetiza a través de un modelo híbrido **B2B SaaS recurrente + B2B2C Transaccional (Genesis Handover) + B2C Freemium**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              MATRIZ DE PLANES Y MONETIZACIÓN                           │
├────────────────────┬────────────────────┬───────────────────────┬──────────────────────┤
│ PLAN               │ B2C MARINERO (FREE)│ B2C SKIPPER PRO       │ B2B FLEET & DEALER   │
├────────────────────┼────────────────────┼───────────────────────┼──────────────────────┤
│ **Precio**         │ $0 USD / Siempre   │ $19 USD/mes ($190/año)│ $79 USD/barco/mes    │
│ **Público Objetivo**│ Tripulantes charter│ Armadores privados    │ Empresas de Charter, │
│                    │ e invitados        │ y skippers frecuentes │ Astilleros y Dealers │
├────────────────────┼────────────────────┼───────────────────────┼──────────────────────┤
│ **Embarcaciones**  │ 1 barco local      │ Hasta 2 barcos        │ Barcos ilimitados    │
│ **Modo Alta Mar**  │ 15 min de prueba   │ Ilimitado             │ Ilimitado            │
│ **Gimbal UI**      │ Bloqueado          │ Incluido              │ Incluido             │
│ **VHF Social**     │ Solo recepción     │ Transmisión & Radar   │ Transmisión & Radar  │
│ **Push-to-Talk AI**│ 10 comandos/mes    │ Comandos ilimitados   │ Comandos ilimitados  │
│ **Handover Acta**  │ Solo lectura       │ Firma básica          │ Acta SHA-256 + Fotos │
│ **Genesis Transfer**│ No disponible     │ No disponible         │ $149 USD/traspaso    │
│ **Soporte & SLA**  │ Comunitario        │ Email 24h             │ Teléfono & Onboarding│
└────────────────────┴────────────────────┴───────────────────────┴──────────────────────┘
```

### 1.1 El Ciclo Virtuoso B2B2C ("Dealer to Owner")
1. **Astillero / Dealer:** Vende un barco nuevo (Beneteau, Jeanneau, Lagoon) o entrega mantenimiento mayor (Volvo, Yanmar). Utiliza MarinOS B2B para crear el Gemelo Digital, preconfigurar los Nodos QR en pañoles y cargar los manuales técnicos.
2. **Genesis Handover ($149 USD):** En el acto de entrega, el dealer genera un "Magic Link de Propiedad". Al escanearlo, el comprador final recibe el barco con todo su historial.
3. **Conversión Orgánica a Skipper Pro ($19 USD/mes):** El nuevo dueño queda incorporado a MarinOS con 6 meses de suscripción Pro incluida (costeada por el dealer como valor agregado de venta), activando el canal de retención de largo plazo.

---

## 2. Historias de Usuario (Agile User Stories & Criterios de Aceptación)

### US-01: Toggle Bimodal Táctico (Tierra vs. Alta Mar)
- **Como:** Capitán navegando en condiciones de marejada o viento fuerte en el Seno de Reloncaví.
- **Quiero:** Activar el "Modo Alta Mar" con un solo toque desde el Navbar para ocultar de inmediato las pantallas administrativas (finanzas, flota, configuración).
- **Para:** Eliminar distracciones y ver únicamente datos críticos de supervivencia y gobierno del barco.
- **Criterios de Aceptación (Gherkin):**
  - **Given** que el usuario está en el Puente o Barco con `isAtSeaMode === false`.
  - **When** pulsa el switch táctico "MODO TIERRA / MODO ALTA MAR".
  - **Then** el fondo cambia a oscuridad táctica (`#040B16`), la barra lateral se oculta o contrae a 2 accesos tácticos (Puente y Averías), y se activa por defecto la vista Gimbal UI o Carta con telemetría en tamaño `text-7xl`.

### US-02: Gimbal UI con Bloqueo de Horizonte (Anti-Mareo)
- **Como:** Skipper o timonel en la rueda de gobierno con escora pronunciada.
- **Quiero:** Que la pantalla contrarreste la inclinación del barco usando el giroscopio del móvil (`deviceorientation`).
- **Para:** Leer la velocidad (SOG), viento (TWS) y sonda de profundidad siempre paralelos al horizonte de la tierra, previniendo el mareo por discordancia visual-vestibular.
- **Criterios de Aceptación:**
  - **Given** que el dispositivo móvil o tablet tiene sensor giroscópico habilitado.
  - **When** el barco escora hacia estribor o babor en un ángulo $\theta$ entre $-45^\circ$ y $+45^\circ$.
  - **Then** el canvas interno de telemetría rota en sentido contrario ($-\theta$) mediante `framer-motion` a 60 FPS, manteniendo las cifras numéricas perfectamente horizontales.

### US-03: Flash-Checklist Swipeable para Briefing y Motores
- **Como:** Patrón de yate preparando la salida de marina con dedos mojados o guantes náuticos.
- **Quiero:** Realizar el checklist ítem por ítem mediante gestos de deslizamiento (swipes) con dos botones de contacto masivo ($\ge 56\text{ px}$).
- **Para:** Verificar los sistemas de emergencia y la sala de máquinas en menos de 90 segundos sin interactuar con casillas diminutas.
- **Criterios de Aceptación:**
  - **Given** que se abre el modal de Flash-Checklist en categoría "Briefing de Invitados" o "Inspección de Máquinas".
  - **When** el usuario pulsa "VERIFICADO" o desliza la tarjeta a la derecha.
  - **Then** la tarjeta avanza con animación spring, el contador de progreso se actualiza y al llegar a la última tarjeta se registra automáticamente la entrada en la bitácora (`db.logbook_entries`).

### US-04: Bitácora por Voz Manos Libres (Push-to-Talk AI)
- **Como:** Capitán llevando el timón en navegación nocturna o con maniobra en proa.
- **Quiero:** Mantener pulsado el botón flotante PTT (Walkie-Talkie) y decir una nota en lenguaje natural (ej. *"Anotar en bitácora motor a 2200 RPM pasando Faro Tenglo"*).
- **Para:** Registrar la posición, hora y telemetría sin soltar la caña ni escribir en el teclado.
- **Criterios de Aceptación:**
  - **Given** que el navegador soporta Web Speech API o grabación de audio.
  - **When** el usuario mantiene presionado el botón PTT táctico.
  - **Then** el sistema emite feedback háptico (vibración de 50ms), transcribe en español de Chile, extrae la intención y solicita confirmación táctil antes de insertar la fila en `logbook_entries`.

### US-05: Radar Social y Radio Digital VHF Comunitaria
- **Como:** Navegante aproximándose a un fondeadero en las Islas Chauques.
- **Quiero:** Ver en una gaveta lateral las alertas de seguridad y condiciones de tenedero emitidas por otros barcos a menos de 10 millas náuticas en las últimas 24 horas.
- **Para:** Conocer si el fondeadero está expuesto a rachas de viento catabático o si hay bancos de arena no cartografiados.
- **Criterios de Aceptación:**
  - **Given** que existen reportes comunitarios en el sistema.
  - **When** se evalúa la lista de reportes respecto a la coordenada actual del barco.
  - **Then** solo se renderizan aquellos a distancia $\le 10\text{ MN}$ y con timestamp menor a 24 horas; los reportes antiguos caducan automáticamente.

### US-06: Genesis Handover (Traspaso Dealer -> Propietario)
- **Como:** Gerente de Operaciones de un Astillero o Concesionario náutico.
- **Quiero:** Transferir el gemelo digital completo del barco (con sus Nodos QR, manuales de servicio y garantías de fábrica) mediante un Magic Link seguro al comprador final.
- **Para:** Entregar un servicio postventa de nivel aeroespacial y certificar la entrega técnica.
- **Criterios de Aceptación:**
  - **Given** que el barco está registrado en la organización B2B del Dealer.
  - **When** el Dealer pulsa "Genesis Transfer" y confirma la operación.
  - **Then** se genera una URL con token criptográfico único que, al ser abierta por el nuevo dueño, reasigna la titularidad del barco en la base de datos sin perder las horas del motor ni el historial de garantías.

### US-07: Paywall de Suscripción y Activación Comercial
- **Como:** Armador navegando con la versión gratuita que intenta añadir un segundo barco o acceder al Gimbal UI permanente.
- **Quiero:** Visualizar una modal de suscripción elegante (Matte Tactical) con selector de planes (Skipper Pro y B2B Fleet), opciones de facturación mensual/anual y beneficios detallados.
- **Para:** Actualizar mi cuenta inmediatamente y desbloquear la capacidad completa de navegación.
- **Criterios de Aceptación:**
  - **Given** un usuario con plan `b2c_free`.
  - **When** intenta acceder a una función reservada para `b2c_pro` o `b2b_fleet`.
  - **Then** se abre la modal de comercialización mostrando los planes, el ahorro del 20% anual y el botón de acción para confirmar la actualización.

---

## 3. Wireframes Arquitectónicos (Layouts Mobile y Desktop)

### 3.1 Wireframe Mobile (390px — iPhone / Android en Cubierta)

```
┌─────────────────────────────────────────────────────────┐ [390px]
│ [SV ALBATROS] 41.1ft  ● LIVE SENSOR  | 41°28.3'S 72°56.1'W│ <- Header Fijo
├─────────────────────────────────────────────────────────┤
│ [ MODO TIERRA ] ────●──── [ MODO ALTA MAR (ACTIVO) ]    │ <- Bimodal Switch
├─────────────────────────────────────────────────────────┤
│                                                         │
│               GIMBAL UI: HORIZON LOCK                   │
│                                                         │
│       ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─       │ <- Línea Horizonte
│                                                         │
│                  SOG: VELOCIDAD FONDO                   │
│                                                         │
│                     7 . 4   kn                          │ <- JetBrains Mono
│                                                         │    text-7xl
│       ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─       │
│                                                         │
│       VIENTO REAL (TWS)         SONDA / PROFUNDIDAD     │
│           16.2 kn                     12.8 m            │ <- text-3xl
│          Aleta 135°               Bajo Quilla 11.2m     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [ FLASH-CHECKLIST ]       [ RADIO VHF: CH 16 / 72 ]     │ <- Acciones Rápidas
├─────────────────────────────────────────────────────────┤
│                  ( ( ( PTT VOICE ) ) )                  │ <- Walkie-Talkie
│              [ Mantener para hablar con IA ]             │    Botón Flotante
├─────────────────────────────────────────────────────────┤
│ [PUENTE]    [AVERÍAS]    [SOS MODO MAR]    [MÁS MÓDULOS]│ <- Barra 48px
└─────────────────────────────────────────────────────────┘
```

### 3.2 Wireframe Desktop (1440px — Dashboard B2B Flota & Centro de Operaciones)

```
┌──────┬──────────────────────────────────────────────────────────────────────────┐ [1440px]
│ LOGO │ SV Albatros (En Fondeo) | Yanmar 4JH57 81.5°C | Plan: B2B FLEET MANAGER  │
├──────┼──────────────────────────────┬───────────────────────────────────────────┤
│      │ GESTIÓN DE FLOTA (4 BARCOS)  │ GEMELO DIGITAL & LIBRO INMUTABLE          │
│ PUEN-│ ┌──────────────────────────┐ │ ┌───────────────────────────────────────┐ │
│  TE  │ │ SV Albatros (Oceanis 41) │ │ │ Motor Principal: Yanmar 4JH57         │ │
│      │ │ Horómetro: 1,420.5 hrs   │ │ │ Estado: Óptimo • Próx. Serv: en 79.5h │ │
│ BAR- │ │ Fondeado: Caleta Mechuque│ │ │ Garantía: Vigente hasta Oct 2028      │ │
│  CO  │ ├──────────────────────────┤ │ ├───────────────────────────────────────┤ │
│      │ │ SV Austral (Sun Odyssey) │ │ │ HISTORIAL DE SERVICIO (SHA-256 VAULT) │ │
│ VIA- │ │ Horómetro: 890.2 hrs     │ │ │ • 1400h: Cambio de Aceite y Filtros   │ │
│  JES │ │ En Marina Puerto Montt   │ │ │   Hash: a8f9...31c2 [Verificado]      │ │
│      │ └──────────────────────────┘ │ │ • 1200h: Reemplazo Impulsor Bomba Agua│ │
│ FLO- │ ┌──────────────────────────┐ │ └───────────────────────────────────────┘ │
│  TA  │ │ + AGREGAR EMBARCACIÓN    │ │ INSPECCIÓN DE ENTREGA (HANDOVER)        │
│      │ │ [GENESIS TRANSFER LINK]  │ │ • Acta de Salida: Sello SHA-256 Activo  │
│ CREW │ └──────────────────────────┘ │ • Fotos de Daños: 6 evidencias cargadas │
│      ├──────────────────────────────┴───────────────────────────────────────────┤
│ SOS  │ RADAR DE FLOTA & TRÁFICO LOCAL CHILOÉ (MapLibre GL con Canales Limpios)  │
│      │ [Puerto Montt] ──────── [Canal Tenglo] ──────── [Golfo de Ancud]         │
└──────┴──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Análisis UX + IA (Ergonomía, Voz y Copiloto con Herramientas)

### 4.1 Principios de Diseño Ergonómico en Alta Mar
1. **Zero Text Input en Navegación:** El teclado en pantalla queda bloqueado en Modo Alta Mar. Todas las entradas se realizan mediante voz (PTT) o toques con confirmación de gran tamaño.
2. **Horizon Lock Fisiológico:** La pantalla estabilizada artificialmente reduce el conflicto sensorial entre el sistema vestibular del oído interno y la retina, permitiendo a skippers propensos al mareo continuar operando el sistema.
3. **Contraste Extremo Anti-Sol:** En tema Solar, el fondo es `#FFFFFF` con texto negro puro (`#000000`) y fuentes en peso $\ge 700$. En tema Nocturno, se desactivan los canales verde y azul, renderizando exclusivamente en rojo profundo (`#FF2D55` sobre fondo negro `#000000`) para no degradar la rodopsina visual de la tripulación de guardia.

### 4.2 Arquitectura del Copiloto de Voz y Tool Calling
El botón flotante PTT se conecta al endpoint Next.js `/api/chat/route.ts` que integra Gemini y orquesta herramientas con fallback determinista:

```
[Usuario Presiona PTT] ──> [Web Speech API es-CL] ──> [Texto Reconocido]
                                                              │
                                                              ▼
                                                   [Next.js API /api/chat]
                                                              │
                    ┌─────────────────────────────────────────┴─────────────────────────────────────────┐
                    ▼                                                                                   ▼
       [Gemini 1.5 Flash Online]                                                           [Fallback Offline Local]
                    │                                                                                   │
     ┌──────────────┴──────────────┐                                                                    │
     ▼                             ▼                                                                    │
[tool: log_to_logbook]   [tool: search_inventory]                                                       ▼
     │                             │                                                           [Reglas Deterministas]
     └──────────────┬──────────────┘                                                                    │
                    ▼                                                                                   │
         [Confirmación Humana] <────────────────────────────────────────────────────────────────────────┘
          ¿Desea registrar en
           bitácora: '...'?
                    │
           [Sí, Confirmar]
                    │
                    ▼
       [Dexie DB db.logbook_entries]
```

---

## 5. Arquitectura de Comercialización y Flujo de Cobro

### 5.1 Funnel de Conversión y Activación
1. **Trigger de Paywall Orgánico:**
   - Intentar registrar un 2° barco en el Gestor de Flota.
   - Activar el Modo Alta Mar Táctico tras expirar el periodo de prueba de 15 días.
   - Solicitar la generación de un Magic Link Genesis Handover para astilleros.
2. **Integración con Stripe / Pasarela Local (Webpay / Stripe Checkout):**
   - El frontend genera un `session_id` llamando al backend con el `plan_tier` seleccionado (`b2c_pro` o `b2b_fleet`).
   - El webhook de confirmación actualiza `db.organizations.plan_tier` y almacena el `stripe_customer_id` en IndexedDB y Supabase.
   - Si no hay conexión a internet durante la navegación, el sistema opera con un **Grace Period Offline de 14 días**, impidiendo que un capitán quede bloqueado en alta mar por falta de señal para validar su suscripción.
