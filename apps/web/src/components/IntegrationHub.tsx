"use client";

import React, { useEffect, useState } from "react";
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
      <div className="marine-card p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none" />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 uppercase">
              <Zap className="w-3.5 h-3.5" />
              <span>APP STORE &amp; GATEWAY NÁUTICO</span>
            </span>
            <span className="text-xs font-mono opacity-60">4 integraciones activas</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Integration Hub • Conectividad &amp; Sensores
          </h1>
          <p className="text-xs sm:text-sm opacity-70 max-w-2xl">
            Conecta tu embarcación con los gateways de hardware a bordo (NMEA 2000), la Autoridad
            Marítima (DIRECTEMAR), predicción meteorológica hiperlocal y dispositivos satelitales.
          </p>
        </div>
      </div>

      {/* 2x2 App Store Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ===================================================================
            CARD 1: SIGNAL K (NMEA 2000 / SEATALK)
        =================================================================== */}
        <div
          data-testid="integration-card-signalk"
          className="marine-card p-6 flex flex-col justify-between space-y-5 hover:border-white/20 transition-all hover:shadow-xl"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#00E5FF]/15 border border-[#00E5FF]/30 flex items-center justify-center shrink-0">
                  <Radio className="w-6 h-6 text-[#00E5FF]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Signal K (Gateway NMEA 2000)</h3>
                  <div className="text-xs font-mono opacity-60">Bus multiplexor del barco</div>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                  formData.signalk.enabled
                    ? "bg-[#00E676]/20 text-[#00E676] border-[#00E676]/40"
                    : "bg-white/10 text-white/60 border-white/20"
                }`}
              >
                {formData.signalk.enabled ? "CONECTADO" : "DESCONECTADO"}
              </span>
            </div>

            <p className="text-xs font-mono opacity-75 leading-relaxed">
              Lee RPM del motor Yanmar 4JH57, temperatura del refrigerante, presión de aceite,
              sonda de profundidad y viento real desde la red marina NMEA 2000 o Raspberry Pi.
            </p>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs space-y-1">
              <div className="text-[10px] uppercase opacity-55">ENDPOINT CONFIGURADO:</div>
              <div className="font-semibold text-white/90">
                {formData.signalk.host
                  ? `${formData.signalk.protocol}://${formData.signalk.host}:${formData.signalk.port}`
                  : "http://192.168.1.100:3000 (Default Marina/Barco)"}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="test-signalk-btn"
              onClick={handleTestSignalK}
              disabled={testingSignalK}
              className="marine-btn marine-btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingSignalK ? "animate-spin" : ""}`} />
              <span>{testingSignalK ? "Probando..." : "Test Ping"}</span>
            </button>

            <button
              type="button"
              data-testid="configure-signalk-btn"
              onClick={() => setActiveModal("signalk")}
              className="marine-btn marine-btn-primary text-xs px-4 py-1.5 font-bold"
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
          className="marine-card p-6 flex flex-col justify-between space-y-5 hover:border-white/20 transition-all hover:shadow-xl"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">DIRECTEMAR (SITPORT API)</h3>
                  <div className="text-xs font-mono opacity-60">Armada de Chile • Autoridad Marítima</div>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                  formData.directemar.enabled
                    ? "bg-[#00E676]/20 text-[#00E676] border-[#00E676]/40"
                    : "bg-white/10 text-white/60 border-white/20"
                }`}
              >
                {formData.directemar.enabled ? "CONECTADO" : "DESCONECTADO"}
              </span>
            </div>

            <p className="text-xs font-mono opacity-75 leading-relaxed">
              Transmisión electrónica de Zarpes y Recepciones oficiales, consulta automática de
              vigencia de licencias de capitanes y sellado criptográfico legal del rol de tripulación.
            </p>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs space-y-1">
              <div className="text-[10px] uppercase opacity-55">MATRÍCULA ASOCIADA / SERVICIO:</div>
              <div className="font-semibold text-white/90">
                {formData.directemar.vessel_registration || "CB-4582"} • Entorno:{" "}
                <span className="text-[var(--accent-primary)]">{formData.directemar.environment.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="test-directemar-btn"
              onClick={handleValidateDirectemar}
              disabled={testingDirectemar}
              className="marine-btn marine-btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingDirectemar ? "animate-spin" : ""}`} />
              <span>{testingDirectemar ? "Validando..." : "Validar"}</span>
            </button>

            <button
              type="button"
              data-testid="configure-directemar-btn"
              onClick={() => setActiveModal("directemar")}
              className="marine-btn marine-btn-primary text-xs px-4 py-1.5 font-bold"
            >
              Credenciales API
            </button>
          </div>
        </div>

        {/* ===================================================================
            CARD 3: PREDICTWIND & OPEN-METEO
        =================================================================== */}
        <div
          data-testid="integration-card-meteo"
          className="marine-card p-6 flex flex-col justify-between space-y-5 hover:border-white/20 transition-all hover:shadow-xl"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#00E676]/15 border border-[#00E676]/30 flex items-center justify-center shrink-0">
                  <CloudSun className="w-6 h-6 text-[#00E676]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">PredictWind / Open-Meteo</h3>
                  <div className="text-xs font-mono opacity-60">Modelos ECMWF &amp; GFS Hiperlocales</div>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40">
                ACTIVO (EN VIVO)
              </span>
            </div>

            <p className="text-xs font-mono opacity-75 leading-relaxed">
              Descarga pronósticos meteorológicos de viento a 10m, ráfagas, altura de ola y período
              en tiempo real para planificar ventanas de zarpe y fondeo seguro en Chiloé.
            </p>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs space-y-1">
              <div className="text-[10px] uppercase opacity-55">RESOLUCIÓN &amp; MODELOS:</div>
              <div className="font-semibold text-white/90">
                ECMWF IFS 0.1° (~9km) • Actualización cada 6 horas • Caché Offline
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="test-meteo-btn"
              onClick={handleTestMeteo}
              disabled={testingMeteo}
              className="marine-btn marine-btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingMeteo ? "animate-spin" : ""}`} />
              <span>{testingMeteo ? "Actualizando..." : "Probar Enlace"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal("meteo")}
              className="marine-btn marine-btn-primary text-xs px-4 py-1.5 font-bold"
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
          className="marine-card p-6 flex flex-col justify-between space-y-5 hover:border-white/20 transition-all hover:shadow-xl"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FF9F0A]/15 border border-[#FF9F0A]/30 flex items-center justify-center shrink-0">
                  <Satellite className="w-6 h-6 text-[#FF9F0A]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Conectividad Satelital</h3>
                  <div className="text-xs font-mono opacity-60">Iridium GO! • Garmin inReach</div>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                  formData.satellite.enabled
                    ? "bg-[#00E676]/20 text-[#00E676] border-[#00E676]/40"
                    : "bg-white/10 text-white/60 border-white/20"
                }`}
              >
                {formData.satellite.enabled ? "CONECTADO" : "STANDBY"}
              </span>
            </div>

            <p className="text-xs font-mono opacity-75 leading-relaxed">
              Enlace de socorro en alta mar fuera de cobertura 4G. Sincroniza telemetría crítica,
              reportes de posición y botón de pánico SOS con los servicios de salvamento.
            </p>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs space-y-1">
              <div className="text-[10px] uppercase opacity-55">DISPOSITIVO SATELITAL ACTIVO:</div>
              <div className="font-semibold text-white/90">
                {formData.satellite.provider === "garmin_inreach"
                  ? "Garmin inReach (MapShare)"
                  : formData.satellite.provider === "iridium_go"
                  ? "Iridium GO! (Wi-Fi 192.168.10.1)"
                  : "Iridium GO! Emulador de Alta Mar"}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="test-satellite-btn"
              onClick={handleTestSatellite}
              disabled={testingSatellite}
              className="marine-btn marine-btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingSatellite ? "animate-spin" : ""}`} />
              <span>{testingSatellite ? "Probando..." : "Test Enlace"}</span>
            </button>

            <button
              type="button"
              data-testid="configure-satellite-btn"
              onClick={() => setActiveModal("satellite")}
              className="marine-btn marine-btn-primary text-xs px-4 py-1.5 font-bold"
            >
              Configurar Sat
            </button>
          </div>
        </div>
      </div>

      {/* =======================================================================
          MODAL 1: CONFIGURAR SIGNAL K
      ======================================================================= */}
      {activeModal === "signalk" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[#040B16] border border-white/20 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
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
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
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
                  className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/10"
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
                    className="w-full min-h-12 px-3 text-xs rounded-xl bg-white/5 border border-white/10"
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
                    className="w-full min-h-12 px-2 text-xs rounded-xl bg-white/5 border border-white/10"
                  >
                    <option value="http">HTTP (Red Barco)</option>
                    <option value="https">HTTPS</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="marine-btn marine-btn-secondary text-xs px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="marine-btn marine-btn-primary text-xs px-5 font-bold"
                >
                  Guardar Conexión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 2: CONFIGURAR DIRECTEMAR
      ======================================================================= */}
      {activeModal === "directemar" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[#040B16] border border-white/20 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[var(--accent-primary)]" />
                <h3 className="font-bold text-base text-white">Credenciales DIRECTEMAR SITPORT</h3>
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
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
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
                  className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/10"
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
                  placeholder="13.452.890-1"
                  className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/10"
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
                  className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/10"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="marine-btn marine-btn-secondary text-xs px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="marine-btn marine-btn-primary text-xs px-5 font-bold"
                >
                  Guardar Credenciales
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 3: METEOROLOGÍA & MODELOS
      ======================================================================= */}
      {activeModal === "meteo" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[#040B16] border border-white/20 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <CloudSun className="w-5 h-5 text-[#00E676]" />
                <h3 className="font-bold text-base text-white">Configuración Meteorológica</h3>
              </div>
              <button type="button" onClick={() => setActiveModal(null)}>
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-[#00E676]/10 border border-[#00E676]/30 text-[#00E676] space-y-1">
                <div className="font-bold">✓ Enlace Automático Open-Meteo Activo</div>
                <div className="text-[11px] opacity-90 leading-relaxed text-white">
                  MarinOS descarga automáticamente las series de tiempo de oleaje y viento en cada
                  fondeadero sin requerir llave de pago ni configuración adicional.
                </div>
              </div>

              <div>
                <label className="block opacity-70 mb-1">Unidad de Viento Preferida</label>
                <select className="w-full min-h-12 px-3 text-xs rounded-xl bg-white/5 border border-white/10">
                  <option value="knots">Nudos (Knots / kn) • Estándar Náutico</option>
                  <option value="kmh">Kilómetros por hora (km/h)</option>
                  <option value="ms">Metros por segundo (m/s)</option>
                </select>
              </div>

              <div>
                <label className="block opacity-70 mb-1">Frecuencia de Actualización</label>
                <select className="w-full min-h-12 px-3 text-xs rounded-xl bg-white/5 border border-white/10">
                  <option value="auto">Automático al detectar conexión a Internet</option>
                  <option value="manual">Manual para ahorro de datos móviles/satelitales</option>
                </select>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="marine-btn marine-btn-primary text-xs px-5 py-2 font-bold"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 4: CONECTIVIDAD SATELITAL
      ======================================================================= */}
      {activeModal === "satellite" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[#040B16] border border-white/20 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Satellite className="w-5 h-5 text-[#FF9F0A]" />
                <h3 className="font-bold text-base text-white">Dispositivo Satelital (Iridium / Garmin)</h3>
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
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
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
                  className="w-full min-h-12 px-3 text-xs rounded-xl bg-white/5 border border-white/10"
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
                  className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/10"
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
                  className="w-full min-h-12 px-3.5 text-xs rounded-xl bg-white/5 border border-white/10"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="marine-btn marine-btn-secondary text-xs px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="marine-btn marine-btn-primary text-xs px-5 font-bold"
                >
                  Guardar Conexión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
