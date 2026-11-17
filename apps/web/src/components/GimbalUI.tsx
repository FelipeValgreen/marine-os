"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Gauge,
  Wind,
  Waves,
  ShieldAlert,
  Radio,
  ClipboardList,
  Lock,
  Unlock,
} from "lucide-react";
export interface GimbalEngineTelemetry {
  rpm: number;
  coolant_temp_c: number;
  oil_pressure_kpa: number;
  alternator_voltage_v: number;
}

interface GimbalUIProps {
  telemetry: GimbalEngineTelemetry;
  twsKn: number;
  twdDeg: number;
  depthM: number;
  sogKn: number;
  cogDeg: number;
  onOpenSOS: () => void;
  onOpenFlashChecklist: () => void;
  onOpenDigitalVHF: () => void;
}

export function GimbalUI({
  telemetry,
  twsKn,
  twdDeg,
  depthM,
  sogKn,
  cogDeg,
  onOpenSOS,
  onOpenFlashChecklist,
  onOpenDigitalVHF,
}: GimbalUIProps) {
  const [horizonLockEnabled, setHorizonLockEnabled] = useState<boolean>(true);
  const [deviceRoll, setDeviceRoll] = useState<number>(0);
  const [devicePitch, setDevicePitch] = useState<number>(0);
  const [hasGyroscope, setHasGyroscope] = useState<boolean>(false);
  const [simulatedSwell, setSimulatedSwell] = useState<boolean>(false);

  // Listen to physical gyroscope
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        setHasGyroscope(true);
        // gamma is roll angle (-90 to +90)
        setDeviceRoll(Math.round(e.gamma * 10) / 10);
      }
      if (e.beta !== null) {
        setDevicePitch(Math.round(e.beta * 10) / 10);
      }
    };

    if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
      window.addEventListener("deviceorientation", handleOrientation);
    }

    return () => {
      if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
        window.removeEventListener("deviceorientation", handleOrientation);
      }
    };
  }, []);

  // Swell simulator for desktop / calm dock verification
  useEffect(() => {
    if (!simulatedSwell) return;
    let t = 0;
    const interval = setInterval(() => {
      t += 0.05;
      // Oscillate heel angle between -14° and +14° with wave frequency
      const roll = Math.sin(t) * 12 + Math.cos(t * 1.5) * 3;
      setDeviceRoll(Math.round(roll * 10) / 10);
    }, 40);

    return () => clearInterval(interval);
  }, [simulatedSwell]);

  const currentRoll = deviceRoll;
  // In Horizon Lock mode, counter-rotate content by -currentRoll
  const counterRotation = horizonLockEnabled ? -currentRoll : 0;

  return (
    <div className="relative w-full min-h-[calc(100vh-5rem)] flex flex-col justify-between p-3 sm:p-6 bg-[#040B16] text-white select-none overflow-hidden rounded-2xl border border-white/5">
      {/* Top Tactical Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 z-20 pb-2 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-950/40 border border-orange-500/30 text-orange-400 font-mono text-xs font-bold tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5722] animate-pulse" />
            <span>MODO ALTA MAR • TÁCTICO</span>
          </div>

          <button
            type="button"
            onClick={() => setHorizonLockEnabled(!horizonLockEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
              horizonLockEnabled
                ? "bg-[#0A1628] border-cyan-500/50 text-[#00E5FF]"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white"
            }`}
            title="Bloqueo de Horizonte: contrarresta la escora para evitar mareo"
          >
            {horizonLockEnabled ? (
              <Lock className="w-3.5 h-3.5 text-[#00E5FF]" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-white/50" />
            )}
            <span>HORIZON LOCK: {horizonLockEnabled ? "ACTIVO" : "DESACTIVADO"}</span>
          </button>
        </div>

        {/* Gyro & Heel Angle Indicator */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
            <span className="text-white/50">ESCORA:</span>
            <span
              className={`font-bold ${
                Math.abs(currentRoll) > 15
                  ? "text-red-400 font-black"
                  : Math.abs(currentRoll) > 8
                  ? "text-amber-400 font-bold"
                  : "text-emerald-400"
              }`}
            >
              {Math.abs(currentRoll).toFixed(1)}°{" "}
              {currentRoll > 0.5 ? "ESTRIBOR (E)" : currentRoll < -0.5 ? "BABOR (B)" : "ADRIZADO"}
            </span>
            <span className="text-white/30">|</span>
            <span className="text-white/50">CABECEO: {devicePitch.toFixed(0)}°</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
              {hasGyroscope ? "GYRO" : "SIM"}
            </span>
          </div>

          {/* Desktop swell simulator button */}
          <button
            type="button"
            onClick={() => setSimulatedSwell(!simulatedSwell)}
            className={`px-2.5 py-1.5 rounded-lg border font-mono text-[11px] transition-colors ${
              simulatedSwell
                ? "bg-amber-950/50 border-amber-500/50 text-amber-300"
                : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
            }`}
            title="Simula oleaje y escora para probar el Horizon Lock"
          >
            {simulatedSwell ? "🌊 Oleaje SIM: ON" : "🌊 Probar Oleaje"}
          </button>
        </div>
      </div>

      {/* Artificial Horizon Background Graphic (Rotates with the vessel) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-30 z-0">
        <motion.div
          animate={{ rotate: currentRoll }}
          transition={{ type: "spring", stiffness: 220, damping: 25 }}
          className="w-[140vw] h-[140vw] flex flex-col justify-center items-center"
        >
          {/* Sky / Sea Horizon Divider */}
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
          <div className="absolute flex items-center gap-12 font-mono text-[10px] text-cyan-300/40 tracking-widest uppercase">
            <span>BABOR -30°</span>
            <span>-15°</span>
            <span className="font-bold text-xs text-cyan-400">--- HORIZONTE ---</span>
            <span>+15°</span>
            <span>ESTRIBOR +30°</span>
          </div>
        </motion.div>
      </div>

      {/* GIMBAL COUNTER-ROTATING TELEMETRY CONTAINER (Glanceable Giant Typography) */}
      <motion.div
        animate={{ rotate: counterRotation }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="relative z-10 my-auto w-full py-4 flex flex-col items-center justify-center"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full max-w-6xl">
          {/* Card 1: SPEED OVER GROUND (SOG) */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#081220]/90 border border-white/10 shadow-2xl backdrop-blur-md flex flex-col justify-between min-h-[220px]">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-cyan-400" />
                <span className="font-mono text-xs uppercase tracking-widest text-cyan-400 font-bold">
                  VELOCIDAD (SOG)
                </span>
              </div>
              <span className="font-mono text-[11px] text-white/50">GNSS / NMEA</span>
            </div>

            <div className="flex items-baseline justify-center gap-2 my-auto py-2">
              <span className="font-mono font-black text-7xl sm:text-8xl tracking-tight text-white drop-shadow">
                {sogKn.toFixed(1)}
              </span>
              <span className="font-mono text-xl sm:text-2xl text-cyan-400 font-bold">KN</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-white/60 pt-2 border-t border-white/5">
              <span>RUMBO COG: <strong className="text-white">{Math.round(cogDeg)}°</strong></span>
              <span className="text-emerald-400 font-semibold">ESTABLE</span>
            </div>
          </div>

          {/* Card 2: TRUE WIND SPEED & DIRECTION (TWS / TWD) */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#081220]/90 border border-white/10 shadow-2xl backdrop-blur-md flex flex-col justify-between min-h-[220px]">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <Wind className="w-5 h-5 text-amber-400" />
                <span className="font-mono text-xs uppercase tracking-widest text-amber-400 font-bold">
                  VIENTO REAL (TWS)
                </span>
              </div>
              <span className="font-mono text-[11px] text-white/50">{twdDeg}° TWD</span>
            </div>

            <div className="flex items-baseline justify-center gap-2 my-auto py-2">
              <span className="font-mono font-black text-7xl sm:text-8xl tracking-tight text-white drop-shadow">
                {twsKn.toFixed(1)}
              </span>
              <span className="font-mono text-xl sm:text-2xl text-amber-400 font-bold">KT</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-white/60 pt-2 border-t border-white/5">
              <span>APARENTE: <strong className="text-white">{(twsKn * 1.15).toFixed(1)} kn</strong></span>
              <span className="text-amber-400 font-semibold">RACHAS 24kt</span>
            </div>
          </div>

          {/* Card 3: DEPTH UNDER KEEL */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border shadow-2xl backdrop-blur-md flex flex-col justify-between min-h-[220px] transition-colors ${
              depthM < 3.0
                ? "bg-red-950/70 border-red-500/50"
                : "bg-[#081220]/90 border-white/10"
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <Waves className={`w-5 h-5 ${depthM < 3.0 ? "text-red-400" : "text-emerald-400"}`} />
                <span
                  className={`font-mono text-xs uppercase tracking-widest font-bold ${
                    depthM < 3.0 ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  SONDA (PROF.)
                </span>
              </div>
              {depthM < 3.0 && (
                <span className="px-2 py-0.5 rounded bg-red-600 text-white font-mono text-[10px] font-bold animate-pulse">
                  ALARMA BAJO FONDO
                </span>
              )}
            </div>

            <div className="flex items-baseline justify-center gap-2 my-auto py-2">
              <span className="font-mono font-black text-7xl sm:text-8xl tracking-tight text-white drop-shadow">
                {depthM.toFixed(1)}
              </span>
              <span className="font-mono text-xl sm:text-2xl text-emerald-400 font-bold">M</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-white/60 pt-2 border-t border-white/5">
              <span>CALADO BAJO QUILLA</span>
              <span className={depthM < 3.0 ? "text-red-300 font-bold" : "text-emerald-400"}>
                {depthM > 1.8 ? `AGUA LIBRE: ${(depthM - 1.8).toFixed(1)}m` : "PELIGRO DE VARADA"}
              </span>
            </div>
          </div>
        </div>

        {/* Engine Horometer & Battery Pill Strip */}
        <div className="mt-5 w-full max-w-6xl flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-xl bg-black/50 border border-white/5 font-mono text-xs">
          <div className="flex items-center gap-4">
            <span className="text-white/60">YANMAR 4JH57:</span>
            <span className="font-bold text-white">{telemetry.rpm} RPM</span>
            <span className="opacity-30">|</span>
            <span className="text-white/60">REFRIG:</span>
            <span className="font-bold text-emerald-400">{telemetry.coolant_temp_c.toFixed(1)}°C</span>
            <span className="opacity-30">|</span>
            <span className="text-white/60">PRESIÓN ACEITE:</span>
            <span className="font-bold text-white">{telemetry.oil_pressure_kpa} kPa</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-white/60">BATERÍA SERVICIO:</span>
            <span className="font-bold text-[#00E5FF]">87% SOC</span>
            <span className="opacity-30">|</span>
            <span className="text-white/60">ALTERNADOR:</span>
            <span className="font-bold text-white">{telemetry.alternator_voltage_v.toFixed(1)}V</span>
          </div>
        </div>
      </motion.div>

      {/* TACTICAL BOTTOM ACTION DOCK (Giant Touch Targets for Wet Hands) */}
      <div className="grid grid-cols-3 gap-3 z-20 pt-3 border-t border-white/5">
        {/* Flash-Checklist Button */}
        <button
          type="button"
          data-testid="gimbal-flash-checklist-btn"
          onClick={onOpenFlashChecklist}
          className="min-h-[58px] sm:min-h-[64px] px-4 rounded-xl bg-[#0E1A2B] hover:bg-[#13233A] active:scale-[0.98] border border-white/10 flex items-center justify-center gap-2.5 font-mono text-xs sm:text-sm font-bold tracking-wide transition shadow-lg"
        >
          <ClipboardList className="w-5 h-5 text-cyan-400 shrink-0" />
          <span className="text-white">FLASH-CHECKLIST</span>
        </button>

        {/* Digital VHF / Social Radar Button */}
        <button
          type="button"
          data-testid="gimbal-digital-vhf-btn"
          onClick={onOpenDigitalVHF}
          className="min-h-[58px] sm:min-h-[64px] px-4 rounded-xl bg-[#0E1A2B] hover:bg-[#13233A] active:scale-[0.98] border border-white/10 flex items-center justify-center gap-2.5 font-mono text-xs sm:text-sm font-bold tracking-wide transition shadow-lg"
        >
          <Radio className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-white">VHF DIGITAL & RADAR</span>
        </button>

        {/* SOS Emergency Button (Flat Matte Red, Zero Exterior Glow) */}
        <button
          type="button"
          data-testid="gimbal-sos-btn"
          onClick={onOpenSOS}
          className="min-h-[58px] sm:min-h-[64px] px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] border border-red-800 flex items-center justify-center gap-2.5 font-mono text-xs sm:text-sm font-black tracking-wider text-white transition shadow-none"
        >
          <ShieldAlert className="w-5 h-5 text-white shrink-0" />
          <span>MAYDAY / SOS</span>
        </button>
      </div>
    </div>
  );
}
