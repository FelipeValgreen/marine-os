# CONTEXT.md — Marine OS (Middleware Operativo & Copiloto Náutico)

## 1. Visión del Producto
Marine OS es una Progressive Web App (PWA) *Local-First* que actúa como el sistema operativo integral para veleros, catamaranes y embarcaciones de recreo/chárter (35–60 pies). Actuamos como la **capa de orquestación inteligente** que conecta el Gemelo Digital del barco, los datos climáticos, la burocracia marítima (zarpes con OCR) y la operación en el muelle y a bordo.

## 2. Tesis de Negocio y Nicho (Beachhead Market)
- **Cliente Principal (B2B2C):** Operadores de chárter boutique, clubes de navegación y armadores con barcos compartidos.
- **Cliente Secundario (B2C):** Armadores particulares de crucero que buscan automatizar seguridad, fondeo y mantenimiento.
- **Motor Viral:** Cada barco B2B onboardea ~200 tripulantes al año mediante *Magic Links* (sin descarga de app) para firmar inventarios, ver tutoriales QR y generar el rol de tripulación/zarpe, logrando un CAC cercano a cero.

## 3. Principios Arquitectónicos Innegociables
1. **Offline-First Real (Edge-Sync):** Toda lectura/escritura crítica debe funcionar 100% sin red sobre `IndexedDB` y sincronizar diferencialmente al recuperar señal.
2. **Conectar, No Reconstruir:** Importamos/exportamos `.gpx` hacia Navionics/OpenCPN, consumimos GRIBs vía API (Open-Meteo Marine) y nos conectamos al bus NMEA 2000 mediante **Signal K**.
3. **Ergonomía Marina Extrema:** Soporta *Modo Sol Directo* (alto contraste, botones >= 56x56px) y *Modo Guardia Nocturna* (paleta estricta Red-Shift `#FF1E1E` sobre `#000000`).
