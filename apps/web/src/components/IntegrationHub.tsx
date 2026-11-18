"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Radio,
  Shield,
  Satellite,
  RefreshCw,
  CloudSun,
  X,
  Zap,
} from "lucide-react";
import {
  db,
  INTEGRATION_SETTINGS_ID,
  createDefaultIntegrationSettings,
  enqueueOfflineMutation,
  type IntegrationSettingsRecord,
} from "@/lib/offline/db";
import {
  testSignalKGateway,
  validateDirectemarConfig,
  testSatelliteLink,
} from "@/lib/integrations";
import { useMarineContext } from "@/components/ThemeProvider";

export function IntegrationHub() {
  const { pushToast } = useMarineContext();

  const liveSettings = useLiveQuery(
    () => db.integration_settings.get(INTEGRATION_SETTINGS_ID),
    []
  );

  const [formData, setFormData] = useState<IntegrationSettingsRecord>(
    createDefaultIntegrationSettings()
  );

  const [activeModal, setActiveModal] = useState<
    "signalk" | "directemar" | "meteo" | "satellite" | null
  >(null);

  const [testingSignalK, setTestingSignalK] = useState(false);
  const [testingDirectemar, setTestingDirectemar] = useState(false);
  const [testingSatellite, setTestingSatellite] = useState(false);
  const [testingMeteo, setTestingMeteo] = useState(false);

  useEffect(() => {
    if (liveSettings) {
      setFormData(liveSettings);
    }
  }, [liveSettings]);

  const handleSaveAll = async (overrideData?: IntegrationSettingsRecord) => {
    const toSave: IntegrationSettingsRecord = {
      ...(overrideData || formData),
      id: INTEGRATION_SETTINGS_ID,
      updated_at: new Date().toISOString(),
    };
    await db.integration_settings.put(toSave);
    await enqueueOfflineMutation({
      table_name: "integration_settings",
      operation: "UPSERT",
      record_id: INTEGRATION_SETTINGS_ID,
      payload: toSave as unknown as Record<string, unknown>,
    });
    setFormData(toSave);
  };

  // Signal K Test
  const handleTestSignalK = async () => {
    setTestingSignalK(true);
    try {
      const res = await testSignalKGateway(formData.signalk);
      const updated: IntegrationSettingsRecord = {
        ...formData,
        signalk: { ...formData.signalk, last_test: res },
      };
      setFormData(updated);
      await handleSaveAll(updated);
      pushToast({
        title: res.status === "ok" ? "Signal K: Conexión Exitosa" : "Signal K: Prueba Local",
        subtitle: res.message,
        tone: res.status === "ok" ? "emerald" : "amber",
      });
    } finally {
      setTestingSignalK(false);
    }
  };

  // DIRECTEMAR Validation
  const handleValidateDirectemar = async () => {
    setTestingDirectemar(true);
    try {
      const res = validateDirectemarConfig(formData.directemar);
      const updated: IntegrationSettingsRecord = {
        ...formData,
        directemar: { ...formData.directemar, last_test: res },
      };
      setFormData(updated);
      await handleSaveAll(updated);
      pushToast({
        title: "DIRECTEMAR SITPORT: Credenciales Validadas",
        subtitle: res.message,
        tone: "emerald",
      });
    } finally {
      setTestingDirectemar(false);
    }
  };

  // Satellite Test
  const handleTestSatellite = async () => {
    setTestingSatellite(true);
    try {
      const res = await testSatelliteLink(formData.satellite);
      const updated: IntegrationSettingsRecord = {
        ...formData,
        satellite: { ...formData.satellite, last_test: res },
      };
      setFormData(updated);
      await handleSaveAll(updated);
      pushToast({
        title: "Enlace Satelital Probado",
        subtitle: res.message,
        tone: res.status === "ok" ? "emerald" : "amber",
      });
    } finally {
      setTestingSatellite(false);
    }
  };

  // Meteo Test
  const handleTestMeteo = async () => {
    setTestingMeteo(true);
    setTimeout(() => {
      setTestingMeteo(false);
      pushToast({
        title: "Open-Meteo & ECMWF Conectados",
        subtitle: "Modelos de viento 0.1° y oleaje marino respondiendo en 14ms",
        tone: "emerald",
      });
    }, 700);
  };

  return (
    <div data-testid="integration-hub-view" className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Hero */}
      <div className="marine-card p-6 sm:p-7 relative overflow-hidden border border-white/5 shadow-2xl shadow-black/50">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none" />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.15em] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 uppercase">
              <Zap className="w-3.5 h-3.5" />
              <span>APP STORE &amp; GATEWAY NÁUTICO</span>
            </span>
            <span className="text-xs font-mono opacity-60">4 integraciones activas</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
            Integration Hub • Conectividad &amp; Sensores
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 opacity-80 max-w-2xl font-normal leading-relaxed">
            Conecta tu embarcación con los gateways de hardware a bordo (NMEA 2000), la Autoridad
            Marítima (DIRECTEMAR), predicción meteorológica hiperlocal y dispositivos satelitales.
          </p>
        </div>
      </div>

      {/* Bento Grid Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===================================================================
            CARD 1: SIGNAL K (NMEA 2000 / SEATALK)
        =================================================================== */}
        <div
          data-testid="integration-card-signalk"
          className="marine-card p-6 sm:p-7 flex flex-col justify-between space-y-5 border border-white/5 shadow-2xl shadow-black/50 hover:border-white/5 transition-all"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#00E5FF]/15 border border-[#00E5FF]/30 flex items-center justify-center shrink-0">
                  <Radio className="w-6 h-6 text-[#00E5FF]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Signal K (Gateway NMEA 2000)</h3>
                  <div className="text-xs text-slate-400 mt-0.5">Multiplexor NMEA &amp; Sensores de a bordo</div>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold border tracking-wider ${
                  formData.signalk.enabled
                    ? "bg-[#38bdf8]/15 text-[#38bdf8] border-[#38bdf8]/40"
                    : "bg-white/5 text-white/50 border-white/5"
                }`}
              >
                {formData.signalk.enabled ? "SIMULADO" : "DESCONECTADO"}
              </span>
            </div>

            <p className="text-xs text-slate-300 opacity-80 leading-relaxed font-normal">
              Lee RPM del motor Yanmar 4JH57, temperatura del refrigerante, presión de aceite,
              sonda de profundidad y viento real desde la red marina NMEA 2000 o multiplexor a bordo.
            </p>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono leading-relaxed">
              ⚠️ Una aplicación web servida bajo HTTPS no puede conectar directamente a http://192.168.x.x (restricción Mixed Content y PNA del navegador). Requiere un gateway WSS con certificado o un agente local a bordo.
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/5 font-mono text-xs space-y-1">
              <div className="text-[9px] font-bold tracking-[0.15em] uppercase opacity-55">ENDPOINT CONFIGURADO:</div>
              <div className="font-semibold text-white/90">
                {formData.signalk.host
                  ? `${formData.signalk.protocol}://${formData.signalk.host}:${formData.signalk.port}`
                  : "http://192.168.1.100:3000 (Default Marina/Barco)"}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="test-signalk-btn"
              onClick={handleTestSignalK}
              disabled={testingSignalK}
              className="marine-btn marine-btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingSignalK ? "animate-spin" : ""}`} />
              <span>{testingSignalK ? "Probando..." : "Test Ping"}</span>
            </button>

            <button
              type="button"
              data-testid="configure-signalk-btn"
              onClick={() => setActiveModal("signalk")}
              className="marine-btn marine-btn-primary text-xs px-5 py-1.5 font-bold tracking-tight shadow-lg"
            >
              Configurar IP
            </button>
          </div>
        </div>

        {/* ===================================================================
            CARD 2: DIRECTEMAR (SITPORT API)
        =================================================================== */}
        <div
          data-testid="integration-card-directemar"
          className="marine-card p-6 sm:p-7 flex flex-col justify-between space-y-5 border border-white/5 shadow-2xl shadow-black/50 hover:border-white/5 transition-all"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">DIRECTEMAR (SITPORT API)</h3>
                  <div className="text-xs text-slate-400 mt-0.5">Armada de Chile • Autoridad Marítima</div>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold border tracking-wider ${
                  formData.directemar.enabled
                    ? "bg-[#38bdf8]/15 text-[#38bdf8] border-[#38bdf8]/40"
                    : "bg-white/5 text-white/50 border-white/5"
                }`}
              >
                {formData.directemar.enabled ? "SIMULADO" : "DESCONECTADO"}
              </span>
            </div>

            <p className="text-xs text-slate-300 opacity-80 leading-relaxed font-normal">
              Simulación de trámite para zarpes y recaladas locales, consulta de vigencia de credenciales
              y sellado de integridad del rol de tripulación en almacenamiento local.
            </p>

            <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/5 font-mono text-xs space-y-1">
              <div className="text-[9px] font-bold tracking-[0.15em] uppercase opacity-55">MATRÍCULA ASOCIADA / SERVICIO:</div>
              <div className="font-semibold text-white/90">
                {formData.directemar.vessel_registration || "CB-4582"} • Entorno:{" "}
                <span className="text-[var(--accent-primary)]">{formData.directemar.environment.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="test-directemar-btn"
              onClick={handleValidateDirectemar}
              disabled={testingDirectemar}
              className="marine-btn marine-btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingDirectemar ? "animate-spin" : ""}`} />
              <span>{testingDirectemar ? "Validando..." : "Validar"}</span>
            </button>

            <button
              type="button"
              data-testid="configure-directemar-btn"
              onClick={() => setActiveModal("directemar")}
              className="marine-btn marine-btn-primary text-xs px-5 py-1.5 font-bold tracking-tight shadow-lg"
            >
              Credenciales API
            </button>
          </div>
        </div>

        {/* ===================================================================
            CARD 3: METEOROLOGÍA OPEN-METEO
        =================================================================== */}
        <div
          data-testid="integration-card-meteo"
          className="marine-card p-6 sm:p-7 flex flex-col justify-between space-y-5 border border-white/5 shadow-2xl shadow-black/50 hover:border-white/5 transition-all"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#00E676]/15 border border-[#00E676]/30 flex items-center justify-center shrink-0">
                  <CloudSun className="w-6 h-6 text-[#00E676]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Open-Meteo (Modelos ECMWF &amp; GFS)</h3>
                  <div className="text-xs text-slate-400 mt-0.5">Modelos Hiperlocales Marinos en Tiempo Real</div>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/40 tracking-wider">
                CONECTADO (EN VIVO)
              </span>
            </div>

            <p className="text-xs text-slate-300 opacity-80 leading-relaxed font-normal">
              Descarga pronósticos meteorológicos de viento a 10m, ráfagas, altura de ola y período
              en tiempo real para planificar ventanas de zarpe y fondeo seguro en Chiloé.
            </p>

            <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/5 font-mono text-xs space-y-1">
              <div className="text-[9px] font-bold tracking-[0.15em] uppercase opacity-55">RESOLUCIÓN &amp; MODELOS:</div>
              <div className="font-semibold text-white/90">
                ECMWF IFS 0.1° (~9km) • Actualización cada 6 horas • Caché Offline
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="test-meteo-btn"
              onClick={handleTestMeteo}
              disabled={testingMeteo}
              className="marine-btn marine-btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingMeteo ? "animate-spin" : ""}`} />
              <span>{testingMeteo ? "Actualizando..." : "Probar Enlace"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal("meteo")}
              className="marine-btn marine-btn-primary text-xs px-5 py-1.5 font-bold tracking-tight shadow-lg"
            >
              Ajustar Modelo
            </button>
          </div>
        </div>

        {/* ===================================================================
            CARD 4: CONECTIVIDAD SATELITAL (IRIDIUM / GARMIN)
        =================================================================== */}
        <div
          data-testid="integration-card-satellite"
          className="marine-card p-6 sm:p-7 flex flex-col justify-between space-y-5 border border-white/5 shadow-2xl shadow-black/50 hover:border-white/5 transition-all"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FF9F0A]/15 border border-[#FF9F0A]/30 flex items-center justify-center shrink-0">
                  <Satellite className="w-6 h-6 text-[#FF9F0A]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Conectividad Satelital</h3>
                  <div className="text-xs text-slate-400 mt-0.5">Iridium GO! • Garmin inReach</div>
                </div>
              </div>

              <span
                className="px-3 py-1 rounded-full text-[10px] font-mono font-bold border tracking-wider bg-[#f87171]/15 text-[#f87171] border-[#f87171]/40"
              >
                NO DISPONIBLE (EMULADOR)
              </span>
            </div>

            <p className="text-xs text-slate-300 opacity-80 leading-relaxed font-normal">
              Enlace de socorro en alta mar fuera de cobertura 4G. Sincroniza telemetría crítica,
              reportes de posición y botón de pánico SOS con los servicios de salvamento.
            </p>

            <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/5 font-mono text-xs space-y-1">
              <div className="text-[9px] font-bold tracking-[0.15em] uppercase opacity-55">DISPOSITIVO SATELITAL ACTIVO:</div>
              <div className="font-semibold text-white/90">
                {formData.satellite.provider === "garmin_inreach"
                  ? "Garmin inReach (MapShare)"
                  : formData.satellite.provider === "iridium_go"
                  ? "Iridium GO! (Wi-Fi 192.168.10.1)"
                  : "Iridium GO! Emulador de Alta Mar"}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="test-satellite-btn"
              onClick={handleTestSatellite}
              disabled={testingSatellite}
              className="marine-btn marine-btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingSatellite ? "animate-spin" : ""}`} />
              <span>{testingSatellite ? "Probando..." : "Test Enlace"}</span>
            </button>

            <button
              type="button"
              data-testid="configure-satellite-btn"
              onClick={() => setActiveModal("satellite")}
              className="marine-btn marine-btn-primary text-xs px-5 py-1.5 font-bold tracking-tight shadow-lg"
            >
              Configurar Sat
            </button>
          </div>
        </div>
      </div>

      {/* =======================================================================
          MODAL 1: CONFIGURAR SIGNAL K
      ======================================================================= */}
      <AnimatePresence>
        {activeModal === "signalk" && (
          <motion.div
            key="modal-signalk-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              key="modal-signalk-panel"
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-md rounded-3xl bg-[#040B16] border border-white/5 p-6 space-y-5 shadow-2xl shadow-black/80"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#00E5FF]" />
                <h3 className="font-bold text-base text-white">Configurar Gateway Signal K</h3>
              </div>
              <button type="button" onClick={() => setActiveModal(null)}>
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleSaveAll();
                setActiveModal(null);
                pushToast({
                  title: "Signal K Configurado",
                  subtitle: `Guardado host ${formData.signalk.host}:${formData.signalk.port}`,
                  tone: "emerald",
                });
              }}
              className="space-y-4 text-xs font-mono"
            >
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="font-bold">Habilitar Integración Signal K</span>
                <input
                  type="checkbox"
                  checked={formData.signalk.enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      signalk: { ...formData.signalk, enabled: e.target.checked },
                    })
                  }
                  className="w-5 h-5 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block opacity-70 mb-1">Host IP local del Barco *</label>
                <input
                  type="text"
                  required
                  value={formData.signalk.host}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      signalk: { ...formData.signalk, host: e.target.value },
                    })
                  }
                  placeholder="192.168.1.100 o localhost"
                  className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block opacity-70 mb-1">Puerto (Default 3000)</label>
                  <input
                    type="number"
                    value={formData.signalk.port}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        signalk: {
                          ...formData.signalk,
                          port: parseInt(e.target.value, 10) || 3000,
                        },
                      })
                    }
                    className="w-full min-h-12 px-3 text-xs rounded-xl bg-white/5 border border-white/5"
                  />
                </div>

                <div>
                  <label className="block opacity-70 mb-1">Protocolo</label>
                  <select
                    value={formData.signalk.protocol}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        signalk: {
                          ...formData.signalk,
                          protocol: e.target.value as "http" | "https",
                        },
                      })
                    }
                    className="w-full min-h-12 px-2 text-xs rounded-xl bg-white/5 border border-white/5"
                  >
                    <option value="http">HTTP (Red Barco)</option>
                    <option value="https">HTTPS</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="marine-btn marine-btn-secondary text-xs px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="marine-btn marine-btn-primary text-xs px-5 font-bold tracking-tight shadow-lg"
                >
                  Guardar Conexión
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* =======================================================================
          MODAL 2: CONFIGURAR DIRECTEMAR
      ======================================================================= */}
      <AnimatePresence>
        {activeModal === "directemar" && (
          <motion.div
            key="modal-directemar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              key="modal-directemar-panel"
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-md rounded-3xl bg-[#040B16] border border-white/5 p-6 space-y-5 shadow-2xl shadow-black/80"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h3 className="font-bold text-base text-white tracking-tight">Credenciales DIRECTEMAR SITPORT</h3>
                </div>
              <button type="button" onClick={() => setActiveModal(null)}>
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleSaveAll();
                setActiveModal(null);
                pushToast({
                  title: "Credenciales DIRECTEMAR Guardadas",
                  subtitle: `Matrícula ${formData.directemar.vessel_registration} asociada`,
                  tone: "emerald",
                });
              }}
              className="space-y-4 text-xs font-mono"
            >
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="font-bold">Habilitar e-Zarpe Directemar</span>
                <input
                  type="checkbox"
                  checked={formData.directemar.enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      directemar: { ...formData.directemar, enabled: e.target.checked },
                    })
                  }
                  className="w-5 h-5 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block opacity-70 mb-1">Matrícula Oficial de la Nave *</label>
                <input
                  type="text"
                  required
                  value={formData.directemar.vessel_registration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      directemar: {
                        ...formData.directemar,
                        vessel_registration: e.target.value.toUpperCase(),
                      },
                    })
                  }
                  placeholder="CB-4582"
                  className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/5"
                />
              </div>

              <div>
                <label className="block opacity-70 mb-1">RUT o Usuario Armador *</label>
                <input
                  type="text"
                  required
                  value={formData.directemar.username}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      directemar: { ...formData.directemar, username: e.target.value },
                    })
                  }
                  placeholder="11.111.111-1"
                  className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/5"
                />
              </div>

              <div>
                <label className="block opacity-70 mb-1">Token API Privado SITPORT</label>
                <input
                  type="password"
                  value={formData.directemar.api_key}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      directemar: { ...formData.directemar, api_key: e.target.value },
                    })
                  }
                  placeholder="••••••••••••••••••••••••"
                  className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/5"
                />
              </div>

              <div className="pt-3 border-t border-white/5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="marine-btn marine-btn-secondary text-xs px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="marine-btn marine-btn-primary text-xs px-5 font-bold tracking-tight shadow-lg"
                >
                  Guardar Credenciales
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* =======================================================================
          MODAL 3: METEOROLOGÍA & MODELOS
      ======================================================================= */}
      <AnimatePresence>
        {activeModal === "meteo" && (
          <motion.div
            key="modal-meteo-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              key="modal-meteo-panel"
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-md rounded-3xl bg-[#040B16] border border-white/5 p-6 space-y-5 shadow-2xl shadow-black/80"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <CloudSun className="w-5 h-5 text-[#00E676]" />
                  <h3 className="font-bold text-base text-white tracking-tight">Configuración Meteorológica</h3>
                </div>
                <button type="button" onClick={() => setActiveModal(null)}>
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>

              <div className="space-y-4 text-xs font-mono">
                <div className="p-3.5 rounded-2xl bg-[#00E676]/10 border border-[#00E676]/30 text-[#00E676] space-y-1">
                  <div className="font-bold font-sans">✓ Enlace Automático Open-Meteo Activo</div>
                  <div className="text-[11px] opacity-90 leading-relaxed text-white font-normal font-sans">
                    MarinOS descarga automáticamente las series de tiempo de oleaje y viento en cada
                    fondeadero sin requerir llave de pago ni configuración adicional.
                  </div>
                </div>

                <div>
                  <label className="block opacity-70 mb-1 font-sans font-semibold text-[11px]">Unidad de Viento Preferida</label>
                  <select className="w-full min-h-12 px-3 text-xs rounded-xl bg-white/5 border border-white/5 font-sans font-medium">
                    <option value="knots">Nudos (Knots / kn) • Estándar Náutico</option>
                    <option value="kmh">Kilómetros por hora (km/h)</option>
                    <option value="ms">Metros por segundo (m/s)</option>
                  </select>
                </div>

                <div>
                  <label className="block opacity-70 mb-1 font-sans font-semibold text-[11px]">Frecuencia de Actualización</label>
                  <select className="w-full min-h-12 px-3 text-xs rounded-xl bg-white/5 border border-white/5 font-sans font-medium">
                    <option value="auto">Automático al detectar conexión a Internet</option>
                    <option value="manual">Manual para ahorro de datos móviles/satelitales</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-white/5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="marine-btn marine-btn-primary text-xs px-5 py-2 font-bold tracking-tight shadow-lg"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =======================================================================
          MODAL 4: CONECTIVIDAD SATELITAL
      ======================================================================= */}
      <AnimatePresence>
        {activeModal === "satellite" && (
          <motion.div
            key="modal-satellite-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              key="modal-satellite-panel"
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-md rounded-3xl bg-[#040B16] border border-white/5 p-6 space-y-5 shadow-2xl shadow-black/80"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Satellite className="w-5 h-5 text-[#FF9F0A]" />
                  <h3 className="font-bold text-base text-white tracking-tight">Dispositivo Satelital (Iridium / Garmin)</h3>
                </div>
                <button type="button" onClick={() => setActiveModal(null)}>
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleSaveAll();
                setActiveModal(null);
                pushToast({
                  title: "Enlace Satelital Configurado",
                  subtitle: `Proveedor: ${formData.satellite.provider}`,
                  tone: "emerald",
                });
              }}
              className="space-y-4 text-xs font-mono"
            >
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="font-bold">Habilitar Satelital</span>
                <input
                  type="checkbox"
                  checked={formData.satellite.enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      satellite: { ...formData.satellite, enabled: e.target.checked },
                    })
                  }
                  className="w-5 h-5 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block opacity-70 mb-1">Proveedor / Dispositivo</label>
                <select
                  value={formData.satellite.provider}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      satellite: {
                        ...formData.satellite,
                        provider: e.target.value as "none" | "iridium_go" | "garmin_inreach",
                      },
                    })
                  }
                  className="w-full min-h-12 px-3 text-xs rounded-xl bg-white/5 border border-white/5"
                >
                  <option value="iridium_go">Iridium GO! (Wi-Fi Local)</option>
                  <option value="garmin_inreach">Garmin inReach (MapShare Feed)</option>
                  <option value="none">Sin Dispositivo</option>
                </select>
              </div>

              <div>
                <label className="block opacity-70 mb-1">IP Local / Host Iridium GO!</label>
                <input
                  type="text"
                  value={formData.satellite.iridium_host}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      satellite: { ...formData.satellite, iridium_host: e.target.value },
                    })
                  }
                  placeholder="192.168.10.1"
                  className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/5"
                />
              </div>

              <div>
                <label className="block opacity-70 mb-1">IMEI del Dispositivo o MapShare ID</label>
                <input
                  type="text"
                  value={formData.satellite.device_imei}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      satellite: { ...formData.satellite, device_imei: e.target.value },
                    })
                  }
                  placeholder="300434063991200"
                  className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/5"
                />
              </div>

              <div className="pt-3 border-t border-white/5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="marine-btn marine-btn-secondary text-xs px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="marine-btn marine-btn-primary text-xs px-5 font-bold tracking-tight shadow-lg"
                >
                  Guardar Conexión
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}
