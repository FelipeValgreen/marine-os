"use client";

import React, { useState } from "react";
import {
  Compass,
  ShieldCheck,
  WifiOff,
  Sparkles,
  CheckCircle2,
  Eye,
  Sun,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useMarineContext } from "@/components/ThemeProvider";

export default function MarineOSLoginPage() {
  const { loginWithGoogle, loginAsOfflineGuest, theme, toggleTheme } =
    useMarineContext();
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const isNight = theme === "night-red-shift";
  const isDaylight = theme === "daylight-high-contrast";

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    try {
      await loginWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-y-auto flex items-center justify-center p-4 sm:p-8 select-none">
      {/* Immersive Oceanic Bathymetric & Tactical Radar Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        {!isNight && !isDaylight && (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#0d2238_0%,#040B16_65%,#03060c_100%)]" />
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[820px] h-[440px] rounded-full bg-[var(--accent-primary)]/12 blur-[140px]" />
            <div className="absolute -bottom-40 left-1/3 w-[680px] h-[400px] rounded-full bg-[#00E676]/10 blur-[150px]" />
          </>
        )}

        {/* Bathymetric Isobars & Nautical Rhumb Lines SVG */}
        <svg
          viewBox="0 0 1440 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full object-cover opacity-25"
        >
          <circle
            cx="720"
            cy="450"
            r="340"
            stroke="var(--accent-primary)"
            strokeOpacity="0.25"
            strokeDasharray="6 6"
          />
          <circle
            cx="720"
            cy="450"
            r="520"
            stroke="var(--accent-primary)"
            strokeOpacity="0.15"
          />
          <path
            d="M0 620 Q 360 540 720 610 T 1440 580"
            stroke="var(--accent-primary)"
            strokeOpacity="0.3"
            strokeWidth="1.5"
          />
          <path
            d="M0 710 Q 420 650 840 720 T 1440 670"
            stroke="var(--accent-primary)"
            strokeOpacity="0.2"
            strokeWidth="1.2"
          />
          <line
            x1="0"
            y1="450"
            x2="1440"
            y2="450"
            stroke="var(--accent-primary)"
            strokeOpacity="0.12"
          />
          <line
            x1="720"
            y1="0"
            x2="720"
            y2="900"
            stroke="var(--accent-primary)"
            strokeOpacity="0.12"
          />
        </svg>
      </div>

      {/* Main Glassmorphic Onboarding Container */}
      <div className="relative z-10 w-full max-w-md marine-card p-7 sm:p-9 space-y-7">
        {/* Top Brand Emblem & Theme Switch */}
        <div className="flex items-center justify-between gap-2">
          <Logo size="md" />

          <button
            type="button"
            onClick={toggleTheme}
            className="marine-btn marine-btn-secondary text-xs px-3.5"
          >
            {isNight ? (
              <Eye className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4 text-[var(--accent-primary)]" />
            )}
            <span>
              {isNight ? "Red-Shift" : isDaylight ? "Daylight" : "Tema"}
            </span>
          </button>
        </div>

        {/* Hero Copy */}
        <div className="space-y-2">
          <div className="font-mono text-[11px] uppercase tracking-widest text-[var(--accent-primary)] font-bold">
            THE LINEAR OF THE SEA • 100% OFFLINE-FIRST
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">
            MarinOS • Sistema Operativo Náutico &amp; Pasaporte Digital
          </h1>
          <p className="text-xs sm:text-sm opacity-75 leading-relaxed">
            Sincroniza tu{" "}
            <strong>Perfil Náutico</strong>, bitácora de navegación (
            <em>Sea Time Log</em>) y los sistemas del{" "}
            <strong>SV Albatros (CB-4582)</strong> en tu dispositivo.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-2.5 font-mono text-xs">
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-[var(--border-subtle)] flex items-center gap-3">
            <Compass className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span>Cartografía Náutica + HUD Táctico</span>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-[var(--border-subtle)] flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-[var(--status-ok)] shrink-0" />
            <span>Zarpe Electrónico + Sello Criptográfico SHA-256</span>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-[var(--border-subtle)] flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span>Command Center (⌘K) + Bitácora por Voz &amp; SOS 3s</span>
          </div>
        </div>

        {/* Primary Action: Giant "Continuar con Google" Button (min-h-[64px]) */}
        <div className="space-y-3 pt-1">
          <button
            type="button"
            data-testid="google-oauth-login-btn"
            onClick={handleGoogleLogin}
            disabled={signingIn}
            className="w-full min-h-[64px] marine-btn marine-btn-primary text-sm sm:text-base font-bold tracking-tight flex items-center justify-center gap-3 shadow-2xl"
          >
            <svg
              className="w-5 h-5 shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 1.81-1.5 3.34-3.2 4.37v3.62h5.18c3.03-2.79 4.78-6.9 4.78-11.72 0-.8-.08-1.57-.23-2.3z"
              />
              <path
                fill="currentColor"
                d="M12.18 22c4.32 0 7.95-1.43 10.6-3.88l-5.18-3.62c-1.43.96-3.26 1.53-5.42 1.53-4.17 0-7.7-2.81-8.96-6.6H.08v3.73C2.72 18.41 7.11 22 12.18 22z"
              />
            </svg>
            <span>
              {signingIn
                ? "Iniciando sesión..."
                : "Continuar con Google"}
            </span>
          </button>

          {/* Secondary Action: Offline Guest Mode (min-h-[64px]) */}
          <button
            type="button"
            data-testid="offline-guest-login-btn"
            onClick={loginAsOfflineGuest}
            className="w-full min-h-[64px] marine-btn marine-btn-secondary text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5"
          >
            <WifiOff className="w-4 h-4 text-[var(--status-warn)] shrink-0" />
            <span>Invitado Offline (Continuar offline como Invitado)</span>
          </button>
        </div>

        {/* Footer Security Note */}
        <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-mono opacity-65">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-ok)]" />
            Almacenamiento Local Seguro
          </span>
          <span>41° 28.3&apos; S • Reloncaví</span>
        </div>
      </div>
    </div>
  );
}
