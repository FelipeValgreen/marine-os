---
description: Ejecuta el UX & Intelligence Sprint en Marine OS (Supabase Google OAuth, Pasaporte Náutico Digital Apple Wallet y Marine Copilot AI Multimodal)
---

1. **Autenticación y Onboarding Premium (`/apps/web`):**
   - Configura `@supabase/supabase-js` en `/apps/web/src/lib/supabase.ts`.
   - Implementa `/apps/web/src/app/login/page.tsx` con glassmorphism oceánico (`#070B14`), botón "Continuar con Google" y botón "Continuar offline como Invitado".
   - Enlaza el estado de sesión en `ThemeProvider.tsx`, persistiendo el `UserProfileAccount` en `IndexedDB` (`user_profiles`) y `sync_queue`.

2. **Pasaporte Náutico Digital (Apple Wallet Style & Sea Time Log):**
   - Transforma la vista de perfil en el Pasaporte Náutico Digital con licencia DIRECTEMAR, código QR vectorial simulado, semáforo de vencimiento (verde `> 6 meses`, ámbar `30-180 días`, rojo `< 30 días`) y contador acumulado de Millas Náuticas Totales (*Sea Time Log*).

3. **Marine Copilot AI Contextual y Multimodal (`/apps/web` + `/apps/api`):**
   - Implementa `/apps/web/src/components/MarineCopilot.tsx` con inyección automática de coordenadas GPS DMS, clima Open-Meteo en vivo, calado (`2.18m`), RPM/temperatura Signal K y horómetro (`1420.5h`).
   - Añade captura y compresión de fotos en cliente a Base64 JPEG conectada a `POST /api/v1/bosun/ask` en `/apps/api/routers/bosun.py`.

4. **Verificación Autónoma:**
   - Ejecuta `npm run typecheck`, `npm run lint` y `npm run build` en `/apps/web` validando cero errores.
