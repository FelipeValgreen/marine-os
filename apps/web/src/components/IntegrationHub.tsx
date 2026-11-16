"use client";

import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Radio,
  Sliders,
  Shield,
  Satellite,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Save,
  Wifi,
  Key,
  Terminal,
} from "lucide-react";
import {
  db,
  INTEGRATION_SETTINGS_ID,
  createDefaultIntegrationSettings,
  enqueueOfflineMutation,
  type IntegrationSettingsRecord,
  type IntegrationTestResult,
} from "@/lib/offline/db";
import {
  testSignalKGateway,
  validateDirectemarConfig,
  testSatelliteLink,
  isMixedContentBlocked,
} from "@/lib/integrations";
import { useMarineContext } from "@/components/ThemeProvider";

export function IntegrationHub() {
  const { theme, pushToast } = useMarineContext();
  const isNight = theme === "night-red-shift";

  const liveSettings = useLiveQuery(
    () => db.integration_settings.get(INTEGRATION_SETTINGS_ID),
    []
  );

  const [formData, setFormData] = useState<IntegrationSettingsRecord>(
    createDefaultIntegrationSettings()
  );
  const [testingSignalK, setTestingSignalK] = useState(false);
  const [testingDirectemar, setTestingDirectemar] = useState(false);
  const [testingSatellite, setTestingSatellite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (liveSettings) {
      setFormData(liveSettings);
    }
  }, [liveSettings]);

  const handleSaveAll = async (overrideData?: IntegrationSettingsRecord) => {
    setIsSaving(true);
    const toSave: IntegrationSettingsRecord = {
      ...(overrideData || formData),
      id: INTEGRATION_SETTINGS_ID,
      updated_at: new Date().toISOString(),
    };
    try {
      await db.integration_settings.put(toSave);
      await enqueueOfflineMutation({
        table_name: "integration_settings",
        operation: "UPSERT",
        record_id: INTEGRATION_SETTINGS_ID,
        payload: toSave as unknown as Record<string, unknown>,
      });
      setFormData(toSave);
      pushToast({
        title: "Integraciones Guardadas",
        subtitle: "Configuración persistida en IndexedDB y cola de sincronización",
        tone: "emerald",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
        title:
          res.status === "ok"
            ? "Signal K: Conexión Exitosa"
            : res.status === "warning"
            ? "Signal K: Advertencia"
            : "Signal K: Error de Conexión",
        subtitle: res.message,
        tone: res.status === "ok" ? "emerald" : res.status === "warning" ? "amber" : "coral",
      });
    } finally {
      setTestingSignalK(false);
    }
  };

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
        title: res.status === "error" ? "DIRECTEMAR: Error en Datos" : "DIRECTEMAR: Validado",
        subtitle: res.message,
        tone: res.status === "error" ? "coral" : "amber",
      });
    } finally {
      setTestingDirectemar(false);
    }
  };

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
        title:
          res.status === "ok"
            ? "Satelital: Enlace Detectado"
            : res.status === "warning"
            ? "Satelital: Aviso de Red"
            : "Satelital: Error",
        subtitle: res.message,
        tone: res.status === "ok" ? "emerald" : res.status === "warning" ? "amber" : "coral",
      });
    } finally {
      setTestingSatellite(false);
    }
  };

  const renderBadge = (test: IntegrationTestResult) => {
    if (test.status === "ok") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold mo-tint-ok">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>CONECTADO / OK</span>
        </span>
      );
    }
    if (test.status === "warning") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold mo-tint-warn">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>ADVERTENCIA</span>
        </span>
      );
    }
    if (test.status === "error") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold mo-tint-danger">
          <XCircle className="w-3.5 h-3.5" />
          <span>ERROR</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold mo-tint-muted">
        <HelpCircle className="w-3.5 h-3.5" />
        <span>SIN PROBAR</span>
      </span>
    );
  };

  const mixedContentSignalK = isMixedContentBlocked(formData.signalk.protocol);

  return (
    <div data-testid="integration-hub-view" className="space-y-6">
      {/* Top Banner */}
      <div className="marine-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[var(--accent-primary)]" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Integration Hub &amp; Enlaces de Bordo
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-mono opacity-70 mt-1">
            Conecta la instrumentación real del barco: bus NMEA 2000, e-Zarpe gubernamental y respaldo satelital.
          </p>
        </div>

        <button
          type="button"
          data-testid="save-all-integrations-btn"
          onClick={() => handleSaveAll()}
          disabled={isSaving}
          className="marine-btn marine-btn-primary text-xs sm:text-sm px-5 shrink-0 self-start sm:self-auto"
        >
          {isSaving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Guardar Configuración</span>
        </button>
      </div>

      {/* 3 Integration Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CARD 1: NMEA 2000 / SIGNAL K */}
        <div className="marine-card p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isNight
                      ? "bg-[#FF0000] text-black"
                      : "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30"
                  }`}
                >
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Gateway NMEA 2000</h2>
                  <div className="text-[10px] font-mono opacity-65">SIGNAL K BRIDGE</div>
                </div>
              </div>
              {renderBadge(formData.signalk.last_test)}
            </div>

            <p className="text-xs opacity-75">
              Conexión directa por Wi-Fi o Ethernet al multiplexor del barco (ej. Yacht Devices, Actisense W2K, Raspberry Pi con Venus OS o Signal K Server).
            </p>

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <span className="text-xs font-semibold">Habilitar Gateway Local</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.signalk.enabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        signalk: { ...formData.signalk, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]" />
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                  Protocolo
                </label>
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
                  className="w-full min-h-14 px-3.5 text-sm font-mono"
                >
                  <option value="http">HTTP (Estándar en redes locales de barco)</option>
                  <option value="https">HTTPS (Seguro con certificado SSL)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    IP / Host del Gateway
                  </label>
                  <input
                    type="text"
                    value={formData.signalk.host}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        signalk: { ...formData.signalk, host: e.target.value },
                      })
                    }
                    placeholder="192.168.1.100"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Puerto
                  </label>
                  <input
                    type="number"
                    value={formData.signalk.port}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        signalk: {
                          ...formData.signalk,
                          port: Number(e.target.value) || 3000,
                        },
                      })
                    }
                    placeholder="3000"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
              </div>

              {mixedContentSignalK && (
                <div className="p-3 rounded-xl mo-tint-warn text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Mixed Content en Producción</span>
                  </div>
                  <p className="opacity-85 text-[11px]">
                    Si accedes a MarinOS por HTTPS en Vercel, el navegador bloquea peticiones a IPs HTTP locales. Para conectar el NMEA 2000 real usa MarinOS en red local o configura HTTPS en el gateway.
                  </p>
                </div>
              )}

              {formData.signalk.last_test.message && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs opacity-85">
                  <div className="text-[10px] opacity-60 uppercase mb-0.5">Última Prueba</div>
                  <div>{formData.signalk.last_test.message}</div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            data-testid="test-signalk-btn"
            onClick={handleTestSignalK}
            disabled={testingSignalK}
            className="w-full marine-btn marine-btn-secondary text-xs font-semibold"
          >
            {testingSignalK ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
            ) : (
              <Wifi className="w-4 h-4 text-[var(--accent-primary)]" />
            )}
            <span>Probar Conexión Gateway (NMEA 2000)</span>
          </button>
        </div>

        {/* CARD 2: DIRECTEMAR E-ZARPE */}
        <div className="marine-card p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isNight
                      ? "bg-[#FF0000] text-black"
                      : "bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30"
                  }`}
                >
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Autoridad Marítima</h2>
                  <div className="text-[10px] font-mono opacity-65">DIRECTEMAR E-ZARPE</div>
                </div>
              </div>
              {renderBadge(formData.directemar.last_test)}
            </div>

            <p className="text-xs opacity-75">
              Credenciales oficiales para transmitir telemáticamente el rol de tripulación y el despacho de zarpe ante la Gobernación Marítima.
            </p>

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <span className="text-xs font-semibold">Integración e-Zarpe Activa</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.directemar.enabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        directemar: {
                          ...formData.directemar,
                          enabled: e.target.checked,
                        },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]" />
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                  Ambiente
                </label>
                <select
                  value={formData.directemar.environment}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      directemar: {
                        ...formData.directemar,
                        environment: e.target.value as "sandbox" | "production",
                      },
                    })
                  }
                  className="w-full min-h-14 px-3.5 text-sm font-mono"
                >
                  <option value="sandbox">Sandbox / Modo Pruebas de Mar</option>
                  <option value="production">Producción DIRECTEMAR</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                  RUT Armador / Capitán
                </label>
                <input
                  type="text"
                  value={formData.directemar.username}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      directemar: {
                        ...formData.directemar,
                        username: e.target.value,
                      },
                    })
                  }
                  placeholder="13.452.890-1"
                  className="w-full min-h-14 px-3.5 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                  API Key / Token Oficial
                </label>
                <input
                  type="password"
                  value={formData.directemar.api_key}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      directemar: {
                        ...formData.directemar,
                        api_key: e.target.value,
                      },
                    })
                  }
                  placeholder="••••••••••••••••"
                  className="w-full min-h-14 px-3.5 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                  Matrícula Asignada
                </label>
                <input
                  type="text"
                  value={formData.directemar.vessel_registration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      directemar: {
                        ...formData.directemar,
                        vessel_registration: e.target.value,
                      },
                    })
                  }
                  placeholder="CB-4582"
                  className="w-full min-h-14 px-3.5 text-sm font-mono"
                />
              </div>

              {formData.directemar.last_test.message && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs opacity-85">
                  <div className="text-[10px] opacity-60 uppercase mb-0.5">Estado Validación</div>
                  <div>{formData.directemar.last_test.message}</div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            data-testid="validate-directemar-btn"
            onClick={handleValidateDirectemar}
            disabled={testingDirectemar}
            className="w-full marine-btn marine-btn-secondary text-xs font-semibold"
          >
            {testingDirectemar ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#00E676]" />
            ) : (
              <Key className="w-4 h-4 text-[#00E676]" />
            )}
            <span>Validar Formato &amp; Credenciales</span>
          </button>
        </div>

        {/* CARD 3: SATÉLITE (IRIDIUM GO! / GARMIN INREACH) */}
        <div className="marine-card p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isNight
                      ? "bg-[#FF0000] text-black"
                      : "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30"
                  }`}
                >
                  <Satellite className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Comunicaciones Satelitales</h2>
                  <div className="text-[10px] font-mono opacity-65">IRIDIUM / INREACH</div>
                </div>
              </div>
              {renderBadge(formData.satellite.last_test)}
            </div>

            <p className="text-xs opacity-75">
              Enlace de emergencia para áreas sin cobertura 4G/5G en los canales patagónicos. Sincroniza tracks y envía alertas SBD / SMS.
            </p>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                  Dispositivo Satelital
                </label>
                <select
                  value={formData.satellite.provider}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      satellite: {
                        ...formData.satellite,
                        provider: e.target.value as "none" | "iridium_go" | "garmin_inreach",
                        enabled: e.target.value !== "none",
                      },
                    })
                  }
                  className="w-full min-h-14 px-3.5 text-sm font-medium"
                >
                  <option value="none">Desactivado (Solo Wi-Fi / Celular)</option>
                  <option value="iridium_go">Iridium GO! / GO! exec (Wi-Fi Local)</option>
                  <option value="garmin_inreach">Garmin inReach (MapShare)</option>
                </select>
              </div>

              {formData.satellite.provider === "iridium_go" && (
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    IP Wi-Fi del Iridium GO!
                  </label>
                  <input
                    type="text"
                    value={formData.satellite.iridium_host}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        satellite: {
                          ...formData.satellite,
                          iridium_host: e.target.value,
                        },
                      })
                    }
                    placeholder="192.168.10.1"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
              )}

              {formData.satellite.provider === "garmin_inreach" && (
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Garmin MapShare ID
                  </label>
                  <input
                    type="text"
                    value={formData.satellite.mapshare_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        satellite: {
                          ...formData.satellite,
                          mapshare_id: e.target.value,
                        },
                      })
                    }
                    placeholder="CapValverde (share.garmin.com/CapValverde)"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
              )}

              {formData.satellite.provider !== "none" && (
                <>
                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      IMEI del Dispositivo (15 dígitos)
                    </label>
                    <input
                      type="text"
                      value={formData.satellite.device_imei}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          satellite: {
                            ...formData.satellite,
                            device_imei: e.target.value,
                          },
                        })
                      }
                      placeholder="300234063901230"
                      className="w-full min-h-14 px-3.5 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                      Contacto de Emergencia Terrestre
                    </label>
                    <input
                      type="text"
                      value={formData.satellite.emergency_contact}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          satellite: {
                            ...formData.satellite,
                            emergency_contact: e.target.value,
                          },
                        })
                      }
                      placeholder="+56 9 8765 4321 (Armador / Base)"
                      className="w-full min-h-14 px-3.5 text-sm font-mono"
                    />
                  </div>
                </>
              )}

              {formData.satellite.last_test.message && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs opacity-85">
                  <div className="text-[10px] opacity-60 uppercase mb-0.5">Estado Satelital</div>
                  <div>{formData.satellite.last_test.message}</div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            data-testid="test-satellite-btn"
            onClick={handleTestSatellite}
            disabled={testingSatellite || formData.satellite.provider === "none"}
            className="w-full marine-btn marine-btn-secondary text-xs font-semibold disabled:opacity-40"
          >
            {testingSatellite ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#00E5FF]" />
            ) : (
              <Terminal className="w-4 h-4 text-[#00E5FF]" />
            )}
            <span>Probar Conexión Satelital</span>
          </button>
        </div>
      </div>
    </div>
  );
}
