<USER_REQUEST>
# PRD + Prompt Maestro — MarinOS v3.1 "Honesto, legible, por voz y seguro a bordo"

> **Cómo usar este documento:** pégalo completo en Antigravity (o guárdalo en la raíz del repo como `PRD.md` y pídele al agente que lo ejecute). La sección 0 es el prompt maestro y la 0.1 el objetivo del sprint (`/goal`); el resto es la especificación que el agente debe cumplir.
>
> **v3.1** integra el "MarinOS Ultimate Sprint" (UI anti-mareo, Flash-Checklist, Push-to-Talk, agente Gemini con herramientas y Radio Comunidad), corregido para que sea real, conectado y coherente con las reglas de honestidad y seguridad de la v3.

---

## 0. PROMPT MAESTRO (para el agente)

Eres un equipo senior formado por: ingeniero full-stack (Next.js + FastAPI + Supabase), diseñador de producto especializado en interfaces marinas, y capitán de yate con experiencia en Chiloé. Vas a modificar la aplicación **MarinOS** según este PRD.

**Reglas de trabajo (obligatorias):**

1. **Primero explora, luego cambia.** Antes de tocar código, recorre el repositorio y genera `docs/AUDIT_MAP.md` con: estructura de carpetas, dónde vive cada módulo (Bridge, Vessel, Voyages, Fleet, Crew, Passport, Integraciones, Handover, Academy, SOS, Copiloto, Command Center), endpoints `/api/v1/*`, esquema de Supabase, stores de IndexedDB y service worker. Si algo de este PRD no coincide con lo que encuentras, anótalo ahí y adapta el plan; no inventes archivos que no existen.
2. **Trabaja por fases** (sección 6), en una rama por fase (`fase-0-honestidad`, `fase-1-datos`, etc.), con commits pequeños y mensajes descriptivos. Al cerrar cada fase entrega un resumen: qué cambió, qué quedó pendiente, cómo probarlo.
3. **Nunca simules una integración como si fuera real.** Si una integración no existe o no está configurada, la UI debe decirlo explícitamente. Prohibido escribir "LIVE", "Verificado", "Legalmente vinculante", "Oficial" o equivalentes sin respaldo técnico real.
4. **No inventes datos técnicos, normativos ni de fabricantes.** Donde este PRD dice `[VERIFICAR]`, deja el valor configurable y marca un `TODO(verificar-fuente)` en código; no lo "rellenes" con lo que creas correcto.
5. **No borres funcionalidades** sin dejarlas detrás de un feature flag documentado. Pregunta antes de migraciones destructivas de base de datos.
6. **Cada requisito tiene criterios de aceptación.** Un requisito no está terminado hasta que sus criterios pasan y hay al menos un test (unitario o E2E con Playwright) que lo cubra cuando sea automatizable.
7. **Idioma de la UI:** español de Chile, con terminología náutica local (ver glosario, sección 5.6). Código y comentarios pueden quedar en inglés.
8. **Nada de "simular" ni "mockear estructuralmente".** Cada función nueva (voz, agente, comunidad) se implementa de verdad. Si falta una credencial o un servicio, la función queda en **modo demo rotulado** (R-4.1.2, R-4.13.2), nunca como una imitación que parezca real.
9. **Humano en el circuito.** Ninguna acción que salga del dispositivo (enviar un correo, publicar un reporte, compartir posición) se ejecuta sin una confirmación explícita del usuario en pantalla. El modelo de IA nunca puede saltarse esa confirmación.
10. **Verifica las APIs de las librerías instaladas.** El Vercel AI SDK, `@ai-sdk/google` y los nombres de modelos de Gemini cambian entre versiones: lee la documentación de la versión que quede en `package.json` antes de escribir código, y deja el nombre del modelo en una variable de entorno.

---

## 0.1 OBJETIVO DEL SPRINT (`/goal`)

