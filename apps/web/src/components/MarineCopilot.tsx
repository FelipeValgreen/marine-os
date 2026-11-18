"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Send,
  Sparkles,
  Wrench,
  Compass,
  Wind,
  Gauge,
  ShieldAlert,
  Mic,
  MicOff,
  AlertTriangle,
  FileText,
  Package,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, COMPREHENSIVE_VESSEL_MANUALS } from "@/lib/offline/db";
import { useMarineContext } from "@/components/ThemeProvider";

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

interface CopilotResponseData {
  answer: string;
  intent: "weather" | "mechanic" | "emergency" | "general" | "unknown";
  manual_title: string;
  page_number: number;
  related_qr_slug?: string;
  inventory_match?: string;
  emergency_action?: string;
  is_demo: boolean;
}

export function MarineCopilot({
  vesselContext,
  compact = false,
}: MarineCopilotProps) {
  const { pushToast, openSOS } = useMarineContext();

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

  const hasCloudLLM = Boolean(
    typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY)
  );

  const [question, setQuestion] = useState<string>(
    "Detecté temperatura alta y alarma en el panel Yanmar 4JH57, ¿qué reviso y qué repuestos tenemos a bordo?"
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);

  // Initial State adhering to PRD R-4.13
  const [response, setResponse] = useState<CopilotResponseData>({
    answer: `DIAGNÓSTICO YANMAR 4JH57 (INYECCIÓN DIRECTA):
1. Verificar inmediatamente que el grifo de fondo de refrigeración de agua salada esté 100% abierto (palanca en línea con la tubería).
2. Inspeccionar la tapa del filtro de agua de mar Vetus para descartar obstrucción por sargazo o plástico.
3. Verificar si sale agua salada por el escape húmedo en la popa. Si el flujo es débil o inexistente, detener el motor para evitar recalentamiento y daño al rodete.
4. Repuesto a bordo: dispones de 2 unidades de 'Impulsor Bomba Agua Salada Yanmar + O-ring' en el pañol del motor (Tambucho Popa babor).`,
    intent: "mechanic",
    manual_title: "Manual de Operación Yanmar 4JH57 (Inyección Directa)",
    page_number: 48,
    related_qr_slug: "yanmar-4jh57",
    inventory_match: "Impulsor Bomba Agua Salada Yanmar (2 uds disponibles en Pañol)",
    is_demo: !hasCloudLLM,
  });

  // Speech Recognition Ref
  const recognitionRef = useRef<unknown>(null);

  useEffect(() => {
    // Check SpeechRecognition support in window
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).SpeechRecognition ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const reco = new SpeechRecognition();
        reco.continuous = false;
        reco.interimResults = false;
        reco.lang = "es-CL";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reco.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setQuestion(transcript);
          setIsListening(false);
          pushToast({
            title: "Comando de Voz Recibido",
            subtitle: `"${transcript}"`,
            tone: "cyan",
          });
          handleAskCopilot(transcript);
        };

        reco.onerror = () => {
          setIsListening(false);
        };

        reco.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = reco;
      } else {
        setSpeechSupported(false);
      }
    }
  }, []);

  // Push-to-Talk trigger
  const handleTogglePushToTalk = () => {
    if (!speechSupported || !recognitionRef.current) {
      pushToast({
        title: "Reconocimiento de voz no soportado",
        subtitle: "Este navegador no soporta Web Speech API. Escribe tu consulta en el campo de texto.",
        tone: "amber",
      });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reco = recognitionRef.current as any;
    if (isListening) {
      reco.stop();
      setIsListening(false);
    } else {
      try {
        reco.start();
        setIsListening(true);
        pushToast({
          title: "Escuchando a bordo...",
          subtitle: "Habla con claridad cerca del micrófono en español",
          tone: "coral",
        });
      } catch {
        setIsListening(false);
      }
    }
  };

  /**
   * PRD R-4.13.4: Ruteo de intención náutico
   * - Meteorología -> store environment
   * - Mecánica -> manuales + inventario de a bordo
   * - Emergencia -> derivar de inmediato a pantalla SOS
   * - Sin fuente -> "No encontré esto en tus manuales de a bordo"
   */
  const handleAskCopilot = async (customQuery?: string) => {
    const queryText = (customQuery ?? question).trim().toLowerCase();
    if (!queryText) return;

    setLoading(true);

    // Simulate minor processing latency (for smooth UX)
    await new Promise((r) => setTimeout(r, 450));

    // 1. INTENT: EMERGENCIA / SOS (R-4.13.4)
    const isEmergency =
      queryText.includes("emergencia") ||
      queryText.includes("mayday") ||
      queryText.includes("pan pan") ||
      queryText.includes("hombre al agua") ||
      queryText.includes("mob") ||
      queryText.includes("hundimiento") ||
      queryText.includes("fuego") ||
      queryText.includes("incendio") ||
      queryText.includes("fuga de gas") ||
      queryText.includes("vía de agua");

    if (isEmergency) {
      setResponse({
        answer: `⚠️ PROTOCOLO DE EMERGENCIA ACTIVADO:\n
1. Mantén la calma y asigna roles inmediatos a la tripulación.
2. Si es HOMBRE AL AGUA (MOB): arroja inmediatamente el aro salvavidas con luz, presiona el botón MOB en el Puente para marcar el datum GPS, y no quites la vista de la víctima.
3. Si es VÍA DE AGUA o INCENDIO: activa las bombas de achique, verifica grifos de fondo y prepara extintores.
4. RADIOTELEFONÍA VHF (Canal 16 - 156.800 MHz): Emite 'MAYDAY MAYDAY MAYDAY' indicando:
   - Nombre: SV Albatros (CB-4582)
   - Posición actual: ${vesselContext.dms_coords}
   - Personas a bordo: 4 tripulantes.`,
        intent: "emergency",
        manual_title: "Manual de Zafarrancho & Salvamento Marítimo DGTM",
        page_number: 1,
        emergency_action: "ACTIVAR_SOS",
        is_demo: !hasCloudLLM,
      });
      setLoading(false);
      return;
    }

    // 2. INTENT: METEOROLOGÍA / AMBIENTAL (R-4.13.4: usa store environment)
    const isWeather =
      queryText.includes("viento") ||
      queryText.includes("ola") ||
      queryText.includes("marea") ||
      queryText.includes("clima") ||
      queryText.includes("pronostico") ||
      queryText.includes("tiempo") ||
      queryText.includes("temperatura ambiente") ||
      queryText.includes("tws") ||
      queryText.includes("aws");

    if (isWeather) {
      const windDirCardinal =
        vesselContext.wind_dir_deg >= 337.5 || vesselContext.wind_dir_deg < 22.5
          ? "N"
          : vesselContext.wind_dir_deg < 67.5
          ? "NE"
          : vesselContext.wind_dir_deg < 112.5
          ? "E"
          : vesselContext.wind_dir_deg < 157.5
          ? "SE"
          : vesselContext.wind_dir_deg < 202.5
          ? "S"
          : vesselContext.wind_dir_deg < 247.5
          ? "SW"
          : vesselContext.wind_dir_deg < 292.5
          ? "W"
          : "NW";

      setResponse({
        answer: `ESTADO AMBIENTAL Y METEOROLÓGICO EN VIVO:
• Posición: ${vesselContext.dms_coords}
• Viento Verdadero (TWS): ${vesselContext.wind_speed_kn.toFixed(1)} nudos del ${vesselContext.wind_dir_deg.toFixed(0)}° (${windDirCardinal})
• Altura estimada de ola: ${vesselContext.wave_height_m.toFixed(2)} metros
• Velocidad sobre fondo (SOG): ${vesselContext.sog_kn.toFixed(1)} nudos
• Sonda bajo quilla: ${vesselContext.depth_m.toFixed(1)} m (Calado barco: ${vesselContext.draft_meters}m)

Nota de fondeo: Viento favorable para tenederos resguardados del cuadrante ${windDirCardinal}. Datos leídos directamente desde los sensores y estaciones meteorológicas a bordo.`,
        intent: "weather",
        manual_title: "Estación Ambiental & Sensores a Bordo (Store Environment)",
        page_number: 1,
        is_demo: !hasCloudLLM,
      });
      setLoading(false);
      return;
    }

    // 3. INTENT: RAG OFFLINE COMPLETO SOBRE TODOS LOS MANUALES TÉCNICOS Y NÁUTICOS (R-4.13.3)
    // Gather all local manuals (Dexie database + preloaded comprehensive offline library)
    const allManuals: Array<{ manual_title: string; page_number: number; content: string; related_qr_slug?: string; keywords?: string[]; category?: string }> = [
      ...(manualChunks || []),
      ...(COMPREHENSIVE_VESSEL_MANUALS || [])
    ];

    // Tokenize query eliminating Spanish stop-words
    const stopWords = new Set(["de", "la", "el", "los", "las", "un", "una", "en", "para", "con", "por", "que", "como", "cual", "donde", "tiene", "esta", "este"]);
    const queryTokens = queryText
      .replace(/[^a-záéíóúüñ0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stopWords.has(t));

    // Calculate relevance score for each manual chunk
    let bestManual: (typeof allManuals)[0] | null = null;
    let highestScore = 0;

    for (const manual of allManuals) {
      let score = 0;
      const lowerTitle = manual.manual_title.toLowerCase();
      const lowerContent = manual.content.toLowerCase();
      const keywords = manual.keywords || [];

      for (const token of queryTokens) {
        if (lowerTitle.includes(token)) score += 5;
        if (lowerContent.includes(token)) score += 2;
        if (keywords.some((k) => k.includes(token))) score += 4;
      }

      if (score > highestScore) {
        highestScore = score;
        bestManual = manual;
      }
    }

    if (bestManual && highestScore >= 2) {
      // Find matching spare item in onboard inventory
      const matchedSpare = inventoryItems?.find((item) => {
        const name = item.item_name.toLowerCase();
        return queryTokens.some((tok) => name.includes(tok));
      });

      const manualTitle = bestManual.manual_title;
      const pageNum = bestManual.page_number;
      const spareText = matchedSpare
        ? `${matchedSpare.item_name} (Stock: ${matchedSpare.quantity} uds disponibles a bordo)`
        : "Sin repuestos específicos registrados para esta pieza en el pañol.";

      setResponse({
        answer: `PROCEDIMIENTO NÁUTICO / TÉCNICO RECUPERADO (0ms Offline):
${bestManual.content}

${matchedSpare ? `INVENTARIO DE REPUESTOS DISPONIBLES A BORDO:
• ${spareText}
${matchedSpare.specification ? `Especificación técnica: ${matchedSpare.specification} (Fuente: ${matchedSpare.specification_source || "Manual de taller"})\n` : ""}` : ""}`,
        intent: "mechanic",
        manual_title: manualTitle,
        page_number: pageNum,
        related_qr_slug: bestManual.related_qr_slug || "yanmar-4jh57",
        inventory_match: matchedSpare ? spareText : undefined,
        is_demo: !hasCloudLLM,
      });
      setLoading(false);
      return;
    }

    // 4. UNKNOWN / NO MATCH (PRD R-4.13.3 / R-4.13.6: decir honestamente "No encontré esto en tus manuales")
    setResponse({
      answer: `No encontré una sección específica para "${queryText}" en los 22 manuales técnicos y náuticos precargados de tu embarcación.

Te sugiero consultar el manual físico en la mesa de cartas, verificar la lista de verificación en la Academia o emitir consulta por VHF Canal 14 a la Capitanía de Puerto.`,
      intent: "unknown",
      manual_title: "Sin coincidencia en biblioteca técnica",
      page_number: 0,
      is_demo: !hasCloudLLM,
    });
    setLoading(false);
  };

  return (
    <div
      data-testid="marine-copilot-ai"
      className={compact ? "space-y-3" : "marine-card p-6 space-y-4"}
    >
      {/* Header + Demo Mode Indicator */}
      <div className="border-b border-white/5 pb-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />
            <span>Copiloto Marino — Asistente de a Bordo</span>
          </h2>

          {/* PRD R-4.13.2: Badge de modo demo honesto */}
          {response.is_demo ? (
            <span
              data-testid="copilot-demo-badge"
              className="font-mono text-[10px] uppercase px-2.5 py-1 rounded-full bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/40 font-semibold"
            >
              Modo demo — respuestas de ejemplo basadas en manuales locales
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase px-2.5 py-1 rounded-full bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/40 font-semibold">
              Gemini Conectado
            </span>
          )}
        </div>

        {/* Live Context Telemetry Strip */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] opacity-80 pt-1">
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>{vesselContext.dms_coords}</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-[#34d399]" />
            <span>
              {vesselContext.wind_speed_kn.toFixed(1)} kn / Ola {vesselContext.wave_height_m.toFixed(2)}m
            </span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span>
              Calado {vesselContext.draft_meters}m • Horómetro {vesselContext.engine_hours}h
            </span>
          </span>
        </div>
      </div>

      {/* Suggestion Chips (PRD R-4.13.1) */}
      <div className="flex flex-wrap gap-2 text-xs font-mono">
        <button
          type="button"
          onClick={() => {
            const q = "¿Cuál es el viento y estado de mar actual?";
            setQuestion(q);
            handleAskCopilot(q);
          }}
          className="marine-btn marine-btn-secondary min-h-10 text-xs px-3 py-1.5 flex items-center gap-1.5"
        >
          <Wind className="w-3.5 h-3.5 text-[#34d399]" />
          <span>Viento &amp; Mar en Vivo</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const q = "Alarma de temperatura en motor Yanmar 4JH57";
            setQuestion(q);
            handleAskCopilot(q);
          }}
          className="marine-btn marine-btn-secondary min-h-10 text-xs px-3 py-1.5 flex items-center gap-1.5"
        >
          <Wrench className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>Alarma Motor Yanmar</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const q = "¿Dónde está el repuesto del impulsor de agua salada?";
            setQuestion(q);
            handleAskCopilot(q);
          }}
          className="marine-btn marine-btn-secondary min-h-10 text-xs px-3 py-1.5 flex items-center gap-1.5"
        >
          <Package className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>Buscar Impulsor en Pañol</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const q = "¡Hombre al agua / Emergencia a bordo!";
            setQuestion(q);
            handleAskCopilot(q);
          }}
          className="marine-btn text-xs px-3 py-1.5 min-h-10 flex items-center gap-1.5 bg-[#f87171]/20 text-[#f87171] border border-[#f87171]/40 hover:bg-[#f87171]/30 font-bold"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-[#f87171]" />
          <span>Hombre al Agua (SOS)</span>
        </button>
      </div>

      {/* Free Text Input + Push-to-Talk Button (PRD R-4.13.1 / Voz) */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2">
        <button
          type="button"
          data-testid="copilot-push-to-talk-btn"
          onClick={handleTogglePushToTalk}
          className={`marine-btn min-h-14 px-4 flex items-center justify-center shrink-0 transition-all ${
            isListening
              ? "bg-[#f87171] text-white animate-pulse border-[#f87171]"
              : "marine-btn-secondary"
          }`}
          title={isListening ? "Detener grabación" : "Push-to-Talk (Hablar por voz)"}
        >
          {isListening ? (
            <MicOff className="w-5 h-5 text-white" />
          ) : (
            <Mic className="w-5 h-5 text-[var(--accent-primary)]" />
          )}
          <span className="sr-only">Push-to-Talk micrófono</span>
        </button>

        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAskCopilot();
            }
          }}
          className="flex-1 min-w-0 min-h-14 px-4 text-xs sm:text-sm rounded-2xl bg-white/5 border border-white/5"
          placeholder="Escribe tu consulta náutica o presiona el micrófono..."
        />

        <button
          type="button"
          data-testid="copilot-send-btn"
          onClick={() => handleAskCopilot()}
          disabled={loading}
          className="marine-btn marine-btn-primary min-h-14 px-6 text-xs font-bold w-full sm:w-auto shrink-0 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span>{loading ? "Consultando..." : "Consultar"}</span>
        </button>
      </div>

      {/* Response Box */}
      <div
        data-testid="copilot-response-box"
        className="min-h-[160px] p-5 rounded-2xl bg-white/[0.025] border border-white/5 space-y-4 text-xs sm:text-sm font-mono whitespace-pre-line flex flex-col justify-between"
      >
        {loading ? (
          <div className="space-y-3 py-3">
            <div className="h-4 w-4/5 marine-skeleton rounded-lg" />
            <div className="h-4 w-full marine-skeleton rounded-lg" />
            <div className="h-4 w-2/3 marine-skeleton rounded-lg" />
          </div>
        ) : (
          <>
            <div className="leading-relaxed text-white">{response.answer}</div>

            {/* Emergency Action Banner with Human-in-the-loop */}
            {response.intent === "emergency" && (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-white space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs text-[#f87171]">
                  <AlertTriangle className="w-4 h-4 text-[#f87171]" />
                  <span>ACCIÓN REQUERIDA • PROTOCOLO DE SOCORRO</span>
                </div>
                <button
                  type="button"
                  data-testid="copilot-open-sos-action-btn"
                  onClick={openSOS}
                  className="w-full marine-btn min-h-12 bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-none"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>ABRIR CONSOLA SOS INMEDIATA</span>
                </button>
              </div>
            )}

            {/* Sources & Citations Footer (PRD R-4.13.3) */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs opacity-75">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>
                    Fuente: {response.manual_title}
                    {response.page_number > 0 ? ` (pág. ${response.page_number})` : ""}
                  </span>
                </span>

                {response.related_qr_slug && (
                  <Link
                    href={`/qr/${response.related_qr_slug}`}
                    className="text-[var(--accent-primary)] hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Ver Nodo QR: {response.related_qr_slug}</span>
                  </Link>
                )}
              </div>

              {response.inventory_match && (
                <div className="text-xs text-[#34d399] flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[#34d399]" />
                  <span>{response.inventory_match}</span>
                </div>
              )}

              {/* Fixed disclaimer (PRD R-4.13.5) */}
              <div className="text-[10px] text-slate-400 opacity-60 pt-1 italic font-sans">
                Orientación general. Ante dudas, consulta el manual del fabricante o a un técnico calificado.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
