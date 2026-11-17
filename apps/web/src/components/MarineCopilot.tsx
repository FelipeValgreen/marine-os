"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Camera,
  Send,
  Sparkles,
  Wrench,
  X,
  Compass,
  Wind,
  Gauge,
  ShieldAlert,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, DEMO_IDS } from "@/lib/offline/db";
import { useMarineContext } from "@/components/ThemeProvider";
import { getApiBaseUrl } from "@/lib/api";

export interface CopilotTelemetryContext {
  lat: number;
  lon: number;
  dms_coords: string;
  wind_speed_kn: number;
  wind_dir_deg: number;
  wave_height_m: number;
  draft_meters: number;
  loa_meters: number;
  sog_kn: number;
  depth_m: number;
  rpm: number;
  coolant_temp_c: number;
  oil_pressure_kpa: number;
  alternator_voltage_v: number;
  engine_hours: number;
}

interface MarineCopilotProps {
  vesselContext: CopilotTelemetryContext;
  compact?: boolean;
}

export function MarineCopilot({
  vesselContext,
  compact = false,
}: MarineCopilotProps) {
  const { isOffline, pushToast } = useMarineContext();

  const manualChunks = useLiveQuery(
    () => db.vessel_manual_chunks.toArray(),
    [],
    []
  );
  const inventoryItems = useLiveQuery(
    () => db.inventory_items.toArray(),
    [],
    []
  );

  // YachtPass Warranty & Compliance Predictive Detection
  const warrantyAlertItem = inventoryItems?.find((item) => {
    if (item.warranty_max_hours) {
      const remainingHours = item.warranty_max_hours - vesselContext.engine_hours;
      return remainingHours <= 100;
    }
    return false;
  });

  const hoursRemaining = warrantyAlertItem?.warranty_max_hours
    ? warrantyAlertItem.warranty_max_hours - vesselContext.engine_hours
    : null;

  const [question, setQuestion] = useState<string>(
    "Detecté traza de aceite/refrigerante en la sentina y alarma en el panel Yanmar 4JH57, ¿qué maniobra y revisión ejecuto?"
  );
  const [attachedImageBase64, setAttachedImageBase64] = useState<string | null>(
    null
  );
  const [attachedImageLabel, setAttachedImageLabel] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(false);

  const [response, setResponse] = useState<{
    answer: string;
    manual_title: string;
    page_number: number;
    related_qr_slug: string;
    inventory_match: string;
    predictive_alert: string;
    multimodal_analyzed: boolean;
  }>({
    answer: `[TELEMETRÍA CONTEXTUAL EN VIVO: POS ${vesselContext.dms_coords} • Viento ${vesselContext.wind_speed_kn.toFixed(
      1
    )} kn • Calado ${vesselContext.draft_meters}m • Horómetro ${vesselContext.engine_hours
      }h]\n\nDIAGNÓSTICO YANMAR 4JH57: 1) Verificar grifo de fondo de agua salada abierto (palanca vertical bajo escalera del salón). 2) Limpiar filtro de agua de mar Vetus. 3) Tienes 2 unidades de 'Impulsor Bomba Agua Yanmar + Empaquetadura' vinculadas al nodo QR yanmar-4jh57.`,
    manual_title: "Manual Técnico Yanmar 4JH57 Common Rail (Sección 4.2)",
    page_number: 48,
    related_qr_slug: "yanmar-4jh57",
    inventory_match:
      "Impulsor Bomba Agua Yanmar + Empaquetadura (Stock: 2 uds)",
    predictive_alert: `Horómetro en ${vesselContext.engine_hours} hrs: Faltan ${(
      1500 - vesselContext.engine_hours
    ).toFixed(1)} hrs para servicio mayor de 1.500 hrs.`,
    multimodal_analyzed: false,
  });

  /**
   * Compresses an uploaded camera photo on the client to Base64 JPEG.
   */
  const handleCameraFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 560 / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL("image/jpeg", 0.72);
          setAttachedImageBase64(base64);
          setAttachedImageLabel(file.name);
          pushToast({
            title: "Foto Comprimida Lista para Análisis IA",
            subtitle: `${file.name} • Base64 JPEG 72%`,
            tone: "cyan",
          });
        }
      };
      if (typeof reader.result === "string") {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  /**
   * Generates a compressed diagnostic camera snapshot on client canvas for instant multimodal testing.
   */
  const handleSimulateDiagnosticCameraCapture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 440;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#040B16";
    ctx.fillRect(0, 0, 440, 240);

    ctx.strokeStyle = "#FF2D55";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 420, 220);

    ctx.fillStyle = "#FF2D55";
    ctx.font = "bold 15px monospace";
    ctx.fillText("CAMARA COPILOTO: SENTINA & ALARMA YANMAR", 22, 42);

    ctx.fillStyle = "#00E5FF";
    ctx.font = "12px monospace";
    ctx.fillText(`GPS: ${vesselContext.dms_coords}`, 22, 78);
    ctx.fillText(
      `VIENTO: ${vesselContext.wind_speed_kn.toFixed(1)} KN | CALADO: ${vesselContext.draft_meters
      }M`,
      22,
      104
    );
    ctx.fillText(
      `MOTOR: ${vesselContext.rpm} RPM | TEMP: ${vesselContext.coolant_temp_c.toFixed(
        1
      )} C | ${vesselContext.engine_hours}H`,
      22,
      130
    );
    ctx.fillStyle = "#FF9F0A";
    ctx.fillText(
      "DETECCION VISUAL: Goteo en reten bomba agua / prefiltro Racor",
      22,
      166
    );

    const compressed = canvas.toDataURL("image/jpeg", 0.72);
    const label = "Inspección Sentina & Alarma Panel Yanmar 4JH57";
    setAttachedImageBase64(compressed);
    setAttachedImageLabel(label);
    pushToast({
      title: "Foto Multimodal Capturada y Comprimida",
      subtitle: label,
      tone: "cyan",
    });
  };

  const handleAskCopilot = async (customQuery?: string) => {
    const queryText = customQuery ?? question;
    if (!queryText.trim()) return;

    const API_URL = getApiBaseUrl();
    setLoading(true);
    try {
      if (!isOffline) {
        const res = await fetch(`${API_URL}/api/v1/bosun/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: queryText,
            vessel_id: DEMO_IDS.VESSEL_ID,
            engine_hours: vesselContext.engine_hours,
            image_base64: attachedImageBase64,
            image_label: attachedImageLabel,
            context: {
              lat: vesselContext.lat,
              lon: vesselContext.lon,
              dms_coords: vesselContext.dms_coords,
              wind_speed_kn: vesselContext.wind_speed_kn,
              wind_dir_deg: vesselContext.wind_dir_deg,
              wave_height_m: vesselContext.wave_height_m,
              draft_meters: vesselContext.draft_meters,
              loa_meters: vesselContext.loa_meters,
              sog_kn: vesselContext.sog_kn,
              depth_m: vesselContext.depth_m,
              rpm: vesselContext.rpm,
              coolant_temp_c: vesselContext.coolant_temp_c,
              oil_pressure_kpa: vesselContext.oil_pressure_kpa,
              alternator_voltage_v: vesselContext.alternator_voltage_v,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setResponse({
            answer: data.answer,
            manual_title: data.citation.manual_title,
            page_number: data.citation.page_number,
            related_qr_slug: data.citation.related_qr_slug,
            inventory_match: data.citation.inventory_match,
            predictive_alert: data.predictive_alert,
            multimodal_analyzed: Boolean(data.multimodal_analyzed),
          });
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback to local offline RAG with injected context
    }

    const q = queryText.toLowerCase();
    const match =
      manualChunks.find((c) =>
        q.includes("racor") || q.includes("combustible")
          ? c.manual_title.toLowerCase().includes("racor")
          : q.includes("baño") || q.includes("jabsco")
            ? c.manual_title.toLowerCase().includes("jabsco")
            : q.includes("ancla") || q.includes("molinete")
              ? c.manual_title.toLowerCase().includes("molinete")
              : c.manual_title.toLowerCase().includes("yanmar")
      ) || manualChunks[0];

    const ukc = (vesselContext.depth_m - vesselContext.draft_meters).toFixed(2);
    const contextHeader = `[CONTEXTO OFFLINE INYECTADO: POS ${vesselContext.dms_coords} • Viento ${vesselContext.wind_speed_kn.toFixed(
      1
    )}kn • UKC ${ukc}m (Calado ${vesselContext.draft_meters}m) • Horómetro ${vesselContext.engine_hours
      }h]`;
    const visionNote = attachedImageBase64
      ? `\n[VISIÓN MULTIMODAL OFFLINE: Evidencia '${attachedImageLabel}' vinculada al diagnóstico]`
      : "";

    setResponse({
      answer: `${contextHeader}${visionNote}\n\n${match?.content ||
        "Verificar grifo de fondo abierto y revisar impulsor Yanmar 4JH57."
        }`,
      manual_title:
        match?.manual_title || "Manual Técnico Yanmar 4JH57 Common Rail",
      page_number: match?.page_number || 48,
      related_qr_slug: match?.related_qr_slug || "yanmar-4jh57",
      inventory_match:
        inventoryItems[0]?.item_name || "Impulsor Bomba Agua Yanmar (2 uds)",
      predictive_alert: `Horómetro Local: ${vesselContext.engine_hours} hrs.`,
      multimodal_analyzed: Boolean(attachedImageBase64),
    });
    setLoading(false);
  };

  return (
    <div
      data-testid="marine-copilot-ai"
      className={compact ? "space-y-3" : "marine-card p-6 space-y-4"}
    >
      {/* Header + Auto-Injected Telemetry Pills */}
      <div className="border-b border-white/5 pb-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />
            <span>Marine Copilot AI — Contextual & Multimodal RAG</span>
          </h2>
          <span className="font-mono text-[10px] uppercase px-2.5 py-1 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-semibold">
            Contexto Barco Inyectado
          </span>
        </div>

        {/* Live Context Telemetry Strip */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] opacity-80">
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 flex items-center gap-1">
            <Compass className="w-3 h-3 text-[#00E5FF]" />
            {vesselContext.dms_coords}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 flex items-center gap-1">
            <Wind className="w-3 h-3 text-[var(--status-ok)]" />
            {vesselContext.wind_speed_kn.toFixed(1)} kn / Ola{" "}
            {vesselContext.wave_height_m.toFixed(2)}m
          </span>
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-[var(--status-warn)]" />
            Calado {vesselContext.draft_meters}m • {vesselContext.engine_hours}h
          </span>
        </div>
      </div>

      {/* Alerta Predictiva de Garantía & Compliance (YachtPass Engine) */}
      {warrantyAlertItem && (
        <div
          data-testid="copilot-warranty-predictive-alert"
          className="p-3.5 sm:p-4 rounded-2xl bg-red-950/30 border border-red-800 text-white space-y-1.5 shadow-none"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#FF2D55] uppercase tracking-wide">
              <ShieldAlert className="w-4 h-4 text-[#FF2D55] shrink-0" />
              <span>ALERTA PREDICTIVA DE GARANTÍA • {warrantyAlertItem.warranty_provider || "OFICIAL"}</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FF2D55] text-white">
              LÍMITE PRÓXIMO
            </span>
          </div>

          <p className="text-xs font-mono leading-relaxed opacity-95">
            Horómetro actual en <strong>{vesselContext.engine_hours.toFixed(1)} hrs</strong>.
            La garantía de fábrica para <em>{warrantyAlertItem.item_name}</em> expira a las{" "}
            <strong>{warrantyAlertItem.warranty_max_hours} hrs</strong> (restan{" "}
            <strong className="text-[#FF2D55] underline">
              {hoursRemaining !== null ? Math.max(0, hoursRemaining).toFixed(1) : "0"} hrs
            </strong>{" "}
            sin servicio registrado). ¡Debes registrar el servicio oficial antes de alcanzar el hito
            para no anular la cobertura mundial del fabricante!
          </p>
        </div>
      )}

      {/* Quick Diagnostic Presets */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const q =
              "Sonó la alarma de temperatura del motor Yanmar 4JH57, ¿qué reviso?";
            setQuestion(q);
            handleAskCopilot(q);
          }}
          className="marine-btn marine-btn-secondary text-xs px-3"
        >
          <Wrench className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>Alarma Temperatura Yanmar</span>
        </button>
        <button
          type="button"
          onClick={() => {
            const q =
              "El motor pierde RPM por combustible o agua en filtro Racor R20P";
            setQuestion(q);
            handleAskCopilot(q);
          }}
          className="marine-btn marine-btn-secondary text-xs px-3"
        >
          <span>Filtro Racor R20P</span>
        </button>
        <button
          type="button"
          data-testid="copilot-camera-sim-btn"
          onClick={handleSimulateDiagnosticCameraCapture}
          className="marine-btn marine-btn-secondary text-xs px-3"
        >
          <Camera className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>Foto Alarma / Sentina (IA Vision)</span>
        </button>
      </div>

      {/* Attached Multimodal Photo Preview */}
      {attachedImageBase64 && (
        <div
          data-testid="copilot-image-preview"
          className="p-3 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={attachedImageBase64}
              alt={attachedImageLabel || "Evidencia Multimodal"}
              className="w-16 h-12 object-cover rounded-lg border border-white/20 shrink-0"
            />
            <div className="min-w-0 font-mono text-xs">
              <div className="font-semibold text-[var(--accent-primary)] truncate">
                {attachedImageLabel || "Foto Adjunta (Base64)"}
              </div>
              <div className="text-[11px] opacity-75">
                Se cruzará con los manuales técnicos y telemetría actual
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAttachedImageBase64(null);
              setAttachedImageLabel(null);
            }}
            className="min-h-14 w-14 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0"
            aria-label="Quitar imagen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input + Camera Upload + Send Button (all min-h-14 / 56px) */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2">
        <label
          title="Subir o tomar foto con cámara para diagnóstico multimodal"
          className="marine-btn marine-btn-secondary px-3.5 cursor-pointer shrink-0"
        >
          <Camera className="w-5 h-5 text-[var(--accent-primary)]" />
          <span className="sr-only">Adjuntar foto de cámara</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraFileSelect}
            className="hidden"
          />
        </label>

        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="flex-1 min-w-0 min-h-14 px-3.5 text-sm"
          placeholder="Describe la falla o adjunta foto de la alarma/sentina..."
        />

        <button
          type="button"
          data-testid="copilot-send-btn"
          onClick={() => handleAskCopilot()}
          disabled={loading}
          className="marine-btn marine-btn-primary text-xs w-full sm:w-auto shrink-0"
        >
          <Send className="w-4 h-4" />
          <span>{loading ? "Analizando..." : "Diagnosticar"}</span>
        </button>
      </div>

      {/* Fixed min-h-[172px] Response Container with Shimmer Skeleton (Zero Layout Shift) */}
      <div
        data-testid="copilot-response-box"
        className="min-h-[172px] p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs sm:text-sm font-mono whitespace-pre-line flex flex-col justify-between"
      >
        {loading ? (
          <div className="space-y-2.5 py-2">
            <div className="h-4 w-4/5 marine-skeleton" />
            <div className="h-4 w-full marine-skeleton" />
            <div className="h-4 w-5/6 marine-skeleton" />
            <div className="h-4 w-2/3 marine-skeleton mt-3" />
          </div>
        ) : (
          <>
            <div className="leading-relaxed">{response.answer}</div>
            <div className="pt-2 border-t border-white/5 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs opacity-80">
                <span>
                  {response.manual_title} (Pág. {response.page_number})
                </span>
                <Link
                  href={`/qr/${response.related_qr_slug}`}
                  className="text-[var(--accent-primary)] underline font-semibold"
                >
                  Ver Nodo QR: {response.related_qr_slug}
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[var(--status-ok)]">
                  Repuesto a bordo: {response.inventory_match}
                </span>
                {response.multimodal_analyzed && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[10px]">
                    VISIÓN IA + RAG VERIFICADO
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