```
/goal Actúa como Principal Staff Architect y Lead AI Engineer de MarinOS.
Ejecuta el PRD v3.1 completo (este documento), en el orden de fases de la sección 6.

Contexto: una auditoría náutica, de producto y de diseño detectó datos simulados
presentados como reales, afirmaciones legales falsas, inconsistencias entre módulos
y mala legibilidad en cubierta. Este sprint corrige eso y agrega cuatro capacidades:
  1. UI anti-mareo + Flash-Checklist (ergonomía extrema en cabina).
  2. Push-to-Talk global: la voz es el input principal (bitácora, comandos, Copiloto).
  3. Agente Gemini con herramientas (Vercel AI SDK + @ai-sdk/google), con
     confirmación humana para toda acción que salga del dispositivo.
  4. Radio Comunidad: reportes geolocalizados que expiran en 24 h y barcos
     cercanos (≤ 10 MN) con PostGIS real en Supabase y privacidad opt-in.

Reglas: sección 0 (reglas 1–10). Prioridad absoluta: Fase 0 (honestidad y seguridad)
antes que cualquier función nueva. Todo lo nuevo debe funcionar de verdad o quedar
rotulado como DEMO; nada simulado que parezca real.

Antes de empezar: confirma la ruta real de la app (¿monorepo con /apps/web o raíz?),
los scripts disponibles en package.json y la versión de Next.js / AI SDK. Si falta
el script "typecheck", créalo como "tsc --noEmit".

Al cerrar cada fase: npm run typecheck && npm run lint && npm run build && tests.
Commit por fase con Conventional Commits. Merge final con:
"feat: honest data, anti-seasickness UI, push-to-talk, Gemini agent and community radio".
```

---

## 1. Contexto

MarinOS es una PWA (Next.js + MapLibre, backend FastAPI bajo `/api/v1`, Supabase, IndexedDB + service worker) para veleros, catamaranes y flotas de charter, con foco en el Seno de Reloncaví y Chiloé.

Una auditoría (navegación, inversión y diseño) concluyó:

- **Fortalezas:** buen conocimiento local (fondeaderos, mareas de 6 m), flujo de zarpe en 4 pasos, cálculo de fondeo con marea, guion MAYDAY con posición grande, traspaso (handover) con evidencia, idea de relacionar diagnóstico con repuestos a bordo.
- **Problemas graves:** datos simulados presentados como reales, afirmaciones legales falsas, SOS satelital que no envía nada, inconsistencias físicas entre módulos, mapa base de calles (no carta náutica), legibilidad deficiente para uso en cubierta, IA de respuestas fijas presentada como IA real.

**Objetivo v3:** que todo lo que la app muestre sea **verdadero, coherente entre módulos y legible en cubierta**, y reenfocar el producto en el usuario que paga: **operadores de flotas de charter** (gestión, zarpe, traspaso, mantenimiento), con la navegación como complemento y nunca como sustituto del plotter certificado.

---

## 2. Usuarios y trabajos a resolver

| Usuario | Trabajo principal | Contexto de uso |
|---|---|---|
| Operador de flota de charter (pagador) | Saber el estado de cada barco, entregar/recibir sin disputas, cumplir trámites | Oficina / marina, escritorio y celular |
| Capitán / skipper | Zarpar con todo en regla, fondear seguro, resolver averías | Cabina: sol, noche, guantes, movimiento, sin señal |
| Tripulante / cliente de charter | Ver rol, checklist, recibir el barco | Celular |

**Principio rector:** la app responde tres preguntas, cada una en una pantalla clara: *¿Está bien el barco? ¿Puedo zarpar? ¿Estoy seguro fondeado?*

---

## 3. Fuera de alcance (v3)

- Reemplazar al plotter, al AIS o a la radio VHF/DSC.
- Integración real con DIRECTEMAR/SITPORT (solo si existe una API oficial accesible; ver 4.4).
- Integración real con Iridium/Garmin (queda como "no disponible" hasta tener hardware y contrato).
- Cartografía oficial SHOA (licenciada); en v3 se agrega advertencia y validación costa/agua.

---

## 4. Requisitos funcionales

Prioridad: **P0** = bloqueante (seguridad/legal), **P1** = coherencia de datos, **P2** = diseño/UX, **P3** = mejoras.

### 4.1 Honestidad de datos y modo simulación — P0

**Problema:** `/api/v1/signalk/telemetry` responde desde Vercel declarando `"source":"Signal K NMEA2000 Bus (can0 / Actisense NGT-1)"`, mientras Integraciones muestra Signal K **DESCONECTADO**. El Gemelo Digital dice "SIGNAL K NMEA 2000 LIVE".

