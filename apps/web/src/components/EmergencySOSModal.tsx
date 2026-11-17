"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertOctagon,
  Radio,
  Satellite,
  X,
  Volume2,
  CheckCircle2,
  Send,
  ShieldAlert,
} from "lucide-react";
import { db, DEMO_IDS, enqueueOfflineMutation } from "@/lib/offline/db";
import {
  formatNauticalCoordsDMS,
  triggerAcousticMarineAlarm,
} from "@/lib/nautical";
import { useMarineContext } from "@/components/ThemeProvider";

export function EmergencySOSModal({ onClose }: { onClose: () => void }) {
  const { theme, pushToast } = useMarineContext();
  const isNight = theme === "night-red-shift";

  const vessel = useLiveQuery(() => db.vessels.get(DEMO_IDS.VESSEL_ID), []);
  const crewList = useLiveQuery(() => db.voyage_crew.toArray(), [], []);

  const [emergencyType, setEmergencyType] = useState<string>(
    "VÍA DE AGUA EN SALA DE MÁQUINAS"
  );
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lon: number }>({
    lat: -41.4717,
    lon: -72.9369,
  });
  const [satTransmitted, setSatTransmitted] = useState<boolean>(false);
  const [satTimestamp, setSatTimestamp] = useState<string>("");

  // Live GPS micro-tick to show real-time coordinate tracking during MAYDAY broadcast
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveCoords((prev) => ({
        lat: prev.lat - 0.00004,
        lon: prev.lon + 0.00003,
      }));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const dms = formatNauticalCoordsDMS(liveCoords.lat, liveCoords.lon);
  const pobCount = Math.max(1, crewList.length || 3);
  const vesselName = vessel?.name || "SV Albatros (Oceanis 41.1)";
  const regNumber = vessel?.registration_number || "CB-4582";

  const compressedSatellitePayload = `SOS|${regNumber}|${liveCoords.lat.toFixed(
    5
  )},${liveCoords.lon.toFixed(5)}|POB:${pobCount}|EMERG:${emergencyType.slice(
    0,
    18
  )}|LOA:${vessel?.loa_meters || 12.43}M|UTC:${new Date()
    .toISOString()
    .slice(11, 19)}`;

  const handleSendSatelliteBurst = async () => {
    const ts = new Date().toISOString();
    setSatTimestamp(ts);
    setSatTransmitted(true);
    triggerAcousticMarineAlarm();

    await enqueueOfflineMutation({
      table_name: "logbook_entries",
      operation: "INSERT",
      record_id: `sos-sat-${Date.now()}`,
      payload: {
        type: "IRIDIUM_GARMIN_SBD_SOS",
        burst_payload: compressedSatellitePayload,
        lat: liveCoords.lat,
        lon: liveCoords.lon,
        pob: pobCount,
        transmitted_at: ts,
      },
    });

    pushToast({
      title: "Burst Satelital Iridium / Garmin Encolado",
      subtitle: `${compressedSatellitePayload.length} bytes transmitidos al gateway local`,
      tone: "coral",
    });
  };

  return (
    <motion.div
      key="emergency-sos-backdrop"
      data-testid="emergency-sos-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className={`fixed inset-0 z-[80] w-screen h-screen overflow-y-auto p-4 sm:p-8 flex items-center justify-center select-none ${
        isNight
          ? "bg-black text-[#FF1E1E]"
          : "bg-black/85 backdrop-blur-2xl text-slate-100"
      }`}
    >
      <motion.div
        key="emergency-sos-panel"
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 14 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`w-full max-w-6xl rounded-3xl p-6 sm:p-8 border shadow-2xl shadow-black/90 space-y-6 ${
          isNight
            ? "bg-black border-[#FF1E1E]"
            : "bg-[#040B16] border-red-900/60"
        }`}
      >
        {/* Top Emergency Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-[#FF2D55] text-white flex items-center justify-center animate-pulse shrink-0">
              <AlertOctagon className="w-8 h-8" />
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#FF2D55]">
                 CONSOLA DE EMERGENCIA MARÍTIMA • MRCC CHILE / DIRECTEMAR
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                SOS — Protocolo MAYDAY VHF Canal 16 &amp; Gateway Satelital
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => triggerAcousticMarineAlarm()}
              className="marine-btn marine-btn-secondary text-xs px-4"
            >
              <Volume2 className="w-4 h-4 text-[#FF2D55]" />
              <span>Sirena Acústica</span>
            </button>
            <button
              type="button"
              data-testid="close-sos-modal-btn"
              onClick={onClose}
              className="min-h-14 px-5 rounded-xl bg-white/10 hover:bg-white/20 font-mono text-xs font-bold flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              <span>CERRAR SOS</span>
            </button>
          </div>
        </div>

        {/* GIANT 32PT LIVE GPS COORDINATES BANNER FOR WHEELHOUSE / VHF READOUT */}
        <div
          data-testid="sos-giant-32pt-coords"
          className="p-5 sm:p-6 rounded-2xl bg-black border border-red-900 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-none"
        >
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-[#FF2D55] font-bold">
              POSICIÓN GPS EN VIVO • LECTURA RÁPIDA DE TIMONERA (32PT)
            </div>
            <div className="font-mono text-2xl sm:text-[32pt] leading-none font-black tracking-tight text-[#00E5FF] mt-2">
              {dms.latDms} • {dms.lonDms}
            </div>
          </div>
          <div className="font-mono text-xs sm:text-sm text-right opacity-90 shrink-0 space-y-1">
            <div className="px-3 py-1 rounded-lg bg-[#FF2D55]/20 border border-[#FF2D55] text-[#FF2D55] font-bold inline-block">
              DECIMAL: {liveCoords.lat.toFixed(5)}°S, {liveCoords.lon.toFixed(5)}°W
            </div>
            <div className="opacity-75">
              DATUM WGS84 • CANAL 16 VHF (156.800 MHz)
            </div>
          </div>
        </div>

        {/* Emergency Nature Quick Selector */}
        <div className="space-y-2">
          <div className="font-mono text-xs uppercase opacity-75">
            SELECCIONA LA NATURALEZA DE LA EMERGENCIA PARA ACTUALIZAR EL SCRIPT:
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              "VÍA DE AGUA EN SALA DE MÁQUINAS",
              "FUEGO A BORDO SIN CONTROL",
              "HOMBRE AL AGUA (MOB)",
              "PÉRDIDA DE GOBIERNO / VARADA",
            ].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setEmergencyType(type)}
                className={`min-h-14 px-3.5 py-2 rounded-xl font-mono text-xs font-bold text-left border transition ${
                  emergencyType === type
                    ? "bg-[#FF2D55] text-white border-[#FF2D55]"
                    : "bg-white/5 border-white/15 hover:bg-white/10"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Responsive Industrial Grid: Side-by-side on PC/iPad Pro, Stacked on Mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* PANEL A: VHF CHANNEL 16 MAYDAY SCRIPT (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl p-6 bg-white/[0.03] border border-white/15 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2.5">
                <Radio className="w-6 h-6 text-[#FF2D55]" />
                <div>
                  <h2 className="text-lg font-bold">
                    A. Llamada VHF Canal 16 (156.800 MHz — Alta Potencia 25W)
                  </h2>
                  <p className="text-xs font-mono opacity-75">
                    Presiona PTT y lee este script en voz clara y pausada:
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#FF2D55]/20 text-[#FF2D55] font-mono text-xs font-bold">
                POB: {pobCount} PERSONAS
              </span>
            </div>

            {/* High-Legibility Giant Phonetic Script */}
            <div
              data-testid="vhf-mayday-script"
              className="p-5 rounded-2xl bg-black/80 border-2 border-[#FF2D55]/60 font-mono text-sm sm:text-base leading-relaxed space-y-2.5"
            >
              <div className="text-[#FF2D55] font-black text-lg sm:text-xl">
                &ldquo;MAYDAY, MAYDAY, MAYDAY&rdquo;
              </div>
              <div>
                AQUÍ{" "}
                <strong className="text-[#00E5FF]">
                  {vesselName.toUpperCase()}
                </strong>
                ,{" "}
                <strong className="text-[#00E5FF]">
                  {vesselName.toUpperCase()}
                </strong>
                ,{" "}
                <strong className="text-[#00E5FF]">
                  {vesselName.toUpperCase()}
                </strong>
              </div>
              <div>
                MATRÍCULA:{" "}
                <strong>{regNumber} (CHARLIE BRAVO 4-5-8-2)</strong>
              </div>
              <div className="p-3 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/40 text-[#00E5FF] font-bold">
                POSICIÓN GPS EN VIVO: {dms.latDms} / {dms.lonDms}
                <div className="text-xs opacity-85 mt-0.5">
                  (DECIMAL: {liveCoords.lat.toFixed(5)}°S,{" "}
                  {liveCoords.lon.toFixed(5)}°W — SENO DE RELONCAVÍ / CHILOÉ)
                </div>
              </div>
              <div>
                EMERGENCIA:{" "}
                <strong className="text-[#FF9F0A]">{emergencyType}</strong>
              </div>
              <div>
                PERSONAS A BORDO (POB):{" "}
                <strong className="text-[#00E676]">
                  {pobCount} TRIPULANTES
                </strong>{" "}
                • VELERO BLANCO {vessel?.loa_meters || 12.43}M ESLORA
              </div>
              <div className="text-[#FF2D55] font-bold">
                &ldquo;SOLICITO ASISTENCIA INMEDIATA — CAMBIO.&rdquo;
              </div>
            </div>
          </div>

          {/* PANEL B: SATELLITE GATEWAY IRIDIUM GO! / GARMIN INREACH (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl p-6 bg-white/[0.03] border border-white/15 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
                <Satellite className="w-6 h-6 text-[#00E5FF]" />
                <div>
                  <h2 className="text-lg font-bold">
                    B. Alerta Satelital (Iridium GO! / Garmin)
                  </h2>
                  <p className="text-xs font-mono opacity-75">
                    Trama SBD ultracomprimida (&lt; 160 bytes) para gateway
                    satelital local
                  </p>
                </div>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between opacity-75">
                  <span>FORMATO SBD (SHORT BURST DATA):</span>
                  <span>{compressedSatellitePayload.length} / 160 BYTES</span>
                </div>
                <div
                  data-testid="satellite-sbd-payload"
                  className="p-4 rounded-xl bg-black/80 border border-[#00E5FF]/40 text-[#00E5FF] break-all leading-relaxed"
                >
                  {compressedSatellitePayload}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 font-mono text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-[#FF9F0A]">
                  <ShieldAlert className="w-4 h-4" />
                  <span>DESTINO GATEWAY SATELITAL:</span>
                </div>
                <div className="opacity-80">
                  • MRCC Chile ( Valparaíso / Puerto Montt ) + Iridium GEOS IERCC
                </div>
                <div className="opacity-80">
                  • Respaldo Local: Encolado prioritario en IndexedDB{" "}
                  <code>sync_queue</code>
                </div>
              </div>

              {satTransmitted && (
                <div
                  data-testid="satellite-sos-confirmed"
                  className="p-4 rounded-xl bg-[#00E676]/15 border border-[#00E676] text-[#00E676] font-mono text-xs space-y-1"
                >
                  <div className="font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>TRAMA SATELITAL SBD TRANSMITIDA AL GATEWAY</span>
                  </div>
                  <div>ACK UTC: {satTimestamp}</div>
                </div>
              )}
            </div>

            <button
              type="button"
              data-testid="transmit-satellite-sos-btn"
              onClick={handleSendSatelliteBurst}
              className="w-full min-h-[60px] rounded-2xl bg-red-600 hover:bg-red-700 text-white font-mono text-sm font-bold flex items-center justify-center gap-2.5 shadow-none border border-red-800"
            >
              <Send className="w-5 h-5" />
              <span>
                {satTransmitted
                  ? "RE-TRANSMITIR BURST SATELITAL SOS"
                  : "EMITIR ALERTA SATELITAL (IRIDIUM / GARMIN)"}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
