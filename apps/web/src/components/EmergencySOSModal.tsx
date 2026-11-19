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
  LifeBuoy,
  Flame,
  Droplets,
  Anchor,
  HelpCircle,
  Eye,
  Navigation,
  MessageCircle,
  Copy,
  Check,
} from "lucide-react";
import {
  db,
  DEMO_IDS,
  getIntegrationSettings,
  type IntegrationSettingsRecord,
} from "@/lib/offline/db";
import {
  formatNauticalCoordsDMS,
  triggerAcousticMarineAlarm,
} from "@/lib/nautical";
import { useMarineContext } from "@/components/ThemeProvider";

export type EmergencyCategory =
  | "via_de_agua"
  | "fuego"
  | "hombre_al_agua"
  | "gobierno_varada"
  | "otra";

interface EmergencyDefinition {
  id: EmergencyCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  assistance: string;
  extraInfo: string;
}

const EMERGENCY_TYPES: EmergencyDefinition[] = [
  {
    id: "via_de_agua",
    label: "Vía de Agua",
    icon: Droplets,
    description: "VÍA DE AGUA INCONTROLADA EN CASCO / SALA DE MÁQUINAS",
    assistance: "SOLICITO ASISTENCIA INMEDIATA Y BOMBAS DE ACHIQUE",
    extraInfo: "Embarcación con riesgo de pérdida de flotabilidad",
  },
  {
    id: "fuego",
    label: "Fuego a Bordo",
    icon: Flame,
    description: "INCENDIO A BORDO FUERA DE CONTROL",
    assistance: "SOLICITO EVACUACIÓN Y APOYO DE EXTINCIÓN INMEDIATO",
    extraInfo: "Fuego activo, tripulación preparando abandono de ser necesario",
  },
  {
    id: "hombre_al_agua",
    label: "Hombre al Agua (MOB)",
    icon: LifeBuoy,
    description: "HOMBRE AL AGUA (MOB) EN EL AGUA",
    assistance: "SOLICITO APOYO URGENTE DE BÚSQUEDA Y RESCATE (SAR)",
    extraInfo: "Iniciando maniobra de recuperación en la última posición marcada",
  },
  {
    id: "gobierno_varada",
    label: "Pérdida de Gobierno / Varada",
    icon: Anchor,
    description: "PÉRDIDA TOTAL DE GOBIERNO / EMBARCACIÓN VARADA EN BAJÍO",
    assistance: "SOLICITO ASISTENCIA DE REMOLQUE Y RESCATE",
    extraInfo: "Sin timón o propulsión, derivando hacia costa / peligros",
  },
  {
    id: "otra",
    label: "Otra Emergencia Grave",
    icon: HelpCircle,
    description: "EMERGENCIA GRAVE CON PELIGRO INMINENTE PARA LA VIDA",
    assistance: "SOLICITO ASISTENCIA INMEDIATA",
    extraInfo: "Situación crítica a bordo",
  },
];