**Requisitos:**
- R-4.1.1 Crear un estado global `dataMode: 'SIMULADO' | 'EN_VIVO'` y un campo `source` + `timestamp` + `ageSeconds` por cada dato mostrado (posición, viento, sonda, motor, batería, olas).
- R-4.1.2 En modo SIMULADO: franja persistente visible en todas las pantallas ("MODO SIMULACIÓN — datos ficticios, no usar para navegar"), y el endpoint de telemetría debe devolver `"source":"simulator"`.
- R-4.1.3 Eliminar de toda la UI los textos "LIVE", "EN VIVO", "Verificado", "Oficial" cuando la fuente no sea real. Búscalos con grep y lista cada reemplazo en el changelog.
- R-4.1.4 Indicador de antigüedad: si un dato tiene más de 10 s (sensores) o más de 6 h (pronóstico), se muestra atenuado con la edad ("hace 3 min").
- R-4.1.5 La simulación debe ser físicamente coherente: si SOG > 0,5 kn, la posición avanza según SOG y COG (no queda fija ±ruido).

**Aceptación:** con Signal K desconectado no aparece ningún "LIVE"; la franja SIMULACIÓN es visible en Bridge, Vessel, SOS y Copiloto; un test verifica que tras 10 s a 7 kn la posición avanzó ~36 m (±20 %).

### 4.2 Máquina de estados del barco — P0/P1

**Problema:** Anchor Watch dice "SECURE" con el barco a 6,8 kn; "Viaje activo" antes de la fecha de zarpe.

- R-4.2.1 Estado único `vesselState: 'AMARRADO' | 'FONDEADO' | 'NAVEGANDO_MOTOR' | 'NAVEGANDO_VELA'`, en un store compartido.
- R-4.2.2 Anchor Watch solo se activa en `FONDEADO`. Si en FONDEADO la SOG supera 0,5 kn sostenida o la distancia al ancla supera el radio de borneo → alarma de garreo.
- R-4.2.3 Un viaje solo es "activo" entre zarpe real y arribo.

**Aceptación:** imposible ver "SECURE" con SOG > 0,5 kn; test de transición de estados.

### 4.3 Fuente única de verdad ambiental — P1

**Problema:** el HUD muestra 6 kn de viento, la telemetría 15 kn aparentes a 47°, el contexto del Copiloto 14,2 kn del 315°, el panel de clima 6 kn del 19°.

- R-4.3.1 Un store `environment` con campos separados y etiquetados: `trueWind` (velocidad, dirección, fuente), `apparentWind` (sensor), `forecastWind` (Open-Meteo, hora del modelo), `waves`, `tide`.
- R-4.3.2 El HUD dice explícitamente qué muestra: "Viento real (pronóstico)" o "Viento aparente (sensor)".
- R-4.3.3 Si hay viento aparente + SOG + COG, calcular el viento real con el triángulo de velocidades; si hay viento real, derivar el aparente. Validar coherencia en simulación.
- R-4.3.4 El Copiloto, el Ruteo y el Fondeo leen del mismo store; prohibido que un endpoint tenga valores propios hardcodeados.

**Aceptación:** los cuatro lugares muestran valores idénticos para la misma variable; test de cálculo del viento real/aparente con casos conocidos.

### 4.4 Zarpe electrónico (Voyages) — P0

**Problemas:** "firma criptográfica SHA-256 legalmente vinculante ante la Armada de Chile"; integración DIRECTEMAR en sandbox; checklist 6/6 marcado por defecto; salida = ahora + 24 h al segundo; arribo 3 días después de un cruce de 7,4 h.

- R-4.4.1 Eliminar toda afirmación de validez legal. Un hash no es firma ni tiene efecto legal.
- R-4.4.2 Mientras no exista integración oficial verificada, el botón "Transmitir E-Zarpe a DIRECTEMAR" se reemplaza por **"Generar documento de zarpe (PDF) para presentar ante la Autoridad Marítima"**, con texto que aclare que el trámite oficial se hace por los canales de la Autoridad Marítima. `[VERIFICAR]` si DIRECTEMAR ofrece una API para terceros; documentarlo en `docs/INTEGRACIONES.md`, sin implementar llamadas ficticias.
- R-4.4.3 El checklist pre-zarpe parte **vacío** en cada viaje nuevo y exige marcar cada ítem manualmente, con hora y quién lo marcó.
- R-4.4.4 Fecha/hora de zarpe elegida por el usuario. ETA = distancia / velocidad estimada, con ambos valores visibles.
- R-4.4.5 Distancia de ruta con una única fuente (hoy aparece 52,4 MN y 55 MN).

