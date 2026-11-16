# PRD.md — Especificación Funcional Completa de Marine OS

## 1. Perfiles de Usuario (RBAC)
- **Fleet Admin / Armador:** Crea barcos, configura QRs, gestiona mantenimiento, revisa finanzas/garantías y aprueba zarpes.
- **Skipper / Patrón:** Planifica rutas `.gpx`, revisa seguridad de fondeaderos, ejecuta check-in/out, activa Anchor Watch y consulta al asistente mecánico IA.
- **Crew / Tripulante (Acceso sin registro vía Magic Link):** Sube documentos de identidad/licencia, firma exención, escanea QRs a bordo, revisa guardias y divide gastos.

## 2. Módulos Funcionales
1. **Digital Twin:** Ficha técnica (LOA, manga, calado, altura palo, horómetro), mapa de tambuchos/inventario con fechas de vencimiento y puente Signal K / NMEA 2000.
2. **AI Compliance & Zarpe:** Magic Link compartible por WhatsApp, OCR multimodal de cédula/pasaporte/licencia náutica, validación de atribuciones y generación de Rol de Tripulación / Zarpe oficial PDF.
3. **Digital Handover & QR Twins:** Códigos QR por sistema a bordo con micro-video tutorial (<=30s) y guía rápida. Check-in/Check-out offline con fotos obligatorias, marca de tiempo, firma táctil y hash SHA-256.
4. **Copilot & Smart Anchorage Matcher:** Importación `.gpx`, MapLibre offline, cruce de pronóstico GRIB con calado y ángulos de exposición de la caleta, cálculo de cadena según marea y Anchor Watch Pro (alarma de garreo).
5. **Predictive Bosun & AI Mechanic:** Alertas por horas de motor, chat RAG conectado a manuales técnicos del barco + inventario real a bordo, calculadora de víveres, guardias y división de gastos con OCR de boletas.