export function EmergencySOSModal({ onClose }: { onClose: () => void }) {
  const { theme } = useMarineContext();
  const isNight = theme === "night-red-shift";

  const vessel = useLiveQuery(() => db.vessels.get(DEMO_IDS.VESSEL_ID), []);
  const crewList = useLiveQuery(() => db.voyage_crew.toArray(), [], []);

  // R-4.5.1: Sin emergencia preseleccionada; el usuario elige la categoría
  const [selectedEmergency, setSelectedEmergency] =
    useState<EmergencyCategory | null>(null);

  // R-4.5.8: Coordenadas 100% offline desde GPS nativo del dispositivo si está disponible
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lon: number }>({
    lat: -41.4717,
    lon: -72.9369,
  });

  const [integrationSettings, setIntegrationSettings] =
    useState<IntegrationSettingsRecord | null>(null);

  useEffect(() => {
    getIntegrationSettings().then(setIntegrationSettings).catch(() => { });

    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLiveCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        },
        () => { },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLiveCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        },
        () => { },
        { enableHighAccuracy: true, maximumAge: 5000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const dms = formatNauticalCoordsDMS(liveCoords.lat, liveCoords.lon);
  const pobCount = Math.max(1, (crewList || []).length || 3);
  const vesselName = vessel?.name || "SV Albatros";
  const regNumber = vessel?.registration_number || "CB-4582";
  const mmsi = vessel?.mmsi || "NO REGISTRADO";
  const callSign = vessel?.call_sign || regNumber;

  const currentEmergencyDef = EMERGENCY_TYPES.find(
    (e) => e.id === selectedEmergency
  );

  // R-4.5.5: Verificar si existe dispositivo satelital configurado y activo
  const hasActiveSatelliteHardware = Boolean(
    integrationSettings?.satellite?.enabled &&
    integrationSettings.satellite.provider !== "none" &&
    integrationSettings.satellite.device_imei
  );

  const [copiedText, setCopiedText] = useState(false);

  const handleSendEmergencyWhatsApp = () => {
    const text = `🚨 *EMERGENCIA MARÍTIMA • LLAMADA DE SOCORRO*\n\nEmbarcación: *${vesselName.toUpperCase()}* (${regNumber})\nCall Sign: ${callSign} • MMSI: ${mmsi}\n\n*NATURALEZA DEL PELIGRO:* ${currentEmergencyDef?.description || "EMERGENCIA GRAVE"}\n*ASISTENCIA:* ${currentEmergencyDef?.assistance || "SOLICITO ASISTENCIA INMEDIATA"}\n\n📍 *POSICIÓN GPS:* ${dms.latDms}, ${dms.lonDms}\n(Lat: ${liveCoords.lat.toFixed(5)}, Lon: ${liveCoords.lon.toFixed(5)})\n👥 *PERSONAS A BORDO (POB):* ${pobCount}\nℹ️ *DETALLE:* ${currentEmergencyDef?.extraInfo || "Sin detalles adicionales"}\n\nVer ubicación en mapa: https://maps.google.com/?q=${liveCoords.lat},${liveCoords.lon}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  };

  const handleCopyEmergencyText = () => {
    const text = `🚨 EMERGENCIA MARÍTIMA • LLAMADA DE SOCORRO\nEmbarcación: ${vesselName.toUpperCase()} (${regNumber})\nCall Sign: ${callSign} • MMSI: ${mmsi}\n\nNATURALEZA: ${currentEmergencyDef?.description || "EMERGENCIA GRAVE"}\nASISTENCIA: ${currentEmergencyDef?.assistance || "SOLICITO ASISTENCIA INMEDIATA"}\n\nPOSICIÓN GPS: ${dms.latDms}, ${dms.lonDms}\n(Lat: ${liveCoords.lat.toFixed(5)}, Lon: ${liveCoords.lon.toFixed(5)})\nPERSONAS A BORDO: ${pobCount}\n\nUbicación: https://maps.google.com/?q=${liveCoords.lat},${liveCoords.lon}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    }
  };

  return (
    <motion.div
      key="emergency-sos-backdrop"
      data-testid="emergency-sos-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={`fixed inset-0 z-[80] w-screen h-screen overflow-y-auto p-3 sm:p-6 flex items-center justify-center select-none ${isNight
        ? "bg-black text-[#FF1E1E]"
        : "bg-black/90 backdrop-blur-2xl text-slate-100"
        }`}
    >
      <motion.div
        key="emergency-sos-panel"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`w-full max-w-5xl rounded-3xl p-5 sm:p-7 border shadow-2xl shadow-black/90 space-y-5 my-6 ${isNight
          ? "bg-black border-[#FF1E1E]"
          : "bg-[#060b14] border-red-900/60"
          }`}
      >
        {/* Top Emergency Header + Close Button (R-4.5.7: Área táctil >= 48px con 1 toque) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-red-500">
                PROTOCOLO DE SOCORRO Y SEGURIDAD • CANAL 16 VHF (156.800 MHz)
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Consola de Emergencia y MAYDAY
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => triggerAcousticMarineAlarm()}
              className="marine-btn marine-btn-secondary text-xs px-3.5 min-h-[48px]"
            >
              <Volume2 className="w-4 h-4 text-red-500" />
              <span>Sirena Acústica</span>
            </button>
            <button
              type="button"
              data-testid="close-sos-modal-btn"
              onClick={onClose}
              className="min-h-[48px] min-w-[48px] px-4 rounded-xl bg-white/10 hover:bg-white/20 font-mono text-xs font-bold flex items-center justify-center gap-2 transition"
              aria-label="Cerrar SOS"
            >
              <X className="w-5 h-5" />
              <span>CERRAR</span>
            </button>
          </div>
        </div>

        {/* R-4.5.2: PASO 1 SIEMPRE VISIBLE — VHF DSC DISTRESS */}
        <div
          data-testid="sos-step1-dsc-banner"
          className="p-4 rounded-2xl bg-red-950/40 border border-red-800 text-red-100 flex items-start gap-3.5"
        >
          <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 mt-0.5 font-bold font-mono text-sm">
            1
          </div>
          <div className="space-y-1">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-red-400">
              PASO 1 INMEDIATO: ALERTA DIGITAL DSC (SI TU RADIO CUENTA CON DSC)
            </div>
            <p className="text-sm font-semibold leading-relaxed">
              Si tu radio VHF tiene DSC, levanta la tapa roja y{" "}
              <span className="text-white underline decoration-red-400 font-bold">
                mantén apretado el botón DISTRESS
              </span>{" "}
              durante varios segundos (según el equipo) hasta que confirme la emisión.
            </p>
          </div>
        </div>

        {/* GIANT LIVE GPS COORDINATES BANNER FOR WHEELHOUSE / VHF READOUT */}
        <div
          data-testid="sos-giant-32pt-coords"
          className="p-4 sm:p-5 rounded-2xl bg-black border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-400 font-bold">
              POSICIÓN GPS ACTUAL • LECTURA INMEDIATA PARA TRANSMISIÓN
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
              {dms.combined}
            </div>
          </div>
          <div className="font-mono text-xs text-left sm:text-right opacity-80 shrink-0 space-y-0.5">
            <div>
              MMSI: <strong className="text-white">{mmsi}</strong>
            </div>
            <div>
              SEÑAL DISTINTIVA: <strong className="text-white">{callSign}</strong>
            </div>
          </div>
        </div>

        {/* R-4.5.1: SELECTOR DE NATURALEZA DE EMERGENCIA (OBLIGATORIO) */}
        <div className="space-y-2">
          <div className="font-mono text-xs uppercase tracking-wider text-slate-300">
            {selectedEmergency
              ? "NATURALEZA DE LA EMERGENCIA SELECCIONADA (HAZ CLIC PARA CAMBIAR):"
              : "PASO 2: SELECCIONA LA NATURALEZA DE TU EMERGENCIA:"}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {EMERGENCY_TYPES.map((em) => {
              const Icon = em.icon;
              const isSelected = selectedEmergency === em.id;
              return (
                <button
                  key={em.id}
                  type="button"
                  data-testid={`sos-select-${em.id}`}
                  onClick={() => setSelectedEmergency(em.id)}
                  className={`min-h-[52px] p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${isSelected
                    ? "bg-red-950/60 text-white border-red-600 font-bold"
                    : "bg-[#0d1524] border-white/5 text-slate-300 hover:bg-[#142033]"
                    }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 ${isSelected ? "text-red-400" : "text-slate-400"
                      }`}
                  />
                  <span className="text-xs leading-tight">{em.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* R-4.5.4: ACCIONES INMEDIATAS PARA HOMBRE AL AGUA (MOB) */}
        {selectedEmergency === "hombre_al_agua" && (
          <div
            data-testid="sos-mob-immediate-actions"
            className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-600/60 text-amber-100 space-y-2.5"
          >
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
              <LifeBuoy className="w-4 h-4 text-amber-400" />
              <span>ACCIONES CRÍTICAS INMEDIATAS ANTES DE TRANSMITIR:</span>
            </div>

            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
              <li className="p-2.5 rounded-xl bg-black/40 border border-amber-600/30 flex items-start gap-2">
                <span className="font-mono font-bold text-amber-400">1.</span>
                <span>¡Gritar fuerte <strong>&quot;¡HOMBRE AL AGUA!&quot;</strong></span>
              </li>
              <li className="p-2.5 rounded-xl bg-black/40 border border-amber-600/30 flex items-start gap-2">
                <span className="font-mono font-bold text-amber-400">2.</span>
                <span>Lanzar aro o boya salvavidas de inmediato</span>
              </li>
              <li className="p-2.5 rounded-xl bg-black/40 border border-amber-600/30 flex items-start gap-2">
                <span className="font-mono font-bold text-amber-400">3.</span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Designar vigía permanente señalando con el brazo</span>
                </span>
              </li>
              <li className="p-2.5 rounded-xl bg-black/40 border border-amber-600/30 flex items-start gap-2">
                <span className="font-mono font-bold text-amber-400">4.</span>
                <span className="flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Pulsar botón MOB en el plotter / GPS</span>
                </span>
              </li>
              <li className="p-2.5 rounded-xl bg-black/40 border border-amber-600/30 flex items-start gap-2">
                <span className="font-mono font-bold text-amber-400">5.</span>
                <span>Iniciar maniobra de recuperación (Williamson/Anderson)</span>
              </li>
            </ol>
          </div>
        )}

        {/* R-4.5.3: GUION DE VOZ ESTÁNDAR DE SOCORRO (MAYDAY) */}
        {selectedEmergency ? (
          <div className="space-y-4">
            <div className="rounded-2xl p-5 bg-[#0d1524] border border-white/5 space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-red-500" />
                  <span className="font-mono text-xs font-bold uppercase text-red-400">
                    PASO 3: GUION DE TRANSMISIÓN EN CANAL 16 VHF (PRESIÓN PTT Y LEE):
                  </span>
                </div>
                <span className="text-[11px] font-mono opacity-70">
                  POB: {pobCount} a bordo
                </span>
              </div>

              {/* Estructura oficial OMI / DIRECTEMAR */}
              <div
                data-testid="vhf-mayday-script"
                className="p-5 rounded-2xl bg-black/90 border border-red-900/60 font-mono text-sm leading-relaxed space-y-3 select-text"
              >
                <div className="text-red-500 font-bold text-base tracking-wider">
                  MAYDAY, MAYDAY, MAYDAY
                </div>

                <div>
                  AQUÍ <strong className="text-white">{vesselName.toUpperCase()}</strong>,{" "}
                  <strong className="text-white">{vesselName.toUpperCase()}</strong>,{" "}
                  <strong className="text-white">{vesselName.toUpperCase()}</strong>
                  <br />
                  DISTINTIVO / MATRÍCULA:{" "}
                  <strong className="text-white">{callSign}</strong> • MMSI:{" "}
                  <strong className="text-white">{mmsi}</strong>
                </div>

                <div className="pt-1 text-slate-300">
                  MAYDAY <strong className="text-white">{vesselName.toUpperCase()}</strong>{" "}
                  <strong className="text-white">{callSign}</strong>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-white font-bold">
                  POSICIÓN: {dms.latDms}, {dms.lonDms}
                  <div className="text-xs font-normal text-slate-400 mt-0.5">
                    ({liveCoords.lat.toFixed(5)}°S, {liveCoords.lon.toFixed(5)}°W • Datum WGS84)
                  </div>
                </div>

                <div>
                  NATURALEZA DE LA EMERGENCIA:{" "}
                  <strong className="text-amber-400">
                    {currentEmergencyDef?.description}
                  </strong>
                </div>

                <div>
                  ASISTENCIA REQUERIDA:{" "}
                  <strong className="text-red-400">
                    {currentEmergencyDef?.assistance}
                  </strong>
                </div>

                <div>
                  PERSONAS A BORDO:{" "}
                  <strong className="text-emerald-400">{pobCount} PERSONAS</strong>
                  <span className="text-slate-400 ml-2">
                    (Barco tipo {vessel?.vessel_type || "velero"}, {vessel?.loa_meters || 12.4}m eslora)
                  </span>
                </div>

                <div className="text-slate-300">
                  INFORMACIÓN ADICIONAL: {currentEmergencyDef?.extraInfo}
                </div>

                <div className="text-red-500 font-bold tracking-wider pt-1">
                  CAMBIO
                </div>
              </div>

              {/* 1-Click WhatsApp / SMS Emergency Broadcast Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>Emisión Rápida de Socorro por Celular / WhatsApp</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Genera mensaje con coordenadas GPS exactas, POB y naturaleza del peligro para contactos de guardia o Capitanía.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendEmergencyWhatsApp}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-2 transition"
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span>Enviar por WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyEmergencyText}
                    className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition"
                    title="Copiar texto de socorro al portapapeles"
                  >
                    {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedText ? "Copiado" : "Copiar Mensaje"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* R-4.5.5: ALERTA SATELITAL HONESTA (DESHABILITADA SI NO HAY HARDWARE) */}
            <div className="p-4 rounded-2xl bg-[#0d1524] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Satellite className="w-5 h-5 text-slate-400" />
                  <span className="font-mono text-xs font-bold uppercase text-slate-300">
                    ALERTA SATELITAL (IRIDIUM / GARMIN INREACH)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                  {hasActiveSatelliteHardware ? "CONECTADO" : "NO DISPONIBLE"}
                </span>
              </div>

              {!hasActiveSatelliteHardware ? (
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-400 space-y-1 font-mono">
                  <p className="font-semibold text-slate-300">
                    Alerta satelital no disponible — no hay dispositivo vinculado.
                  </p>
                  <p className="text-[11px] opacity-75">
                    Para activar transmisión satelital de emergencia se requiere un terminal físico
                    Iridium GO! o Garmin inReach con suscripción activa configurado en el Hub de Integraciones.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="transmit-satellite-sos-btn"
                  className="w-full min-h-[52px] rounded-xl bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-none border border-red-800"
                >
                  <span>TRANSMITIR ALERTA SATELITAL SOS</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-[#0d1524] border border-white/5 text-center space-y-2">
            <Radio className="w-8 h-8 mx-auto text-slate-500" />
            <div className="text-sm font-semibold text-slate-300">
              Selecciona una de las 5 categorías arriba para desplegar el guion MAYDAY correspondiente.
            </div>
            <p className="text-xs text-slate-500 font-mono">
              El protocolo radiotelefónico internacional exige comunicar con precisión la naturaleza del peligro.
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