**Aceptación:** grep de "legalmente vinculante" = 0 resultados; un viaje nuevo muestra 0/6; ETA coherente con distancia/velocidad.

### 4.5 SOS — P0

**Hoy:** guion MAYDAY útil con posición grande (mantener). Problemas: emergencia preseleccionada ("Vía de agua"), falta el paso DSC, MOB sin acciones inmediatas, "Emitir alerta satelital" apunta a un *Iridium GO! Emulador* y solo encola en IndexedDB prometiendo llegar al MRCC Chile, y el cierre de la pantalla no respondió a un clic normal (reproducir en dispositivo real).

- R-4.5.1 Sin emergencia preseleccionada: la primera pantalla pide elegir (Vía de agua / Fuego / Hombre al agua / Pérdida de gobierno o varada / Otra).
- R-4.5.2 Paso 1 siempre visible: **"Si tu VHF tiene DSC, levanta la tapa roja y mantén apretado el botón DISTRESS"** (el tiempo exacto depende del equipo `[VERIFICAR]`; redactar "varios segundos, según tu radio").
- R-4.5.3 Guion de voz con la estructura estándar de socorro:
  ```
  MAYDAY, MAYDAY, MAYDAY
  AQUÍ [NOMBRE] ×3, [DISTINTIVO DE LLAMADA / MMSI]
  MAYDAY [NOMBRE] [DISTINTIVO / MMSI]
  POSICIÓN [lat/lon en grados y minutos]
  [NATURALEZA DE LA EMERGENCIA]
  [ASISTENCIA REQUERIDA]
  [PERSONAS A BORDO]
  [OTRA INFORMACIÓN ÚTIL]
  CAMBIO
  ```
  Agregar campos **MMSI** y **distintivo de llamada** al perfil del barco (hoy solo existe la matrícula). `[VERIFICAR]` la fraseología contra el material oficial de radiotelefonía de la Autoridad Marítima de Chile.
- R-4.5.4 Para **Hombre al agua**, mostrar antes del guion las acciones inmediatas: gritar "¡Hombre al agua!", lanzar el aro o la boya, designar a alguien que no le quite la vista y lo apunte con el brazo, marcar el punto (botón MOB del plotter o de la app), iniciar la maniobra de recuperación.
- R-4.5.5 Botón satelital: si no hay dispositivo real vinculado, se muestra **deshabilitado** con el texto "Alerta satelital no disponible — no hay dispositivo vinculado". Prohibido decir que se enviará al MRCC si no es verdad.
- R-4.5.6 El mensaje SBD no puede truncar palabras ("EN SAL"); usar códigos cortos de emergencia.
- R-4.5.7 Botón "Cerrar" con área táctil ≥ 48 px que funcione con un toque en iOS y Android.
- R-4.5.8 La pantalla SOS funciona 100 % sin conexión (posición del GPS del dispositivo, no del servidor).

**Aceptación:** test E2E: SOS → elegir MOB → ver acciones → guion con MMSI → cerrar con un toque; con red cortada, la posición se sigue mostrando.

### 4.6 Fondeo & Clima — P1

**Hoy:** el clima viene en vivo de Open-Meteo (mantener). Problemas: recomienda 70 m de cadena con 60 m a bordo y marca "SAFE 100/100"; el fondeadero "Canal Tenglo" (-41.4717, -72.9369) cae visualmente sobre tierra.

- R-4.6.1 La cadena disponible es un dato del barco (Fleet). Si cadena recomendada > cadena disponible → estado **ATENCIÓN** con el texto "Necesitas X m; tienes Y m. Considera fondear en menos profundidad o complementar con cabo".
- R-4.6.2 El puntaje de seguridad penaliza: cadena insuficiente, ráfagas > 1,5 × viento medio, exposición del fondeadero a la dirección del viento, poco margen bajo la quilla en bajamar.
- R-4.6.3 Validación costa/agua: todo fondeadero y waypoint se valida contra un polígono de tierra (por ejemplo, los land polygons de OpenStreetMap). Si cae en tierra, error en la carga de datos. Las coordenadas de los fondeaderos existentes deben revisarse manualmente contra una carta oficial `[VERIFICAR]`; no las corrijas "a ojo".
- R-4.6.4 Mostrar la fuente y la hora del pronóstico, con una nota sobre la limitada precisión de los modelos de oleaje en aguas interiores.

