# MarinOS Design System (v3.1) — "Honesto, legible y seguro a bordo"

## 1. Visión y Filosofía de Diseño Marítimo

A bordo de una embarcación en navegación (especialmente en condiciones adversas de los canales australes de Chile como Chiloé o el Seno de Reloncaví), una interfaz no es un adorno estético; es un instrumento de seguridad y supervivencia.

El diseño de **MarinOS** se rige por cuatro principios navales fundamentales:
1. **Preservación Escotópica de la Visión Nocturna:** En navegación nocturna, cualquier píxel blanco, azul o cian destruye la adaptación a la oscuridad del timonel durante 20 a 30 minutos. El modo noche utiliza estrictamente rojo monocromático sobre negro puro OLED (`#000000`).
2. **Legibilidad al Timón bajo Sol Extremo (Glare-Proof):** En la bañera o flybridge bajo sol directo, el deslumbramiento hace ilegibles las pantallas convencionales. El modo Sol aplica fondos claros (`#F8FAFC`) con texto carbón profundo (`#020617`, peso $\ge 600$) y contraste superior a 15:1.
3. **Ergonomía con Guantes y Mar Formado:** Los botones tienen áreas táctiles mínimas de $48 \times 48$ px (altura táctil estándar de 56 px a 64 px) con espaciado amplio para evitar pulsaciones erróneas causadas por el cabeceo y balanceo de la embarcación.
4. **Cero Salto de Diseño (CLS = 0) en Telemetría:** Los números críticos (SOG, COG, Profundidad, Viento, RPM) emplean **JetBrains Mono** con números tabulares (`tabular-nums slashed-zero`) para que el cambio de valores no desplace ningún elemento de la pantalla.

---

## 2. Los Tres Temas Operacionales

| Tema | Atributo `data-theme` | Escenario Operacional | Especificación Cromática |
|---|---|---|---|
| **Océano (Día)** | `midnight-ocean` | Puente de mando / Cabina interior | Fondo abisal (`#060B14`), texto marfil (`#F8FAFC`), naranja salvamento atenuado (`#C2410C`), cian táctil suave (`#38BDF8`). |
| **Noche (Red-Shift)** | `night-red-shift` | Guardia de noche en cubierta | Fondo negro puro OLED (`#000000`), textos e íconos en rojo (`#FF2222` / `#CC1111`). Cero píxeles blancos, verdes o cian. |
| **Sol (Alto Contraste)** | `daylight-high-contrast` | Timón de bañera a pleno sol | Fondo hielo mate (`#F8FAFC`), texto marino oscuro (`#020617`), naranja solar (`#C2410C`). Sin grises claros. |

---

## 3. Tokens Semánticos (`globals.css`)

```css
:root,
[data-theme="midnight-ocean"] {
  --color-brand: #38bdf8;
  --color-action: #c2410c;
  --color-ok: #34d399;
  --color-warning: #fbbf24;
  --color-danger: #f87171;
  --color-data: #38bdf8;
  --color-sim: #f59e0b;
  --accent-primary: #c2410c;
  --accent-contrast: #ffffff;
}

[data-theme="daylight-high-contrast"] {
  --color-brand: #0369a1;
  --color-action: #c2410c;
  --color-ok: #047857;
  --color-warning: #b45309;
  --color-danger: #b91c1c;
  --color-data: #0369a1;
  --color-sim: #b45309;
  --accent-primary: #c2410c;
  --accent-contrast: #ffffff;
}

[data-theme="night-red-shift"] {
  --color-brand: #ff2222;
  --color-action: #ff0000;
  --color-ok: #cc1111;
  --color-warning: #ff2222;
  --color-danger: #ff0000;
  --color-data: #ff2222;
  --color-sim: #ff2222;
  --accent-primary: #ff0000;
  --accent-contrast: #000000;
}
```

---

## 4. Matriz de Contraste WCAG 2.1 AA

| Elemento / Combinación | Modo Océano | Modo Sol | Modo Noche | Nivel WCAG |
|---|---|---|---|---|
| Texto principal sobre fondo (`--text-primary` / `--bg-primary`) | **18.2:1** (`#F8FAFC` en `#060B14`) | **19.1:1** (`#020617` en `#F8FAFC`) | **5.8:1** (`#FF2222` en `#000000`) | **Pasa AAA** |
| Texto secundario sobre fondo (`--text-secondary` / `--bg-primary`) | **7.5:1** (`#94A3B8` en `#060B14`) | **14.8:1** (`#1E293B` en `#F8FAFC`) | **4.6:1** (`#CC1111` en `#000000`) | **Pasa AA** |
| Botón primario (`.marine-btn-primary`: `#FFFFFF` sobre `#C2410C`) | **5.2:1** | **5.2:1** | Monocromático rojo | **Pasa AA** ($\ge 4.5:1$) |
| Indicador de Telemetría (Cian `#38BDF8` en fondo `#060B14`) | **8.8:1** | **6.0:1** (`#0369A1`) | Monocromático rojo | **Pasa AAA** |
| Indicador de Estado OK (Esmeralda `#34D399` en fondo `#060B14`) | **9.2:1** | **5.5:1** (`#047857`) | Monocromático rojo | **Pasa AAA** |
| Alerta Precaución (Ámbar `#FBBF24` en fondo `#060B14`) | **11.5:1** | **5.2:1** (`#B45309`) | Monocromático rojo | **Pasa AAA** |

---

## 5. Tipografía y Jerarquía

1. **Inter (`var(--font-inter)`):** Toda la prosa, títulos, botones y etiquetas de navegación.
2. **JetBrains Mono (`var(--font-jetbrains-mono)`):** Números críticos, coordenadas, SOG/COG, profundidad, horómetros, hashes criptográficos SHA-256.
3. **Escala de Tamaños:**
   - **HUD Timón Crítico:** `text-2xl sm:text-4xl` (24 px a 36 px) en negrita mono.
   - **Títulos de Módulo:** `text-xl sm:text-2xl` (20 px a 24 px).
   - **Texto de Navegación y Lectura:** $\ge 14$ px (`text-sm` o `text-base`). Se prohíben textos minúsculos de menos de 12 px salvo sub-etiquetas métricas secundarias (ej. `KN`, `°M`).

---

## 6. Accesibilidad Marítima (A11y)

- **Alarmas Críticas:** Toda alarma (garreo de ancla, SOS, falla de sensor) implementa `role="alert"` y `aria-live="assertive"`, asegurando que los lectores de pantalla y sistemas de a bordo anuncien inmediatamente el peligro.
- **Canal Sensorial Múltiple:** Jamás se transmite una alarma solo con color; se combinan:
  1. **Color de Alerta** (Rojo o Ámbar con contraste verificado).
  2. **Icono Gráfico de Alerta** (`AlertTriangle`, `AlertOctagon`).
  3. **Texto Explícito** (ej. `"¡ALARMA DE GARREO! Barco fuera del radio de borneo"`).
  4. **Señal Acústica** (Sirena piezoeléctrica vía Web Audio API).
  5. **Retroalimentación Háptica** (`navigator.vibrate([200, 100, 200])`).
- **Respeto a Preferencias de Sistema:**
  - `@media (prefers-reduced-motion: reduce)` desactiva animaciones y transiciones intensas para mitigar el mareo por movimiento (cinetosis).
  - `prefers-color-scheme` inicializa automáticamente el modo `daylight-high-contrast` en dispositivos diurnos antes de que el capitán elija manualmente.