**Aceptación:** con la cadena del barco en 60 m y recomendada 70 m, el estado nunca es SAFE; test de validación costa/agua.

### 4.7 Ruteo 48 h — P1

**Problemas:** etiqueta "PredictWind Engine" sin integración; texto "popa redonda" junto a "Aleta / Largo 135° TWA"; ventana fija.

- R-4.7.1 Quitar "PredictWind" salvo integración real. Etiqueta: "Estimación propia con pronóstico Open-Meteo".
- R-4.7.2 Calcular el TWA a partir del rumbo de la ruta y la dirección del viento pronosticado; generar el texto del rumbo de navegación (ceñida / través / descuartelar / largo / popa) desde ese cálculo, nunca hardcodeado.
- R-4.7.3 Las ventanas (ahora, +2 h, +6 h, mañana) se calculan con el pronóstico real por hora.

**Aceptación:** test: rumbo 193°, viento del 315° → TWA ≈ 122° → "descuartelar/largo", nunca "popa redonda".

### 4.8 Mapa (Bridge) — P0/P2

**Problemas:** mapa base de calles (CARTO) + marcas OpenSeaMap; sin sondas; ruta verde que cruza tierra; la app dice "cero cruce por tierra".

- R-4.8.1 Advertencia fija y discreta en el mapa: "Carta referencial — no apta para navegación. Usa cartas oficiales SHOA y tu plotter."
- R-4.8.2 Evaluar mapas base más náuticos (por ejemplo, un estilo con agua y costa resaltadas, menos calles) y mantener la capa de OpenSeaMap. Documentar opciones y licencias en `docs/CARTOGRAFIA.md`.
- R-4.8.3 Validar rutas contra tierra (R-4.6.3); eliminar el texto "cero cruce por tierra" salvo que la validación pase.
- R-4.8.4 Agregar al HUD: batería de servicio (%), con la fuente y la edad del dato.
- R-4.8.5 Rendimiento: el canvas del mapa hoy bloquea la UI ~1,5 s (INP). Objetivo INP < 200 ms.

### 4.9 Vessel: Gemelo, Inventario, Mantenimiento — P1

- R-4.9.1 Separar inventario en **Equipos** (motor, generador, molinete), **Repuestos** (con stock mínimo) y **Seguridad con vencimiento** (balsa salvavidas, EPIRB, extintores, bengalas, chalecos), con alertas a 90/30 días.
- R-4.9.2 Etiqueta correcta: "Batería de servicio (SOC)" separada de "Alternador (V)".
- R-4.9.3 Horómetro: desde el sensor si existe; si es manual, que se registre la fecha y quién lo ingresó (quitar los botones "+0,5 h" de demo o dejarlos solo en modo SIMULACIÓN).
- R-4.9.4 Intervalos de mantenimiento configurables por equipo (horas y/o meses) que ingresa el usuario desde el manual. Alerta de **servicio vencido** si las horas desde el último servicio superan el intervalo. No hardcodear intervalos ni condiciones de garantía de Yanmar u otros fabricantes `[VERIFICAR]`.
- R-4.9.5 Datos de repuestos: no afirmar especificaciones (por ejemplo, micras de un filtro Racor) sin fuente; campo "especificación" editable con fuente. `[VERIFICAR]`: la auditoría sospecha que el sufijo "P" de Racor corresponde a 30 micras y no 10, y que el 4JH57 no es "Common Rail".
- R-4.9.6 Eliminar "+18 % plusvalía reventa certificada" (afirmación sin respaldo).

### 4.10 Handover (traspaso) — P1

**Hoy:** se puede sellar un acta con una foto generada sin cámara real; firma una sola parte; el hash vive solo en IndexedDB.

- R-4.10.1 Las fotos de evidencia solo se aceptan desde la cámara o la galería del dispositivo (`<input type="file" accept="image/*" capture="environment">`); prohibido insertar placeholders.
- R-4.10.2 Firma táctil de **ambas partes** (quien entrega y quien recibe), con nombre y RUT.
- R-4.10.3 El "sello" es un hash SHA-256 del JSON canónico del acta, que incluye los hashes de cada foto. Al sincronizar, se guarda en Supabase en una tabla **append-only** (sin UPDATE/DELETE vía RLS) con timestamp del servidor.
- R-4.10.4 Vista "Verificar acta": recalcula el hash y lo compara con el registrado en el servidor.
- R-4.10.5 Texto: "Sello de integridad" (no "legal", no "certificado").
- R-4.10.6 Ampliar el checklist: combustible y agua (%), baterías, balsa, EPIRB, auxiliar y fuera de borda, gas, velas (estado), electrónica, cadena (metros).

### 4.11 Crew y Passport — P0

- R-4.11.1 Validación: exactamente un **Capitán** por viaje; el resto, tripulantes o pasajeros.
- R-4.11.2 Alertas de vencimiento de licencias a 90/30 días (ya existe; mantener).
- R-4.11.3 **Passport:** eliminar el encabezado "REPÚBLICA DE CHILE • DIRECTEMAR", el "QR VERIFICACIÓN ARMADA" y la insignia "DIRECTEMAR Verificado". Rediseñar como "Perfil náutico" sin apariencia de documento oficial.
- R-4.11.4 Datos de demo: reemplazar RUT, nombres y correo por datos claramente ficticios (por ejemplo, RUT 11.111.111-1, "Capitán Demo", `demo@marinos.app`). Quitar cualquier correo personal real del seed.
- R-4.11.5 Las insignias de gamificación quedan detrás de un flag (activadas para usuarios recreativos, desactivadas para cuentas de flota).

### 4.12 Integraciones — P1

- R-4.12.1 Cada integración muestra estado real: CONECTADO / DESCONECTADO / NO DISPONIBLE / SIMULADO.
- R-4.12.2 **Signal K:** una página HTTPS no puede consumir `http://192.168.x.x` (contenido mixto y restricciones de acceso a red privada del navegador). Documentar en `docs/ARQUITECTURA_A_BORDO.md` las opciones viables: (a) gateway a bordo con HTTPS/WSS y certificado; (b) app compañera local; (c) relay en la nube desde el gateway. No implementar conexiones ficticias.
- R-4.12.3 Satelital: "NO DISPONIBLE" mientras sea emulador.

### 4.13 Copiloto IA — P2

**Hoy:** no hay campo de texto libre; respuestas fijas por palabra clave (ante una pregunta de pronóstico respondió sobre la temperatura del motor); cita "Sección 3.5, pág. 33" sin poder verificarse; se presenta como "Multimodal RAG" e "IA Vision".

- R-4.13.1 Campo de texto libre + chips de sugerencias.
- R-4.13.2 Si no hay un LLM configurado (variable de entorno), el Copiloto muestra "Modo demo — respuestas de ejemplo" en todas sus respuestas.
- R-4.13.3 Con LLM: RAG real sobre los documentos que el usuario sube (manuales en PDF). **Solo se citan fuentes efectivamente recuperadas**, con nombre de archivo y página extraída del PDF; si no hay fuente, decir "No encontré esto en tus manuales".
- R-4.13.4 Ruteo de intención: preguntas de meteorología → datos de `environment`; mecánica → manuales + inventario; emergencias → derivar a la pantalla SOS.
- R-4.13.5 Mensaje fijo en respuestas de mecánica y seguridad: "Orientación general. Ante dudas, consulta el manual del fabricante o a un técnico."
- R-4.13.6 La IA debe expresar incertidumbre ("no estoy seguro", "verifica en…") y no inventar números de página, especificaciones ni procedimientos.
- R-4.13.7 Renombrar: "Copiloto" (quitar "Multimodal RAG" e "IA Vision" de la UI hasta que existan).
- R-4.13.8 Mantener la buena idea actual: mostrar el contexto del barco usado y enlazar los repuestos a bordo con su ubicación.

**Aceptación:** test: pregunta de viento → la respuesta usa el store `environment`; pregunta sin fuente → "No encontré esto en tus manuales"; grep "pág." en respuestas de demo = solo si viene de un PDF real.

---

## 5. Diseño, UX y accesibilidad — P2

### 5.1 Temas obligatorios
| Tema | Uso | Especificación |
|---|---|---|
| **Día** | Uso general | El actual, corregido en contraste |
| **Noche (rojo)** | Navegación nocturna | Fondo negro puro, todo el texto y los íconos en rojo oscuro, sin blancos, cian ni verde; brillo bajo. Atajo de un toque visible en el Bridge |
| **Sol (alto contraste)** | Cabina a pleno sol | Fondo claro, texto negro, peso de fuente ≥ 600, sin grises claros |

Respetar `prefers-reduced-motion` (ya existe) y agregar `prefers-color-scheme` como valor inicial.

### 5.2 Color semántico (tokens)
- Crear tokens: `--color-brand`, `--color-action`, `--color-ok`, `--color-warning`, `--color-danger`, `--color-data`, `--color-sim`.
- **Naranja y rojo solo para alertas reales.** La navegación activa y los botones normales usan un color neutro o el de marca atenuado.
- Bajar la saturación del cian (#00E5FF) y del verde (#00E676), que encandilan de noche.
- Contraste **WCAG 2.1 AA**: ≥ 4,5:1 para texto normal, ≥ 3:1 para texto grande. Hoy el blanco sobre #FF5722 mide **3,2:1** (falla) en "Diagnosticar", "Abrir QR", "Agregar", "+2.0h", "Continuar a Tripulación". Solución: texto oscuro sobre naranja, o un naranja más oscuro que pase 4,5:1 (calcular y verificar con herramienta).

### 5.3 Tipografía
- **Inter** para todo el texto; **JetBrains Mono** solo para números y datos (SOG, COG, coordenadas, horómetro).
- Tamaño mínimo en la app: **14 px**. Hoy hay textos de 9–10 px (en Voyages, 11 de 27 textos miden menos de 11 px).
- Datos críticos del HUD: ≥ 28 px (ya existe en el Bridge, mantener).
- Reducir etiquetas en MAYÚSCULAS con espaciado; usar mayúscula inicial.

### 5.4 Navegación y layout (mobile-first)
- **Celular:** una sola barra inferior de 5 ítems (Bridge, Barco, Viaje, Flota, Más) + botón SOS fijo. Sin barra lateral.
- **Escritorio:** barra lateral; se elimina la barra inferior duplicada.
- La barra superior no puede tapar las coordenadas en ningún ancho (hoy ocurre a 400 px).
- Áreas táctiles ≥ 48 × 48 px, separación ≥ 8 px (uso con guantes y mar).
- Los atajos ⌘1–9 y ⌘K se mantienen solo en escritorio.
- Una pregunta principal por pantalla: separar Gemelo / Inventario / Copiloto en vistas distintas.

### 5.5 Copy y lenguaje
- Eliminar jerga técnica de la UI: "IndexedDB", "sync_queue", "logbook_entries", "100vw/100vh", "Edge-Sync", "Zero Data Entry", "Multimodal RAG", "Digital Twin". Reemplazar por lenguaje del usuario ("Guardado en el teléfono", "Pendiente de sincronizar").
- Título de la página: **"MarinOS"** (quitar "Apple Maps Nautical & Orca Co-Pilot": usa marcas ajenas).
- Eliminar afirmaciones no respaldadas (listadas en 4.1, 4.4, 4.9, 4.11).

### 5.6 Glosario (UI en español de Chile)
| Actual | Nuevo |
|---|---|
| Bridge | Puente / Carta |
| Vessel | Barco |
| Voyages | Viajes / Zarpes |
| Fleet | Flota |
| Crew | Tripulación |
| Handover | Entrega y recepción |
| Damage Control | Averías y emergencias |
| Anchor Watch Pro | Vigía de fondeo |
| Marine Academy | Aprende |

### 5.7 Accesibilidad
- `aria-live="assertive"` para alarmas (garreo, SOS, sensor fuera de rango).
- Toda alarma combina color + ícono + texto + sonido/vibración (nunca solo color).
- Navegación completa por teclado en escritorio.

---

## 6. Plan por fases

| Fase | Contenido | Requisitos |
|---|---|---|
| **0 — Honestidad y seguridad** | Modo SIMULADO, quitar afirmaciones falsas, SOS, Passport, datos de demo, advertencia de carta | 4.1, 4.4.1–4.4.2, 4.5, 4.8.1, 4.11.3–4.11.4, 4.12.3, 5.5 (parcial) |
| **1 — Coherencia de datos** | Estado del barco, store ambiental, fondeo, ruteo, checklist, ETA, validación costa/agua | 4.2, 4.3, 4.4.3–4.4.5, 4.6, 4.7, 4.8.3 |
| **2 — Sistema de diseño** | Tokens, temas día/noche/sol, tipografía, contraste | 5.1–5.3, 5.7 |
| **3 — UX móvil** | Navegación única, layout, áreas táctiles, glosario | 5.4, 5.5, 5.6 |
| **4 — Producto de flota** | Inventario, mantenimiento, handover, crew, integraciones | 4.9, 4.10, 4.11.1–4.11.2, 4.11.5, 4.12 |
| **5 — Copiloto IA** | Texto libre, RAG real, honestidad | 4.13 |
| **6 — Rendimiento y offline** | INP, offline real, HUD sin polling a la nube | 4.8.5, sección 7 |

---

## 7. Requisitos no funcionales

- **Offline:** con la red cortada deben seguir funcionando: SOS, posición (GPS del dispositivo), bitácora, checklist, handover (con sincronización posterior) y la última carta en caché. Hoy el HUD consulta la telemetría a la nube varias veces por segundo: en modo SIMULADO la simulación corre en el cliente; en EN_VIVO se lee del gateway a bordo.
- **Rendimiento:** INP < 200 ms, LCP < 2,5 s en un celular de gama media con red 4G.
- **Seguridad:** RLS en todas las tablas de Supabase; tabla de actas append-only; sin datos personales reales en seeds.
- **Observabilidad:** registrar los errores de integración con su fuente.

---

## 8. Plan de pruebas (Playwright + unitarias)

1. Grep de textos prohibidos = 0: "legalmente vinculante", "LIVE" (sin fuente real), "Verificado", "PredictWind" (sin integración), "Apple Maps", "plusvalía".
2. Simulación: a 7 kn durante 10 s la posición avanza ~36 m.
3. Con SOG > 0,5 kn nunca aparece "fondeo seguro".
4. Cadena recomendada > disponible → nunca SAFE.
5. Viento: mismo valor en HUD, Fondeo, Ruteo y Copiloto.
6. TWA: rumbo 193°, viento 315° → "descuartelar/largo".
7. Viaje nuevo → checklist 0/6.
8. SOS sin preselección; MOB muestra acciones inmediatas; cierre con un toque; funciona offline.
9. Handover: no permite sellar sin foto real ni sin las dos firmas; la verificación del hash coincide con el servidor.
10. Contraste: auditoría automática (axe-core) sin fallas AA en Bridge, Barco, Viaje, SOS.
11. Celular a 390 px: las coordenadas visibles; ningún texto < 14 px.
12. Copiloto: pregunta de viento → usa `environment`; pregunta sin fuente → "No encontré esto en tus manuales".

---

## 9. Entregables del agente

- `docs/AUDIT_MAP.md` (exploración inicial).
- `CHANGELOG.md` por fase, con la lista de textos reemplazados.
- `docs/LO_QUE_SIGUE_SIMULADO.md`: lista honesta de todo lo que sigue siendo simulado o no integrado.
- `docs/INTEGRACIONES.md`, `docs/CARTOGRAFIA.md`, `docs/ARQUITECTURA_A_BORDO.md`.
- Lista de todos los `TODO(verificar-fuente)` para revisión humana (coordenadas de fondeaderos, fraseología de radio, intervalos de mantenimiento, especificaciones de repuestos, existencia de una API de DIRECTEMAR).

---

## 10. Definición de terminado (v3)

La v3 está terminada cuando un capitán puede usar la app en la cabina de noche y a pleno sol sin forzar la vista, **ninguna pantalla afirma algo que no sea verdad**, todos los módulos muestran el mismo dato para la misma variable, y un operador de charter puede gestionar zarpe, entrega/recepción y mantenimiento de su flota de principio a fin, con todos los tests de la sección 8 en verde.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-11-16T22:41:25-03:00.

The user's current state is as follows:
Active Document: /Users/valgreen/Desktop/marine-os/apps/web/src/components/IntegrationHub.tsx (LANGUAGE_UNSPECIFIED)
Cursor is on line: 195
Other open documents:
- /Users/valgreen/Desktop/marine-os/apps/web/src/components/SeaTrialsOnboarding.tsx (LANGUAGE_UNSPECIFIED)
- /Users/valgreen/Desktop/marine-os/apps/web/src/components/MarineAcademy.tsx (LANGUAGE_UNSPECIFIED)
- /Users/valgreen/Desktop/marine-os/docs/GEMINI_AUDIT_BUNDLE.md (LANGUAGE_UNSPECIFIED)
- /Users/valgreen/Desktop/marine-os/apps/web/src/app/page.tsx (LANGUAGE_UNSPECIFIED)
- /Users/valgreen/Desktop/marine-os/apps/api/routers/ocr.py (LANGUAGE_UNSPECIFIED)
</ADDITIONAL_METADATA>